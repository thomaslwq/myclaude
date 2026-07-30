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

  it('should migrate fennec-latest[1M] to opus[1M]', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[1M]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1M]' },
    )
  })

  it('should migrate fennec-latest[100K] to opus[100K]', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[100K]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[100K]' },
    )
  })

  it('should migrate fennec-fast-latest to opus (no suffix, no fastMode)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus' },
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

  it('should migrate fennec-fast-latest[1M] to opus[1M] without fastMode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[1M]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1M]' },
    )
  })

  it('should migrate fennec-fast-latest[100k] to opus[100k] with fastMode true', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[100k]', fastMode: true })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[100k]', fastMode: true },
    )
  })

  it('should migrate fennec-fast-latest[200k] to opus[200k] with fastMode true', () => {
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

  it('should migrate opus-4-5-fast[1m] to opus[1m]', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'opus-4-5-fast[1m]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1m]' },
    )
  })

  it('should migrate opus-4-5-fast[100k] to opus[100k]', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'opus-4-5-fast[100k]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[100k]' },
    )
  })

  it('should migrate opus-4-5-fast[200k] to opus[200k]', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'opus-4-5-fast[200k]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[200k]' },
    )
  })

  it('should migrate opus-4-5-fast[1m] with fastMode to opus[1m] with fastMode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'opus-4-5-fast[1m]', fastMode: true })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1m]', fastMode: true },
    )
  })

  it('should not preserve plain number suffix [1] (not a valid context-length suffix)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[1]' })

    migrateFennecToOpus()

    // [1] is not a valid context-length suffix (no unit), so suffix should be dropped
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus' },
    )
  })

  it('should not preserve plain number suffix [100] (not a valid context-length suffix)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[100]' })

    migrateFennecToOpus()

    // [100] is not a valid context-length suffix (no unit), so suffix should be dropped
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus' },
    )
  })

  it('should not preserve plain number suffix [500] (not a valid context-length suffix)', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[500]' })

    migrateFennecToOpus()

    // [500] is not a valid context-length suffix (no unit), so suffix should be dropped
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus' },
    )
  })

  it('should not preserve suffix with spaces inside brackets', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[1 m]' })

    migrateFennecToOpus()

    // [1 m] is not a valid context-length suffix (spaces not allowed), so suffix should be dropped
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus' },
    )
  })

  it('should not preserve suffix with leading space in bracket', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[ 100k]' })

    migrateFennecToOpus()

    // [ 100k] is not a valid context-length suffix (leading space), so suffix should be dropped
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus' },
    )
  })

  it('should not preserve suffix with trailing space in bracket', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[200k ]' })

    migrateFennecToOpus()

    // [200k ] is not a valid context-length suffix (trailing space), so suffix should be dropped
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus' },
    )
  })

  it('should not migrate custom model name ending with bracket pattern', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    // This model doesn't start with fennec-* or opus-4-5-fast, so migration should not run
    mockGetSettingsForSource.mockReturnValue({ model: 'my-custom-model[1m]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should handle multiple sources', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource
      .mockReturnValueOnce({ model: 'fennec-latest[1m]' })  // userSettings
      .mockReturnValueOnce({ model: 'fennec-latest[100k]' }) // projectSettings
      .mockReturnValueOnce({ model: 'opus' })                 // localSettings

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledTimes(2)
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1m]' },
    )
    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'projectSettings',
      { model: 'opus[100k]' },
    )
  })

  it('should skip empty model', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: '' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should skip non-matching model', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'sonnet' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should migrate fennec-fast-latest[1m] with fastMode to opus[1m] with fastMode', () => {
    mockGetAPIProvider.mockReturnValue('firstParty')
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest[1m]', fastMode: true })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1m]', fastMode: true },
    )
  })
})
