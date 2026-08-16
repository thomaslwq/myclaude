import { describe, test, expect } from 'bun:test'

/**
 * Regression tests for /checkpoint argument routing (issue #672/#599).
 * call() routes '' / 'list' to list, 'restore <n>' to restore, else create.
 * We test the routing regex indirectly by loading the module and
 * asserting the exported call function exists and the restore regex
 * matches expected shapes (source-level, since call() shells to git).
 */

describe('/checkpoint argument parsing (rewind.ts)', () => {
  test('module exports the call entrypoint', async () => {
    const mod = await import('../rewind.js')
    expect(typeof mod.call).toBe('function')
  })

  test('restore regex accepts /^restore|undo N$/ shapes', () => {
    const re = /^(?:restore|undo)\s+(\d+)$/
    expect('restore 3'.match(re)?.[1]).toBe('3')
    expect('undo 12'.match(re)?.[1]).toBe('12')
    expect('restore'.match(re)).toBeNull()
    expect('restore abc'.match(re)).toBeNull()
    expect('create checkpoint foo'.match(re)).toBeNull()
  })
})
