import { describe, test, expect } from 'bun:test'
import { shouldContinueOnError } from '../executor.js'

/**
 * Regression tests for issue #888: shouldContinueOnError only treats
 * ETIMEDOUT as transient, missing common transient network errors that
 * DO resolve on retry (connection reset, network unreachable, broken pipe,
 * DNS resolution, socket hangup).
 *
 * Fix: extend the transient set with the standard Node/libuv network
 * error codes while keeping permanent errors (EACCES/ENOENT) fatal.
 */

describe('shouldContinueOnError - transient network errors (issue #888)', () => {
  test('common transient network errors are recoverable', async () => {
    const transient = ['ECONNRESET', 'ENETUNREACH', 'EPIPE', 'EAI_AGAIN']
    for (const code of transient) {
      const err = Object.assign(new Error('network'), { code })
      expect(await shouldContinueOnError(err, {} as never), `code=${code}`).toBe(true)
    }
  })

  test('ETIMEDOUT remains transient', async () => {
    const err = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
    expect(await shouldContinueOnError(err, {} as never)).toBe(true)
  })

  test('permanent errors stay fatal', async () => {
    for (const code of ['EACCES', 'ENOENT']) {
      const err = Object.assign(new Error('fs'), { code })
      expect(await shouldContinueOnError(err, {} as never), `code=${code}`).toBe(false)
    }
  })
})
