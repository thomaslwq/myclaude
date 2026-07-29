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

  it('should migrate fennec-latest[1] to opus[1]', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[1]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1]' },
    )
  })

  it('should migrate fennec-latest[100] to opus[100]', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[100]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[100]' },
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

  it('should migrate fennec-latest[500] to opus[500]', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[500]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[500]' },
    )
  })

  it('should migrate fennec-latest[1M] to opus[1M]', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[1M]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1M]' },
    )
  })

  it('should migrate fennec-latest to opus', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus' },
    )
  })

  it('should migrate fennec-fast-latest to opus without fastMode (no suffix)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus' },
    )
  })

  it('should migrate fennec-fast-latest[1] to opus[1] without fastMode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[1]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1]' },
    )
  })

  it('should migrate fennec-fast-latest[100] to opus[100] without fastMode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[100]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[100]' },
    )
  })

  it('should migrate fennec-fast-latest[1m] to opus[1m] without fastMode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[1m]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1m]' },
    )
  })

  it('should migrate fennec-fast-latest[2m] to opus[2m] without fastMode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[2m]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[2m]' },
    )
  })

  it('should migrate fennec-fast-latest[500] to opus[500] without fastMode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[500]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[500]' },
    )
  })

  it('should migrate fennec-fast-latest[1M] to opus[1M] without fastMode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[1M]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1M]' },
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

  it('should migrate fennec-fast-latest[100k] to opus[100k] without fastMode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[100k]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[100k]' },
    )
  })

  it('should migrate fennec-fast-latest[200k] to opus[200k] without fastMode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[200k]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[200k]' },
    )
  })

  it('should migrate fennec-fast-latest[100k] to opus[100k] with fastMode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[100k]', fastMode: true })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[100k]', fastMode: true },
    )
  })

  it('should migrate fennec-fast-latest[200k] to opus[200k] with fastMode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[200k]', fastMode: true })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[200k]', fastMode: true },
    )
  })

  it('should migrate fennec-fast-latest[100k] to opus[100k] with fastMode false', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[100k]', fastMode: false })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[100k]', fastMode: false },
    )
  })

  it('should migrate fennec-fast-latest[200k] to opus[200k] with fastMode false', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[200k]', fastMode: false })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[200k]', fastMode: false },
    )
  })

  it('should migrate fennec-latest[1m] with trailing whitespace to opus[1m]', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[1m] ' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1m]' },
    )
  })
})