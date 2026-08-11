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
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "" correctly', async () => {
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
    expect(result.replBridgeEnabled).toBeUndefined()
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
    expect(result.replBridgeEnabled).toBeUndefined()
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
    expect(result.replBridgeEnabled).toBeUndefined()
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
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle object value as truthy', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: { enabled: true },
    })
    expect(result.remoteControlAtStartup).toBe(true)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "active" (unknown) as truthy', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'active',
    })
    expect(result.remoteControlAtStartup).toBe(true)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "null" as truthy (edge case, non-empty string)', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'null',
    })
    expect(result.remoteControlAtStartup).toBe(true)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "undefined" as truthy (edge case, non-empty string)', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'undefined',
    })
    expect(result.remoteControlAtStartup).toBe(true)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "enable" as truthy (preserving original Boolean() behavior)', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'enable',
    })
    expect(result.remoteControlAtStartup).toBe(true)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "1" as truthy', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: '1',
    })
    expect(result.remoteControlAtStartup).toBe(true)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "yes" as truthy', async () => {
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
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "on" as truthy', async () => {
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
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "enabled" as truthy', async () => {
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
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should not migrate if old key is undefined', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: undefined,
    })
    expect(result).toEqual({
      remoteControlAtStartup: undefined,
    })
  })

  it('should not migrate if new key already exists', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: true,
      replBridgeEnabled: true,
    })
    expect(result).toEqual({
      remoteControlAtStartup: true,
      replBridgeEnabled: true,
    })
  })

  it('should handle async delayed write correctly', async () => {
    // Simulate a delayed async write (e.g. file I/O taking time)
    const delay = 10
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      await new Promise(resolve => setTimeout(resolve, delay))
      return cb({
        remoteControlAtStartup: undefined,
        replBridgeEnabled: true,
      })
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalled()
  })

  it('should handle async failure gracefully', async () => {
    // Simulate an async failure (e.g. file I/O error)
    mockSaveGlobalConfig.mockRejectedValue(new Error('File system error'))
    await expect(migrateReplBridgeEnabledToRemoteControlAtStartup()).rejects.toThrow('File system error')
  })

  it('should not log sensitive data for unknown string values', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    // Test with an API key - the raw value should NOT appear in the log message
    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'sk-1234567890abcdef',
    })
    expect(result.remoteControlAtStartup).toBe(true)

    // Verify that logForDebugging was called WITHOUT the raw value
    // i.e., the raw value should not be in any log message
    for (const args of mockLogForDebugging.mock.calls) {
      const message = args[0] as string
      expect(message).not.toContain('sk-1234567890abcdef')
    }
  })

  it('should not log sensitive data for unknown string values with special characters', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    // Test with a JWT token
    const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: jwtToken,
    })
    expect(result.remoteControlAtStartup).toBe(true)

    // Verify that logForDebugging was called WITHOUT the raw value
    for (const args of mockLogForDebugging.mock.calls) {
      const message = args[0] as string
      expect(message).not.toContain(jwtToken)
    }
  })

  it('should not log sensitive data for unknown object values', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    // Test with an object containing sensitive data
    const obj = { apiKey: 'sk-1234567890abcdef', secret: 'secret123' }
    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: obj,
    })
    expect(result.remoteControlAtStartup).toBe(true)

    // Verify that logForDebugging was called WITHOUT the raw object value
    for (const args of mockLogForDebugging.mock.calls) {
      const message = args[0] as string
      expect(message).not.toContain('sk-1234567890abcdef')
      expect(message).not.toContain('secret123')
    }
  })

  it('should not log sensitive data for unknown number values', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    // Test with a number (should be truthy)
    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 12345,
    })
    expect(result.remoteControlAtStartup).toBe(true)

    // Verify that logForDebugging was called WITHOUT the raw value
    for (const args of mockLogForDebugging.mock.calls) {
      const message = args[0] as string
      expect(message).not.toContain('12345')
    }
  })

  it('should log the type of the value instead of the raw value', async () => {
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
    expect(result.remoteControlAtStartup).toBe(true)

    // Verify that logForDebugging was called with the type rather than the raw value
    expect(mockLogForDebugging).toHaveBeenCalled()
    const message = mockLogForDebugging.mock.calls[0][0] as string
    expect(message).toContain('string')
    expect(message).not.toContain('some-unknown-value')
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
})