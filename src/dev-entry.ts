import pkg from '../package.json'
import { access } from 'fs/promises'
import { dirname, extname, join, resolve } from 'path'
import { readFile, readdir } from 'fs/promises'

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

export async function scanFiles(dir: string, out: string[], maxDepth = 10, currentDepth = 0): Promise<void> {
  if (currentDepth > maxDepth) return
  let dirHandle
  try {
    dirHandle = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  const promises = dirHandle.map(async (entry) => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip node_modules, .git, and other common large directories
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) return
      await scanFiles(fullPath, out, maxDepth, currentDepth + 1)
      return
    }
    if (SUPPORTED_EXTENSIONS.has(extname(entry.name))) {
      out.push(fullPath)
    }
  })
  await Promise.all(promises)
}

async function getChangedFilesSinceLastCommit(): Promise<string[]> {
  try {
    const { execSync } = await import('child_process')
    // Get files changed in the working tree (unstaged + staged)
    const result = execSync('git diff --name-only HEAD --diff-filter=ACMR', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    const files = result.trim().split('\n').filter(Boolean)
    // Filter to only source files we care about
    return files
      .filter(f => SUPPORTED_EXTENSIONS.has(extname(f)) && f.startsWith('src/'))
      .map(f => resolve(f))
  } catch {
    // If git is not available or not a git repo, return empty to fall back to full scan
    return []
  }
}

async function hasResolvableTarget(basePath: string): Promise<boolean> {
  const withoutJs = basePath.replace(/\.js$/u, '')
  const candidates = [
    withoutJs,
    `${withoutJs}.ts`,
    `${withoutJs}.tsx`,
    `${withoutJs}.js`,
    `${withoutJs}.jsx`,
    `${withoutJs}.mjs`,
    `${withoutJs}.cjs`,
    join(withoutJs, 'index.ts'),
    join(withoutJs, 'index.tsx'),
    join(withoutJs, 'index.js'),
  ]
  const results = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        await access(candidate)
        return true
      } catch {
        return false
      }
    })
  )
  return results.some(exists => exists)
}

export async function collectMissingRelativeImports(): Promise<MissingImport[]> {
  const files: string[] = []
  
  // Try to use git to detect changed files first (much faster)
  const changedFiles = await getChangedFilesSinceLastCommit()
  
  if (changedFiles.length > 0) {
    // Only scan changed files and their import dependencies
    files.push(...changedFiles)
  } else {
    // Fall back to full directory scan with depth limit
    await scanFiles(resolve('src'), files, 10)
  }
  
  const missing: MissingImport[] = []
  const seen = new Set<string>()
  const pattern =
    /(?:import|export)\s+[\s\S]*?from\s+['"](\..?\/[^'"]+)['"]|require\(\s*['"](\..?\/[^'"]+)['"]\s*\)/g

  for (const file of files) {
    const text = await getFileContent(file)
    if (!text) continue
    for (const match of text.matchAll(pattern)) {
      const specifier = match[1] ?? match[2]
      if (!specifier) continue
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
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('/dev-entry.ts') ||
  process.argv[1].endsWith('/dev-entry.js') ||
  process.argv[1].endsWith('\\dev-entry.ts') ||
  process.argv[1].endsWith('\\dev-entry.js')
)

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
