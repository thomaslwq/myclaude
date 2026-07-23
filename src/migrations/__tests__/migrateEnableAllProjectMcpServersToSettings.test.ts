import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { join } from 'path'

// ── Mock config ────────────────────────────────────────────────────
let projectConfigStore: Record<string, any> = {}
let settingsStore: Record<string, any> = {}

beforeEach(() => {
  projectConfigStore = {}
  settingsStore = {}
})

describe('migrateEnableAllProjectMcpServersToSettings', () => {
  test('should only remove fields that were migrated (single field)', async () => {
    // Setup mocks
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
    // Setup mocks
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

    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with only enabledMcpjsonServers
    projectConfigStore = {
      enableAllProjectMcpServers: undefined,
      enabledMcpjsonServers: ['server1', 'server2'],
      disabledMcpjsonServers: [],
      otherField: 'keep-me',
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that only enabledMcpjsonServers was removed
    expect(projectConfigStore).toEqual({
      enableAllProjectMcpServers: undefined,
      disabledMcpjsonServers: [],
      otherField: 'keep-me',
    })
  })

  test('should remove all three fields when all are migrated', async () => {
    // Setup mocks
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

    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with all three fields
    projectConfigStore = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['server1'],
      disabledMcpjsonServers: ['server2'],
      otherField: 'keep-me',
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that all three fields were removed
    expect(projectConfigStore).toEqual({
      otherField: 'keep-me',
    })
  })

  test('should not remove any fields when none exist', async () => {
    // Setup mocks
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

    // Dynamic import after mocks are set up
    const { migrateEnableAllProjectMcpServersToSettings } = await import('../migrateEnableAllProjectMcpServersToSettings.js')

    // Mock project config with no MCP fields (empty arrays are falsy)
    projectConfigStore = {
      enableAllProjectMcpServers: undefined,
      enabledMcpjsonServers: [],
      disabledMcpjsonServers: [],
      otherField: 'keep-me',
    }

    // Run migration
    migrateEnableAllProjectMcpServersToSettings()

    // Verify that no config was saved (early return)
    expect(projectConfigStore).toEqual({
      enableAllProjectMcpServers: undefined,
      enabledMcpjsonServers: [],
      disabledMcpjsonServers: [],
      otherField: 'keep-me',
    })
  })
})
