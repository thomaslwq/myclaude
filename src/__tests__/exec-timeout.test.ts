import { describe, test, expect } from 'bun:test'

/**
 * Regression test for issue #849: git exec calls in
 * getChangedFilesSinceLastCommit have no timeout, risking an indefinite hang
 * (git waiting on a credential prompt, or a corrupted .git/index.lock).
 * Every git exec() call must include an explicit timeout option.
 */

describe('getChangedFilesSinceLastCommit exec timeout (issue #849)', () => {
  test('all git exec calls include a timeout option', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync(
      new URL('../dev-entry.ts', import.meta.url),
      'utf-8',
    )
    // Find the three git exec invocations and verify each block has timeout.
    const gitCalls = source.match(/exec\('git [^']+', \{/g)
    expect(gitCalls).not.toBeNull()
    expect(gitCalls!.length).toBeGreaterThanOrEqual(3)
    // Count timeout occurrences inside the exec option blocks.
    const timeoutCount = (source.match(/timeout: \d+/g) ?? []).length
    expect(timeoutCount).toBeGreaterThanOrEqual(3)
  })
})
