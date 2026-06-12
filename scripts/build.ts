#!/usr/bin/env bun
/**
 * Build script for myclaude.
 *
 * Bundles the CLI entry point into a standalone Bun executable.
 * Dynamically imported optional packages are excluded from the bundle.
 */

const { readFileSync, writeFileSync, unlinkSync, copyFileSync } = await import('fs')
const { spawnSync } = await import('child_process')
const { resolve, join } = await import('path')

const ROOT = resolve(import.meta.dir, '..')
const ENTRY = resolve(ROOT, 'src/entrypoints/cli.tsx')
const DIST = resolve(ROOT, 'dist')
const OUTFILE = resolve(DIST, 'myclaude.js')
const TMP_OUT = resolve(DIST, 'myclaude_tmp.js')
const BUILD_OUT = resolve(DIST, 'myclaude_bundle.js')
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
  `--outfile=${BUILD_OUT}`,
  ...EXTERNAL.flatMap(pkg => ['--external', pkg]),
], { stdio: 'inherit', cwd: ROOT })

if (result.status !== 0) {
  console.error('Build failed')
  process.exit(result.status ?? 1)
}

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

// Copy to destination and clean up
try { unlinkSync(OUTFILE) } catch {}
copyFileSync(TMP_MACRO, OUTFILE)

// Clean up temp files
try { unlinkSync(BUILD_OUT) } catch {}
try { unlinkSync(TMP_OUT) } catch {}

console.log(`\nBuild complete: ${OUTFILE}`)
console.log(`  Size: ${(readFileSync(OUTFILE).length / 1024 / 1024).toFixed(2)} MB`)
