import pkg from '../package.json'
import { realpathSync } from 'fs'
import { readFile, readdir, stat } from 'fs/promises'
import { basename, dirname, extname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import pMap from 'p-map'
import { LRUCache } from 'lru-cache'

// Apply MYCLAUDE_* env var aliases before any code reads them
import { applyEnvAliases } from './utils/envCompat.js'
applyEnvAliases()

type MacroConfig = {
  VERSION: string
  BUILD_TIME: string
  PACKAGE_URL: string
  NATIVE_PACKAGE_URL: string
  VERSION_CHANGELOG: string
  ISSUES_EXPLAINER: string
  FEEDBACK_CHANNEL: string
}

const defaultMacro: MacroConfig = Object.freeze({
  VERSION: pkg.version,
  BUILD_TIME: '',
  PACKAGE_URL: pkg.name,
  NATIVE_PACKAGE_URL: pkg.name,
  VERSION_CHANGELOG: '',
  ISSUES_EXPLAINER:
    'file an issue at https://github.com/thomaslwq/myclaude/issues',
  FEEDBACK_CHANNEL: 'github',
})

/**
 * Module-level singleton for the MACRO config (issue #843).
 *
 * The previous implementation used a check-then-set pattern
 * (`if (!('MACRO' in globalThis)) globalThis.MACRO = defaultMacro`),
 * which is a race condition across async boundaries: two concurrent
 * initializers can both observe the absence and both assign, and the shared
 * mutable `defaultMacro` reference could be mutated by any consumer
 * (e.g. `globalThis.MACRO.VERSION = 'x'`), affecting all consumers.
 *
 * This implementation:
 * - Freezes `defaultMacro` so consumers cannot mutate shared state.
 * - Uses a module-level singleton (`macroSingleton`) that is assigned exactly
 *   once at module load time. Module evaluation is single-threaded in JS, so
 *   the assignment is atomic with respect to async boundaries.
 * - Exposes `MACRO` as a stable export backed by the singleton, and mirrors it
 *   onto `globalThis` (also frozen) for legacy consumers that read the global.
 */
const macroSingleton: MacroConfig = defaultMacro

// Mirror onto globalThis for legacy consumers, but only if not already set.
// The singleton above is the source of truth; this is a best-effort fallback.
// The property remains writable/configurable so tests can swap in mock
// MACRO objects, but the default value itself is frozen, preventing
// accidental mutation of shared state by consumers.
if (!(globalThis as typeof globalThis & { MACRO?: MacroConfig }).MACRO) {
  ;(globalThis as typeof globalThis & { MACRO: MacroConfig }).MACRO =
    macroSingleton
}

export const MACRO: MacroConfig = macroSingleton

export type MissingImport = {
  importer: string
  specifier: string
}

const SCAN_CACHE_TTL_MS = 60_000 // 1 minute TTL for scan cache

// Cache for file contents to avoid re-reading unchanged files
export const fileContentCache = new LRUCache<string, { content: string; mtime: number }>({ max: 1000 })

// Cache for directory scan results to avoid full re-scan on every call
// Used in the fallback path when git diff is not available
// Note: Uses isScanCacheEntryFresh with SCAN_CACHE_TTL_MS (60s) plus a recursive
// mtime signature (issue #852) to ensure fresh results after filesystem changes
// in any subdirectory, not just the top-level directory.
export const scanCache = new LRUCache<string, { files: string[]; timestamp: number; mtimeSignature?: string }>({ max: 1000 })

/**
 * Compute a recursive mtime signature for a directory tree.
 *
 * A directory's own mtime only changes when entries are directly added or
 * removed in that directory — not when files in subdirectories are modified,
 * added, or deleted (issue #852). Since scanFiles recurses into
 * subdirectories, checking only the top-level directory's mtime misses
 * changes in nested subdirectories.
 *
 * This function walks the directory tree (skipping node_modules and .git)
 * and builds a deterministic signature from the mtimes of every directory
 * and file it encounters. Any change to any file or directory mtime in the
 * tree produces a different signature, ensuring cache invalidation.
 *
 * Returns `undefined` if the directory cannot be read.
 */
export async function computeDirMtimeSignature(dir: string): Promise<string | undefined> {
  const parts: string[] = []
  const queue: string[] = [dir]

  while (queue.length > 0) {
    const currentDir = queue.shift()!
    let entries
    try {
      entries = await readdir(currentDir, { withFileTypes: true })
    } catch {
      continue
    }
    // Sort for deterministic ordering
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const fullPath = join(currentDir, entry.name)
      try {
        const s = await stat(fullPath)
        // Include the relative path (from root dir) and mtime in the signature
        const relPath = fullPath.slice(dir.length)
        parts.push(`${relPath}:${s.mtimeMs}`)
        if (entry.isDirectory() && !entry.isSymbolicLink()) {
          queue.push(fullPath)
        }
      } catch {
        // Skip entries we can't stat
      }
    }
  }

  if (parts.length === 0) return undefined
  return parts.join('|')
}

