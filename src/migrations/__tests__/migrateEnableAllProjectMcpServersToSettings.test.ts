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
    getSettingsForSource: (source: string) => ({ ...(settingsStore[source] || {}) }),
    updateSettingsForSource: (source: string, updates: any) => {
      if (!settingsStore[source]) {
        settingsStore[source] = {}
      }
      // Match the real implementation: undefined values signal deletion
      for (const key of Object.keys(updates)) {
        if (updates[key] === undefined) {
          delete settingsStore[source][key]
        } else {
          settingsStore[source][key] = updates[key]
        }
      }
    },
    deleteSettingsField: (source: string, field: string) => {
      if (settingsStore[source]) {
        delete settingsStore[source][field]
      }
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

    // Verify settings were updated
    expect(settingsStore.localSettings.enableAllProjectMcpServers).toBe(true)

    // Verify migration flag was set
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)

    // Verify logEvent was called
    expect(logEventMock).toHaveBeenCalledTimes(1)
    expect(logEventMock.mock.calls[0][0]).toBe('tengu_migrate_enable_all_project_mcp_servers_to_settings')
    expect(logEventMock.mock.calls[0][1].fieldsMigrated).toBe('enableAllProjectMcpServers,enabledMcpjsonServers,disabledMcpjsonServers')
  })

  test('should only remove fields that were migrated (partial fields)', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['server1'],
      otherField: 'keep-me',
    }

    migrateEnableAllProjectMcpServersToSettings()

    expect(projectConfigStore).toEqual({
      otherField: 'keep-me',
    })

    expect(settingsStore.localSettings.enableAllProjectMcpServers).toBe(true)
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['server1'])
    expect(settingsStore.localSettings.disabledMcpjsonServers).toBeUndefined()

    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)

    expect(logEventMock).toHaveBeenCalledTimes(1)
    expect(logEventMock.mock.calls[0][1].fieldsMigrated).toBe('enableAllProjectMcpServers,enabledMcpjsonServers')
  })

  test('should merge enabled servers preserving order and avoiding duplicates', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existing1', 'existing2'],
    }

    projectConfigStore = {
      enabledMcpjsonServers: ['existing2', 'new1', 'existing1', 'new2'],
    }

    migrateEnableAllProjectMcpServersToSettings()

    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existing1', 'existing2', 'new1', 'new2'])

    expect(projectConfigStore).toEqual({})

    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should merge disabled servers preserving order and avoiding duplicates', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    settingsStore.localSettings = {
      disabledMcpjsonServers: ['existing1', 'existing2'],
    }

    projectConfigStore = {
      disabledMcpjsonServers: ['existing2', 'new1', 'existing1', 'new2'],
    }

    migrateEnableAllProjectMcpServersToSettings()

    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['existing1', 'existing2', 'new1', 'new2'])

    expect(projectConfigStore).toEqual({})

    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should resolve overlapping servers by removing them from disabled list when servers appear in both enabled and disabled lists (with existing settings)', async () => {
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
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should resolve overlapping servers by removing them from disabled list when all disabled servers are also in enabled list (no new disabled servers from project config)', async () => {
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
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should resolve overlapping servers by removing them from disabled list when servers appear in both enabled and disabled lists (no new disabled servers from project config)', async () => {
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
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should resolve overlapping servers by removing them from disabled list when servers appear in both enabled and disabled lists (with new disabled servers from project config)', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings with overlapping servers
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['serverA', 'serverB'],
      disabledMcpjsonServers: ['serverA', 'serverC'],
    }

    // Mock project config with both enabled and disabled servers
    projectConfigStore = {
      enabledMcpjsonServers: ['serverD'],
      disabledMcpjsonServers: ['serverE', 'serverA'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that 'serverA' is removed from the disabled list since it's also in the enabled list
    // 'serverC' and 'serverE' stay in disabled list
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['serverA', 'serverB', 'serverD'])
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['serverC', 'serverE'])
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should not overwrite other settings fields', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    settingsStore.localSettings = {
      existingField: 'keep-me',
      enabledMcpjsonServers: ['existing1'],
    }

    projectConfigStore = {
      enabledMcpjsonServers: ['new1'],
    }

    migrateEnableAllProjectMcpServersToSettings()

    expect(settingsStore.localSettings.existingField).toBe('keep-me')
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existing1', 'new1'])
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should handle empty arrays correctly', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existing1'],
    }

    projectConfigStore = {
      enabledMcpjsonServers: [],
    }

    migrateEnableAllProjectMcpServersToSettings()

    // Empty array means 'explicitly set to empty list' - should overwrite existing settings
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual([])
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should handle project config with only disabled servers', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    projectConfigStore = {
      disabledMcpjsonServers: ['server1', 'server2'],
    }

    migrateEnableAllProjectMcpServersToSettings()

    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['server1', 'server2'])
    expect(projectConfigStore).toEqual({})
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should handle project config with only enabled servers', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    projectConfigStore = {
      enabledMcpjsonServers: ['server1', 'server2'],
    }

    migrateEnableAllProjectMcpServersToSettings()

    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['server1', 'server2'])
    expect(projectConfigStore).toEqual({})
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should handle project config with both enabled and disabled servers and resolve overlaps', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    projectConfigStore = {
      enabledMcpjsonServers: ['serverA', 'serverB'],
      disabledMcpjsonServers: ['serverA', 'serverC'],
    }

    migrateEnableAllProjectMcpServersToSettings()

    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['serverA', 'serverB'])
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['serverC'])
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should handle project config with enableAllProjectMcpServers flag', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    projectConfigStore = {
      enableAllProjectMcpServers: true,
    }

    migrateEnableAllProjectMcpServersToSettings()

    expect(settingsStore.localSettings.enableAllProjectMcpServers).toBe(true)
    expect(projectConfigStore).toEqual({})
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should handle project config with only enableAllProjectMcpServers flag', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    projectConfigStore = {
      enableAllProjectMcpServers: false,
    }

    migrateEnableAllProjectMcpServersToSettings()

    expect(settingsStore.localSettings.enableAllProjectMcpServers).toBe(false)
    expect(projectConfigStore).toEqual({})
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should handle project config with no fields to migrate', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    projectConfigStore = {
      otherField: 'keep-me',
    }

    migrateEnableAllProjectMcpServersToSettings()

    expect(projectConfigStore).toEqual({ otherField: 'keep-me' })
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
    expect(logEventMock).not.toHaveBeenCalled()
  })

  test('should handle project config with undefined values', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    projectConfigStore = {
      enableAllProjectMcpServers: undefined,
      enabledMcpjsonServers: ['server1'],
    }

    migrateEnableAllProjectMcpServersToSettings()

    // enableAllProjectMcpServers is undefined, so it should not be migrated
    expect(settingsStore.localSettings.enableAllProjectMcpServers).toBeUndefined()
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['server1'])
    expect(projectConfigStore).toEqual({})
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should handle project config with null values', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    projectConfigStore = {
      enableAllProjectMcpServers: null,
      enabledMcpjsonServers: null,
    }

    migrateEnableAllProjectMcpServersToSettings()

    // null is not undefined, so enableAllProjectMcpServers should be migrated
    expect(settingsStore.localSettings.enableAllProjectMcpServers).toBeNull()
    // enabledMcpjsonServers is null, not an array, so it should not be counted as hasEnabledServers
    expect(settingsStore.localSettings.enabledMcpjsonServers).toBeUndefined()
    expect(projectConfigStore).toEqual({})
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should handle project config with non-array values', async () => {
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
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should handle project config with mixed valid and invalid values', async () => {
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
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
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
    expect(logEventCall).toBe('tengu_migrate_mcp_server_conflict_resolved')
    // Server names (or their hashes) must NOT leak into analytics metadata —
    // only the conflict count is logged (issues #575/#580).
    expect(logEventMetadata.overlappingServers).toBeUndefined()
    expect(logEventMetadata.overlappingServerCount).toBe(1)

    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
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

    // Verify that only the completion event was logged
    expect(logEventMock).toHaveBeenCalledTimes(1)
    expect(logEventMock.mock.calls[0][0]).toBe('tengu_migrate_enable_all_project_mcp_servers_to_settings')

    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should propagate error when updateSettingsForSource fails and NOT mark migration as completed', async () => {
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

    // Mock updateSettingsForSource to throw
    let updateSettingsCallCount = 0
    const updateSettingsMock = mock((source: string, updates: any) => {
      updateSettingsCallCount++
      throw new Error('Disk full')
    })

    mock.module(join(import.meta.dir, '../../utils/settings/settings.js'), () => ({
      getSettingsForSource: (source: string) => settingsStore[source] || {},
      updateSettingsForSource: updateSettingsMock,
    }))

    // Run migration - should throw
    expect(() => migrateEnableAllProjectMcpServersToSettings()).toThrow('Disk full')

    // Verify that updateSettingsForSource was called only once
    expect(updateSettingsCallCount).toBe(1)

    // Verify that migration flag was NOT set (should remain undefined)
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBeUndefined()

    // Verify that settings were NOT modified (the write failed)
    expect(settingsStore.localSettings).toEqual({
      otherSetting: 'some-value',
      enabledMcpjsonServers: ['existing1'],
    })

    // Verify that project config was NOT modified (settings write failed before project config removal)
    expect(projectConfigStore).toEqual({
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['server1', 'server2'],
      disabledMcpjsonServers: ['server3'],
      otherField: 'keep-me',
    })
  })

  test('should propagate error when saveCurrentProjectConfig fails and NOT mark migration as completed', async () => {
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

    // Mock saveCurrentProjectConfig to throw on first call
    let saveProjectConfigCallCount = 0
    const saveProjectConfigMock = mock((updater: any) => {
      saveProjectConfigCallCount++
      throw new Error('Permission denied')
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

    // Run migration - should throw
    expect(() => migrateEnableAllProjectMcpServersToSettings()).toThrow('Permission denied')

    // Verify that saveCurrentProjectConfig was called once
    expect(saveProjectConfigCallCount).toBe(1)

    // Verify that migration flag was NOT set (should remain undefined)
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBeUndefined()

    // Verify that settings were updated (step 1 succeeded before step 2 failed)
    // This is safe because the migration is idempotent - next run will complete it
    expect(settingsStore.localSettings.enableAllProjectMcpServers).toBe(true)
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['server1'])

    // Verify that original project config WAS NOT restored (no rollback needed - harmless)
    expect(projectConfigStore).toEqual({
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['server1'],
      otherField: 'keep-me',
    })
  })

  test('should be idempotent - second call does nothing', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with fields to migrate
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['server1'],
      otherField: 'keep-me',
    }

    // Run migration first time
    migrateEnableAllProjectMcpServersToSettings()

    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
    expect(settingsStore.localSettings.enableAllProjectMcpServers).toBe(true)
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['server1'])
    expect(projectConfigStore).toEqual({ otherField: 'keep-me' })

    // Reset log event mock to check second call
    logEventMock.mockClear()

    // Run migration second time - should do nothing
    migrateEnableAllProjectMcpServersToSettings()

    // Verify no additional changes or events
    expect(logEventMock).not.toHaveBeenCalled()
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })

  test('should correctly handle existing settings with no disabledMcpjsonServers field', async () => {
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings with only enabled servers
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['serverA', 'serverB'],
    }

    // Mock project config with only enabled servers
    projectConfigStore = {
      enabledMcpjsonServers: ['serverC'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that disabledMcpjsonServers was NOT set in settings (since it didn't exist before)
    expect(settingsStore.localSettings.disabledMcpjsonServers).toBeUndefined()
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['serverA', 'serverB', 'serverC'])
    expect(globalConfigStore.hasCompletedMcpServerMigration).toBe(true)
  })
})
