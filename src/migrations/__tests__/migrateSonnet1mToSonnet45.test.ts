import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test'
import { migrateSonnet1mToSonnet45 } from '../migrateSonnet1mToSonnet45'

// Mock dependencies
const mockGetSettingsForSource = vi.fn()
const mockUpdateSettingsForSource = vi.fn()
const mockGetGlobalConfig = vi.fn()
const mockSaveGlobalConfig = vi.fn()
const mockGetMainLoopModelOverride = vi.fn()
const mockSetMainLoopModelOverride = vi.fn()
const mockLogError = vi.fn()

vi.mock('../../utils/settings/settings.js', () => ({
  getSettingsForSource: (...args: any[]) => mockGetSettingsForSource(...args),
  updateSettingsForSource: (...args: any[]) => mockUpdateSettingsForSource(...args),
}))

vi.mock('../../utils/config.js', () => ({
  getGlobalConfig: (...args: any[]) => mockGetGlobalConfig(...args),
  saveGlobalConfig: (...args: any[]) => mockSaveGlobalConfig(...args),
}))

vi.mock('../../bootstrap/state.js', () => ({
  getMainLoopModelOverride: (...args: any[]) => mockGetMainLoopModelOverride(...args),
  setMainLoopModelOverride: (...args: any[]) => mockSetMainLoopModelOverride(...args),
}))

vi.mock('../../utils/log.js', () => ({
  logError: (...args: any[]) => mockLogError(...args),
}))

describe('migrateSonnet1mToSonnet45', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetGlobalConfig.mockReturnValue({ sonnet1m45MigrationComplete: false })
  })

  afterEach(() => {
    delete process.env.USER_TYPE
  })

  it('should skip migration if already complete', () => {
    mockGetGlobalConfig.mockReturnValue({ sonnet1m45MigrationComplete: true })

    migrateSonnet1mToSonnet45()

    expect(mockGetSettingsForSource).not.toHaveBeenCalled()
    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    expect(mockSaveGlobalConfig).not.toHaveBeenCalled()
  })

  it('should migrate sonnet[1m] from userSettings to sonnet-4-5-20250929[1m]', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'sonnet[1m]' })
    mockGetMainLoopModelOverride.mockReturnValue(null)

    migrateSonnet1mToSonnet45()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'sonnet-4-5-20250929[1m]' },
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
    // Verify the completion flag is set
    const saveFn = mockSaveGlobalConfig.mock.calls[0][0]
    expect(saveFn({})).toEqual({ sonnet1m45MigrationComplete: true })
  })

  it('should migrate sonnet[1m] from projectSettings to sonnet-4-5-20250929[1m]', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'sonnet[1m]' })
    mockGetMainLoopModelOverride.mockReturnValue(null)

    migrateSonnet1mToSonnet45()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'projectSettings',
      { model: 'sonnet-4-5-20250929[1m]' },
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
    const saveFn = mockSaveGlobalConfig.mock.calls[0][0]
    expect(saveFn({})).toEqual({ sonnet1m45MigrationComplete: true })
  })

  it('should migrate sonnet[1m] from localSettings to sonnet-4-5-20250929[1m]', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'sonnet[1m]' })
    mockGetMainLoopModelOverride.mockReturnValue(null)

    migrateSonnet1mToSonnet45()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'localSettings',
      { model: 'sonnet-4-5-20250929[1m]' },
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
    const saveFn = mockSaveGlobalConfig.mock.calls[0][0]
    expect(saveFn({})).toEqual({ sonnet1m45MigrationComplete: true })
  })

  it('should not update settings if model is not sonnet[1m]', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'sonnet' })
    mockGetMainLoopModelOverride.mockReturnValue(null)

    migrateSonnet1mToSonnet45()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    expect(mockSaveGlobalConfig).toHaveBeenCalled()
    const saveFn = mockSaveGlobalConfig.mock.calls[0][0]
    expect(saveFn({})).toEqual({ sonnet1m45MigrationComplete: true })
  })

  it('should also migrate in-memory override if set', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'sonnet[1m]' })
    mockGetMainLoopModelOverride.mockReturnValue('sonnet[1m]')

    migrateSonnet1mToSonnet45()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'sonnet-4-5-20250929[1m]' },
    )
    expect(mockSetMainLoopModelOverride).toHaveBeenCalledWith(
      'sonnet-4-5-20250929[1m]',
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
    const saveFn = mockSaveGlobalConfig.mock.calls[0][0]
    expect(saveFn({})).toEqual({ sonnet1m45MigrationComplete: true })
  })

  it('should handle multiple sources with sonnet[1m] in different sources', () => {
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return { model: 'sonnet[1m]' }
      if (source === 'projectSettings') return { model: 'sonnet' }
      if (source === 'localSettings') return { model: 'sonnet[1m]' }
      return undefined
    })
    mockGetMainLoopModelOverride.mockReturnValue(null)

    migrateSonnet1mToSonnet45()

    // Should have been called for userSettings and localSettings (which have sonnet[1m])
    expect(mockUpdateSettingsForSource).toHaveBeenCalledTimes(2)
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'sonnet-4-5-20250929[1m]' },
    )
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'localSettings',
      { model: 'sonnet-4-5-20250929[1m]' },
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
    const saveFn = mockSaveGlobalConfig.mock.calls[0][0]
    expect(saveFn({})).toEqual({ sonnet1m45MigrationComplete: true })
  })
})