/**
 * Whether a scanCache entry is still fresh (issues #755, #824, and #852).
 *
 * Two conditions must hold for an entry to be considered fresh:
 * 1. The entry is within SCAN_CACHE_TTL_MS (issue #755).
 * 2. If the entry records an mtime signature and a current signature is
 *    provided, they must match — otherwise files were added/deleted/modified
 *    in the directory tree and the cache is stale even within the TTL window
 *    (issues #824 and #852).
 */
export function isScanCacheEntryFresh(
  entry: { files: string[]; timestamp: number; mtimeSignature?: string } | undefined,
  now: number = Date.now(),
  currentMtimeSignature?: string,
): boolean {
  if (!entry) return false
  if (now - entry.timestamp > SCAN_CACHE_TTL_MS) return false
  if (entry.mtimeSignature !== undefined && currentMtimeSignature !== undefined && entry.mtimeSignature !== currentMtimeSignature) return false
  return true
}

async function getFileContent(filePath: string): Promise<string | null> {
  try {
    const stats = await stat(filePath).catch(() => null)
    if (!stats) return null
    const cached = fileContentCache.get(filePath)
    if (cached && cached.mtime >= stats.mtimeMs) {
      return cached.content
    }
    const content = await readFile(filePath, 'utf8')
    fileContentCache.set(filePath, { content, mtime: stats.mtimeMs })
    return content
  } catch {
    return null
  }
}

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

interface QueueEntry {
  dir: string
  depth: number
}

export async function scanFiles(dir: string, out: string[], maxDepth = 100, currentDepth = 0): Promise<void> {
  // Use an explicit queue (FIFO) to avoid stack overflow from deeply nested
  // directories while producing a deterministic, breadth-first traversal order.
  // Directories are processed with bounded concurrency so that sibling
  // subdirectories are read in parallel (the real I/O bottleneck), rather than
  // one at a time.
  //
  // Entries within each directory are sorted by name before processing so that
  // the resulting `out` array order is stable and independent of the underlying
  // filesystem's readdir iteration order (issue #842).
  const queue: QueueEntry[] = [{ dir, depth: currentDepth }]
  const CONCURRENCY = 10

  while (queue.length > 0) {
    // Dequeue up to CONCURRENCY directories to process them in parallel
    const batch: QueueEntry[] = []
    while (queue.length > 0 && batch.length < CONCURRENCY) {
      batch.push(queue.shift()!)
    }

    // Each worker returns the files it discovered (in sorted order) plus the
    // subdirectories to enqueue. We merge results in batch order so that the
    // final `out` array is deterministic regardless of which concurrent
    // worker finishes first (issue #842).
    const batchResults = await pMap(
      batch,
      async ({ dir: currentDir, depth }) => {
        const files: string[] = []
        const subdirs: QueueEntry[] = []

        if (depth > maxDepth) return { files, subdirs }

        let dirHandle
        try {
          dirHandle = await readdir(currentDir, { withFileTypes: true })
        } catch {
          return { files, subdirs }
        }

        // Sort entries by name for deterministic traversal order regardless
        // of the underlying filesystem's readdir iteration order.
        dirHandle.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

        for (const entry of dirHandle) {
          try {
            const fullPath = join(currentDir, entry.name)
            // Check if entry is a symbolic link to avoid infinite loops.
            // `readdir` was called with `withFileTypes: true`, so the Dirent
            // already exposes `isSymbolicLink()` — no extra `lstat` syscall needed.
            if (entry.isSymbolicLink()) continue
            if (entry.isDirectory()) {
              // Skip node_modules and .git to avoid scanning large/generated directories.
              // Other dot-prefixed directories (e.g. .github, .storybook, .vscode) may
              // contain legitimate source files and should not be skipped (issue #820).
              if (entry.name === 'node_modules' || entry.name === '.git') continue
              subdirs.push({ dir: fullPath, depth: depth + 1 })
              continue
            }
            if (SUPPORTED_EXTENSIONS.has(extname(entry.name))) {
              files.push(fullPath)
            }
          } catch {
            // Gracefully skip this entry (e.g., permission error, I/O failure)
          }
        }

        return { files, subdirs }
      },
      { concurrency: CONCURRENCY }
    )

    // Merge results in batch order (FIFO) for deterministic output.
    for (const { files, subdirs } of batchResults) {
      out.push(...files)
      queue.push(...subdirs)
    }
  }
}

