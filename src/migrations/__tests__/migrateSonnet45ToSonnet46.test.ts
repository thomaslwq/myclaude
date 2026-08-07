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

  it('should migrate non-subscriber first-party users from sonnet-4-5 to sonnet', () => {
    mockIsProSubscriber.mockReturnValue(false)
    mockIsMaxSubscriber.mockReturnValue(false)
    mockIsTeamPremiumSubscriber.mockReturnValue(false)
    mockGetSettingsForSource.mockReturnValue({ model: 'claude-sonnet-4-5-20250929' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'sonnet' },
    )
  })

  it('should migrate claude-sonnet-4-5-20250929 to sonnet', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'claude-sonnet-4-5-20250929' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'sonnet' },
    )
  })

  it('should migrate projectSettings', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'claude-sonnet-4-5-20250929' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'projectSettings',
      { model: 'sonnet' },
    )
  })

  it('should migrate localSettings', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'claude-sonnet-4-5-20250929' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'localSettings',
      { model: 'sonnet' },
    )
  })

  it('should migrate all three sources', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'claude-sonnet-4-5-20250929' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'sonnet' },
    )
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'projectSettings',
      { model: 'sonnet' },
    )
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'localSettings',
      { model: 'sonnet' },
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

  it('should migrate claude-sonnet-4-5-20250929[1m] to sonnet[1m]', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'claude-sonnet-4-5-20250929[1m]' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'sonnet[1m]' },
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

  it('should migrate from projectSettings to sonnet', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'claude-sonnet-4-5-20250929' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'projectSettings',
      { model: 'sonnet' },
    )
  })

  it('should migrate from localSettings to sonnet', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'claude-sonnet-4-5-20250929' })

    migrateSonnet45ToSonnet46()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'localSettings',
      { model: 'sonnet' },
    )
  })

  it('should handle multiple sources with sonnet-4-5 in different sources', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'claude-sonnet-4-5-20250929' })

    migrateSonnet45ToSonnet46()

    // Should have been called for each source
    expect(mockUpdateSettingsForSource).toHaveBeenCalledTimes(3)
  })
})