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

describe('resetAutoModeOptInForDefaultOffer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAutoModeEnabledState.mockReturnValue('enabled')
    mockGetGlobalConfig.mockReturnValue({ hasResetAutoModeOptInForDefaultOffer: false })
    mockGetInitialSettings.mockReturnValue({ permissions: { defaultMode: 'ask' } })
    mockSaveGlobalConfig.mockImplementation((fn: any) => fn({}))
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
    mockGetInitialSettings.mockReturnValue({ permissions: { defaultMode: 'ask' } })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith('userSettings', {
      skipAutoPermissionPrompt: undefined,
    })
    expect(mockUpdateSettingsForSource).toHaveBeenCalledTimes(1)
    expect(mockLogEvent).toHaveBeenCalledWith('tengu_migrate_reset_auto_opt_in_for_default_offer', {})
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should not clear skipAutoPermissionPrompt when defaultMode is already auto', () => {
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {
        skipAutoPermissionPrompt: true,
        permissions: { defaultMode: 'auto' },
      }
      if (source === 'localSettings') return {}
      if (source === 'projectSettings') return {}
      return null
    })
    mockGetInitialSettings.mockReturnValue({ permissions: { defaultMode: 'auto' } })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    expect(mockLogEvent).not.toHaveBeenCalled()
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should clear skipAutoPermissionPrompt from localSettings when set there (higher priority)', () => {
    // skipAutoPermissionPrompt is set in localSettings (higher priority) but not userSettings
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {}
      if (source === 'localSettings') return {
        skipAutoPermissionPrompt: true,
        permissions: { defaultMode: 'ask' },
      }
      if (source === 'projectSettings') return {}
      return null
    })
    mockGetInitialSettings.mockReturnValue({ permissions: { defaultMode: 'ask' } })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith('localSettings', {
      skipAutoPermissionPrompt: undefined,
    })
    expect(mockUpdateSettingsForSource).toHaveBeenCalledTimes(1)
    expect(mockLogEvent).toHaveBeenCalledWith('tengu_migrate_reset_auto_opt_in_for_default_offer', {})
  })

  it('should clear skipAutoPermissionPrompt from all sources where it is set', () => {
    // skipAutoPermissionPrompt is set in both userSettings and localSettings
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {
        skipAutoPermissionPrompt: true,
      }
      if (source === 'localSettings') return {
        skipAutoPermissionPrompt: true,
      }
      if (source === 'projectSettings') return {}
      return null
    })
    mockGetInitialSettings.mockReturnValue({ permissions: { defaultMode: 'ask' } })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith('userSettings', {
      skipAutoPermissionPrompt: undefined,
    })
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith('localSettings', {
      skipAutoPermissionPrompt: undefined,
    })
    expect(mockUpdateSettingsForSource).toHaveBeenCalledTimes(2)
    expect(mockLogEvent).toHaveBeenCalledWith('tengu_migrate_reset_auto_opt_in_for_default_offer', {})
  })

  it('should use effective defaultMode (highest priority) rather than userSettings defaultMode', () => {
    // userSettings has defaultMode 'ask' but localSettings (higher priority) has defaultMode 'auto'
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {
        skipAutoPermissionPrompt: true,
        permissions: { defaultMode: 'ask' },
      }
      if (source === 'localSettings') return {
        skipAutoPermissionPrompt: true,
        permissions: { defaultMode: 'auto' },
      }
      if (source === 'projectSettings') return {}
      return null
    })
    // Effective defaultMode is 'auto' (from localSettings, higher priority)
    mockGetInitialSettings.mockReturnValue({ permissions: { defaultMode: 'auto' } })

    resetAutoModeOptInForDefaultOffer()

    // Should NOT clear because effective defaultMode is already 'auto'
    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    expect(mockLogEvent).not.toHaveBeenCalled()
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should handle case where skipAutoPermissionPrompt is set in projectSettings', () => {
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {}
      if (source === 'localSettings') return {}
      if (source === 'projectSettings') return {
        skipAutoPermissionPrompt: true,
      }
      return null
    })
    mockGetInitialSettings.mockReturnValue({ permissions: { defaultMode: 'ask' } })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith('projectSettings', {
      skipAutoPermissionPrompt: undefined,
    })
    expect(mockUpdateSettingsForSource).toHaveBeenCalledTimes(1)
    expect(mockLogEvent).toHaveBeenCalledWith('tengu_migrate_reset_auto_opt_in_for_default_offer', {})
  })

  it('should clear skipAutoPermissionPrompt from userSettings when explicitly set to false', () => {
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {
        skipAutoPermissionPrompt: false,
        permissions: { defaultMode: 'ask' },
      }
      if (source === 'localSettings') return {}
      if (source === 'projectSettings') return {}
      return null
    })
    mockGetInitialSettings.mockReturnValue({ permissions: { defaultMode: 'ask' } })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith('userSettings', {
      skipAutoPermissionPrompt: undefined,
    })
    expect(mockUpdateSettingsForSource).toHaveBeenCalledTimes(1)
    expect(mockLogEvent).toHaveBeenCalledWith('tengu_migrate_reset_auto_opt_in_for_default_offer', {})
  })

  it('should clear skipAutoPermissionPrompt from all sources even when some are false', () => {
    // skipAutoPermissionPrompt is true in userSettings, false in localSettings
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {
        skipAutoPermissionPrompt: true,
      }
      if (source === 'localSettings') return {
        skipAutoPermissionPrompt: false,
      }
      if (source === 'projectSettings') return {}
      return null
    })
    mockGetInitialSettings.mockReturnValue({ permissions: { defaultMode: 'ask' } })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith('userSettings', {
      skipAutoPermissionPrompt: undefined,
    })
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith('localSettings', {
      skipAutoPermissionPrompt: undefined,
    })
    expect(mockUpdateSettingsForSource).toHaveBeenCalledTimes(2)
    expect(mockLogEvent).toHaveBeenCalledWith('tengu_migrate_reset_auto_opt_in_for_default_offer', {})
  })

  it('should not clear if skipAutoPermissionPrompt is not set in any source', () => {
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {}
      if (source === 'localSettings') return {}
      if (source === 'projectSettings') return {}
      return null
    })
    mockGetInitialSettings.mockReturnValue({ permissions: { defaultMode: 'ask' } })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    expect(mockLogEvent).not.toHaveBeenCalled()
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should not clear if defaultMode is not set', () => {
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {
        skipAutoPermissionPrompt: true,
      }
      if (source === 'localSettings') return {}
      if (source === 'projectSettings') return {}
      return null
    })
    mockGetInitialSettings.mockReturnValue({ permissions: {} })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    expect(mockLogEvent).not.toHaveBeenCalled()
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should always mark migration as done even when no clearing needed', () => {
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {}
      if (source === 'localSettings') return {}
      if (source === 'projectSettings') return {}
      return null
    })

    resetAutoModeOptInForDefaultOffer()

    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should handle errors gracefully', () => {
    mockGetSettingsForSource.mockImplementation(() => {
      throw new Error('test error')
    })

    expect(() => resetAutoModeOptInForDefaultOffer()).not.toThrow()
    expect(mockLogError).toHaveBeenCalled()
  })
})
