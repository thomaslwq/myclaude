import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Regression test for issue #829: Repeated dynamic import('fs/promises') in hot
 * paths causes unnecessary overhead.
 *
 * The source file should use a static `import { stat } from 'fs/promises'`
 * instead of repeated `await import('fs/promises')` calls in hot paths.
 */
describe('static import of fs/promises stat (issue #829)', () => {
  test('dev-entry.ts uses static import for stat, not dynamic import', () => {
    const source = readFileSync(
      join(import.meta.dir, '..', 'dev-entry.ts'),
      'utf8',
    )

    // The static import line should include stat
    const hasStaticStatImport = /import\s+\{[^}]*\bstat\b[^}]*\}\s+from\s+['"]fs\/promises['"]/.test(source)
    expect(hasStaticStatImport).toBe(true)

    // There should be no dynamic import of fs/promises remaining
    const hasDynamicFsPromisesImport = /await\s+import\s*\(\s*['"]fs\/promises['"]\s*\)/.test(source)
    expect(hasDynamicFsPromisesImport).toBe(false)
  })
})
