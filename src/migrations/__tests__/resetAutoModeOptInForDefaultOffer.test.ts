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
    mockSaveGlobalConfig.mockImplementation(async (fn: any) => fn({}))
    mockUpdateSettingsForSource.mockImplementation(async () => {})
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

  it('should not run if already migrated', async () => {
    mockGetGlobalConfig.mockReturnValue({ hasResetAutoModeOptInForDefaultOffer: true })

    await resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    expect(mockSaveGlobalConfig).not.toHaveBeenCalled()
  })

  it('should not run if auto mode is not enabled', async () => {
    mockGetAutoModeEnabledState.mockReturnValue('opt-in')

    await resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    expect(mockSaveGlobalConfig).not.toHaveBeenCalled()
  })

  it('should clear skipAutoPermissionPrompt from userSettings when set there and defaultMode is not auto', async () => {
    // Use a mutable store so getSettingsForSource returns updated state after clearing
    const settingsStore: Record<string, any> = {
      userSettings: { skipAutoPermissionPrompt: true, permissions: { defaultMode: 'ask' } },
      localSettings: {},
      projectSettings: {},
    }
    mockGetSettingsForSource.mockImplementation((source: string) => settingsStore[source] ?? null)
    mockUpdateSettingsForSource.mockImplementation(async (source: string, updates: any) => {
      settingsStore[source] = { ...settingsStore[source], ...updates }
    })

    await resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { skipAutoPermissionPrompt: undefined },
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should throw error when updateSettingsForSource fails and NOT mark migration as complete', async () => {
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {
        skipAutoPermissionPrompt: true,
        permissions: { defaultMode: 'ask' },
      }
      if (source === 'localSettings') return {}
      if (source === 'projectSettings') return {}
      return null
    })
    mockUpdateSettingsForSource.mockImplementation(async () => {
      throw new Error('Failed to update settings')
    })

    await expect(resetAutoModeOptInForDefaultOffer()).rejects.toThrow('Failed to update settings')
    expect(mockLogError).toHaveBeenCalled()
    // Migration must NOT mark itself complete if the clear operation failed
    expect(mockSaveGlobalConfig).not.toHaveBeenCalled()
  })

  it('should clear skipAutoPermissionPrompt from localSettings and projectSettings when set there', async () => {
    const settingsStore: Record<string, any> = {
      userSettings: { skipAutoPermissionPrompt: true, permissions: { defaultMode: 'ask' } },
      localSettings: { skipAutoPermissionPrompt: true, permissions: { defaultMode: 'ask' } },
      projectSettings: { skipAutoPermissionPrompt: true, permissions: { defaultMode: 'ask' } },
    }
    mockGetSettingsForSource.mockImplementation((source: string) => settingsStore[source] ?? null)
    mockUpdateSettingsForSource.mockImplementation(async (source: string, updates: any) => {
      settingsStore[source] = { ...settingsStore[source], ...updates }
    })

    await resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { skipAutoPermissionPrompt: undefined },
    )
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'localSettings',
      { skipAutoPermissionPrompt: undefined },
    )
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'projectSettings',
      { skipAutoPermissionPrompt: undefined },
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should clear skipAutoPermissionPrompt if defaultMode is auto', async () => {
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return {
        skipAutoPermissionPrompt: true,
      }
      if (source === 'localSettings') return {}
      if (source === 'projectSettings') return {}
      return null
    })
    mockGetInitialSettings.mockReturnValue({ permissions: { defaultMode: 'auto' } })

    await resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { skipAutoPermissionPrompt: undefined },
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should handle async delayed write correctly', async () => {
    const settingsStore: Record<string, any> = {
      userSettings: { skipAutoPermissionPrompt: true, permissions: { defaultMode: 'ask' } },
      localSettings: {},
      projectSettings: {},
    }
    mockGetSettingsForSource.mockImplementation((source: string) => settingsStore[source] ?? null)
    // Simulate a delayed async write
    const delay = 10
    mockUpdateSettingsForSource.mockImplementation(async (source: string, updates: any) => {
      await new Promise(resolve => setTimeout(resolve, delay))
      settingsStore[source] = { ...settingsStore[source], ...updates }
    })
    mockSaveGlobalConfig.mockImplementation(async (fn: any) => {
      await new Promise(resolve => setTimeout(resolve, delay))
      return fn({})
    })

    await resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { skipAutoPermissionPrompt: undefined },
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should handle async failure in saveGlobalConfig gracefully', async () => {
    const settingsStore: Record<string, any> = {
      userSettings: { skipAutoPermissionPrompt: true, permissions: { defaultMode: 'ask' } },
      localSettings: {},
      projectSettings: {},
    }
    mockGetSettingsForSource.mockImplementation((source: string) => settingsStore[source] ?? null)
    mockUpdateSettingsForSource.mockImplementation(async (source: string, updates: any) => {
      settingsStore[source] = { ...settingsStore[source], ...updates }
    })
    mockSaveGlobalConfig.mockImplementation(async () => {
      throw new Error('Async save failed')
    })

    await expect(resetAutoModeOptInForDefaultOffer()).rejects.toThrow('Async save failed')
  })
})
