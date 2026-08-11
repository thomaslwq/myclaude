import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { migrateReplBridgeEnabledToRemoteControlAtStartup } from '../migrateReplBridgeEnabledToRemoteControlAtStartup'

// Mock dependencies
const mockSaveGlobalConfig = vi.fn()
const mockLogForDebugging = vi.fn()

vi.mock('../../utils/config.js', () => ({
  saveGlobalConfig: (...args: any[]) => mockSaveGlobalConfig(...args),
}))

vi.mock('../../utils/debug.js', () => ({
  logForDebugging: (...args: any[]) => mockLogForDebugging(...args),
}))

describe('migrateReplBridgeEnabledToRemoteControlAtStartup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should migrate boolean true to remoteControlAtStartup in a single atomic write', async () => {
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      return cb({
        remoteControlAtStartup: undefined,
        replBridgeEnabled: true,
      })
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    // Now only one call to saveGlobalConfig
    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should migrate boolean false to remoteControlAtStartup in a single atomic write', async () => {
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      return cb({
        remoteControlAtStartup: undefined,
        replBridgeEnabled: false,
      })
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should handle string "true" correctly', async () => {
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      return cb({
        remoteControlAtStartup: undefined,
        replBridgeEnabled: 'true',
      })
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should handle string "false" correctly', async () => {
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      return cb({
        remoteControlAtStartup: undefined,
        replBridgeEnabled: 'false',
      })
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should handle string "0" correctly', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: '0',
    })
    expect(result.remoteControlAtStartup).toBe(false)
  })

  it('should handle string "yes" correctly', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'yes',
    })
    expect(result.remoteControlAtStartup).toBe(true)
  })

  it('should handle string "no" correctly', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'no',
    })
    expect(result.remoteControlAtStartup).toBe(false)
  })

  it('should handle string "on" correctly', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'on',
    })
    expect(result.remoteControlAtStartup).toBe(true)
  })

  it('should handle string "off" correctly', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'off',
    })
    expect(result.remoteControlAtStartup).toBe(false)
  })

  it('should handle string "enabled" correctly', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'enabled',
    })
    expect(result.remoteControlAtStartup).toBe(true)
  })

  it('should handle string "disabled" correctly', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'disabled',
    })
    expect(result.remoteControlAtStartup).toBe(false)
  })

  it('should handle empty string correctly', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: '',
    })
    expect(result.remoteControlAtStartup).toBe(false)
  })

  it('should handle unknown string values by defaulting to false and logging a warning', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    // Test with an unknown string value
    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'some-unknown-value',
    })
    expect(result.remoteControlAtStartup).toBe(false)

    // Verify that logForDebugging was called with a warning
    expect(mockLogForDebugging).toHaveBeenCalled()
    const message = mockLogForDebugging.mock.calls[0][0] as string
    expect(message).toContain('Unknown replBridgeEnabled value')
    expect(message).toContain('some-unknown-value')
  })

  it('should handle unknown string values with trailing spaces by defaulting to false and logging a warning', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    // Test with an unknown string value with trailing spaces
    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'on_typo ',
    })
    expect(result.remoteControlAtStartup).toBe(false)

    // Verify that logForDebugging was called with a warning
    expect(mockLogForDebugging).toHaveBeenCalled()
    const message = mockLogForDebugging.mock.calls[0][0] as string
    expect(message).toContain('Unknown replBridgeEnabled value')
    expect(message).toContain('on_typo ')
  })

  it('should handle unknown string values with leading spaces by defaulting to false and logging a warning', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    // Test with an unknown string value with leading spaces
    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: ' enable',
    })
    expect(result.remoteControlAtStartup).toBe(false)

    // Verify that logForDebugging was called with a warning
    expect(mockLogForDebugging).toHaveBeenCalled()
    const message = mockLogForDebugging.mock.calls[0][0] as string
    expect(message).toContain('Unknown replBridgeEnabled value')
    expect(message).toContain(' enable')
  })

  it('should handle unknown string values with mixed case by defaulting to false and logging a warning', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    // Test with an unknown string value with mixed case
    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'EnAbLe',
    })
    expect(result.remoteControlAtStartup).toBe(false)

    // Verify that logForDebugging was called with a warning
    expect(mockLogForDebugging).toHaveBeenCalled()
    const message = mockLogForDebugging.mock.calls[0][0] as string
    expect(message).toContain('Unknown replBridgeEnabled value')
    expect(message).toContain('EnAbLe')
  })

  it('should handle non-string, non-boolean values by defaulting to false and logging a warning', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    // Test with an unknown number value
    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 12345,
    })
    expect(result.remoteControlAtStartup).toBe(false)

    // Verify that logForDebugging was called with a warning
    expect(mockLogForDebugging).toHaveBeenCalled()
    const message = mockLogForDebugging.mock.calls[0][0] as string
    expect(message).toContain('Unknown replBridgeEnabled value')
    expect(message).toContain('number')
  })

  it('should not call logForDebugging for known values', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    // Test with a known value
    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'true',
    })
    expect(result.remoteControlAtStartup).toBe(true)

    // Verify that logForDebugging was NOT called for known values
    expect(mockLogForDebugging).not.toHaveBeenCalled()
  })

  it('should not call logForDebugging for boolean values', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    // Test with a boolean value
    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: true,
    })
    expect(result.remoteControlAtStartup).toBe(true)

    // Verify that logForDebugging was NOT called for boolean values
    expect(mockLogForDebugging).not.toHaveBeenCalled()
  })

  it('should not call logForDebugging for undefined values', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    // Test with undefined value
    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: undefined,
    })
    expect(result.remoteControlAtStartup).toBe(undefined)

    // Verify that logForDebugging was NOT called for undefined values
    expect(mockLogForDebugging).not.toHaveBeenCalled()
  })

  it('should not migrate if remoteControlAtStartup already exists', async () => {
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      return cb({
        remoteControlAtStartup: true,
        replBridgeEnabled: 'true',
      })
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should not migrate if replBridgeEnabled is undefined', async () => {
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      return cb({
        remoteControlAtStartup: undefined,
        replBridgeEnabled: undefined,
      })
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
    expect(mockSaveGlobalConfig).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should remove replBridgeEnabled after migration', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'true',
    })
    expect(result.remoteControlAtStartup).toBe(true)
    expect(result.replBridgeEnabled).toBe(undefined)
  })
})
