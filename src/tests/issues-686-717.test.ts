import { describe, test, expect, mock, afterEach } from 'bun:test'

/**
 * Regression tests for issues #686/#704/#688 (extractRelativeImports),
 * #687 (initReplBridge dynamic import), #716 (OSC8 injection).
 *
 * TDD: written first (Red), then implementation makes them pass (Green).
 */

describe('extractRelativeImports — template literals & escapes (issues #686/#704)', () => {
  test('does not treat ${expr} inside template literal as closing backtick', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js')
    const code = "const x = `hello ${name} from './not-real'`\n"
    expect(extractRelativeImports(code)).toEqual([])
  })

  test('does not extract import-looking text inside template literal expression', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js')
    const code = "const path = `./${dir}/file`\n"
    expect(extractRelativeImports(code)).toEqual([])
  })

  test('handles escaped quotes inside string literals', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js')
    const code = 'const msg = "escaped \\"from \'./fake\'\\""\n'
    expect(extractRelativeImports(code)).toEqual([])
  })

  test('still extracts a real import after a template literal line', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js')
    const code = "const x = `tpl ${y}`\nimport { a } from './real'\n"
    expect(extractRelativeImports(code)).toEqual(['./real'])
  })

  test('extracts single-pass equivalent results (issue #688: no duplicate scanning)', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js')
    const code = [
      "import { a } from './a'",
      "require('./b')",
      "import('./c')",
      "export { d } from './d'",
    ].join('\n')
    const result = extractRelativeImports(code)
    expect(result).toContain('./a')
    expect(result).toContain('./b')
    expect(result).toContain('./c')
    expect(result).toContain('./d')
  })
})

describe('initReplBridge — dynamic import failure handling (issue #687)', () => {
  test('sessionStorage is imported statically, not via an unguarded dynamic import', async () => {
    // Issue #687: initReplBridge used `await import('../utils/sessionStorage.js')`
    // whose rejection would crash bridge initialization. The fix imports
    // getCurrentSessionTitle statically (resolved at bundle time, no runtime
    // rejection). Loading the real module pulls in ~1300 modules, so we assert
    // the source contract instead (same approach as regex-patterns.test.ts).
    const fs = await import('fs')
    const source = fs.readFileSync(
      new URL('../bridge/initReplBridge.ts', import.meta.url),
      'utf-8',
    )
    // No unguarded dynamic import of sessionStorage anywhere in the file
    expect(source).not.toContain("await import('../utils/sessionStorage.js')")
    // And getCurrentSessionTitle is a static top-level import
    expect(source).toContain("from '../utils/sessionStorage.js'")
  })
})

describe('wrapWithOsc8Link — injection resistance (issue #716)', () => {
  test('escapes ESC and BEL characters in the link text', async () => {
    const { wrapWithOsc8Link } = await import('../bridge/bridgeStatusUtil.js')
    const out = wrapWithOsc8Link('hello\x1b]8;;http://evil\x07world', 'https://safe.example')
    // The injected OSC8 sequence must be neutralized: no raw \x1b]8 inside the text
    expect(out.indexOf('\x1b]8;;http://evil')).toBe(-1)
  })

  test('escapes ESC and BEL characters in the url', async () => {
    const { wrapWithOsc8Link } = await import('../bridge/bridgeStatusUtil.js')
    const out = wrapWithOsc8Link('text', 'https://safe.example\x1b]8;;http://evil\x07')
    expect(out.indexOf('\x1b]8;;http://evil')).toBe(-1)
  })

  test('produces a well-formed OSC 8 hyperlink for clean input', async () => {
    const { wrapWithOsc8Link } = await import('../bridge/bridgeStatusUtil.js')
    const out = wrapWithOsc8Link('label', 'https://safe.example')
    expect(out).toBe('\x1b]8;;https://safe.example\x07label\x1b]8;;\x07')
  })
})


describe('wrapWithOsc8Link — percent encoding (issue #744)', () => {
  test('percent signs in url are percent-encoded', async () => {
    const { wrapWithOsc8Link } = await import('../bridge/bridgeStatusUtil.js')
    const out = wrapWithOsc8Link('label', 'http://example.com?foo%bar')
    // A literal % must become %25 so it cannot break the OSC8 envelope
    expect(out).toContain('%25')
    expect(out.indexOf('?foo%25bar')).not.toBe(-1)
  })

  test('percent signs in text are percent-encoded', async () => {
    const { wrapWithOsc8Link } = await import('../bridge/bridgeStatusUtil.js')
    const out = wrapWithOsc8Link('100% done', 'https://safe.example')
    expect(out).toContain('100%25 done')
  })
})

describe('bridgeConfig — no MACRO-based lazy resolver bypass (issue #745)', () => {
  test('bridgeConfig exposes only static override getters, no globalThis.MACRO resolver', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync(
      new URL('../bridge/bridgeConfig.ts', import.meta.url),
      'utf-8',
    )
    // The vulnerable getResolver() pattern re-read globalThis.MACRO to rebuild
    // the override resolver; the fixed code has no MACRO access at all.
    expect(source).not.toContain('globalThis.MACRO')
    expect(source).not.toContain('MACRO')
  })

  test('bridgeConfig still exports all four override getters', async () => {
    // Source-level assertion: importing bridgeConfig pulls in oauth.js and
    // auth.js, which other test files mock with partial exports and break
    // the module graph in the full suite (same pattern as migrate tests).
    // Assert the export declarations exist in the source instead.
    const fs = await import('fs')
    const source = fs.readFileSync(
      new URL('../bridge/bridgeConfig.ts', import.meta.url),
      'utf-8',
    )
    expect(source).toContain('export function getBridgeTokenOverride')
    expect(source).toContain('export function getBridgeBaseUrlOverride')
    expect(source).toContain('export function getBridgeAccessToken')
    expect(source).toContain('export function getBridgeBaseUrl')
  })
})
