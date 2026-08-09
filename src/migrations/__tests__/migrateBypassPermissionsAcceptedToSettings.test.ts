import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { migrateBypassPermissionsAcceptedToSettings } from '../migrateBypassPermissionsAcceptedToSettings'

// Mock dependencies
const mockGetGlobalConfig = vi.fn()
const mockSaveGlobalConfig = vi.fn()
const mockGetSettingsForSource = vi.fn()
const mockUpdateSettingsForSource = vi.fn()
const mockHasSkipDangerousModePermissionPrompt = vi.fn()

vi.mock('../../utils/config.js', () => ({
  getGlobalConfig: (...args: any[]) => mockGetGlobalConfig(...args),
  saveGlobalConfig: (...args: any[]) => mockSaveGlobalConfig(...args),
}))

vi.mock('../../utils/settings/settings.js', () => ({
  getSettingsForSource: (...args: any[]) => mockGetSettingsForSource(...args),
  updateSettingsForSource: (...args: any[]) => mockUpdateSettingsForSource(...args),
  hasSkipDangerousModePermissionPrompt: (...args: any[]) => mockHasSkipDangerousModePermissionPrompt(...args),
}))

describe('migrateBypassPermissionsAcceptedToSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveGlobalConfig.mockImplementation((updater) => {
      const config = mockGetGlobalConfig()
      return updater(config)
    })
  })

  it('should not run if bypassPermissionsModeAccepted is not set', async () => {
    mockGetGlobalConfig.mockReturnValue({})

    await migrateBypassPermissionsAcceptedToSettings()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    expect(mockSaveGlobalConfig).not.toHaveBeenCalled()
  })

  it('should not run if skipDangerousModePermissionPrompt is already set to true via hasSkipDangerousModePermissionPrompt', async () => {
    mockGetGlobalConfig.mockReturnValue({ bypassPermissionsModeAccepted: true })
    mockHasSkipDangerousModePermissionPrompt.mockReturnValue(true)

    await migrateBypassPermissionsAcceptedToSettings()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should not run if user explicitly opted out', async () => {
    mockGetGlobalConfig.mockReturnValue({ bypassPermissionsModeAccepted: true })
    mockHasSkipDangerousModePermissionPrompt.mockReturnValue(false)
    mockGetSettingsForSource.mockReturnValue({ skipDangerousModePermissionPrompt: false })

    await migrateBypassPermissionsAcceptedToSettings()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should migrate and remove bypassPermissionsModeAccepted when update succeeds', async () => {
    mockGetGlobalConfig.mockReturnValue({
      bypassPermissionsModeAccepted: true,
      otherSetting: 'value',
    })
    mockHasSkipDangerousModePermissionPrompt.mockReturnValue(false)
    mockGetSettingsForSource.mockReturnValue({})
    mockUpdateSettingsForSource.mockReturnValue({ error: null })

    await migrateBypassPermissionsAcceptedToSettings()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith('userSettings', {
      skipDangerousModePermissionPrompt: true,
    })
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should NOT remove bypassPermissionsModeAccepted when update fails', async () => {
    mockGetGlobalConfig.mockReturnValue({
      bypassPermissionsModeAccepted: true,
      otherSetting: 'value',
    })
    mockHasSkipDangerousModePermissionPrompt.mockReturnValue(false)
    mockGetSettingsForSource.mockReturnValue({})
    mockUpdateSettingsForSource.mockReturnValue({ error: new Error('Write failed') })

    await expect(migrateBypassPermissionsAcceptedToSettings()).rejects.toThrow('Write failed')

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith('userSettings', {
      skipDangerousModePermissionPrompt: true,
    })
    expect(mockSaveGlobalConfig).not.toHaveBeenCalled()
  })

  it('should propagate error when update throws', async () => {
    mockGetGlobalConfig.mockReturnValue({
      bypassPermissionsModeAccepted: true,
      otherSetting: 'value',
    })
    mockHasSkipDangerousModePermissionPrompt.mockReturnValue(false)
    mockGetSettingsForSource.mockReturnValue({})
    mockUpdateSettingsForSource.mockImplementation(() => {
      throw new Error('Unexpected error')
    })

    await expect(migrateBypassPermissionsAcceptedToSettings()).rejects.toThrow('Unexpected error')

    expect(mockSaveGlobalConfig).not.toHaveBeenCalled()
  })
})