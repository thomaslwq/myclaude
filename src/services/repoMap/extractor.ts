import { readdir, readFile, stat } from 'fs/promises'
import { join, relative, extname } from 'path'

/**
 * Lightweight repo map extractor (issue #974).
 *
 * Inspired by Aider's ctags-based repo map and Cursor's implicit context:
 * walk the workspace, extract function/class/method/const signatures from
 * source files, and produce a compressed hierarchical overview that fits
 * within a small token budget. This gives the LLM situational awareness of
 * the codebase without requiring manual @ mentions.
 *
 * Design notes:
 *  - No external dependencies (no ctags, no tree). Pure Node/Bun fs + regex.
 *  - Regex-based "AST-lite" extraction: good enough for TS/JS/TSX/JSX/JSON/MD.
 *  - Deterministic ordering (sorted by path) so the map is stable across runs
 *    and doesn't bust the prompt cache.
 *  - Budget-aware: truncates to a character budget (roughly 4 chars/token).
 */

export const DEFAULT_IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.cache',
  '.turbo',
  '.parcel-cache',
  '.pytest_cache',
  '__pycache__',
  '.venv',
  'venv',
  'coverage',
  '.test-tmp',
])

export const DEFAULT_IGNORE_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'pnpm-lock.yaml',
  'CHANGELOG.md',
  'LICENSE',
  'LICENSE.md',
  '.env',
  '.env.local',
])

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.swift',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.cs',
  '.rb',
  '.php',
  '.sh',
])

const MAX_FILE_BYTES = 256 * 1024 // 256 KB per file
const MAX_FILES = 4000

export interface RepoMapOptions {
  /** Absolute path of the workspace root. */
  root: string
  /** Character budget for the final map. Default ~8000 chars (~2000 tokens). */
  budgetChars?: number
  /** Max directory depth to descend. Default 8. */
  maxDepth?: number
  /** Extra directory names to skip. */
  ignoreDirs?: Iterable<string>
  /** Extra file names to skip. */
  ignoreFiles?: Iterable<string>
  /** Extra file extensions to include. */
  includeExtensions?: Iterable<string>
  /** Max files to scan. Default 4000. */
  maxFiles?: number
}

export interface RepoMapResult {
  /** The compressed, hierarchical map string. */
  map: string
  /** Number of files scanned. */
  filesScanned: number
  /** Number of files included in the final map (after budget truncation). */
  filesIncluded: number
  /** Whether the budget was hit and the map was truncated. */
  truncated: boolean
  /** Total characters of the map. */
  chars: number
}

/**
 * Extract function/class/method/const signatures from a source file.
 * Regex-based, intentionally permissive — false positives are cheaper than
 * missing real definitions.
 */
