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

  test('should merge values when project config has a different value than settings', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with enableAllProjectMcpServers set to true
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: [],
      disabledMcpjsonServers: [],
      otherField: 'keep-me',
    }

    // Mock settings with enableAllProjectMcpServers set to false
    settingsStore = {
      localSettings: {
        enableAllProjectMcpServers: false,
      },
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that the project config value (true) was migrated to settings
    expect(settingsStore.localSettings.enableAllProjectMcpServers).toBe(true)
    // Verify that the field was removed from project config
    expect(projectConfigStore.enableAllProjectMcpServers).toBeUndefined()
  })

  test('should remove field from project config even if values are the same', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with enableAllProjectMcpServers set to true
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: [],
      disabledMcpjsonServers: [],
      otherField: 'keep-me',
    }

    // Mock settings with enableAllProjectMcpServers set to true (same value)
    settingsStore = {
      localSettings: {
        enableAllProjectMcpServers: true,
      },
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that the field was removed from project config (migration is complete)
    expect(projectConfigStore.enableAllProjectMcpServers).toBeUndefined()
    // Verify that settings still have the correct value
    expect(settingsStore.localSettings.enableAllProjectMcpServers).toBe(true)
  })

  test('should handle enabledMcpjsonServers merging when project config has different values', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with enabledMcpjsonServers
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['server1', 'server2'],
      disabledMcpjsonServers: [],
      otherField: 'keep-me',
    }

    // Mock settings with different enabledMcpjsonServers
    settingsStore = {
      localSettings: {
        enabledMcpjsonServers: ['server3', 'server4'],
      },
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that all servers were merged (no duplicates, settings values first then project config)
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['server3', 'server4', 'server1', 'server2'])
    // Verify that the field was removed from project config
    expect(projectConfigStore.enabledMcpjsonServers).toBeUndefined()
  })

  test('should handle disabledMcpjsonServers merging when project config has different values', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with disabledMcpjsonServers
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: [],
      disabledMcpjsonServers: ['server1', 'server2'],
      otherField: 'keep-me',
    }

    // Mock settings with different disabledMcpjsonServers
    settingsStore = {
      localSettings: {
        disabledMcpjsonServers: ['server3', 'server4'],
      },
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that all servers were merged (no duplicates, settings values first then project config)
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['server3', 'server4', 'server1', 'server2'])
    // Verify that the field was removed from project config
    expect(projectConfigStore.disabledMcpjsonServers).toBeUndefined()
  })

  test('should handle all fields being migrated with different values', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with all fields
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['server1', 'server2'],
      disabledMcpjsonServers: ['server3', 'server4'],
      otherField: 'keep-me',
    }

    // Mock settings with different values for all fields
    settingsStore = {
      localSettings: {
        enableAllProjectMcpServers: false,
        enabledMcpjsonServers: ['server5', 'server6'],
        disabledMcpjsonServers: ['server7', 'server8'],
      },
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that project config values were merged into settings
    expect(settingsStore.localSettings.enableAllProjectMcpServers).toBe(true)
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['server5', 'server6', 'server1', 'server2'])
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['server7', 'server8', 'server3', 'server4'])
    // Verify that all fields were removed from project config
    expect(projectConfigStore.enableAllProjectMcpServers).toBeUndefined()
    expect(projectConfigStore.enabledMcpjsonServers).toBeUndefined()
    expect(projectConfigStore.disabledMcpjsonServers).toBeUndefined()
  })

  // ── Red: Test that a server in both enabled and disabled lists is resolved ──
  test('should remove a server from disabled list if it is also in enabled list (mutual exclusivity)', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with a server in BOTH enabled and disabled lists
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['server1', 'server2'],
      disabledMcpjsonServers: ['server2', 'server3'],
      otherField: 'keep-me',
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that server2 appears only in enabled list, not in disabled list
    expect(settingsStore.localSettings.enabledMcpjsonServers).toContain('server1')
    expect(settingsStore.localSettings.enabledMcpjsonServers).toContain('server2')
    expect(settingsStore.localSettings.disabledMcpjsonServers).not.toContain('server2')
    expect(settingsStore.localSettings.disabledMcpjsonServers).toContain('server3')
    // Verify that server2 is not in both lists
    for (const server of (settingsStore.localSettings.enabledMcpjsonServers || [])) {
      expect(settingsStore.localSettings.disabledMcpjsonServers).not.toContain(server)
    }
  })

  test('should handle overlap between existing settings and project config enabled/disabled lists', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['serverA', 'serverB'],
      disabledMcpjsonServers: ['serverB', 'serverC'],
      otherField: 'keep-me',
    }

    // Mock existing settings with overlapping servers
    settingsStore = {
      localSettings: {
        enabledMcpjsonServers: ['serverB', 'serverD'],
        disabledMcpjsonServers: ['serverA', 'serverE'],
      },
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // After migration, no server should appear in both enabled and disabled lists
    const enabled = settingsStore.localSettings.enabledMcpjsonServers || []
    const disabled = settingsStore.localSettings.disabledMcpjsonServers || []
    for (const server of enabled) {
      expect(disabled).not.toContain(server)
    }
    for (const server of disabled) {
      expect(enabled).not.toContain(server)
    }
    // All servers should be accounted for somewhere (enabled wins over disabled)
    expect(enabled).toContain('serverA')
    expect(enabled).toContain('serverB')
    expect(enabled).toContain('serverD')
    expect(disabled).toContain('serverC')
    expect(disabled).toContain('serverE')
  })

  test('should NOT overwrite existing enabledMcpjsonServers in settings when project config has empty array', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with empty enabledMcpjsonServers (this is the bug scenario)
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: [],
      disabledMcpjsonServers: ['serverY'],
    }

    // Mock existing settings with pre-existing enabled servers
    settingsStore = {
      localSettings: {
        enabledMcpjsonServers: ['serverA', 'serverB', 'serverC'],
        disabledMcpjsonServers: ['serverX'],
      },
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that existing enabled servers in settings were NOT overwritten by empty array
    expect(settingsStore.localSettings.enabledMcpjsonServers).toEqual(['serverA', 'serverB', 'serverC'])
    // Verify that disabledMcpjsonServers from project config was merged (non-empty, so it should be added)
    expect(settingsStore.localSettings.disabledMcpjsonServers).toContain('serverY')
    expect(settingsStore.localSettings.disabledMcpjsonServers).toContain('serverX')
  })

  test('should NOT overwrite existing disabledMcpjsonServers in settings when project config has empty array', async () => {
    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with empty disabledMcpjsonServers
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['serverZ'],
      disabledMcpjsonServers: [],
    }

    // Mock existing settings with pre-existing disabled servers
    settingsStore = {
      localSettings: {
        enabledMcpjsonServers: ['serverA'],
        disabledMcpjsonServers: ['serverX', 'serverY'],
      },
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that existing disabled servers in settings were NOT overwritten by empty array
    expect(settingsStore.localSettings.disabledMcpjsonServers).toEqual(['serverX', 'serverY'])
    // Verify that enabledMcpjsonServers from project config was merged (non-empty, so it should be added)
    expect(settingsStore.localSettings.enabledMcpjsonServers).toContain('serverZ')
    expect(settingsStore.localSettings.enabledMcpjsonServers).toContain('serverA')
  })
})
