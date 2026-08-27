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
 *  2. Gate updates: a transient GrowthBook failure must not permanently
 *     disable the shim — a later corrected gate can overwrite the first
 *     via EXPLICIT `{ force: true }` (issue #941). Plain calls are
 *     first-writer-wins (issue #969).
 */

beforeEach(async () => {
  await resetCseShimGateForTesting()
})

describe('sessionIdCompat multi-instance isolation (issue #880)', () => {
  test('a later corrected gate can overwrite a transient false gate via force', async () => {
    // Bridge A initializes with shim disabled due to transient failure.
    await setCseShimGate(() => false)
    expect(getCseShimGate()!()).toBe(false)
    expect(toCompatSessionId('cse_a')).toBe('cse_a')

    // GrowthBook recovers — Bridge B explicitly forces a corrected gate.
    await setCseShimGate(() => true, { force: true })
    expect(getCseShimGate()!()).toBe(true)
    expect(toCompatSessionId('cse_b')).toBe('session_b')
  })

  test('reset clears state so a fresh instance can register its own gate', async () => {
    await setCseShimGate(() => true)
    await resetCseShimGateForTesting()
    await setCseShimGate(() => false)
    expect(getCseShimGate()!()).toBe(false)
    expect(toCompatSessionId('cse_c')).toBe('cse_c') // shim off
  })

  test('translation behavior reflects the latest gate', async () => {
    await setCseShimGate(() => true)
    expect(toCompatSessionId('cse_x')).toBe('session_x')
    // A later caller can disable the shim (recovery in the other direction)
    // via explicit force.
    await setCseShimGate(() => false, { force: true })
    expect(toCompatSessionId('cse_y')).toBe('cse_y')
  })
})
