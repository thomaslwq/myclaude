import pkg from '../package.json'
import { access } from 'fs/promises'
import { readFile, readdir } from 'fs/promises'
import { dirname, extname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

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
    try {
      const fullPath = join(dir, entry.name)
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
  })
  await Promise.all(promises)
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
  const importPattern = /(?:import|export)\s+[^'"]*?from\s+['"`](\..?\/[^'"]+)['"`]/g
  const requirePattern = /require\(\s*['"`](\..?\/[^'"]+)['"`]\s*\)/g
  const dynamicImportPattern = /import\(\s*['"`](\..?\/[^'"]+)['"`]\s*\)/g

  for (const file of files) {
    const text = await getFileContent(file)
    if (!text) continue
    for (const match of text.matchAll(importPattern)) {
      const specifier = match[1]
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
    for (const match of text.matchAll(requirePattern)) {
      const specifier = match[1]
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
    for (const match of text.matchAll(dynamicImportPattern)) {
      const specifier = match[1]
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
// Uses resolve + fileURLToPath to handle relative paths and different path separators
// Avoids synchronous I/O by using path.resolve instead of fs.realpathSync
const isMainModule = process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)

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