export async function getChangedFilesSinceLastCommit(): Promise<string[]> {
  try {
    const { exec } = await import('child_process/promises')

    // Check if the repository has a HEAD reference (i.e., at least one commit)
    // This handles empty repos and shallow clones gracefully
    try {
      await exec('git rev-parse --verify HEAD', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      })
    } catch {
      // No HEAD reference - this is a fresh repo or shallow clone
      console.debug('getChangedFilesSinceLastCommit: No HEAD reference (empty repo or shallow clone), falling back to full directory scan')
      return []
    }

    // Get files changed in the working tree (unstaged + staged).
    // Include Deleted (D) files (issue #822): when a source file is deleted
    // but still imported elsewhere, the importer must be re-scanned so the
    // broken import is detected. The caller (collectMissingRelativeImports)
    // checks for deleted files and falls back to a full scan when any are
    // present, ensuring importers of the deleted module are re-scanned.
    const [diffResult, untrackedResult] = await Promise.all([
      exec('git diff --name-only HEAD --diff-filter=ACDMR', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }),
      exec('git ls-files --others --exclude-standard', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }),
    ])
    const changed = diffResult.stdout.trim().split('\n').filter(Boolean)
    const untracked = untrackedResult.stdout.trim().split('\n').filter(Boolean)
    const files = [...changed, ...untracked]
    // Filter to only source files we care about
    return files
      .filter(f => SUPPORTED_EXTENSIONS.has(extname(f)) && f.startsWith('src/'))
      .map(f => resolve(f))
  } catch {
    // If git is not available or not a git repo, return empty to fall back to full scan
    console.debug('getChangedFilesSinceLastCommit: Git command failed (no commits or not a git repo), falling back to full directory scan')
    return []
  }
}

export async function hasResolvableTarget(basePath: string): Promise<boolean> {
  const withoutJs = basePath.replace(/\.js$/u, '')
  const parentDir = dirname(withoutJs)
  const baseName = basename(withoutJs)

  try {
    const entries = await readdir(parentDir, { withFileTypes: true })
    const files = new Set(entries.filter(e => e.isFile()).map(e => e.name))
    // Use stat to check for directories (follows symlinks)
    const dirs = new Set<string>()
    for (const entry of entries) {
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        try {
          const fullPath = join(parentDir, entry.name)
          const stats = await stat(fullPath)
          if (stats.isDirectory()) {
            dirs.add(entry.name)
          }
        } catch {
          // Not accessible or not a directory
        }
      }
    }

    // Check direct file candidates in preference order (.ts before .js to avoid build artifacts)
    if (files.has(baseName)) return true
    if (files.has(`${baseName}.ts`)) return true
    if (files.has(`${baseName}.tsx`)) return true
    if (files.has(`${baseName}.js`)) return true
    if (files.has(`${baseName}.jsx`)) return true
    if (files.has(`${baseName}.mjs`)) return true
    if (files.has(`${baseName}.cjs`)) return true

    // Check if baseName is a directory with index files
    if (dirs.has(baseName)) {
      try {
        const subDir = join(parentDir, baseName)
        const subEntries = await readdir(subDir, { withFileTypes: true })
        const subFiles = new Set(subEntries.filter(e => e.isFile()).map(e => e.name))
        if (subFiles.has('index.ts')) return true
        if (subFiles.has('index.tsx')) return true
        if (subFiles.has('index.js')) return true
        if (subFiles.has('index.jsx')) return true
        if (subFiles.has('index.mjs')) return true
        if (subFiles.has('index.cjs')) return true
      } catch {
        // Directory not readable
      }
    }

    return false
  } catch {
    return false
  }
}

