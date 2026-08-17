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

  test('gate is locked after first registration — later gates are ignored (issue #705)', () => {
    // First registration: shim active
    setCseShimGate(() => true)
    expect(toCompatSessionId('cse_abc123')).toBe('session_abc123')

    // A second registration with a different gate must NOT change behavior
    // mid-execution; the first gate wins.
    setCseShimGate(() => false)
    expect(toCompatSessionId('cse_abc123')).toBe('session_abc123')
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

describe('sessionIdCompat — concurrent initialization (issue #821)', () => {
  test('concurrent setCseShimGate calls do not race — first gate wins', async () => {
    resetCseShimGateForTesting()

    // Simulate two async init paths (REPL bridge + daemon bridge) that
    // both call setCseShimGate concurrently. The first gate (true) must win;
    // the second (false) must be ignored.
    const gateA = () => true
    const gateB = () => false

    await Promise.all([
      Promise.resolve().then(() => setCseShimGate(gateA)),
      Promise.resolve().then(() => setCseShimGate(gateB)),
    ])

    // The first-registered gate should be the one stored.
    expect(getCseShimGate()).toBe(gateA)
    // And translation behavior must reflect gate A (shim active).
    expect(toCompatSessionId('cse_abc123')).toBe('session_abc123')
  })

  test('gate is set synchronously within setCseShimGate before returning', async () => {
    resetCseShimGateForTesting()

    // Even when interleaved with microtasks, the lock must be acquired
    // synchronously so no other async task can observe an unlocked state.
    const gateA = () => true
    const gateB = () => false

    // Schedule both on the microtask queue; whichever runs first, the
    // other must see the lock as already held.
    const results = await Promise.all([
      Promise.resolve().then(() => setCseShimGate(gateA)),
      Promise.resolve().then(() => setCseShimGate(gateB)),
    ])

    // Exactly one gate should be registered.
    expect(getCseShimGate()).toBeDefined()
    expect(getCseShimGate()).toBe(gateA)
    expect(results).toEqual([undefined, undefined])
  })
})

