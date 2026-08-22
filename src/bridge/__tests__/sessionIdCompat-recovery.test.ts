import { describe, test, expect, beforeEach } from 'bun:test'
import {
  setCseShimGate,
  resetCseShimGateForTesting,
  toCompatSessionId,
  toInfraSessionId,
  getCseShimGate,
} from '../sessionIdCompat.js'

/**
 * Regression tests for issue #941: transient GrowthBook failures should
 * not permanently lock in a bad gate.
 */

beforeEach(async () => {
  await resetCseShimGateForTesting()
})

describe('sessionIdCompat — gate recovery (issue #941)', () => {
  test('transient false gate can be overwritten with true gate', async () => {
    // First caller registers a false gate due to transient failure
    await setCseShimGate(() => false)
    expect(toCompatSessionId('cse_abc123')).toBe('cse_abc123') // untranslated

    // GrowthBook recovers, second caller registers a corrected gate
    await setCseShimGate(() => true)
    expect(toCompatSessionId('cse_abc123')).toBe('session_abc123') // now translated
  })

  test('transient true gate can be overwritten with false gate', async () => {
    // First caller registers a true gate
    await setCseShimGate(() => true)
    expect(toCompatSessionId('cse_abc123')).toBe('session_abc123')

    // GrowthBook changes, second caller registers a corrected gate
    await setCseShimGate(() => false)
    expect(toCompatSessionId('cse_abc123')).toBe('cse_abc123') // now untranslated
  })

  test('multiple overwrites are allowed', async () => {
    await setCseShimGate(() => false)
    expect(toCompatSessionId('cse_abc123')).toBe('cse_abc123')

    await setCseShimGate(() => true)
    expect(toCompatSessionId('cse_abc123')).toBe('session_abc123')

    await setCseShimGate(() => false)
    expect(toCompatSessionId('cse_abc123')).toBe('cse_abc123')

    await setCseShimGate(() => true)
    expect(toCompatSessionId('cse_abc123')).toBe('session_abc123')
  })

  test('getCseShimGate returns the latest registered gate', async () => {
    await setCseShimGate(() => false)
    expect(getCseShimGate()).toBeInstanceOf(Function)
    expect(getCseShimGate()!()).toBe(false)

    await setCseShimGate(() => true)
    expect(getCseShimGate()!()).toBe(true)
  })

  test('unawaited setCseShimGate is immediately visible to synchronous reads', () => {
    resetCseShimGateForTesting()
    setCseShimGate(() => false) // deliberately NOT awaited
    expect(toCompatSessionId('cse_abc123')).toBe('cse_abc123') // untranslated
    expect(toInfraSessionId('session_abc123')).toBe('session_abc123')
  })
})
