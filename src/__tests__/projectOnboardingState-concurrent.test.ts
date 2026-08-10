import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test'
import {
  clearCachedSteps,
  getSteps,
} from '../projectOnboardingState'

// Mock the utils
const mockGetCwd = vi.fn(() => '/test/workspace')
const mockExistsSync = vi.fn()
const mockStatSync = vi.fn()
const mockIsDirEmptySync = vi.fn()
const mockGetCurrentProjectConfig = vi.fn(() => ({
  hasCompletedProjectOnboarding: false,
  hasDismissedProjectOnboarding: false,
}))
const mockSaveCurrentProjectConfig = vi.fn()

vi.mock('../utils/cwd', () => ({
  getCwd: (...args: any[]) => mockGetCwd(...args),
}))

vi.mock('../utils/fsOperations', () => ({
  getFsImplementation: () => ({
    existsSync: (...args: any[]) => mockExistsSync(...args),
    statSync: (...args: any[]) => mockStatSync(...args),
  }),
}))

vi.mock('../utils/file', () => ({
  isDirEmptySync: (...args: any[]) => mockIsDirEmptySync(...args),
}))

vi.mock('../utils/config', () => ({
  getCurrentProjectConfig: (...args: any[]) => mockGetCurrentProjectConfig(...args),
  saveCurrentProjectConfig: (...args: any[]) => mockSaveCurrentProjectConfig(...args),
}))

describe('projectOnboardingState - concurrent access', () => {
  beforeEach(() => {
    clearCachedSteps()
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockExistsSync.mockReturnValue(false)
    mockStatSync.mockReturnValue({ mtimeMs: Date.now() })
    mockIsDirEmptySync.mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    clearCachedSteps()
  })

  it('should return consistent results for rapid consecutive calls', () => {
    // Simulate rapid consecutive calls (10 in a row)
    const results = Array(10).fill(null).map(() => getSteps())

    // All results should be identical
    results.forEach(result => {
      expect(result).toEqual(results[0])
    })

    // isDirEmptySync is called once to build the cache, then once per
    // isCacheValid check on each subsequent call (9 more times).
    expect(mockIsDirEmptySync).toHaveBeenCalledTimes(10)
  })

  it('should return consistent results when cache is expired', () => {
    // Build the initial cache
    getSteps()

    // Expire the cache
    vi.advanceTimersByTime(6000)

    // 10 rapid calls after expiry
    const results = Array(10).fill(null).map(() => getSteps())

    // All results should be identical
    results.forEach(result => {
      expect(result).toEqual(results[0])
    })

    // Initial call: 1 call (build cache)
    // After expiry: isCacheValid returns false early (no isDirEmptySync call)
    // Call 1 (after expiry): recompute (1) = 1
    // Calls 2-10: isCacheValid (1 each) = 9
    // Total: 1 + 1 + 9 = 11
    expect(mockIsDirEmptySync).toHaveBeenCalledTimes(11)
  })

  it('should return consistent results when directory state changes during rapid calls', () => {
    // Initial call - workspace is empty
    const steps1 = getSteps()
    expect(steps1[0].isEnabled).toBe(true) // workspace step enabled

    // Simulate files being added (directory becomes non-empty)
    mockIsDirEmptySync.mockReturnValue(false)

    // Fast-forward within TTL - cache should be invalidated
    vi.advanceTimersByTime(1000)

    // 10 rapid calls after the state change
    const results = Array(10).fill(null).map(() => getSteps())

    // All results should be identical
    results.forEach(result => {
      expect(result).toEqual(results[0])
    })

    // Call 0 (initial): 1 call to build cache
    // Call 1: isCacheValid (1) + recompute (1) = 2
    // Calls 2-10: isCacheValid (1 each) = 9
    // Total: 12
    expect(mockIsDirEmptySync).toHaveBeenCalledTimes(12)
  })
})