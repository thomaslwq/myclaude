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

    // Verify that only enableAllProjectMcpServers was removed
    expect(projectConfigStore).toEqual({
      enabledMcpjsonServers: [],
      disabledMcpjsonServers: [],
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

    // Verify that only enableAllProjectMcpServers and enabledMcpjsonServers were removed
    expect(projectConfigStore).toEqual({
      disabledMcpjsonServers: [],
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

    // Mock settings with enableAllProjectMcpServers set to false (different value)
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
})