// ReDoS-safe import extraction using indexOf (O(n) per file, no backtracking)
export function extractRelativeImports(text: string): string[] {
  const results: string[] = []
  const len = text.length

  // Helper function to skip string literals and comments
  const skipStringAndComment = (i: number): number => {
    while (i < len) {
      // Skip string literals (single, double, backtick)
      if (text[i] === '"' || text[i] === "'" || text[i] === '`') {
        const quote = text[i]
        let j = i + 1
        while (j < len && text[j] !== quote) {
          if (text[j] === '\\') j++ // skip escaped character
          j++
        }
        i = j < len ? j + 1 : j
        continue
      }
      // Skip single-line comments
      if (text[i] === '/' && text[i + 1] === '/') {
        let j = i + 2
        while (j < len && text[j] !== '\n') j++
        i = j
        continue
      }
      // Skip multi-line comments
      if (text[i] === '/' && text[i + 1] === '*') {
        let j = i + 2
        while (j < len - 1 && !(text[j] === '*' && text[j + 1] === '/')) j++
        // Clamp to len so unterminated comments don't overshoot the buffer
        i = Math.min(j + 2, len)
        continue
      }
      break
    }
    return i
  }

  // Helper function to skip whitespace and comments (but NOT string literals)
  const skipWhitespaceAndComment = (i: number): number => {
    while (i < len) {
      while (i < len && /\s/.test(text[i])) i++
      // Skip single-line comments
      if (text[i] === '/' && text[i + 1] === '/') {
        let j = i + 2
        while (j < len && text[j] !== '\n') j++
        i = j
        continue
      }
      // Skip multi-line comments
      if (text[i] === '/' && text[i + 1] === '*') {
        let j = i + 2
        while (j < len - 1 && !(text[j] === '*' && text[j + 1] === '/')) j++
        // Clamp to len so unterminated comments don't overshoot the buffer
        i = Math.min(j + 2, len)
        continue
      }
      break
    }
    return i
  }

  // Pattern 1: import/export ... from './...' (handles multi-line imports)
  let i = 0
  let inImportStatement = false
  while (i < len) {
    i = skipStringAndComment(i)
    // Detect import/export keyword (standalone word)
    if ((text[i] === 'i' && text.startsWith('import', i)) ||
        (text[i] === 'e' && text.startsWith('export', i))) {
      const before = i > 0 ? text[i - 1] : ' '
      const after = text[i + 6] ?? ' '
      if (!/[A-Za-z0-9_$]/.test(before) && !/[A-Za-z0-9_$]/.test(after)) {
        // Skip import.meta — it's a property access, not an import declaration
        if (text[i] === 'i' && text[i + 6] === '.') {
          i += 1
          continue
        }
        inImportStatement = true
        i += 6
        // Skip whitespace/comments between the keyword and the rest of the
        // statement. This allows side-effect imports like `import /* comment */ './foo'`
        // and ensures comments before `from` are skipped.
        i = skipWhitespaceAndComment(i)
        // Handle side-effect imports: `import './foo'` or `import /* c */ './foo'`
        if (i < len && (text[i] === '"' || text[i] === "'" || text[i] === '`')) {
          const quote = text[i]
          const specStart = i + 1
          let specEnd = specStart
          while (specEnd < len && text[specEnd] !== quote) {
            if (text[specEnd] === '\\') specEnd++ // skip escaped character
            specEnd++
          }
          if (specEnd < len) {
            const spec = text.slice(specStart, specEnd)
            if (spec.startsWith('./') || spec.startsWith('../')) {
              results.push(spec)
            }
          }
          inImportStatement = false
          i = specEnd + 1
          continue
        }
        continue
      }
    }
    // Inside an import/export statement, try to extract a specifier after 'from'
    if (inImportStatement && text[i] === 'f' && text.startsWith('from', i)) {
      const before = i > 0 ? text[i - 1] : ' '
      const after = text[i + 4] ?? ' '
      if (!/[A-Za-z0-9_$]/.test(before) && !/[A-Za-z0-9_$]/.test(after)) {
        let j = skipWhitespaceAndComment(i + 4)
        if (j < len && (text[j] === '"' || text[j] === "'" || text[j] === '`')) {
          const quote = text[j]
          const specStart = j + 1
          let specEnd = specStart
          while (specEnd < len && text[specEnd] !== quote) {
            if (text[specEnd] === '\\') specEnd++ // skip escaped character
            specEnd++
          }
          if (specEnd < len) {
            const spec = text.slice(specStart, specEnd)
            if (spec.startsWith('./') || spec.startsWith('../')) {
              results.push(spec)
            }
          }
          inImportStatement = false
          i = specEnd + 1
          continue
        }
        i = j + 1
        continue
      }
    }
    // A newline does NOT terminate an import/export statement — multi-line imports/exports
    // (e.g., import {\n  foo,\n  bar\n} from './utils') span multiple lines.
    // Only a semicolon or successful 'from' extraction resets the flag.
    // A semicolon terminates an import/export statement
    if (inImportStatement && text[i] === ';') {
      inImportStatement = false
    }
    i++
  }

  // Pattern 2: require('./...')
  i = 0
  while (i < len) {
    i = skipStringAndComment(i)
    if (text[i] === 'r' && text.startsWith('require(', i)) {
      const before = i > 0 ? text[i - 1] : ' '
      const after = text[i + 7] ?? ' '
      if (!/[A-Za-z0-9_$]/.test(before) && !/[A-Za-z0-9_$]/.test(after)) {
        // Skip past 'require(' to find the opening quote
        let j = i + 8
        while (j < len && /\s/.test(text[j])) j++
        if (j < len && (text[j] === '"' || text[j] === "'" || text[j] === '`')) {
          const quote = text[j]
          const specStart = j + 1
          let specEnd = specStart
          while (specEnd < len && text[specEnd] !== quote) {
            if (text[specEnd] === '\\') specEnd++ // skip escaped character
            specEnd++
          }
          if (specEnd < len) {
            const spec = text.slice(specStart, specEnd)
            if (spec.startsWith('./') || spec.startsWith('../')) {
              results.push(spec)
            }
          }
          i = specEnd + 1
          continue
        }
      }
    }
    i++
  }

  // Pattern 3: import('./...')
  i = 0
  while (i < len) {
    i = skipStringAndComment(i)
    if (text[i] === 'i' && text.startsWith('import(', i)) {
      const before = i > 0 ? text[i - 1] : ' '
      const after = text[i + 6] ?? ' '
      if (!/[A-Za-z0-9_$]/.test(before) && !/[A-Za-z0-9_$]/.test(after)) {
        // Skip past 'import(' to find the opening quote
        let j = i + 7
        while (j < len && /\s/.test(text[j])) j++
        if (j < len && (text[j] === '"' || text[j] === "'" || text[j] === '`')) {
          const quote = text[j]
          const specStart = j + 1
          let specEnd = specStart
          while (specEnd < len && text[specEnd] !== quote) {
            if (text[specEnd] === '\\') specEnd++ // skip escaped character
            specEnd++
          }
          if (specEnd < len) {
            const spec = text.slice(specStart, specEnd)
            if (spec.startsWith('./') || spec.startsWith('../')) {
              results.push(spec)
            }
          }
          i = specEnd + 1
          continue
        }
      }
    }
    i++
  }

  return results
}

