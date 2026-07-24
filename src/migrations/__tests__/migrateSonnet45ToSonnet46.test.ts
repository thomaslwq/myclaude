import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test'
import { migrateSonnet45ToSonnet46 } from '../migrateSonnet45ToSonnet46'

// Mock dependencies
const mockGetSettingsForSource = vi.fn()
const mockUpdateSettingsForSource = vi.fn()
const mockGetAPIProvider = vi.fn()
const mockIsProSubscriber = vi.fn()
const mockIsMaxSubscriber = vi.fn()
const mockIsTeamPremiumSubscriber = vi.fn()
const mockGetGlobalConfig = vi.fn()
const mockSaveGlobalConfig = vi.fn()
const mockLogEvent = vi.fn()

vi.mock('../../utils/settings/settings.js', () => ({
  getSettingsForSource: (...args: any[]) => mockGetSettingsForSource(...args),
  updateSettingsForSource: (...args: any[]) => mockUpdateSettingsForSource(...args),
}))

vi.mock('../../utils/model/providers.js', () => ({
  getAPIProvider: (...args: any[]) => mockGetAPIProvider(...args),
}))

vi.mock('../../utils/auth.js', () => ({
  isProSubscriber: (...args: any[]) => mockIsProSubscriber(...args),
  isMaxSubscriber: (...args: any[]) => mockIsMaxSubscriber(...args),
  isTeamPremiumSubscriber: (...args: any[]) => mockIsTeamPremiumSubscriber(...args),
}))

vi.mock('../../utils/config.js', () => ({
  getGlobalConfig: (...args: any[]) => mockGetGlobalConfig(...args),
  saveGlobalConfig: (...args: any[]) => mockSaveGlobalConfig(...args),
}))

vi.mock('../../services/analytics/index.js', () => ({
  logEvent: (...args: any[]) => mockLogEvent(...args),
}))

describe('migrateSonnet45ToSonnet46', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockIsProSubscriber.mockReturnValue(true)
    mockIsMaxSubscriber.mockReturnValue(false)
    mockIsTeamPremiumSubscriber.mockReturnValue(false)
    mockGetGlobalConfig.mockReturnValue({ numStartups: 2 })
    mockSaveGlobalConfig.mockImplementation((fn: any) => fn({}))
  })

  afterEach(() => {
    delete process.env.USER_TYPE
  })

  it('should not run if API provider is not firstParty', () => {
    mockGetAPIProvider.mockReturnValue('bedrock')
    mockGetSettingsForSource.mockReturnValue({ model: 'claude-sonnet-4-5-20250929' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should not run if user is not a subscriber', () => {
    mockIsProSubscriber.mockReturnValue(false)
    mockIsMaxSubscriber.mockReturnValue(false)
    mockIsTeamPremiumSubscriber.mockReturnValue(false)
    mockGetSettingsForSource.mockReturnValue({ model: 'claude-sonnet-4-5-20250929' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should migrate claude-sonnet-4-5-20250929 to sonnet', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'claude-sonnet-4-5-20250929' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'sonnet' },
    )
  })

  it('should migrate claude-sonnet-4-5-20250929[1m] to sonnet[1m]', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'claude-sonnet-4-5-20250929[1m]' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'sonnet[1m]' },
    )
  })

  it('should migrate sonnet-4-5-20250929 to sonnet', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'sonnet-4-5-20250929' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'sonnet' },
    )
  })

  it('should migrate sonnet-4-5-20250929[1m] to sonnet[1m]', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'sonnet-4-5-20250929[1m]' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'sonnet[1m]' },
    )
  })

  // Test for the bug: exotic suffixes should be preserved
  it('should migrate sonnet-4-5-20250929[100k] to sonnet[100k]', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'sonnet-4-5-20250929[100k]' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'sonnet[100k]' },
    )
  })

  it('should migrate claude-sonnet-4-5-20250929[200k] to sonnet[200k]', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'claude-sonnet-4-5-20250929[200k]' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'sonnet[200k]' },
    )
  })

  it('should not migrate unrelated models', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'gpt-4' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should not migrate if model is undefined', () => {
    mockGetSettingsForSource.mockReturnValue({ model: undefined })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should not migrate sonnet-4-6-20251001 (different date)', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'sonnet-4-6-20251001' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should not migrate sonnet (alias)', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'sonnet' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should log an analytics event with the old model name', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'sonnet-4-5-20250929[100k]' })

    migrateSonnet45ToSonnet46()

    expect(mockLogEvent).toHaveBeenCalledWith('tengu_sonnet45_to_46_migration', {
      from_model: 'sonnet-4-5-20250929[100k]',
      has_1m: false,
    })
  })
})
