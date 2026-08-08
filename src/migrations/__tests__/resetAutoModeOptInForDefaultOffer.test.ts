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

// Note: console.warn is not mocked as it's a browser/node built-in, but we no longer use it in this migration

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

  it('should throw error when updateSettingsForSource fails and NOT mark migration as complete', () => {
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
    // Migration must NOT mark itself complete if the clear operation failed
    expect(mockSaveGlobalConfig).not.toHaveBeenCalled()
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
    // Should log an event about non-editable sources
    expect(mockLogEvent).toHaveBeenCalledWith(
      'tengu_migrate_reset_auto_opt_in_for_default_offer_skipped',
      { reason: 'skipAutoPermissionPrompt_set_in_non_editable_sources' }
    )
    // Should still save the config as migrated
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
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
    expect(mockLogEvent).toHaveBeenCalledWith(
      'tengu_migrate_reset_auto_opt_in_for_default_offer_skipped',
      { reason: 'skipAutoPermissionPrompt_set_in_non_editable_sources' }
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
    expect(mockLogEvent).toHaveBeenCalledWith(
      'tengu_migrate_reset_auto_opt_in_for_default_offer_skipped',
      { reason: 'skipAutoPermissionPrompt_set_in_non_editable_sources' }
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })
})
