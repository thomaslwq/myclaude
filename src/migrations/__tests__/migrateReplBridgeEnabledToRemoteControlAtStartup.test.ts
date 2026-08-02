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
    // Simulate two sequential calls to saveGlobalConfig
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(2)

    // Phase 1: add new key, keep old key
    const phase1Result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: true,
    })
    expect(phase1Result.remoteControlAtStartup).toBe(true)
    expect(phase1Result.replBridgeEnabled).toBe(true)

    // Phase 2: remove old key
    const phase2Result = calls[1]({
      remoteControlAtStartup: true,
      replBridgeEnabled: true,
    })
    expect(phase2Result.remoteControlAtStartup).toBe(true)
    expect(phase2Result.replBridgeEnabled).toBeUndefined()
  })

  it('should migrate boolean false to remoteControlAtStartup', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(2)

    const phase1Result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: false,
    })
    expect(phase1Result.remoteControlAtStartup).toBe(false)
    expect(phase1Result.replBridgeEnabled).toBe(false)

    const phase2Result = calls[1]({
      remoteControlAtStartup: false,
      replBridgeEnabled: false,
    })
    expect(phase2Result.remoteControlAtStartup).toBe(false)
    expect(phase2Result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "true" correctly', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(2)

    const phase1Result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'true',
    })
    expect(phase1Result.remoteControlAtStartup).toBe(true)
    expect(phase1Result.replBridgeEnabled).toBe('true')

    const phase2Result = calls[1]({
      remoteControlAtStartup: true,
      replBridgeEnabled: 'true',
    })
    expect(phase2Result.remoteControlAtStartup).toBe(true)
    expect(phase2Result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "1" as truthy', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(2)

    const phase1Result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: '1',
    })
    expect(phase1Result.remoteControlAtStartup).toBe(true)
    expect(phase1Result.replBridgeEnabled).toBe('1')

    const phase2Result = calls[1]({
      remoteControlAtStartup: true,
      replBridgeEnabled: '1',
    })
    expect(phase2Result.remoteControlAtStartup).toBe(true)
    expect(phase2Result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "yes" as truthy', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(2)

    const phase1Result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'yes',
    })
    expect(phase1Result.remoteControlAtStartup).toBe(true)
    expect(phase1Result.replBridgeEnabled).toBe('yes')

    const phase2Result = calls[1]({
      remoteControlAtStartup: true,
      replBridgeEnabled: 'yes',
    })
    expect(phase2Result.remoteControlAtStartup).toBe(true)
    expect(phase2Result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "enabled" as truthy', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(2)

    const phase1Result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'enabled',
    })
    expect(phase1Result.remoteControlAtStartup).toBe(true)
    expect(phase1Result.replBridgeEnabled).toBe('enabled')

    const phase2Result = calls[1]({
      remoteControlAtStartup: true,
      replBridgeEnabled: 'enabled',
    })
    expect(phase2Result.remoteControlAtStartup).toBe(true)
    expect(phase2Result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "0" as falsy', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(2)

    const phase1Result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: '0',
    })
    expect(phase1Result.remoteControlAtStartup).toBe(false)
    expect(phase1Result.replBridgeEnabled).toBe('0')

    const phase2Result = calls[1]({
      remoteControlAtStartup: false,
      replBridgeEnabled: '0',
    })
    expect(phase2Result.remoteControlAtStartup).toBe(false)
    expect(phase2Result.replBridgeEnabled).toBeUndefined()
  })

  it('should handle string "no" as falsy', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(2)

    const phase1Result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: 'no',
    })
    expect(phase1Result.remoteControlAtStartup).toBe(false)
    expect(phase1Result.replBridgeEnabled).toBe('no')

    const phase2Result = calls[1]({
      remoteControlAtStartup: false,
      replBridgeEnabled: 'no',
    })
    expect(phase2Result.remoteControlAtStartup).toBe(false)
    expect(phase2Result.replBridgeEnabled).toBeUndefined()
  })

  it('should add new key and remove old key in two-phase write', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(2)

    // Phase 1: add new key, keep old key
    const phase1Input = {
      remoteControlAtStartup: undefined,
      replBridgeEnabled: true,
    }
    const phase1Output = calls[0](phase1Input)
    expect(phase1Output.remoteControlAtStartup).toBe(true)
    expect(phase1Output.replBridgeEnabled).toBe(true) // kept
    // Phase 1 should not modify the input (it returns a new object)
    expect(phase1Input.replBridgeEnabled).toBe(true)

    // Phase 2: remove old key
    const phase2Input = {
      remoteControlAtStartup: true,
      replBridgeEnabled: true,
    }
    const phase2Output = calls[1](phase2Input)
    expect(phase2Output.remoteControlAtStartup).toBe(true)
    expect(phase2Output.replBridgeEnabled).toBeUndefined() // removed
  })

  it('should handle phase 2 safely if phase 1 was skipped (no old key)', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(2)

    // Phase 1: no old key, so skip
    const phase1Result = calls[0]({
      remoteControlAtStartup: undefined,
    })
    expect(phase1Result).toBeDefined()

    // Phase 2: no old key, so skip
    const phase2Result = calls[1]({
      remoteControlAtStartup: undefined,
    })
    expect(phase2Result).toBeDefined()
  })

  it('should NOT set remoteControlAtStartup to false when old key is missing in phase 2', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(2)

    // Phase 1: no old key, so skip
    const phase1Result = calls[0]({
      remoteControlAtStartup: undefined,
    })
    expect(phase1Result).toBeDefined()

    // Phase 2: no old key, so skip - should NOT modify remoteControlAtStartup
    const phase2Result = calls[1]({
      remoteControlAtStartup: true, // User had a preference set
    })
    expect(phase2Result.remoteControlAtStartup).toBe(true) // Should remain true, not become false
  })

  it('should handle crash recovery — phase 1 done, phase 2 re-runs', () => {
    const calls: ((prev: any) => any)[] = []
    mockSaveGlobalConfig.mockImplementation((cb: (prev: any) => any) => {
      calls.push(cb)
    })
    migrateReplBridgeEnabledToRemoteControlAtStartup()

    expect(mockSaveGlobalConfig).toHaveBeenCalledTimes(2)

    // Phase 1: old key exists, new key missing → migrate
    const phase1Result = calls[0]({
      remoteControlAtStartup: undefined,
      replBridgeEnabled: true,
    })
    expect(phase1Result.remoteControlAtStartup).toBe(true)
    expect(phase1Result.replBridgeEnabled).toBe(true)

    // Phase 2: both keys exist → remove old key
    const phase2Result = calls[1]({
      remoteControlAtStartup: true,
      replBridgeEnabled: true,
    })
    expect(phase2Result.remoteControlAtStartup).toBe(true)
    expect(phase2Result.replBridgeEnabled).toBeUndefined()
  })
})