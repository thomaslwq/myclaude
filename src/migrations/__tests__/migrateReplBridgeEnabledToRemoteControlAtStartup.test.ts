import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { migrateReplBridgeEnabledToRemoteControlAtStartup } from '../migrateReplBridgeEnabledToRemoteControlAtStartup'

// Mock dependencies
const mockSaveGlobalConfig = vi.fn()

vi.mock('../../utils/config.js', () => ({
  saveGlobalConfig: (...args: any[]) => mockSaveGlobalConfig(...args),
}))

describe('migrateReplBridgeEnabledToRemoteControlAtStartup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should migrate boolean true to remoteControlAtStartup in a single atomic write', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    // Now only one call to saveGlobalConfig
    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: true,
    })
    expect(result.remoteControlAtStartup).toBe(true)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should migrate boolean false to remoteControlAtStartup in a single atomic write', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: false,
    })
    expect(result.remoteControlAtStartup).toBe(false)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "true" correctly', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'true',
    })
    expect(result.remoteControlAtStartup).toBe(true)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "false" correctly', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'false',
    })
    expect(result.remoteControlAtStartup).toBe(false)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "0" correctly', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: '0',
    })
    expect(result.remoteControlAtStartup).toBe(false)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "no" correctly', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'no',
    })
    expect(result.remoteControlAtStartup).toBe(false)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "1" as truthy', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: '1',
    })
    expect(result.remoteControlAtStartup).toBe(true)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "yes" as truthy', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'yes',
    })
    expect(result.remoteControlAtStartup).toBe(true)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "enabled" as truthy', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'enabled',
    })
    expect(result.remoteControlAtStartup).toBe(true)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle empty string as falsy', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: '',
    })
    expect(result.remoteControlAtStartup).toBe(false)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should not migrate if remoteControlAtStartup is already set', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: true,
      replBridgeEnabled: true,
    })
    // Should return the same object (no change) because migration already happened
    expect(result).toEqual({
      remoteControlAtStartup: true,
      replBridgeEnabled: true,
    })
  })

  it('should not migrate if old key does not exist', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
    })
    // Should return the same object (no change) because there's nothing to migrate
    expect(result).toEqual({
      remoteControlAtStartup: undefined,
    })
  })

  it('should handle string "unknown" as falsy (not in whitelist)', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'unknown',
    })
    expect(result.remoteControlAtStartup).toBe(false)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "maybe" as falsy (not in whitelist)', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'maybe',
    })
    expect(result.remoteControlAtStartup).toBe(false)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "disabled" as falsy (not in whitelist)', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'disabled',
    })
    expect(result.remoteControlAtStartup).toBe(false)
    expect(result.replBridgeEnabled).toBeUndefined()
  })
})
