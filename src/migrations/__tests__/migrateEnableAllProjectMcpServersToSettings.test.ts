import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { join } from 'path'

// ── Mock config ────────────────────────────────────────────────────
let projectConfigStore: Record<string, any> = {}
let globalConfigStore: Record<string, any> = {}
let settingsStore: Record<string, any> = {}
let logEventMock: ReturnType<typeof mock> = mock(() => {})

beforeEach(() => {
  projectConfigStore = {}
  globalConfigStore = {}
  settingsStore = {}
  logEventMock = mock(() => {})

  // Setup mocks for all tests
  mock.module(join(import.meta.dir, '../../utils/config.js'), () => ({
    getCurrentProjectConfig: () => ({ ...projectConfigStore }),
    saveCurrentProjectConfig: (updater: any) => {
      if (typeof updater === 'function') {
        projectConfigStore = updater(projectConfigStore)
      } else {
        projectConfigStore = { ...projectConfigStore, ...updater }
      }
    },
    getGlobalConfig: () => ({ ...globalConfigStore }),
    saveGlobalConfig: (updater: any) => {
      if (typeof updater === 'function') {
        globalConfigStore = updater(globalConfigStore)
      } else {
        globalConfigStore = { ...globalConfigStore, ...updater }
      }
    },
  }))

  mock.module(join(import.meta.dir, '../../utils/settings/settings.js'), () => ({
    getSettingsForSource: (source: string) => settingsStore[source] || {},
    updateSettingsForSource: (source: string, updates: any) => {
      if (!settingsStore[source]) {
        settingsStore[source] = {}
      }
      settingsStore[source] = { ...settingsStore[source], ...updates }
    },
  }))

  mock.module(join(import.meta.dir, '../../utils/log.js'), () => ({
    logError: () => {},
  }))

  mock.module(join(import.meta.dir, '../../services/analytics/index.js'), () => ({
    logEvent: logEventMock,
  }))
})

