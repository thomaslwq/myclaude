import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test'
import { migrateFennecToOpus } from '../migrateFennecToOpus'
import { getAPIProvider } from '../../utils/model/providers.js'

// Mock dependencies
const mockGetSettingsForSource = vi.fn()
const mockUpdateSettingsForSource = vi.fn()
const mockGetAPIProvider = vi.fn()

vi.mock('../../utils/settings/settings.js', () => ({
  getSettingsForSource: (...args: any[]) => mockGetSettingsForSource(...args),
  updateSettingsForSource: (...args: any[]) => mockUpdateSettingsForSource(...args),
}))

vi.mock('../../utils/model/providers.js', () => ({
  getAPIProvider: (...args: any[]) => mockGetAPIProvider(...args),
}))

describe('migrateFennecToOpus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.USER_TYPE
  })

  it('should not run if API provider is not firstParty', () => {
    mockGetAPIProvider.mockReturnValue('bedrock')
    mockGetSettingsForSource.mockReturnValue({ model: 'opus' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should migrate fennec-latest to opus (no suffix)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus' },
    )
  })

  it('should migrate fennec-latest[1m] to opus[1m]', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[1m]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1m]' },
    )
  })

  it('should migrate fennec-latest[2m] to opus[2m]', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[2m]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[2m]' },
    )
  })

  it('should migrate fennec-latest[100k] to opus[100k]', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[100k]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[100k]' },
    )
  })

  it('should migrate fennec-latest[200k] to opus[200k]', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[200k]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[200k]' },
    )
  })

  it('should not preserve uppercase suffix [1M] (invalid context-length suffix)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[1M]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus' },
    )
  })

  it('should migrate fennec-fast-latest to opus with fast mode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus' },
    )
  })

  it('should migrate fennec-fast-latest[1m] to opus[1m] with fast mode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[1m]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1m]' },
    )
  })

  it('should migrate opus-4-5-fast to opus with fast mode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'opus-4-5-fast' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus' },
    )
  })

  it('should migrate opus-4-5-fast[1m] to opus[1m] with fast mode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'opus-4-5-fast[1m]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1m]' },
    )
  })

  it('should preserve existing fastMode setting when migrating fennec-fast-latest', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest', fastMode: true })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus', fastMode: true },
    )
  })

  it('should preserve existing fastMode setting when migrating opus-4-5-fast', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'opus-4-5-fast', fastMode: false })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus', fastMode: false },
    )
  })

  it('should migrate all three editable sources', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockImplementation((source: string) => {
      if (source === 'userSettings') return { model: 'fennec-latest' }
      if (source === 'projectSettings') return { model: 'fennec-latest[1m]' }
      if (source === 'localSettings') return { model: 'fennec-fast-latest' }
      return null
    })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledTimes(3)
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith('userSettings', { model: 'opus' })
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith('projectSettings', { model: 'opus[1m]' })
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith('localSettings', { model: 'opus' })
  })

  it('should skip sources with empty model', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: '' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should skip non-fennec models', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'opus' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should skip sources with undefined model', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({})

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should log error and re-throw', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockImplementation(() => {
      throw new Error('test error')
    })

    // Should log error and re-throw
    expect(() => migrateFennecToOpus()).toThrow('test error')
  })
})
