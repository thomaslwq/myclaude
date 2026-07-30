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
    // Only userSettings has sonnet[1m]; other sources return null
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return { model: 'sonnet[1m]' }
      return null
    })
    mockGetMainLoopModelOverride.mockReturnValue(null)

    migrateSonnet1mToSonnet45()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'sonnet-4-5-20250929[1m]' },
    )
    // Should NOT update projectSettings or localSettings
    expect(mockUpdateSettingsForSource).not.toHaveBeenCalledWith(
      'projectSettings',
      expect.anything(),
    )
    expect(mockUpdateSettingsForSource).not.toHaveBeenCalledWith(
      'localSettings',
      expect.anything(),
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
    const saveFn = mockSaveGlobalConfig.mock.calls[0][0]
    expect(saveFn({})).toEqual({ sonnet1m45MigrationComplete: true })
  })

  it('should migrate sonnet[1m] from projectSettings to sonnet-4-5-20250929[1m]', () => {
    // Only projectSettings has sonnet[1m]; other sources return null
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'projectSettings') return { model: 'sonnet[1m]' }
      return null
    })
    mockGetMainLoopModelOverride.mockReturnValue(null)

    migrateSonnet1mToSonnet45()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'projectSettings',
      { model: 'sonnet-4-5-20250929[1m]' },
    )
    // Should NOT update userSettings or localSettings
    expect(mockUpdateSettingsForSource).not.toHaveBeenCalledWith(
      'userSettings',
      expect.anything(),
    )
    expect(mockUpdateSettingsForSource).not.toHaveBeenCalledWith(
      'localSettings',
      expect.anything(),
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
    const saveFn = mockSaveGlobalConfig.mock.calls[0][0]
    expect(saveFn({})).toEqual({ sonnet1m45MigrationComplete: true })
  })

  it('should migrate sonnet[1m] from localSettings to sonnet-4-5-20250929[1m]', () => {
    // Only localSettings has sonnet[1m]; other sources return null
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'localSettings') return { model: 'sonnet[1m]' }
      return null
    })
    mockGetMainLoopModelOverride.mockReturnValue(null)

    migrateSonnet1mToSonnet45()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'localSettings',
      { model: 'sonnet-4-5-20250929[1m]' },
    )
    // Should NOT update userSettings or projectSettings
    expect(mockUpdateSettingsForSource).not.toHaveBeenCalledWith(
      'userSettings',
      expect.anything(),
    )
    expect(mockUpdateSettingsForSource).not.toHaveBeenCalledWith(
      'projectSettings',
      expect.anything(),
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
    const saveFn = mockSaveGlobalConfig.mock.calls[0][0]
    expect(saveFn({})).toEqual({ sonnet1m45MigrationComplete: true })
  })

  it('should not update settings if model is not sonnet[1m]', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'claude-sonnet-4-20250514' })
    mockGetMainLoopModelOverride.mockReturnValue(null)

    migrateSonnet1mToSonnet45()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should also migrate in-memory override if set', () => {
    mockGetSettingsForSource.mockReturnValue(null)
    mockGetMainLoopModelOverride.mockReturnValue('sonnet[1m]')

    migrateSonnet1mToSonnet45()

    expect(mockSetMainLoopModelOverride).toHaveBeenCalledWith('sonnet-4-5-20250929[1m]')
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should handle error gracefully', () => {
    mockGetSettingsForSource.mockImplementation(() => {
      throw new Error('test error')
    })

    migrateSonnet1mToSonnet45()

    expect(mockLogError).toHaveBeenCalledWith(expect.any(Error))
    expect(mockSaveGlobalConfig).not.toHaveBeenCalled()
  })

  it('should handle multiple sources with sonnet[1m] in different sources', () => {
    // Both userSettings and projectSettings have sonnet[1m]
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings' || source === 'projectSettings') {
        return { model: 'sonnet[1m]' }
      }
      return null
    })
    mockGetMainLoopModelOverride.mockReturnValue(null)

    migrateSonnet1mToSonnet45()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'sonnet-4-5-20250929[1m]' },
    )
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'projectSettings',
      { model: 'sonnet-4-5-20250929[1m]' },
    )
    expect(mockUpdateSettingsForSource).not.toHaveBeenCalledWith(
      'localSettings',
      expect.anything(),
    )
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
  })
})
