import { describe, test, expect } from 'bun:test'

/**
 * Regression test for issue #759: initReplBridge statically imports heavy
 * modules (growthbook, oauth client, policyLimits, auth) that are only used
 * at a few points. Static imports force all of those modules to load even
 * when the bridge never starts, slowing REPL startup.
 *
 * Fix: the heavy modules must be dynamically imported at their use sites.
 */

const HEAVY_MODULES = [
  '../services/analytics/growthbook.js',
  '../services/oauth/client.js',
  '../services/policyLimits/index.js',
  '../utils/auth.js',
]

describe('initReplBridge lazy-imports heavy modules (issue #759)', () => {
  test('no heavy module is statically imported', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync(
      new URL('../initReplBridge.ts', import.meta.url),
      'utf-8',
    )
    for (const mod of HEAVY_MODULES) {
      expect(source).not.toContain(`from '${mod}'`)
      expect(source).not.toContain(`from "${mod}"`)
    }
  })

  test('heavy modules are still available via dynamic import', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync(
      new URL('../initReplBridge.ts', import.meta.url),
      'utf-8',
    )
    for (const mod of HEAVY_MODULES) {
      expect(source).toContain(`import('${mod}')`)
    }
  })
})
