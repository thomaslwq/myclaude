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

  it('should migrate boolean true to remoteControlAtStartup', () => {
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      const prev = {
        remoteControlAtStartup: undefined,
        replBridgeEnabled: true,
      }
      const result = cb(prev)
      expect(result.remoteControlAtStartup).toBe(true)
      expect(result.replBridgeEnabled).toBeUndefined()
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()
    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
  })

  it('should migrate boolean false to remoteControlAtStartup', () => {
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      const prev = {
        remoteControlAtStartup: undefined,
        replBridgeEnabled: false,
      }
      const result = cb(prev)
      expect(result.remoteControlAtStartup).toBe(false)
      expect(result.replBridgeEnabled).toBeUndefined()
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()
    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
  })

  it('should handle string "true" correctly', () => {
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      const prev = {
        remoteControlAtStartup: undefined,
        replBridgeEnabled: 'true',
      }
      const result = cb(prev)
      expect(result.remoteControlAtStartup).toBe(true)
      expect(result.replBridgeEnabled).toBeUndefined()
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()
    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
  })

  it('should handle string "false" correctly (this is the bug fix)', () => {
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      const prev = {
        remoteControlAtStartup: undefined,
        replBridgeEnabled: 'false',
      }
      const result = cb(prev)
      // This test will fail with the old code (Boolean('false') === true)
      // and pass after the fix
      expect(result.remoteControlAtStartup).toBe(false)
      expect(result.replBridgeEnabled).toBeUndefined()
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()
    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
  })

  it('should handle empty string as false', () => {
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      const prev = {
        remoteControlAtStartup: undefined,
        replBridgeEnabled: '',
      }
      const result = cb(prev)
      expect(result.remoteControlAtStartup).toBe(false)
      expect(result.replBridgeEnabled).toBeUndefined()
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()
    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
  })

  it('should handle number 0 as false', () => {
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      const prev = {
        remoteControlAtStartup: undefined,
        replBridgeEnabled: 0,
      }
      const result = cb(prev)
      expect(result.remoteControlAtStartup).toBe(false)
      expect(result.replBridgeEnabled).toBeUndefined()
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()
    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
  })

  it('should handle number 1 as true', () => {
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      const prev = {
        remoteControlAtStartup: undefined,
        replBridgeEnabled: 1,
      }
      const result = cb(prev)
      expect(result.remoteControlAtStartup).toBe(true)
      expect(result.replBridgeEnabled).toBeUndefined()
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()
    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
  })

  it('should handle null as false', () => {
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      const prev = {
        remoteControlAtStartup: undefined,
        replBridgeEnabled: null,
      }
      const result = cb(prev)
      expect(result.remoteControlAtStartup).toBe(false)
      expect(result.replBridgeEnabled).toBeUndefined()
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()
    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
  })

  it('should not migrate if remoteControlAtStartup is already set', () => {
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      const prev = {
        remoteControlAtStartup: true,
        replBridgeEnabled: true,
      }
      const result = cb(prev)
      // Should return the same object unchanged
      expect(result).toBe(prev)
      expect(result.remoteControlAtStartup).toBe(true)
      expect(result.replBridgeEnabled).toBe(true)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()
    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
  })

  it('should not migrate if replBridgeEnabled is undefined', () => {
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      const prev = {
        remoteControlAtStartup: undefined,
        replBridgeEnabled: undefined,
      }
      const result = cb(prev)
      // Should return the same object unchanged
      expect(result).toBe(prev)
      expect(result.remoteControlAtStartup).toBeUndefined()
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()
    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(1)
  })
})
