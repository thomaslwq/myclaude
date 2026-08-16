import { describe, test, expect } from 'bun:test'
import { runAndVerify, defaultErrorParser } from '../selfHealing.js'

/**
 * Regression tests for the self-healing loop (issues #622/#694).
 * Written to lock in the run->parse->fix->rerun contract.
 */

describe('defaultErrorParser', () => {
  test('extracts error lines from output', () => {
    const out = 'INFO ok\nERROR: something broke\nerror TS2345: type mismatch\n'
    const errs = defaultErrorParser(out)
    expect(errs.length).toBeGreaterThan(0)
  })
})

describe('runAndVerify', () => {
  test('passes on first attempt when run succeeds cleanly', async () => {
    const outcome = await runAndVerify(
      async () => ({ exitCode: 0, output: 'all good' }),
      async () => ({ changed: false }),
    )
    expect(outcome.passed).toBe(true)
    expect(outcome.attempts).toBe(1)
    expect(outcome.failures).toEqual([])
  })

  test('retries with a fix when run fails, then passes', async () => {
    let runs = 0
    const outcome = await runAndVerify(
      async () => {
        runs++
        return runs === 1
          ? { exitCode: 1, output: 'ERROR: build failed' }
          : { exitCode: 0, output: 'build ok' }
      },
      async () => ({ changed: true }),
      { maxAttempts: 3 },
    )
    expect(outcome.passed).toBe(true)
    expect(outcome.attempts).toBe(2)
  })

  test('gives up when the fixer makes no changes', async () => {
    const outcome = await runAndVerify(
      async () => ({ exitCode: 1, output: 'ERROR: still broken' }),
      async () => ({ changed: false }),
      { maxAttempts: 3 },
    )
    expect(outcome.passed).toBe(false)
    expect(outcome.report).toContain('no changes')
  })

  test('exhausts attempts and reports failure', async () => {
    const outcome = await runAndVerify(
      async () => ({ exitCode: 1, output: 'ERROR: nope' }),
      async () => ({ changed: true }),
      { maxAttempts: 2, retryDelayMs: 0 },
    )
    expect(outcome.passed).toBe(false)
    expect(outcome.attempts).toBe(2)
    expect(outcome.failures.length).toBeGreaterThan(0)
  })
})
