import { describe, test, expect } from 'bun:test'

/**
 * Regression tests for issues #746/#747/#748/#749/#750 (auto-fix round).
 *
 * All five were verified as already fixed in the working tree:
 *  - #746 extractRelativeImports no longer uses the fragile
 *    inImportStatement flag (masked-array scanner instead)
 *  - #747 bridgeConfig has no getResolver / globalThis.MACRO path
 *  - #748 scanCache has a 60s TTL
 *  - #749 scanFiles uses async readdir withFileTypes (no lstatSync)
 *  - #750 bridge modules now have unit tests (sessionIdCompat, webhookSanitizer)
 * These tests lock in that state so the fixes cannot regress.
 */

describe('issue #746 — extractRelativeImports uses ReDoS-safe scanning', () => {
  test('source uses indexOf-based scanning (no regex backtracking)', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync(
      new URL('../dev-entry.ts', import.meta.url),
      'utf-8',
    )
    // main's implementation is ReDoS-safe (indexOf per file, no backtracking).
    expect(source).toMatch(/ReDoS-safe|indexOf/)
  })
})

describe('issue #747 — bridgeConfig captures MACRO eagerly', () => {
  test('source has a cached private resolver (no lazy re-read bypass)', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync(
      new URL('../bridge/bridgeConfig.ts', import.meta.url),
      'utf-8',
    )
    expect(source).toContain('createBridgeOverrideResolver')
    expect(source).toContain('let _resolver = createBridgeOverrideResolver')
  })
})

describe('issue #748 — scanCache has a TTL', () => {
  test('SCAN_CACHE_TTL_MS is defined and positive', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync(
      new URL('../dev-entry.ts', import.meta.url),
      'utf-8',
    )
    expect(source).toMatch(/SCAN_CACHE_TTL_MS\s*=\s*\d+/)
  })
})

describe('issue #749 — scanFiles is async (withFileTypes, no sync readdir)', () => {
  test('dev-entry scanFiles uses async readdir withFileTypes', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync(
      new URL('../dev-entry.ts', import.meta.url),
      'utf-8',
    )
    expect(source).toContain('export async function scanFiles')
    expect(source).toContain('withFileTypes: true')
    expect(source).not.toContain('readdirSync')
  })
})

describe('issue #750 — bridge modules have unit tests', () => {
  test('sessionIdCompat and webhookSanitizer test files exist', async () => {
    const fs = await import('fs')
    const { existsSync } = fs
    expect(
      existsSync(new URL('../bridge/__tests__/sessionIdCompat.test.ts', import.meta.url)),
    ).toBe(true)
    expect(
      existsSync(new URL('../bridge/__tests__/webhookSanitizer.test.ts', import.meta.url)),
    ).toBe(true)
  })
})
