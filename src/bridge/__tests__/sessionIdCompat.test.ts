import { describe, test, expect, beforeEach } from 'bun:test'
import {
  setCseShimGate,
  resetCseShimGateForTesting,
  toCompatSessionId,
  toInfraSessionId,
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
