import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { resetProToOpusDefault } from '../resetProToOpusDefault'

// Mock dependencies
const mockGetGlobalConfig = vi.fn()
const mockSaveGlobalConfig = vi.fn()
const mockGetAPIProvider = vi.fn()
const mockGetSettingsForSource = vi.fn()
const mockIsProSubscriber = vi.fn()
const mockLogEvent = vi.fn()

vi.mock('../../utils/model/providers.js', () => ({
  getAPIProvider: (...args: any[]) => mockGetAPIProvider(...args),
}))

vi.mock('../../utils/config.js', () => ({
  getGlobalConfig: (...args: any[]) => mockGetGlobalConfig(...args),
  saveGlobalConfig: (...args: any[]) => mockSaveGlobalConfig(...args),
}))

vi.mock('../../utils/settings/settings.js', () => ({
  getSettingsForSource: (...args: any[]) => mockGetSettingsForSource(...args),
}))

vi.mock('../../utils/auth.js', () => ({
  isProSubscriber: (...args: any[]) => mockIsProSubscriber(...args),
}))

vi.mock('../../services/analytics/index.js', () => ({
  logEvent: (...args: any[]) => mockLogEvent(...args),
}))

describe('resetProToOpusDefault', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not run if migration is already complete', () => {
    mockGetGlobalConfig.mockReturnValue({ opusProMigrationComplete: true })

    resetProToOpusDefault()

    expect(mockSaveGlobalConfig).not.toHaveBeenCalled()
    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it('should skip when API provider is not firstParty', () => {
    mockGetGlobalConfig.mockReturnValue({ opusProMigrationComplete: false })
    mockGetAPIProvider.mockReturnValue('bedrock')

    resetProToOpusDefault()

    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(
      expect.any(Function),
    )
    expect(mockLogEvent).toHaveBeenCalledWith('tengu_reset_pro_to_opus_default', {
      skipped: true,
    })
  })

  it('should skip when user is not a pro subscriber', () => {
    mockGetGlobalConfig.mockReturnValue({ opusProMigrationComplete: false })
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockIsProSubscriber.mockReturnValue(false)

    resetProToOpusDefault()

    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(
      expect.any(Function),
    )
    expect(mockLogEvent).toHaveBeenCalledWith('tengu_reset_pro_to_opus_default', {
      skipped: true,
    })
  })

  it('should show notification if user has no custom model in userSettings', () => {
    mockGetGlobalConfig.mockReturnValue({ opusProMigrationComplete: false })
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockIsProSubscriber.mockReturnValue(true)
    mockGetSettingsForSource.mockReturnValue({ model: undefined })

    resetProToOpusDefault()

    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(
      expect.any(Function),
    )
    expect(mockLogEvent).toHaveBeenCalledWith('tengu_reset_pro_to_opus_default', {
      skipped: false,
      had_custom_model: false,
    })
  })

  it('should skip notification if user has custom model in userSettings', () => {
    mockGetGlobalConfig.mockReturnValue({ opusProMigrationComplete: false })
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockIsProSubscriber.mockReturnValue(true)
    mockGetSettingsForSource.mockReturnValue({ model: 'gpt-4' })

    resetProToOpusDefault()

    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(
      expect.any(Function),
    )
    expect(mockLogEvent).toHaveBeenCalledWith('tengu_reset_pro_to_opus_default', {
      skipped: false,
      had_custom_model: true,
    })
  })

  it('should show notification even if other sources have model set, but userSettings does not', () => {
    // This test validates the bug fix: userSettings is checked, not merged settings
    mockGetGlobalConfig.mockReturnValue({ opusProMigrationComplete: false })
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockIsProSubscriber.mockReturnValue(true)
    // userSettings has no model set
    mockGetSettingsForSource.mockReturnValue({ model: undefined })

    resetProToOpusDefault()

    expect(mockLogEvent).toHaveBeenCalledWith('tengu_reset_pro_to_opus_default', {
      skipped: false,
      had_custom_model: false,
    })
  })

  it('should get settings from userSettings source', () => {
    mockGetGlobalConfig.mockReturnValue({ opusProMigrationComplete: false })
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockIsProSubscriber.mockReturnValue(true)
    mockGetSettingsForSource.mockReturnValue({ model: undefined })

    resetProToOpusDefault()

    expect(mockGetSettingsForSource).toHaveBeenCalledWith('userSettings')
  })
})
