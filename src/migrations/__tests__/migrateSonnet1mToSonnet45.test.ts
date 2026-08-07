import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test'
import { migrateSonnet1mToSonnet45 } from '../migrateSonnet1mToSonnet45'
import { CLAUDE_SONNET_4_5_CONFIG } from '../../utils/model/configs.js'

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

const sonnet45Model1m = `${CLAUDE_SONNET_4_5_CONFIG.firstParty}[1m]`

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

  it('should migrate sonnet[1m] from userSettings to the canonical Sonnet 4.5 model', () => {
    // Only userSettings has sonnet[1m]; other sources return null
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return { model: 'sonnet[1m]' }
      return null
    })
    mockGetMainLoopModelOverride.mockReturnValue(null)

    migrateSonnet1mToSonnet45()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: sonnet45Model1m },
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

  it('should migrate sonnet[1m] from projectSettings to the canonical Sonnet 4.5 model', () => {
    // Only projectSettings has sonnet[1m]; other sources return null
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'projectSettings') return { model: 'sonnet[1m]' }
      return null
    })
    mockGetMainLoopModelOverride.mockReturnValue(null)

    migrateSonnet1mToSonnet45()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'projectSettings',
      { model: sonnet45Model1m },
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

  it('should migrate sonnet[1m] from localSettings to the canonical Sonnet 4.5 model', () => {
    // Only localSettings has sonnet[1m]; other sources return null
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'localSettings') return { model: 'sonnet[1m]' }
      return null
    })
    mockGetMainLoopModelOverride.mockReturnValue(null)

    migrateSonnet1mToSonnet45()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'localSettings',
      { model: sonnet45Model1m },
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

  it('should migrate model override from sonnet[1m] to the canonical Sonnet 4.5 model', () => {
    mockGetSettingsForSource.mockReturnValue(null)
    mockGetMainLoopModelOverride.mockReturnValue('sonnet[1m]')

    migrateSonnet1mToSonnet45()

    expect(mockSetMainLoopModelOverride).toHaveBeenCalledWith(sonnet45Model1m)
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
    const saveFn = mockSaveGlobalConfig.mock.calls[0][0]
    expect(saveFn({})).toEqual({ sonnet1m45MigrationComplete: true })
  })

  it('should handle migration across multiple sources', () => {
    // Both userSettings and projectSettings have sonnet[1m]
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return { model: 'sonnet[1m]' }
      if (source === 'projectSettings') return { model: 'sonnet[1m]' }
      return null
    })
    mockGetMainLoopModelOverride.mockReturnValue('sonnet[1m]')

    migrateSonnet1mToSonnet45()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: sonnet45Model1m },
    )
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'projectSettings',
      { model: sonnet45Model1m },
    )
    expect(mockUpdateSettingsForSource).not.toHaveBeenCalledWith(
      'localSettings',
      expect.anything(),
    )
    expect(mockSetMainLoopModelOverride).toHaveBeenCalledWith(sonnet45Model1m)
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
    const saveFn = mockSaveGlobalConfig.mock.calls[0][0]
    expect(saveFn({})).toEqual({ sonnet1m45MigrationComplete: true })
  })

  it('should handle errors gracefully', () => {
    mockGetSettingsForSource.mockImplementation(() => {
      throw new Error('Settings error')
    })
    mockGetMainLoopModelOverride.mockReturnValue(null)

    migrateSonnet1mToSonnet45()

    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Failed to migrate sonnet[1m]'),
      }),
    )
  })

  it('should not migrate non-matching models', () => {
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return { model: 'haiku' }
      return null
    })
    mockGetMainLoopModelOverride.mockReturnValue(null)

    migrateSonnet1mToSonnet45()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
    const saveFn = mockSaveGlobalConfig.mock.calls[0][0]
    expect(saveFn({})).toEqual({ sonnet1m45MigrationComplete: true })
  })
})
