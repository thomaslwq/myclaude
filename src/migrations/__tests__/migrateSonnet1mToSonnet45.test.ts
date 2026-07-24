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

  it('should migrate sonnet[1m] to sonnet-4-5-20250929[1m]', () => {
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

    expect(mockSetMainLoopModelOverride).toHaveBeenCalledWith('sonnet-4-5-20250929[1m]')
  })

  it('should not set completion flag if updateSettingsForSource throws', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'sonnet[1m]' })
    mockUpdateSettingsForSource.mockImplementation(() => {
      throw new Error('Filesystem error')
    })
    mockGetMainLoopModelOverride.mockReturnValue(null)

    migrateSonnet1mToSonnet45()

    // saveGlobalConfig should NOT be called since updateSettingsForSource threw
    expect(mockSaveGlobalConfig).not.toHaveBeenCalled()
    // logError should be called with the error
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Failed to migrate sonnet[1m]'),
      }),
    )
  })

  it('should not set completion flag if setMainLoopModelOverride throws', () => {
    mockGetSettingsForSource.mockReturnValue({ model: 'sonnet[1m]' })
    mockGetMainLoopModelOverride.mockReturnValue('sonnet[1m]')
    mockSetMainLoopModelOverride.mockImplementation(() => {
      throw new Error('Override error')
    })

    migrateSonnet1mToSonnet45()

    // saveGlobalConfig should NOT be called since setMainLoopModelOverride threw
    expect(mockSaveGlobalConfig).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Failed to migrate sonnet[1m]'),
      }),
    )
  })
})
