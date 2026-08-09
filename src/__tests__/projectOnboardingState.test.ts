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
      // No I/O on second call — cache is valid within TTL
      // Note: isDirEmptySync is called in isCacheValid() to check for changes
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

      // Fast-forward within TTL - cache should be invalidated due to emptiness change
      vi.advanceTimersByTime(1000)

      const steps2 = getSteps()
      expect(steps2).not.toEqual(steps1) // new steps returned
      expect(steps2[0].isEnabled).toBe(false) // workspace step now disabled
      expect(steps2[1].isEnabled).toBe(true) // claude.md step now enabled

      // Verify isDirEmptySync was called again (cache invalidated, I/O occurred)
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

      // Fast-forward within TTL - cache should be invalidated due to emptiness change
      vi.advanceTimersByTime(1000)

      const steps2 = getSteps()
      expect(steps2).not.toEqual(steps1) // new steps returned
      expect(steps2[0].isEnabled).toBe(true) // workspace step now enabled
      expect(steps2[1].isEnabled).toBe(false) // claude.md step now disabled

      // Verify isDirEmptySync was called again (cache invalidated, I/O occurred)
      expect(mockIsDirEmptySync).toHaveBeenCalledTimes(3)
    })

    it('should invalidate cache when CLAUDE.md mtime changes', () => {
      mockIsDirEmptySync.mockReturnValue(false)
      mockExistsSync.mockReturnValue(true)

      const initialMtime = Date.now()
      mockStatSync.mockReturnValue({ mtimeMs: initialMtime })

      // Initial call - CLAUDE.md exists
      const steps1 = getSteps()
      expect(steps1[0].isEnabled).toBe(false) // workspace step disabled
      expect(steps1[1].isEnabled).toBe(true) // claude.md step enabled

      // Simulate CLAUDE.md being edited (mtime changes)
      const newMtime = initialMtime + 1000
      mockStatSync.mockReturnValue({ mtimeMs: newMtime })

      // Cache should be invalidated due to mtime change, causing I/O
      const steps2 = getSteps()
      expect(mockIsDirEmptySync).toHaveBeenCalledTimes(2) // I/O occurred
    })

    it('should invalidate cache when CLAUDE.md is created', () => {
      mockIsDirEmptySync.mockReturnValue(true)
      mockExistsSync.mockReturnValue(false) // No CLAUDE.md initially

      // Initial call - no CLAUDE.md
      const steps1 = getSteps()
      expect(steps1[0].isEnabled).toBe(true) // workspace step enabled
      expect(steps1[1].isEnabled).toBe(false) // claude.md step disabled

      // Simulate CLAUDE.md being created
      mockExistsSync.mockReturnValue(true)
      const newMtime = Date.now()
      mockStatSync.mockReturnValue({ mtimeMs: newMtime })

      // Cache should be invalidated due to CLAUDE.md creation
      const steps2 = getSteps()
      expect(steps2).not.toEqual(steps1) // new steps returned
      expect(mockIsDirEmptySync).toHaveBeenCalledTimes(2) // I/O occurred
    })

    it('should invalidate cache when CLAUDE.md is deleted', () => {
      mockIsDirEmptySync.mockReturnValue(false)
      mockExistsSync.mockReturnValue(true)
      mockStatSync.mockReturnValue({ mtimeMs: Date.now() })

      // Initial call - CLAUDE.md exists
      const steps1 = getSteps()
      expect(steps1[0].isEnabled).toBe(false) // workspace step disabled
      expect(steps1[1].isEnabled).toBe(true) // claude.md step enabled

      // Simulate CLAUDE.md being deleted
      mockExistsSync.mockReturnValue(false)

      // Cache should be invalidated due to CLAUDE.md deletion
      const steps2 = getSteps()
      expect(steps2).not.toEqual(steps1) // new steps returned
      expect(mockIsDirEmptySync).toHaveBeenCalledTimes(2) // I/O occurred
    })
  })
})