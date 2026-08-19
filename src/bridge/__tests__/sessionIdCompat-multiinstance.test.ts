import { describe, test, expect, beforeEach } from 'bun:test'
import {
  setCseShimGate,
  resetCseShimGateForTesting,
  getCseShimGate,
  toCompatSessionId,
} from '../sessionIdCompat.js'

/**
 * Regression tests for issue #880 (global mutable singleton state).
 *
 * Two concerns:
 *  1. Test pollution: a forgotten reset leaks gate state between test cases.
 *  2. Multi-instance conflicts: two bridge connections with different gates
 *     must not silently overwrite each other.
 *
 * The module now uses a first-writer-wins lock (issue #821): once a gate is
 * registered it is locked, so a later init path cannot silently replace the
 * first connection's gate. These tests lock in that contract.
 */

beforeEach(() => {
  resetCseShimGateForTesting()
})

describe('sessionIdCompat multi-instance isolation (issue #880)', () => {
  test('two sequential bridge inits do not overwrite the first gate', () => {
    // Bridge A initializes with shim active.
    setCseShimGate(() => true)
    expect(getCseShimGate()!()).toBe(true)
    expect(toCompatSessionId('cse_a')).toBe('session_a')

    // Bridge B initializes later with a different gate — must NOT win.
    setCseShimGate(() => false)
    expect(getCseShimGate()!()).toBe(true)
    expect(toCompatSessionId('cse_b')).toBe('session_b')
  })

  test('reset clears state so a fresh instance can register its own gate', () => {
    setCseShimGate(() => true)
    resetCseShimGateForTesting()
    setCseShimGate(() => false)
    expect(getCseShimGate()!()).toBe(false)
    expect(toCompatSessionId('cse_c')).toBe('cse_c') // shim off
  })

  test('translation behavior stays stable after the first gate wins', () => {
    setCseShimGate(() => true)
    expect(toCompatSessionId('cse_x')).toBe('session_x')
    // Even if a later caller tries to disable the shim, already-registered
    // connections keep their behavior (no mid-execution flip).
    setCseShimGate(() => false)
    expect(toCompatSessionId('cse_y')).toBe('session_y')
  })
})
