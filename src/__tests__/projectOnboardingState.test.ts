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

describe('projectOnboardingState', () => {
  beforeEach(() => {
    clearCachedSteps()
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockExistsSync.mockReturnValue(false)
    mockStatSync.mockReturnValue({ mtimeMs: Date.now() })
  })

  afterEach(() => {
    vi.useRealTimers()
    clearCachedSteps()
  })

  describe('getSteps', () => {
    it('should return cached steps when cache is valid', () => {
      mockIsDirEmptySync.mockReturnValue(true)

      const steps1 = getSteps()
      const steps2 = getSteps()

      expect(steps1).toEqual(steps2)
      expect(mockIsDirEmptySync).toHaveBeenCalledTimes(2)
    })

    it('should invalidate cache when directory becomes non-empty within TTL', () => {
      mockIsDirEmptySync.mockReturnValue(true)

      // Initial call - workspace is empty
      const steps1 = getSteps()
      expect(steps1[0].isEnabled).toBe(true) // workspace step enabled
      expect(steps1[1].isEnabled).toBe(false) // claude.md step disabled

      // Simulate files being added (directory becomes non-empty)
      mockIsDirEmptySync.mockReturnValue(false)

      // Fast-forward within TTL - cache should be invalidated
      vi.advanceTimersByTime(1000)

      const steps2 = getSteps()
      expect(steps2[0].isEnabled).toBe(false) // workspace step should be disabled
      expect(steps2[1].isEnabled).toBe(true) // claude.md step should be enabled

      // Verify isDirEmptySync was called again (cache invalidated)
      expect(mockIsDirEmptySync).toHaveBeenCalledTimes(3)
    })

    it('should invalidate cache when directory becomes empty within TTL', () => {
      mockIsDirEmptySync.mockReturnValue(false)

      // Initial call - workspace is not empty
      const steps1 = getSteps()
      expect(steps1[0].isEnabled).toBe(false) // workspace step disabled
      expect(steps1[1].isEnabled).toBe(true) // claude.md step enabled

      // Simulate files being removed (directory becomes empty)
      mockIsDirEmptySync.mockReturnValue(true)

      // Fast-forward within TTL - cache should be invalidated
      vi.advanceTimersByTime(1000)

      const steps2 = getSteps()
      expect(steps2[0].isEnabled).toBe(true) // workspace step should be enabled
      expect(steps2[1].isEnabled).toBe(false) // claude.md step should be disabled

      // Verify isDirEmptySync was called again (cache invalidated)
      expect(mockIsDirEmptySync).toHaveBeenCalledTimes(3)
    })

    it('should use cached steps when directory emptiness changes but TTL is exceeded', () => {
      mockIsDirEmptySync.mockReturnValue(true)

      // Initial call
      const steps1 = getSteps()

      // Simulate files being added
      mockIsDirEmptySync.mockReturnValue(false)

      // Fast-forward past TTL - cache should be invalidated by TTL, not by directory check
      vi.advanceTimersByTime(5001)

      const steps2 = getSteps()
      expect(steps2[0].isEnabled).toBe(false) // workspace step disabled
      expect(steps2[1].isEnabled).toBe(true) // claude.md step enabled

      // Verify isDirEmptySync was called again (TTL expired)
      expect(mockIsDirEmptySync).toHaveBeenCalledTimes(2)
    })
  })
})
