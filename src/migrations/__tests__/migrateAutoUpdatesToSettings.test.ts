import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test'
import { migrateAutoUpdatesToSettings } from '../migrateAutoUpdatesToSettings'

// Mock dependencies
const mockLogEvent = vi.fn()
const mockLogError = vi.fn()
const mockGetGlobalConfig = vi.fn()
const mockSaveGlobalConfig = vi.fn()
const mockGetSettingsForSource = vi.fn()
const mockUpdateSettingsForSource = vi.fn()

vi.mock('../../services/analytics/index.js', () => ({
  logEvent: (...args: any[]) => mockLogEvent(...args),
}))

vi.mock('../../utils/log.js', () => ({
  logError: (...args: any[]) => mockLogError(...args),
}))

vi.mock('../../utils/config.js', () => ({
  getGlobalConfig: (...args: any[]) => mockGetGlobalConfig(...args),
  saveGlobalConfig: (...args: any[]) => mockSaveGlobalConfig(...args),
}))

vi.mock('../../utils/settings/settings.js', () => ({
  getSettingsForSource: (...args: any[]) => mockGetSettingsForSource(...args),
  updateSettingsForSource: (...args: any[]) => mockUpdateSettingsForSource(...args),
}))

describe('migrateAutoUpdatesToSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Save original env
    process.env.DISABLE_AUTOUPDATER = ''
  })

  afterEach(() => {
    delete process.env.DISABLE_AUTOUPDATER
  })

  it('should not mutate process.env.DISABLE_AUTOUPDATER', () => {
    mockGetGlobalConfig.mockReturnValue({
      autoUpdates: false,
      autoUpdatesProtectedForNative: false,
    })
    mockGetSettingsForSource.mockReturnValue({})

    migrateAutoUpdatesToSettings()

    // The migration should NOT set process.env.DISABLE_AUTOUPDATER directly
    expect(process.env.DISABLE_AUTOUPDATER).toBe('')
  })

  it('should write DISABLE_AUTOUPDATER to user settings env', () => {
    mockGetGlobalConfig.mockReturnValue({
      autoUpdates: false,
      autoUpdatesProtectedForNative: false,
    })
    mockGetSettingsForSource.mockReturnValue({})

    migrateAutoUpdatesToSettings()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      expect.objectContaining({
        env: {
          DISABLE_AUTOUPDATER: '1',
        },
      }),
    )
  })

  it('should respect existing DISABLE_AUTOUPDATER value in user settings', () => {
    mockGetGlobalConfig.mockReturnValue({
      autoUpdates: false,
      autoUpdatesProtectedForNative: false,
    })
    mockGetSettingsForSource.mockReturnValue({
      env: {
        DISABLE_AUTOUPDATER: '0', // User explicitly wants to enable auto-updates
      },
    })

    migrateAutoUpdatesToSettings()

    // Should NOT overwrite the user's existing value
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      expect.objectContaining({
        env: {
          DISABLE_AUTOUPDATER: '0', // User's value should be preserved
        },
      }),
    )
  })

  it('should preserve other env vars when setting DISABLE_AUTOUPDATER', () => {
    mockGetGlobalConfig.mockReturnValue({
      autoUpdates: false,
      autoUpdatesProtectedForNative: false,
    })
    mockGetSettingsForSource.mockReturnValue({
      env: {
        MY_CUSTOM_VAR: 'my-value',
        OTHER_VAR: 'other-value',
      },
    })

    migrateAutoUpdatesToSettings()

    // Other env vars should be preserved alongside DISABLE_AUTOUPDATER
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      {
        env: {
          MY_CUSTOM_VAR: 'my-value',
          OTHER_VAR: 'other-value',
          DISABLE_AUTOUPDATER: '1',
        },
      },
    )
  })

  it('should not run if autoUpdates is not false', () => {
    mockGetGlobalConfig.mockReturnValue({
      autoUpdates: true,
    })

    migrateAutoUpdatesToSettings()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should not run if autoUpdatesProtectedForNative is true', () => {
    mockGetGlobalConfig.mockReturnValue({
      autoUpdates: false,
      autoUpdatesProtectedForNative: true,
    })

    migrateAutoUpdatesToSettings()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should remove autoUpdates and autoUpdatesProtectedForNative from global config after migration', () => {
    mockGetGlobalConfig.mockReturnValue({
      autoUpdates: false,
      autoUpdatesProtectedForNative: false,
    })
    mockGetSettingsForSource.mockReturnValue({})
    mockSaveGlobalConfig.mockImplementation(
      (fn: (current: any) => any) => fn({ autoUpdates: false, autoUpdatesProtectedForNative: false, otherKey: 'value' }),
    )

    migrateAutoUpdatesToSettings()

    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })
})