export function extractSignatures(content: string, ext: string): string[] {
  const out: string[] = []
  const lines = content.split('\n')

  if (ext === '.json') {
    // For JSON, list top-level keys.
    try {
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed).slice(0, 20)
        if (keys.length > 0) out.push(`keys: ${keys.join(', ')}`)
      }
    } catch {
      // ignore malformed JSON
    }
    return out
  }

  if (ext === '.md') {
    // For markdown, list headings.
    for (const line of lines) {
      const m = /^(#{1,6})\s+(.+)$/.exec(line)
      if (m) out.push(`# ${m[2].trim()}`)
      if (out.length >= 20) break
    }
    return out
  }

  // TS/JS/TSX/JSX/JSON/Python/Go/Rust/etc.
  const patterns: RegExp[] = [
    // export function foo(...) / export async function foo(...)
    /^\s*export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/,
    // function foo(...) (non-exported)
    /^\s*function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/,
    // export class Foo / class Foo
    /^\s*export\s+(?:default\s+)?class\s+([A-Za-z_$][\w$]*)\s*(?:extends\s+\w+)?\s*(?:\{|$)/,
    /^\s*class\s+([A-Za-z_$][\w$]*)\s*(?:extends\s+\w+)?\s*(?:\{|$)/,
    // export interface Foo / interface Foo
    /^\s*export\s+interface\s+([A-Za-z_$][\w$]*)\s*(?:extends\s+\w+)?\s*(?:\{|$)/,
    /^\s*interface\s+([A-Za-z_$][\w$]*)\s*(?:extends\s+\w+)?\s*(?:\{|$)/,
    // export type Foo = ... / type Foo = ...
    /^\s*export\s+type\s+([A-Za-z_$][\w$]*)\s*=\s*(.+?);?\s*$/,
    /^\s*type\s+([A-Za-z_$][\w$]*)\s*=\s*(.+?);?\s*$/,
    // export const foo = ... / const foo = ...
    /^\s*export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=\s*(.+?);?\s*$/,
    /^\s*const\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=\s*(.+?);?\s*$/,
    // export enum Foo / enum Foo
    /^\s*export\s+enum\s+([A-Za-z_$][\w$]*)\s*(?:\{|$)/,
    /^\s*enum\s+([A-Za-z_$][\w$]*)\s*(?:\{|$)/,
    // Python: def foo(...) / async def foo(...)
    /^\s*(?:async\s+)?def\s+([A-Za-z_][\w_]*)\s*\(([^)]*)\)/,
    // Python: class Foo
    /^\s*class\s+([A-Za-z_][\w_]*)\s*(?:\([^)]*\))?\s*:/,
    // Go: func Foo(...) / func (r *T) Foo(...)
    /^\s*func\s+(?:\([^)]*\)\s+)?([A-Za-z_][\w_]*)\s*\(([^)]*)\)/,
    // Rust: fn foo(...) / pub fn foo(...)
    /^\s*(?:pub\s+)?fn\s+([A-Za-z_][\w_]*)\s*\(([^)]*)\)/,
    // Rust: struct Foo / impl Foo
    /^\s*(?:pub\s+)?struct\s+([A-Za-z_][\w_]*)\b/,
    /^\s*(?:pub\s+)?trait\s+([A-Za-z_][\w_]*)\b/,
    // Java/Kotlin/C#: public class Foo / class Foo
    /^\s*(?:public\s+|private\s+|protected\s+|static\s+|abstract\s+|final\s+)*class\s+([A-Za-z_][\w_]*)\b/,
    /^\s*(?:public\s+|private\s+|protected\s+|static\s+|abstract\s+|final\s+)*interface\s+([A-Za-z_][\w_]*)\b/,
    // Shell: function foo() { / foo() {
    /^\s*(?:function\s+)?([A-Za-z_][\w_]*)\s*\(\s*\)\s*\{?/,
  ]

  for (const line of lines) {
    for (const re of patterns) {
      const m = re.exec(line)
      if (!m) continue
      const name = m[1]
      const rest = m[2] ?? ''
      // Skip trivially short names (likely false positives like `if`, `for`).
      if (name.length < 2) continue
      if (rest && rest.length > 60) {
        out.push(`${name}(${rest.slice(0, 57)}...)`)
      } else if (rest) {
        out.push(`${name}(${rest})`)
      } else {
        out.push(name)
      }
      break
    }
    if (out.length >= 200) break
  }

  return out
}

async function walkDir(
  dir: string,
  root: string,
  depth: number,
  maxDepth: number,
  ignoreDirs: Set<string>,
  ignoreFiles: Set<string>,
  includeExtensions: Set<string>,
  out: string[],
): Promise<void> {
  if (depth > maxDepth) return
  if (out.length >= MAX_FILES) return

  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  // Sort for deterministic ordering.
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

  for (const entry of entries) {
    if (out.length >= MAX_FILES) return
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      if (ignoreDirs.has(entry.name)) continue
      await walkDir(fullPath, root, depth + 1, maxDepth, ignoreDirs, ignoreFiles, includeExtensions, out)
    } else if (entry.isFile()) {
      if (ignoreFiles.has(entry.name)) continue
      const ext = extname(entry.name).toLowerCase()
      if (!SOURCE_EXTENSIONS.has(ext) && !includeExtensions.has(ext)) continue
      out.push(fullPath)
    }
  }
}

/**
 * Build a compressed repo map for the given workspace root.
 */
export async function buildRepoMap(options: RepoMapOptions): Promise<RepoMapResult> {
  const {
    root,
    budgetChars = 8000,
    maxDepth = 8,
    maxFiles = MAX_FILES,
  } = options
  const ignoreDirs = new Set([...DEFAULT_IGNORE_DIRS, ...(options.ignoreDirs ?? [])])
  const ignoreFiles = new Set([...DEFAULT_IGNORE_FILES, ...(options.ignoreFiles ?? [])])
  const includeExtensions = new Set(options.includeExtensions ?? [])

  const files: string[] = []
  await walkDir(root, root, 0, maxDepth, ignoreDirs, ignoreFiles, includeExtensions, files)
  files.sort()

  const sections: string[] = []
  let used = 0
  let included = 0
  let truncated = false

  for (const file of files) {
    if (used >= budgetChars) {
      truncated = true
      break
    }
    let content: string
    try {
      const s = await stat(file)
      if (s.size > MAX_FILE_BYTES) continue
      content = await readFile(file, 'utf-8')
    } catch {
      continue
    }

    const ext = extname(file).toLowerCase()
    const sigs = extractSignatures(content, ext)
    if (sigs.length === 0) continue

    const rel = relative(root, file)
    const header = `## ${rel}`
    const body = sigs.map(s => `  ${s}`).join('\n')
    const section = `${header}\n${body}`

    // Reserve room for the next section; if it doesn't fit, stop.
    if (used + section.length + 2 > budgetChars) {
      // Try to fit a truncated version of this section.
      const remaining = budgetChars - used - 2
      if (remaining > header.length + 20) {
        const lines = sigs.slice()
        let bodyLines: string[] = []
        let bodyLen = 0
        for (const line of lines) {
          const candidate = `  ${line}`
          if (bodyLen + candidate.length + 1 > remaining - header.length - 2) break
          bodyLines.push(candidate)
          bodyLen += candidate.length + 1
        }
        if (bodyLines.length > 0) {
          sections.push(`${header}\n${bodyLines.join('\n')}\n  ...`)
          used += header.length + bodyLen + 4
          included++
          truncated = true
        }
      }
      break
    }

    sections.push(section)
    used += section.length + 2
    included++
  }

  const map = sections.join('\n\n')
  return {
    map,
    filesScanned: files.length,
    filesIncluded: included,
    truncated,
    chars: map.length,
  }
}
