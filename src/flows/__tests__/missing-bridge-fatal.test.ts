import { describe, test, expect } from 'bun:test'
import { shouldContinueOnError } from '../executor.js'

/**
 * Regression tests for issue #871: shouldContinueOnError treated
 * "No bridge.runCommand available" / "No bridge.editFile available" as a
 * recoverable error, so a misconfigured/missing bridge made every step
 * silently fail while the flow ran to completion — masking real failures.
 *
 * Fix: a missing bridge is a configuration error that must abort the flow,
 * not be silently swallowed.
 */

describe('shouldContinueOnError - missing bridge is fatal (issue #871)', () => {
  test('No bridge.runCommand error aborts the flow', async () => {
    expect(await shouldContinueOnError(new Error('No bridge.runCommand available to execute: echo hi'), {} as never))
      .toBe(false)
  })

  test('No bridge.editFile error aborts the flow', async () => {
    expect(await shouldContinueOnError(new Error('No bridge.editFile available to edit: src/a.ts'), {} as never))
      .toBe(false)
  })

  test('ETIMEDOUT is still transient (recoverable)', async () => {
    expect(await shouldContinueOnError(new Error('ETIMEDOUT: operation timed out'), {} as never))
      .toBe(true)
  })
})
