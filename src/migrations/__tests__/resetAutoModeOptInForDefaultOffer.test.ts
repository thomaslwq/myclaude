import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test'
import { resetAutoModeOptInForDefaultOffer } from '../resetAutoModeOptInForDefaultOffer'

// Mock dependencies
const mockGetGlobalConfig = vi.fn()
const mockSaveGlobalConfig = vi.fn()
const mockGetSettingsForSource = vi.fn()
const mockUpdateSettingsForSource = vi.fn()
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
    mockSaveGlobalConfig.mockImplementation((fn: any) => fn({}))
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

  it('should clear skipAutoPermissionPrompt when user has skipAutoPermissionPrompt but defaultMode is not auto', () => {
    mockGetSettingsForSource.mockReturnValue({
      skipAutoPermissionPrompt: true,
      permissions: { defaultMode: 'ask' },
    })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith('userSettings', {
      skipAutoPermissionPrompt: undefined,
    })
    expect(mockLogEvent).toHaveBeenCalledWith('tengu_migrate_reset_auto_opt_in_for_default_offer', {})
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should not clear skipAutoPermissionPrompt when defaultMode is already auto', () => {
    mockGetSettingsForSource.mockReturnValue({
      skipAutoPermissionPrompt: true,
      permissions: { defaultMode: 'auto' },
    })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    expect(mockLogEvent).not.toHaveBeenCalled()
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should not clear skipAutoPermissionPrompt when skipAutoPermissionPrompt is not set', () => {
    mockGetSettingsForSource.mockReturnValue({
      permissions: { defaultMode: 'ask' },
    })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    expect(mockLogEvent).not.toHaveBeenCalled()
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should mark migration as complete even if no change needed', () => {
    mockGetSettingsForSource.mockReturnValue({
      permissions: { defaultMode: 'auto' },
    })

    resetAutoModeOptInForDefaultOffer()

    expect(mockSaveGlobalConfig).toHaveBeenCalled()
    // Verify the callback saves hasResetAutoModeOptInForDefaultOffer: true
    const saveFn = mockSaveGlobalConfig.mock.calls[0][0]
    const result = saveFn({ hasResetAutoModeOptInForDefaultOffer: false })
    expect(result.hasResetAutoModeOptInForDefaultOffer).toBe(true)
  })

  it('should handle errors gracefully', () => {
    mockGetSettingsForSource.mockImplementation(() => {
      throw new Error('test error')
    })

    resetAutoModeOptInForDefaultOffer()

    expect(mockLogError).toHaveBeenCalled()
    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should run the migration body regardless of feature flags', () => {
    // Previously this was gated behind if (feature('TRANSCRIPT_CLASSIFIER'))
    // which always returned false. Now the body should execute directly.
    mockGetSettingsForSource.mockReturnValue({
      skipAutoPermissionPrompt: true,
      permissions: { defaultMode: 'ask' },
    })

    resetAutoModeOptInForDefaultOffer()

    expect(mockUpdateSettingsForSource).toHaveBeenCalled()
    expect(mockLogEvent).toHaveBeenCalled()
  })
})
