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

  it('should migrate boolean true to remoteControlAtStartup in a single atomic write', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    // Now only one call to saveGlobalConfig
    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: true,
    })
    expect(result.remoteControlAtStartup).toBe(true)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should migrate boolean false to remoteControlAtStartup in a single atomic write', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: false,
    })
    expect(result.remoteControlAtStartup).toBe(false)
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "true" correctly', async () => {
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
    expect(result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "false" correctly', async () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      calls.push(cb)
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)

    const result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'false',
    })
    expect(result.remoteControlAtStartup).toBe(false)
    expect(result.replBridgeEnabled).toBeUndefined()
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

  it('should handle string "active" (unknown truthy) correctly', async () => {
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
      replBridgeEnabled: undefined,
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
      remoteControlAtStartup: false,
      replBridgeEnabled: true,
    })
    expect(result.remoteControlAtStartup).toBe(false)
    expect(result.replBridgeEnabled).toBe(true)
  })

  it('should handle async delayed write correctly', async () => {
    // Simulate a delayed async write (e.g., file I/O taking time)
    const delay = 10
    mockSaveGlobalConfig.mockImplementation(async (cb: (prev: any) => any) => {
      await new Promise(resolve => setTimeout(resolve, delay))
      return cb
    })
    await migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
  })

  it('should handle async failure gracefully', async () => {
    // Simulate an async failure (e.g., file I/O error)
    mockSaveGlobalConfig.mockImplementation(async () => {
      throw new Error('Async write failed')
    })
    await expect(migrateReplBridgeEnabledToRemoteControlAtStartup()).rejects.toThrow('Async write failed')
  })
})
