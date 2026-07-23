import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test'
import { migrateFennecToOpus } from '../migrateFennecToOpus'

// Mock dependencies
const mockGetSettingsForSource = vi.fn()
const mockUpdateSettingsForSource = vi.fn()

vi.mock('../../utils/settings/settings.js', () => ({
  getSettingsForSource: (...args: any[]) => mockGetSettingsForSource(...args),
  updateSettingsForSource: (...args: any[]) => mockUpdateSettingsForSource(...args),
}))

describe('migrateFennecToOpus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.USER_TYPE
  })

  it('should not run if USER_TYPE is not ant', () => {
    process.env.USER_TYPE = 'consumer'
    mockGetSettingsForSource.mockReturnValue({ model: 'opus' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should migrate fennec-latest[1m] to opus[1m]', () => {
    process.env.USER_TYPE = 'ant'
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest[1m]' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1m]' },
    )
  })

  it('should migrate fennec-latest to opus', () => {
    process.env.USER_TYPE = 'ant'
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus' },
    )
  })

  it('should migrate fennec-fast-latest to opus[1m] with fastMode', () => {
    process.env.USER_TYPE = 'ant'
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-fast-latest' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1m]', fastMode: true },
    )
  })

  it('should migrate opus-4-5-fast to opus[1m] with fastMode', () => {
    process.env.USER_TYPE = 'ant'
    mockGetSettingsForSource.mockReturnValue({ model: 'opus-4-5-fast' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).toHaveBeenCalledWith(
      'userSettings',
      { model: 'opus[1m]', fastMode: true },
    )
  })

  it('should not update if model is not a string', () => {
    process.env.USER_TYPE = 'ant'
    mockGetSettingsForSource.mockReturnValue({ model: undefined })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should not update if model does not start with fennec', () => {
    process.env.USER_TYPE = 'ant'
    mockGetSettingsForSource.mockReturnValue({ model: 'gpt-4' })

    migrateFennecToOpus()

    expect(mockUpdateSettingsForSource).not.toHaveBeenCalled()
  })

  it('should handle errors gracefully when getSettingsForSource throws', () => {
    process.env.USER_TYPE = 'ant'
    mockGetSettingsForSource.mockImplementation(() => {
      throw new Error('File system error')
    })

    // Should not throw, but log the error
    expect(() => migrateFennecToOpus()).not.toThrow()
  })

  it('should handle errors gracefully when updateSettingsForSource throws', () => {
    process.env.USER_TYPE = 'ant'
    mockGetSettingsForSource.mockReturnValue({ model: 'fennec-latest' })
    mockUpdateSettingsForSource.mockImplementation(() => {
      throw new Error('File system error')
    })

    // Should not throw, but log the error
    expect(() => migrateFennecToOpus()).not.toThrow()
  })
})