import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test'
import { resetAutoModeOptInForDefaultOffer } from '../resetAutoModeOptInForDefaultOffer'

// Mock dependencies
const mockGetGlobalConfig = vi.fn()
const mockSaveGlobalConfig = vi.fn()
const mockGetSettingsForSource = vi.fn()
const mockUpdateSettingsForSource = vi.fn()
const mockGetInitialSettings = vi.fn()
const mockGetAutoModeEnabledState = vi.fn()
const mockLogEvent = vi.fn()
const mockLogError = vi.fn()

vi.mock('../../utils/config.js', () => ({
  getGlobalConfig: (...args: any[]) => mockGetGlobalConfig(...args),
  saveGlobalConfig: (...args: any[]) => mockSaveGlobalConfig(...args),
}))

vi.mock('../../utils/settings/settings.js', () => ({
  getSettingsForSource: (...args: any[]) => mockGetSettingsForSource(...args),
  updateSettingsForSource: (...args: any[]) => mockUpdateSettingsForSource(...args),
  getInitialSettings: (...args: any[]) => mockGetInitialSettings(...args),
}))

vi.mock('../../utils/permissions/permissionSetup.js', () => ({
  getAutoModeEnabledState: (...args: any[]) => mockGetAutoModeEnabledState(...args),
}))

vi.mock('../../services/analytics/index.js', () => ({
  logEvent: (...args: any[]) => mockLogEvent(...args),
}))

vi.mock('../../utils/log.js', () => ({
  logError: (...args: any[]) => mockLogError(...args),
}))

// Note: console.warn is not mocked as it's a browser/node built-in

describe('resetAutoModeOptInForDefaultOffer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockGetAutoModeEnabledState.mockReturnValue('enabled')
    mockGetGlobalConfig.mockReturnValue({ hasResetAutoModeOptInForDefaultOffer: false })
    mockGetInitialSettings.mockReturnValue({ permissions: { defaultMode: 'ask' } })
    mockSaveGlobalConfig.mockImplementation((fn: any) => fn({}))
    mockUpdateSettingsForSource.mockImplementation(() => {})
    // Default: no skipAutoPermissionPrompt set in any source
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {}
      if (source === 'localSettings') return {}
      if (source === 'projectSettings') return {}
      return null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should not run if already migrated', () => {
    mockGetGlobalConfig.mockReturnValue({ hasResetAutoModeOptInForDefaultOffer: true })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    expect(mockSaveGlobalConfig).not.toHaveBeenCalled()
  })

  it('should not run if auto mode is not enabled', () => {
    mockGetAutoModeEnabledState.mockReturnValue('opt-in')

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    expect(mockSaveGlobalConfig).not.toHaveBeenCalled()
  })

  it('should clear skipAutoPermissionPrompt from userSettings when set there and defaultMode is not auto', () => {
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {
        skipAutoPermissionPrompt: true,
        permissions: { defaultMode: 'ask' },
      }
      if (source === 'localSettings') return {}
      if (source === 'projectSettings') return {}
      return null
    })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { skipAutoPermissionPrompt: undefined },
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should read fresh settings after clearing (no stale cache) (issue #592)', () => {
    // Simulate the real settings.ts behavior: updateSettingsForSource deletes
    // undefined-valued keys and resets the cache, so the follow-up read in the
    // migration sees the flag as cleared — no stale-cache warning.
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') {
        return {
          skipAutoPermissionPrompt: true,
          permissions: { defaultMode: 'ask' },
        }
      }
      if (source === 'localSettings') return {}
      if (source === 'projectSettings') return {}
      return null
    })
    mockUpdateSettingsForSource.mockImplementation((source: string, updates: any) => {
      for (const key of Object.keys(updates)) {
        if (updates[key] === undefined) {
          mockGetSettingsForSource.mockImplementation((s: string) => {
            if (s === source) return { permissions: { defaultMode: 'ask' } }
            if (s === 'userSettings') return { permissions: { defaultMode: 'ask' } }
            return {}
          })
        }
      }
    })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { skipAutoPermissionPrompt: undefined },
    )
    // The post-clear read must see the flag cleared — no warning about stale data
    expect(console.warn).not.toHaveBeenCalled()
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should throw error when updateSettingsForSource fails', () => {
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {
        skipAutoPermissionPrompt: true,
        permissions: { defaultMode: 'ask' },
      }
      if (source === 'localSettings') return {}
      if (source === 'projectSettings') return {}
      return null
    })
    mockUpdateSettingsForSource.mockImplementation(() => {
      throw new Error('Failed to update settings')
    })

    expect(() => resetAutoModeOptInForDefaultOffer()).toThrow('Failed to update settings')
    expect(mockLogError).toHaveBeenCalled()
  })

  it('should throw error when saveGlobalConfig fails', () => {
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {
        skipAutoPermissionPrompt: true,
        permissions: { defaultMode: 'ask' },
      }
      if (source === 'localSettings') return {}
      if (source === 'projectSettings') return {}
      return null
    })
    mockUpdateSettingsForSource.mockImplementation(() => {})
    mockSaveGlobalConfig.mockImplementation(() => {
      throw new Error('Failed to save config')
    })

    expect(() => resetAutoModeOptInForDefaultOffer()).toThrow('Failed to save config')
    expect(mockLogError).toHaveBeenCalled()
  })

  it('should throw error when getInitialSettings fails', () => {
    mockGetInitialSettings.mockImplementation(() => {
      throw new Error('Failed to get initial settings')
    })

    expect(() => resetAutoModeOptInForDefaultOffer()).toThrow('Failed to get initial settings')
    expect(mockLogError).toHaveBeenCalled()
  })

  it('should log warning when skipAutoPermissionPrompt is set in policySettings (non-editable source)', () => {
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'policySettings') return {
        skipAutoPermissionPrompt: true,
        permissions: { defaultMode: 'ask' },
      }
      if (source === 'userSettings') return {}
      if (source === 'localSettings') return {}
      if (source === 'projectSettings') return {}
      if (source === 'flagSettings') return null
      return null
    })

    resetAutoModeOptInForDefaultOffer()

    // Should NOT update any editable source since none have the flag set
    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    // Should log a warning about non-editable sources
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('skipAutoPermissionPrompt is still set in non-editable sources'),
    )
    // Should still save the config as migrated
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
    // Should NOT log the event (since hasSkipInEditableSources is false)
    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it('should log warning when skipAutoPermissionPrompt is set in flagSettings (non-editable source)', () => {
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'flagSettings') return {
        skipAutoPermissionPrompt: true,
        permissions: { defaultMode: 'ask' },
      }
      if (source === 'userSettings') return {}
      if (source === 'localSettings') return {}
      if (source === 'projectSettings') return {}
      if (source === 'policySettings') return null
      return null
    })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('skipAutoPermissionPrompt is still set in non-editable sources'),
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should also log warning when skipAutoPermissionPrompt is set in both editable and non-editable sources', () => {
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {
        skipAutoPermissionPrompt: true,
        permissions: { defaultMode: 'ask' },
      }
      if (source === 'policySettings') return {
        skipAutoPermissionPrompt: true,
        permissions: { defaultMode: 'ask' },
      }
      if (source === 'localSettings') return {}
      if (source === 'projectSettings') return {}
      if (source === 'flagSettings') return null
      return null
    })

    resetAutoModeOptInForDefaultOffer()

    // Should clear the editable source
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { skipAutoPermissionPrompt: undefined },
    )
    // Should log warning about non-editable sources still having the flag
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('skipAutoPermissionPrompt is still set in non-editable sources'),
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
    expect(mockLogEvent).toHaveBeenCalled()
  })
})
