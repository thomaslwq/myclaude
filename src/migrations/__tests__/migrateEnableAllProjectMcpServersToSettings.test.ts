import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { join } from 'path'

// ── Mock config ────────────────────────────────────────────────────
let projectConfigStore: Record<string, any> = {}
let settingsStore: Record<string, any> = {}

beforeEach(() => {
  projectConfigStore = {}
  settingsStore = {}

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
    logEvent: () => {},
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

  test('should ensure mutual exclusivity between enabled and disabled servers', async () => {
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

    // Verify that servers in enabled list are removed from disabled list
    // 'existingEnabled' from project config is already in existing enabled list, so it's not duplicated
    // 'existingEnabled' from project config disabled list is removed because it's in the enabled list
    // 'existingDisabled' is only in the disabled list, so it stays
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existingEnabled', 'otherEnabled', 'newEnabled'])
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['existingDisabled', 'otherDisabled', 'newDisabled'])
  })

  test('should ensure mutual exclusivity applies to existing settings too', async () => {
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
      disabledMcpjsonServers: ['newServer2'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that servers in enabled list are removed from disabled list (even if they existed before)
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['existingEnabled', 'conflictingServer', 'newServer1'])
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['existingDisabled', 'newServer2'])
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

  test('should handle project config with both enabled and disabled servers', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock existing settings
    settingsStore.localSettings = {
      enabledMcpjsonServers: ['existingEnabled'],
      disabledMcpjsonServers: ['existingDisabled'],
    }

    // Mock project config with both enabled and disabled servers
    projectConfigStore = {
      enabledMcpjsonServers: ['newEnabled', 'existingDisabled'],
      disabledMcpjsonServers: ['newDisabled', 'existingEnabled'],
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that servers are merged and mutual exclusivity is enforced
    // 'existingDisabled' from project config enabled list is added to enabled list
    // 'existingEnabled' from project config disabled list is removed from disabled list (since it's enabled)
    // 'existingDisabled' is removed from disabled list because it is now in the enabled list
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
})
