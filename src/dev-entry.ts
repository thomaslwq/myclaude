import pkg from '../package.json'
import { realpathSync, lstatSync } from 'fs'
import { readFile, readdir } from 'fs/promises'
import { basename, dirname, extname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import pMap from 'p-map'

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

const defaultMacro: MacroConfig = {
  VERSION: pkg.version,
  BUILD_TIME: '',
  PACKAGE_URL: pkg.name,
  NATIVE_PACKAGE_URL: pkg.name,
  VERSION_CHANGELOG: '',
  ISSUES_EXPLAINER:
    'file an issue at https://github.com/anthropics/claude-code/issues',
  FEEDBACK_CHANNEL: 'github',
}

if (!('MACRO' in globalThis)) {
  ;(globalThis as typeof globalThis & { MACRO: MacroConfig }).MACRO =
    defaultMacro
}

export type MissingImport = {
  importer: string
  specifier: string
}

// Cache for file contents to avoid re-reading unchanged files
const fileContentCache = new Map<string, { content: string; mtime: number }>()

// Cache for directory scan results to avoid full re-scan on every call
// Used in the fallback path when git diff is not available
const scanCache = new Map<string, { files: string[]; timestamp: number }>()
const SCAN_CACHE_TTL_MS = 60_000 // 1 minute TTL for scan cache

async function getFileContent(filePath: string): Promise<string | null> {
  try {
    const { stat } = await import('fs/promises')
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

export async function scanFiles(dir: string, out: string[], maxDepth = 100, currentDepth = 0): Promise<void> {
  if (currentDepth > maxDepth) return
  let dirHandle
  try {
    dirHandle = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  // Process entries with bounded concurrency to avoid excessive memory usage
  // on large directory trees
  const CONCURRENCY = 10
  await pMap(
    dirHandle,
    async (entry) => {
      try {
        const fullPath = join(dir, entry.name)
        // Check if entry is a symbolic link to avoid infinite recursion
        let isSymlink = false
        try {
          const stats = lstatSync(fullPath)
          isSymlink = stats.isSymbolicLink()
        } catch {}
        if (isSymlink) return
        if (entry.isDirectory()) {
          // Skip node_modules, .git, and other common large directories (but allow .github)
          if (entry.name === 'node_modules' || entry.name === '.git' || (entry.name.startsWith('.') && entry.name !== '.github')) return
          await scanFiles(fullPath, out, maxDepth, currentDepth + 1)
          return
        }
        if (SUPPORTED_EXTENSIONS.has(extname(entry.name))) {
          out.push(fullPath)
        }
      } catch {
        // Gracefully skip this entry (e.g., permission error, I/O failure)
      }
    },
    { concurrency: CONCURRENCY }
  )
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

    // Get files changed in the working tree (unstaged + staged)
    const [diffResult, untrackedResult] = await Promise.all([
      exec('git diff --name-only HEAD --diff-filter=ACMR', {
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
    const dirs = new Set(entries.filter(e => e.isDirectory()).map(e => e.name))

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
        i = j + 2
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
        i = j + 2
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
  
  if (changedFiles.length > 0) {
    // Only scan changed files and their import dependencies
    files.push(...changedFiles)
  } else {
    // Fall back to full directory scan with depth limit, using cache
    const srcDir = resolve('src')
    const now = Date.now()
    const cached = scanCache.get(srcDir)
    if (cached && (now - cached.timestamp) < SCAN_CACHE_TTL_MS) {
      files.push(...cached.files)
    } else {
      await scanFiles(srcDir, files)
      scanCache.set(srcDir, { files: [...files], timestamp: now })
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
const isMainModule = process.argv[1] &&
  realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))

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
