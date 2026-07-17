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

type MissingImport = {
  importer: string
  specifier: string
}

async function scanFiles(dir: string, out: string[]): Promise<void> {
  let dirHandle
  try {
    dirHandle = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  const promises = dirHandle.map(async (entry) => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      await scanFiles(fullPath, out)
      return
    }
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(extname(entry.name))) {
      out.push(fullPath)
    }
  })
  await Promise.all(promises)
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

async function collectMissingRelativeImports(): Promise<MissingImport[]> {
  const files: string[] = []
  await scanFiles(resolve('src'), files)
  // Skip vendor/ directory which can be large and blocks the event loop with synchronous file reads
  // scanFiles(resolve('vendor'), files)
  const missing: MissingImport[] = []
  const seen = new Set<string>()
  const pattern =
    /(?:import|export)\s+[\s\S]*?from\s+['"](\.\.?\/[^'"]+)['"]|require\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g

  for (const file of files) {
    const text = await readFile(file, 'utf8')
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

const args = process.argv.slice(2)

// Only run the filesystem scan in development mode
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    const missingImports = await collectMissingRelativeImports()

    if (args.includes('--version')) {
      if (missingImports.length > 0) {
        console.log(`${pkg.version} (restored dev workspace)`)
      } else {
        console.log(pkg.version)
      }
      process.exit(0)
    }

    if (missingImports.length > 0) {
      console.log('Missing relative imports detected:')
      for (const imp of missingImports) {
        console.log(`  ${imp.importer}: ${imp.specifier}`)
      }
      process.exit(1)
    }

    console.log('Dev workspace check passed (no missing relative imports)')
  } else {
    // In production, skip the expensive scan entirely
    if (args.includes('--version')) {
      console.log(pkg.version)
      process.exit(0)
    }

    console.log('Dev workspace check skipped (NODE_ENV is not development)')
  }

  // Launch the actual CLI application
  await import('./entrypoints/cli.js')
}

void main()
