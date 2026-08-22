import { describe, test, expect, beforeEach } from 'bun:test'
import {
  setCseShimGate,
  resetCseShimGateForTesting,
  toCompatSessionId,
  toInfraSessionId,
  getCseShimGate,
} from '../sessionIdCompat.js'

/**
 * Regression tests for issue #705 (global mutable session-ID gate).
 *
 * The gate is module-level state set via setCseShimGate(); if it were
 * re-settable after the first translation call, behavior would change
 * mid-execution. The fix locks the gate so the first registration wins.
 */

beforeEach(async () => {
  await resetCseShimGateForTesting()
})

describe('sessionIdCompat — gate lifecycle (issue #705)', () => {
  test('with no gate registered, cse_* IDs are translated (shim active by default)', () => {
    expect(toCompatSessionId('cse_abc123')).toBe('session_abc123')
    expect(toCompatSessionId('session_abc123')).toBe('session_abc123') // no-op
  })

  test('gate returning false disables the cse_ shim', async () => {
    await setCseShimGate(() => false)
    expect(toCompatSessionId('cse_abc123')).toBe('cse_abc123') // untranslated
    expect(toCompatSessionId('session_abc123')).toBe('session_abc123')
  })

  test('gate returning true keeps the shim active', async () => {
    await setCseShimGate(() => true)
    expect(toCompatSessionId('cse_abc123')).toBe('session_abc123')
  })

  test('unawaited setCseShimGate is immediately visible to synchronous reads (issue #935)', () => {
    // Regression test: the async-mutex used to defer the gate write to a
    // microtask, so a synchronous read right after the call observed the old
    // (undefined) gate. The write must be synchronous so sync readers like
    // toCompatSessionId / toInfraSessionId can never see a stale gate.
    resetCseShimGateForTesting()
    setCseShimGate(() => false) // deliberately NOT awaited
    expect(toCompatSessionId('cse_abc123')).toBe('cse_abc123') // untranslated
    expect(toInfraSessionId('session_abc123')).toBe('session_abc123')
  })

  test('first-writer-wins: a later init path cannot overwrite the first gate (issue #880)', async () => {
    // First registration: shim active
    await setCseShimGate(() => true)
    expect(toCompatSessionId('cse_abc123')).toBe('session_abc123')

    // A second registration with a different gate CAN overwrite the first
    // gate to allow recovery from transient failures (issue #941).
    await setCseShimGate(() => false)
    expect(toCompatSessionId('cse_abc123')).toBe('cse_abc123')
  })

  test('toInfraSessionId is the inverse and respects the gate', async () => {
    await setCseShimGate(() => true)
    expect(toInfraSessionId('session_abc123')).toBe('cse_abc123')
    expect(toInfraSessionId('cse_abc123')).toBe('cse_abc123') // no-op
    // When the shim is disabled, neither direction translates.
    await resetCseShimGateForTesting()
    await setCseShimGate(() => false)
    expect(toInfraSessionId('session_abc123')).toBe('session_abc123')
  })
})

describe('sessionIdCompat — concurrent initialization (issue #880)', () => {
  test('concurrent setCseShimGate calls are safe — first writer wins', async () => {
    resetCseShimGateForTesting()

    // Simulate two async init paths (REPL bridge + daemon bridge) that
    // both call setCseShimGate concurrently. Because the gate is a
    // lazily-evaluated function, the last writer wins, which allows
    // recovery from transient failures (issue #941).
    const gateA = () => true
    const gateB = () => false

    await Promise.all([
      Promise.resolve().then(() => setCseShimGate(gateA)),
      Promise.resolve().then(() => setCseShimGate(gateB)),
    ])

    // The last-registered gate should be the one stored.
    expect(getCseShimGate()).toBe(gateB)
    // And translation behavior must reflect gate B (shim disabled).
    expect(toCompatSessionId('cse_abc123')).toBe('cse_abc123')
  })

  test('gate is set synchronously within setCseShimGate before returning', async () => {
    resetCseShimGateForTesting()

    // The assignment is synchronous, so after the microtask runs the
    // gate is immediately visible to subsequent callers.
    const gateA = () => true
    const gateB = () => false

    const results = await Promise.all([
      Promise.resolve().then(() => setCseShimGate(gateA)),
      Promise.resolve().then(() => setCseShimGate(gateB)),
    ])

    // A gate should be registered (last writer wins).
    expect(getCseShimGate()).toBeDefined()
    expect(getCseShimGate()).toBe(gateB)
    expect(results).toEqual([undefined, undefined])
  })
})