export async function collectMissingRelativeImports(): Promise<MissingImport[]> {
  const files: string[] = []
  
  // Try to use git to detect changed files first (much faster)
  const changedFiles = await getChangedFilesSinceLastCommit()
  
  // Detect deleted files (issue #822): when a source file is deleted but
  // still imported elsewhere, scanning only the changed files is not enough
  // — the importer of the deleted module must be re-scanned.  When any
  // changed file no longer exists on disk, fall back to a full directory
  // scan so that all potential importers are checked.
  const hasDeleted = changedFiles.length > 0 && (
    await Promise.all(
      changedFiles.map(f => stat(f).then(() => false).catch(() => true)),
    )
  ).some(Boolean)

  if (changedFiles.length > 0 && !hasDeleted) {
    // Only scan changed files and their import dependencies
    files.push(...changedFiles)
  } else if (hasDeleted) {
    // A source file was deleted — scan everything so importers of the
    // deleted module are re-scanned and broken imports detected.
    const srcDir = resolve('src')
    // Use a recursive mtime signature so changes in any subdirectory
    // invalidate the cache (issue #852). A directory's own mtime only
    // changes for direct entries, missing changes in nested subdirectories.
    const currentMtimeSignature = await computeDirMtimeSignature(srcDir)
    const cached = scanCache.get(srcDir)
    if (isScanCacheEntryFresh(cached, Date.now(), currentMtimeSignature)) {
      files.push(...cached!.files)
    } else {
      await scanFiles(srcDir, files)
      scanCache.set(srcDir, { files: [...files], timestamp: Date.now(), mtimeSignature: currentMtimeSignature })
    }
  } else {
    // Fall back to full directory scan with depth limit, using cache
    const srcDir = resolve('src')
    // Use a recursive mtime signature to invalidate the cache when files are
    // added, deleted, or modified in any subdirectory within the TTL window
    // (issues #824 and #852).
    const currentMtimeSignature = await computeDirMtimeSignature(srcDir)
    const cached = scanCache.get(srcDir)
    if (isScanCacheEntryFresh(cached, Date.now(), currentMtimeSignature)) {
      files.push(...cached!.files)
    } else {
      await scanFiles(srcDir, files)
      scanCache.set(srcDir, { files: [...files], timestamp: Date.now(), mtimeSignature: currentMtimeSignature })
    }
  }
  
  const missing: MissingImport[] = []
  const seen = new Set<string>()

  for (const file of files) {
    const text = await getFileContent(file)
    if (!text) continue
    for (const specifier of extractRelativeImports(text)) {
      const target = resolve(dirname(file), specifier)
      if (await hasResolvableTarget(target)) continue
      const key = `${file} -> ${specifier}`
      if (seen.has(key)) continue
      seen.add(key)
      missing.push({
        importer: file,
        specifier,
      })
    }
  }

  return missing.sort((a, b) =>
    `${a.importer}:${a.specifier}`.localeCompare(`${b.importer}:${b.specifier}`),
  )
}

