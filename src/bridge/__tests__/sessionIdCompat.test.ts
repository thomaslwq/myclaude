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

beforeEach(() => {
  resetCseShimGateForTesting()
})

describe('sessionIdCompat — gate lifecycle (issue #705)', () => {
  test('with no gate registered, cse_* IDs are translated (shim active by default)', () => {
    expect(toCompatSessionId('cse_abc123')).toBe('session_abc123')
    expect(toCompatSessionId('session_abc123')).toBe('session_abc123') // no-op
  })

  test('gate returning false disables the cse_ shim', () => {
    setCseShimGate(() => false)
    expect(toCompatSessionId('cse_abc123')).toBe('cse_abc123') // untranslated
    expect(toCompatSessionId('session_abc123')).toBe('session_abc123')
  })

  test('gate returning true keeps the shim active', () => {
    setCseShimGate(() => true)
    expect(toCompatSessionId('cse_abc123')).toBe('session_abc123')
  })

  test('gate can be updated by a later init path (issue #860)', () => {
    // First registration: shim active
    setCseShimGate(() => true)
    expect(toCompatSessionId('cse_abc123')).toBe('session_abc123')

    // A second registration with a different gate MUST be honored so that
    // a transient GrowthBook failure (first caller registers () => false)
    // can be corrected once GrowthBook recovers (issue #860).
    setCseShimGate(() => false)
    expect(toCompatSessionId('cse_abc123')).toBe('cse_abc123')
  })

  test('toInfraSessionId is the inverse and respects the gate', () => {
    setCseShimGate(() => true)
    expect(toInfraSessionId('session_abc123')).toBe('cse_abc123')
    expect(toInfraSessionId('cse_abc123')).toBe('cse_abc123') // no-op
    // When the shim is disabled, neither direction translates.
    resetCseShimGateForTesting()
    setCseShimGate(() => false)
    expect(toInfraSessionId('session_abc123')).toBe('session_abc123')
  })
})

describe('sessionIdCompat — concurrent initialization (issue #860)', () => {
  test('concurrent setCseShimGate calls are safe — last writer wins', async () => {
    resetCseShimGateForTesting()

    // Simulate two async init paths (REPL bridge + daemon bridge) that
    // both call setCseShimGate concurrently. Because the gate is a
    // lazily-evaluated function, there is no stale cached boolean — the
    // last writer wins, which is the desired behavior so a later init
    // path can correct a transient failure from an earlier one (issue #860).
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

