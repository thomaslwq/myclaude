#!/usr/bin/env bun
/**
 * Build script for myclaude.
 *
 * Bundles the CLI entry point into a standalone Bun executable.
 * Dynamically imported optional packages are excluded from the bundle.
 */

import { readFileSync, writeFileSync, unlinkSync, copyFileSync, mkdirSync } from 'fs'
import { spawnSync } from 'child_process'
import { resolve, join } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const ENTRY = resolve(ROOT, 'src/entrypoints/cli.tsx')
const DIST = resolve(ROOT, 'dist')
// Ensure dist directory exists (it's gitignored, may not exist on CI)
mkdirSync(DIST, { recursive: true })
const OUTFILE = resolve(DIST, 'myclaude.js')
const OUTFILE_NEW = resolve(DIST, 'myclaude-new.js')
const TMP_OUT = resolve(DIST, 'myclaude_tmp.js')
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))

// Packages excluded from bundle (dynamically imported at runtime)
const EXTERNAL = [
  '@anthropic-ai/bedrock-sdk',
  '@anthropic-ai/foundry-sdk',
  '@anthropic-ai/vertex-sdk',
  '@aws-sdk/client-bedrock',
  '@aws-sdk/client-sts',
  '@azure/identity',
  'google-auth-library',
  'sharp',
  'turndown',
  '@opentelemetry/exporter-metrics-otlp-grpc',
  '@opentelemetry/exporter-metrics-otlp-http',
  '@opentelemetry/exporter-metrics-otlp-proto',
  '@opentelemetry/exporter-prometheus',
  '@opentelemetry/exporter-logs-otlp-grpc',
  '@opentelemetry/exporter-logs-otlp-http',
  '@opentelemetry/exporter-logs-otlp-proto',
  '@opentelemetry/exporter-trace-otlp-grpc',
  '@opentelemetry/exporter-trace-otlp-http',
  '@opentelemetry/exporter-trace-otlp-proto',
  'image-processor.node',
]

// Build-time MACRO preamble (replaces bun:bundle compile-time macros)
const MACRO_PREAMBLE = `
// MACRO - build-time constants (injected by build.ts)
globalThis.MACRO = {
  VERSION: ${JSON.stringify(pkg.version)},
  BUILD_TIME: ${JSON.stringify(new Date().toISOString())},
  PACKAGE_URL: ${JSON.stringify(pkg.name)},
  NATIVE_PACKAGE_URL: ${JSON.stringify(pkg.name)},
  VERSION_CHANGELOG: '',
  ISSUES_EXPLAINER: 'file an issue at ' + ${JSON.stringify(pkg.bugs?.url || pkg.repository?.url || '')},
  FEEDBACK_CHANNEL: 'github',
};
`

console.log(`Building myclaude...`)
console.log(`  Version: ${pkg.version}`)
console.log(`  Entry:  ${ENTRY}`)
console.log(`  Output: ${OUTFILE}`)

// Build to a temp file first, then move
const result = spawnSync('bun', [
  'build', ENTRY,
  '--target=node',
  `--outdir=${DIST}`,
  ...EXTERNAL.flatMap(pkg => ['--external', pkg]),
], { stdio: 'inherit', cwd: ROOT })

if (result.status !== 0) {
  console.error('Build failed')
  process.exit(result.status ?? 1)
}

// The output file is named after the entry point in the outdir
const BUILD_OUT = resolve(DIST, 'cli.js')

const { tmpdir } = await import('os')
const TMP_MACRO = join(tmpdir(), 'myclaude_macro_' + Date.now() + '.js')

// Prepend MACRO preamble to the bundled output
const bundle = readFileSync(BUILD_OUT, 'utf8')

// Add Node.js shebang for npm bin compat, then MACRO preamble
writeFileSync(TMP_MACRO, '#!/usr/bin/env node\n\n' + MACRO_PREAMBLE + '\n' + bundle)
// Also inject MACRO before feature() calls: replace "if (false)" that came
// from feature() with the actual MACRO-aware check
const injected = readFileSync(TMP_MACRO, 'utf8')
  .replace(
    /globalThis\.MACRO = \{/,
    '// MACRO injected by build script\nglobalThis.MACRO = {',
  )

writeFileSync(TMP_MACRO, injected)

// Write final output (use different filename to avoid antivirus lock)
const FINAL_OUT = resolve(DIST, 'myclaude.mjs')
writeFileSync(FINAL_OUT, readFileSync(TMP_MACRO))

// Clean up temp files
try { unlinkSync(BUILD_OUT) } catch {}
try { unlinkSync(TMP_OUT) } catch {}

console.log(`\nBuild complete: ${FINAL_OUT}`)
console.log(`  Size: ${(readFileSync(FINAL_OUT).length / 1024 / 1024).toFixed(2)} MB`)

// Also write to myclaude.js for the bin entry (use copyFileSync which might work for different names)
try { copyFileSync(FINAL_OUT, OUTFILE) } catch (e) {
  console.log(`Note: could not write ${OUTFILE} (${e.message})`)
}