// Only run the main entry point logic when this file is executed directly
// (not when imported as a module for testing)
// Uses realpathSync to resolve symlinks and case-insensitive paths
// fileURLToPath converts the import.meta.url to a file path
let isMainModule = false
try {
  isMainModule = process.argv[1] &&
    realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))
} catch {
  // If realpathSync fails (e.g., non-existent path), treat as not main module
}

if (isMainModule) {
  const args = process.argv.slice(2)

  // Handle --version immediately without any filesystem scan
  if (args.includes('--version')) {
    console.log(pkg.version)
    process.exit(0)
  }

  // Only run the filesystem scan in development mode when explicitly enabled
  async function main(): Promise<void> {
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.MYCLAUDE_CHECK_MISSING_IMPORTS === 'true'
    ) {
      const missingImports = await collectMissingRelativeImports()

      if (missingImports.length > 0) {
        console.log('Missing relative imports detected:')
        for (const imp of missingImports) {
          console.log(`  ${imp.importer}: ${imp.specifier}`)
        }
        process.exit(1)
      }

      console.log('Dev workspace check passed (no missing relative imports)')
    } else if (process.env.NODE_ENV !== 'development') {
      // In production, skip the expensive scan entirely
      console.log('Dev workspace check skipped (NODE_ENV is not development)')
    }

    // Launch the actual CLI application
    await import('./entrypoints/cli.js')
  }

  void main()
}