describe('migrateEnableAllProjectMcpServersToSettings', () => {
  test('should only remove fields that were migrated (single field)', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with only enableAllProjectMcpServers
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: [],
      disabledMcpjsonServers: [],
      otherField: 'keep-me',
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that only enableAllProjectMcpServers was removed, and empty arrays are also cleaned up
    expect(projectConfigStore).toEqual({
      otherField: 'keep-me',
    })
  })

  test('should only remove fields that were migrated (partial fields)', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with enableAllProjectMcpServers and enabledMcpjsonServers
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['server1', 'server2'],
      disabledMcpjsonServers: [],
      otherField: 'keep-me',
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that only enableAllProjectMcpServers and enabledMcpjsonServers were removed, and empty arrays are also cleaned up
    expect(projectConfigStore).toEqual({
      otherField: 'keep-me',
    })
  })

  test('should merge enabled servers preserving order and avoiding duplicates', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings with servers in a specific order
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existing1', 'existing2', 'existing3'],
      otherSetting: 'keep',
    }

    // Mock project config with new servers
    projectConfigStore = {
      enabledMcpjsonServers: ['existing2', 'newServer1', 'existing1', 'newServer2'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that existing order is preserved, duplicates are removed, and new servers are added
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existing1', 'existing2', 'existing3', 'newServer1', 'newServer2'])
    expect(settingsStore.localSettings.otherSetting).toBe('keep')
  })

  test('should merge disabled servers preserving order and avoiding duplicates', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings with servers in a specific order
    settingsStore.localSettings = {
      disabledMcpjsonServers: ['existing1', 'existing2', 'existing3'],
      otherSetting: 'keep',
    }

    // Mock project config with new servers
    projectConfigStore = {
      disabledMcpjsonServers: ['existing2', 'newServer1', 'existing1', 'newServer2'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that existing order is preserved, duplicates are removed, and new servers are added
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['existing1', 'existing2', 'existing3', 'newServer1', 'newServer2'])
    expect(settingsStore.localSettings.otherSetting).toBe('keep')
  })

  test('should resolve overlapping servers by removing them from disabled list when servers appear in both enabled and disabled lists (with existing settings)', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings with servers in both lists
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existingEnabled', 'otherEnabled'],
      disabledMcpjsonServers: ['existingDisabled', 'otherDisabled'],
    }

    // Mock project config with conflicting servers
    projectConfigStore = {
      enabledMcpjsonServers: ['existingEnabled', 'newEnabled'],
      disabledMcpjsonServers: ['existingDisabled', 'existingEnabled', 'newDisabled'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that 'existingEnabled' is removed from the disabled list since it's also in the enabled list
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existingEnabled', 'otherEnabled', 'newEnabled'])
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['existingDisabled', 'otherDisabled', 'newDisabled'])
  })

  test('should resolve overlapping servers by removing them from disabled list when all disabled servers are also in enabled list (no new disabled servers from project config)', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings with ALL disabled servers also in enabled list
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['serverA', 'serverB'],
      disabledMcpjsonServers: ['serverA'],
    }

    // Mock project config with only enabled servers (no disabled servers field)
    projectConfigStore = {
      enabledMcpjsonServers: ['serverC'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that 'serverA' is removed from the disabled list since it's also in the enabled list
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['serverA', 'serverB', 'serverC'])
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual([])
  })

  test('should resolve overlapping servers by removing them from disabled list when servers appear in both enabled and disabled lists (no new disabled servers from project config)', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings with conflicting servers (same server in both lists)
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['serverA', 'serverB'],
      disabledMcpjsonServers: ['serverA', 'serverC'],
    }

    // Mock project config with only enabled servers (no disabled servers)
    projectConfigStore = {
      enabledMcpjsonServers: ['serverD'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that 'serverA' is removed from the disabled list since it's also in the enabled list
    // 'serverC' stays in disabled list as it's not in enabled list
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['serverA', 'serverB', 'serverD'])
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['serverC'])
  })

  test('should resolve overlapping servers by removing them from disabled list when servers appear in both enabled and disabled lists (with new disabled servers from project config)', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings with conflicting servers
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existingEnabled', 'conflictingServer'],
      disabledMcpjsonServers: ['existingDisabled', 'conflictingServer'],
    }

    // Mock project config with no conflicting servers
    projectConfigStore = {
      enabledMcpjsonServers: ['newServer1'],
      disabledMcpjsonServers: ['newDisabled'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that 'conflictingServer' is removed from the disabled list since it's also in the enabled list
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existingEnabled', 'conflictingServer', 'newServer1'])
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['existingDisabled', 'newDisabled'])
  })

  test('should not overwrite other settings fields', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings with other fields
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existing1'],
      disabledMcpjsonServers: ['existing2'],
      otherArray: ['keep', 'these'],
      otherObject: { keep: 'me' },
      otherString: 'keep me',
    }

    // Mock project config
    projectConfigStore = {
      enabledMcpjsonServers: ['newServer'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that other fields are preserved
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existing1', 'newServer'])
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['existing2'])
    expect(settingsStore.localSettings.otherArray).toEqual(['keep', 'these'])
    expect(settingsStore.localSettings.otherObject).toEqual({ keep: 'me' })
    expect(settingsStore.localSettings.otherString).toBe('keep me')
  })

  test('should handle empty arrays correctly', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings with empty arrays
    settingsStore.localSettings = {
      enabledMcpjsonServers: [],
      disabledMcpjsonServers: [],
    }

    // Mock project config with empty arrays
    projectConfigStore = {
      enabledMcpjsonServers: [],
      disabledMcpjsonServers: [],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that empty arrays are handled correctly
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual([])
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual([])
  })

  test('should handle project config with only disabled servers', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existing1'],
      disabledMcpjsonServers: ['existing2'],
    }

    // Mock project config with only disabled servers
    projectConfigStore = {
      disabledMcpjsonServers: ['newServer1', 'newServer2'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that disabled servers are merged
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existing1'])
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['existing2', 'newServer1', 'newServer2'])
  })

  test('should handle project config with only enabled servers', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existing1'],
      disabledMcpjsonServers: ['existing2'],
    }

    // Mock project config with only enabled servers
    projectConfigStore = {
      enabledMcpjsonServers: ['newServer1', 'newServer2'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that enabled servers are merged
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existing1', 'newServer1', 'newServer2'])
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['existing2'])
  })

  test('should handle project config with both enabled and disabled servers and resolve overlaps', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existingEnabled'],
      disabledMcpjsonServers: ['existingDisabled'],
    }

    // Mock project config with both enabled and disabled servers, including overlapping ones
    projectConfigStore = {
      enabledMcpjsonServers: ['newEnabled', 'existingDisabled'],
      disabledMcpjsonServers: ['newDisabled', 'existingEnabled'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // After migration:
    // - enabled list: ['existingEnabled', 'newEnabled', 'existingDisabled']
    // - disabled list originally had ['existingDisabled', 'newDisabled', 'existingEnabled']
    // - 'existingDisabled' is now in enabled list, so it's removed from disabled list
    // - 'existingEnabled' is in enabled list, so it's removed from disabled list
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existingEnabled', 'newEnabled', 'existingDisabled'])
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['newDisabled'])
  })

  test('should handle project config with enableAllProjectMcpServers flag', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existing1'],
    }

    // Mock project config with enableAll flag
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['newServer'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that the flag is migrated
    expect(settingsStore.localSettings.enableAllProjectMcpServers).toBe(true)
    // Verify that enabled servers are merged
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existing1', 'newServer'])
  })

  test('should handle project config with only enableAllProjectMcpServers flag', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existing1'],
    }

    // Mock project config with only enableAll flag
    projectConfigStore = {
      enableAllProjectMcpServers: true,
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that the flag is migrated
    expect(settingsStore.localSettings.enableAllProjectMcpServers).toBe(true)
    // Verify that enabled servers are not modified
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existing1'])
  })

  test('should handle project config with no fields to migrate', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existing1'],
    }

    // Mock project config with no MCP fields
    projectConfigStore = {
      otherField: 'keep',
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that nothing is modified
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existing1'])
    expect(projectConfigStore).toEqual({ otherField: 'keep' })
  })

  test('should handle project config with undefined values', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existing1'],
    }

    // Mock project config with undefined values
    projectConfigStore = {
      enabledMcpjsonServers: undefined,
      disabledMcpjsonServers: undefined,
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that nothing is modified
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existing1'])
  })

  test('should handle project config with null values', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existing1'],
    }

    // Mock project config with null values
    projectConfigStore = {
      enabledMcpjsonServers: null,
      disabledMcpjsonServers: null,
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that nothing is modified
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existing1'])
  })

  test('should handle project config with non-array values', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existing1'],
    }

    // Mock project config with non-array values
    projectConfigStore = {
      enabledMcpjsonServers: 'not an array',
      disabledMcpjsonServers: 123,
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that nothing is modified
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existing1'])
  })

  test('should handle project config with mixed valid and invalid values', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existing1'],
    }

    // Mock project config with mixed valid and invalid values
    projectConfigStore = {
      enabledMcpjsonServers: ['valid1', 'valid2'],
      disabledMcpjsonServers: 'invalid',
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that only valid values are merged
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existing1', 'valid1', 'valid2'])
  })

  test('should resolve overlapping servers by removing them from disabled list when servers appear in both enabled and disabled lists', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with overlapping servers
    projectConfigStore = {
      enabledMcpjsonServers: ['serverA', 'serverB'],
      disabledMcpjsonServers: ['serverA', 'serverC'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that the overlapping server 'serverA' is removed from the disabled list
    // (enabled list takes precedence)
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['serverA', 'serverB'])
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['serverC'])

    // Verify that logEvent was called 2 times: overlap event and completion event
    expect(logEventMock).toHaveBeenCalledTimes(2)
    const logEventCall = logEventMock.mock.calls[0]?.[0] || ''
    const logEventMetadata = logEventMock.mock.calls[0]?.[1] || {}
    expect(logEventCall).toBe('tengu_migrate_mcp_server_overlap_in_both_lists')
    expect(logEventMetadata.overlappingServers).toContain('serverA')
    expect(logEventMetadata.overlappingServers).not.toContain('serverC')
  })

  test('should not log event when no servers overlap between enabled and disabled lists', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with no overlapping servers
    projectConfigStore = {
      enabledMcpjsonServers: ['serverA', 'serverB'],
      disabledMcpjsonServers: ['serverC', 'serverD'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that only the completion event was called (no overlapping servers)
    expect(logEventMock).toHaveBeenCalledTimes(1)
  })

  test('should preserve empty arrays in settings when project config has empty arrays', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings without enabledMcpjsonServers or disabledMcpjsonServers
    settingsStore.localSettings = {
      otherSetting: 'some-value',
    }

    // Mock project config with empty arrays
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: [],
      disabledMcpjsonServers: [],
      otherField: 'keep-me',
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that empty arrays are preserved in settings to maintain semantic meaning
    // (explicit list of zero servers) vs undefined which means "use defaults"
    expect(settingsStore.localSettings).toEqual({
      otherSetting: 'some-value',
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: [],
      disabledMcpjsonServers: [],
    })
  })

  test('should rollback on updateSettingsForSource failure and NOT mark migration as completed', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with fields to migrate
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['server1', 'server2'],
      disabledMcpjsonServers: ['server3'],
      otherField: 'keep-me',
    }

    // Mock settings with existing data
    settingsStore.localSettings = {
      otherSetting: 'some-value',
      enabledMcpjsonServers: ['existing1'],
    }

    // Mock updateSettingsForSource to throw on first call (migration), succeed on subsequent calls (rollback)
    let updateSettingsCallCount = 0
    const updateSettingsMock = mock((source: string, updates: any) => {
      updateSettingsCallCount++
      if (updateSettingsCallCount === 1) {
        throw new Error('Disk full')
      }
      // Rollback call succeeds
      if (!settingsStore[source]) {
        settingsStore[source] = {}
      }
      settingsStore[source] = { ...settingsStore[source], ...updates }
    })

    mock.module(join(import.meta.dir, '../../utils/settings/settings.js'), () => ({
      getSettingsForSource: (source: string) => settingsStore[source] || {},
      updateSettingsForSource: updateSettingsMock,
    }))

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that updateSettingsForSource was called twice (migration + rollback)
    expect(updateSettingsCallCount).toBe(2)

    // Verify that migration flag was NOT set (should remain undefined)
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBeUndefined()

    // Verify that original settings were restored (rollback)
    expect(settingsStore.localSettings).toEqual({
      otherSetting: 'some-value',
      enabledMcpjsonServers: ['existing1'],
    })

    // Verify that original project config was restored
    expect(projectConfigStore).toEqual({
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['server1', 'server2'],
      disabledMcpjsonServers: ['server3'],
      otherField: 'keep-me',
    })
  })

  test('should rollback on saveCurrentProjectConfig failure and NOT mark migration as completed', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with fields to migrate
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['server1'],
      otherField: 'keep-me',
    }

    // Mock settings with existing data
    settingsStore.localSettings = {
      otherSetting: 'some-value',
    }

    // Mock saveCurrentProjectConfig to throw on first call (migration), succeed on subsequent calls (rollback)
    let saveProjectConfigCallCount = 0
    const saveProjectConfigMock = mock((updater: any) => {
      saveProjectConfigCallCount++
      if (saveProjectConfigCallCount === 1) {
        throw new Error('Permission denied')
      }
      // Rollback call succeeds
      if (typeof updater === 'function') {
        projectConfigStore = updater(projectConfigStore)
      } else {
        projectConfigStore = { ...projectConfigStore, ...updater }
      }
    })

    mock.module(join(import.meta.dir, '../../utils/config.js'), () => ({
      getCurrentProjectConfig: () => ({ ...projectConfigStore }),
      saveCurrentProjectConfig: saveProjectConfigMock,
      getGlobalConfig: () => ({ ...globalConfigStore }),
      saveGlobalConfig: (updater: any) => {
        if (typeof updater === 'function') {
          globalConfigStore = updater(globalConfigStore)
        } else {
          globalConfigStore = { ...globalConfigStore, ...updater }
        }
      },
    }))

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that saveCurrentProjectConfig was called twice (migration + rollback)
    expect(saveProjectConfigCallCount).toBe(2)

    // Verify that migration flag was NOT set (should remain false)
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBeUndefined()

    // Verify that original settings were restored (rollback removed the migration-added fields)
    expect(settingsStore.localSettings).toEqual({
      otherSetting: 'some-value',
    })

    // Verify that original project config was restored (rollback)
    expect(projectConfigStore).toEqual({
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['server1'],
      otherField: 'keep-me',
    })
  })

  test('should re-apply migrated state to settings when project config rollback fails after settings rollback succeeded', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with fields to migrate
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['server1'],
      otherField: 'keep-me',
    }

    // Mock settings with existing data
    settingsStore.localSettings = {
      otherSetting: 'some-value',
    }

    // Mock saveCurrentProjectConfig to throw on first call (migration) and third call (project config rollback),
    // but succeed on second call (settings rollback)
    let saveProjectConfigCallCount = 0
    const saveProjectConfigMock = mock((updater: any) => {
      saveProjectConfigCallCount++
      if (saveProjectConfigCallCount === 1) {
        throw new Error('Permission denied on migration')
      }
      if (saveProjectConfigCallCount === 2) {
        throw new Error('Permission denied on project config rollback')
      }
      // Should not reach here
      if (typeof updater === 'function') {
        projectConfigStore = updater(projectConfigStore)
      } else {
        projectConfigStore = { ...projectConfigStore, ...updater }
      }
    })

    mock.module(join(import.meta.dir, '../../utils/config.js'), () => ({
      getCurrentProjectConfig: () => ({ ...projectConfigStore }),
      saveCurrentProjectConfig: saveProjectConfigMock,
      getGlobalConfig: () => ({ ...globalConfigStore }),
      saveGlobalConfig: (updater: any) => {
        if (typeof updater === 'function') {
          globalConfigStore = updater(globalConfigStore)
        } else {
          globalConfigStore = { ...globalConfigStore, ...updater }
        }
      },
    }))

    // Run migration - should throw because rollback is incomplete
    expect(() => migrateEnableAllProjectMcpServersToSettings()).toThrow()

    // Verify that saveCurrentProjectConfig was called twice (migration + project config rollback)
    expect(saveProjectConfigCallCount).toBe(2)

    // Verify that migration flag was NOT set (should remain false)
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBeUndefined()

    // Verify that settings were re-applied with the migrated state (since settings rollback succeeded
    // but project config rollback failed, the system should re-apply the migrated state to settings
    // to maintain consistency)
    expect(settingsStore.localSettings).toEqual({
      otherSetting: 'some-value',
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['server1'],
    })

    // Verify that project config still has the original fields (migration failed, but rollback also failed)
    expect(projectConfigStore).toEqual({
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['server1'],
      otherField: 'keep-me',
    })
  })
})
