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

  it('should preserve uppercase suffix [1M] (valid context-length suffix)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[1M]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1M]' },
    )
  })

  it('should migrate fennec-fast-latest to opus (no suffix, no fastMode in settings)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus' },
    )
  })

  it('should migrate fennec-fast-latest[1m] to opus[1m] (no fastMode in settings)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[1m]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1m]' },
    )
  })

  it('should migrate opus-4-5-fast to opus (no suffix, no fastMode in settings)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'opus-4-5-fast' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus' },
    )
  })

  it('should migrate opus-4-5-fast[1m] to opus[1m] (no fastMode in settings)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'opus-4-5-fast[1m]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1m]' },
    )
  })

  it('should reject fennec-latest[1m][200k] (multiple suffixes are invalid)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[1m][200k]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should reject fennec-latest[1m][200k][500k] (multiple suffixes are invalid)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[1m][200k][500k]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should reject fennec-fast-latest[1m][200k] (multiple suffixes are invalid)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[1m][200k]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should reject opus-4-5-fast[1m][200k] (multiple suffixes are invalid)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'opus-4-5-fast[1m][200k]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should reject fennec-latest[1M][200K] (multiple uppercase suffixes are invalid)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[1M][200K]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should migrate fennec-fast-latest[1M] to opus[1M] (uppercase suffix)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[1M]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1M]' },
    )
  })

  it('should migrate opus-4-5-fast[1M] to opus[1M] (uppercase suffix)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'opus-4-5-fast[1M]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1M]' },
    )
  })

  it('should migrate fennec-fast-latest[100K] to opus[100K] (uppercase suffix)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[100K]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[100K]' },
    )
  })

  it('should migrate opus-4-5-fast[100K] to opus[100K] (uppercase suffix)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'opus-4-5-fast[100K]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[100K]' },
    )
  })

  it('should reject fennec-fast-latest[1M][200K] (multiple uppercase suffixes are invalid)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[1M][200K]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should reject opus-4-5-fast[1M][200K] (multiple uppercase suffixes are invalid)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'opus-4-5-fast[1M][200K]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })
})