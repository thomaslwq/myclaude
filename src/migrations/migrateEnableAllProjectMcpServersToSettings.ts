import { logEvent } from '../services/analytics/index.js'
import {
  getCurrentProjectConfig,
  saveCurrentProjectConfig,
} from '../utils/config.js'
import { logError } from '../utils/log.js'
import {
  getSettingsForSource,
  updateSettingsForSource,
} from '../utils/settings/settings.js'

/**
 * Migration: Move MCP server approval fields from project config to local settings
 * This migrates both enableAllProjectMcpServers and enabledMcpjsonServers to the
 * settings system for better management and consistency.
 */
export function migrateEnableAllProjectMcpServersToSettings(): void {
  const projectConfig = getCurrentProjectConfig()

  // Check if any field exists in project config
  const hasEnableAll = projectConfig.enableAllProjectMcpServers !== undefined
  const hasEnabledServers = Array.isArray(projectConfig.enabledMcpjsonServers)
  const hasDisabledServers = Array.isArray(projectConfig.disabledMcpjsonServers)

  if (!hasEnableAll && !hasEnabledServers && !hasDisabledServers) {
    return
  }

  try {
    const existingSettings = getSettingsForSource('localSettings') || {}
    const updates: Partial<{
      enableAllProjectMcpServers: boolean
      enabledMcpjsonServers: string[]
      disabledMcpjsonServers: string[]
    }> = {}
    const fieldsToRemove: Array<
      | 'enableAllProjectMcpServers'
      | 'enabledMcpjsonServers'
      | 'disabledMcpjsonServers'
    > = []

    // Migrate enableAllProjectMcpServers if it exists
    // Always migrate the project config value to settings, preferring the project-level value
    if (hasEnableAll) {
      updates.enableAllProjectMcpServers =
        projectConfig.enableAllProjectMcpServers
      fieldsToRemove.push('enableAllProjectMcpServers')
    }

    // Migrate enabledMcpjsonServers if it exists
    if (hasEnabledServers) {
      // Only merge into settings if the project config has actual servers to add
      if (projectConfig.enabledMcpjsonServers && projectConfig.enabledMcpjsonServers.length > 0) {
        const existingEnabledServers =
          existingSettings.enabledMcpjsonServers || []
        // Merge the servers (avoiding duplicates)
        updates.enabledMcpjsonServers = [
          ...new Set([
            ...existingEnabledServers,
            ...projectConfig.enabledMcpjsonServers,
          ]),
        ]
      }
      fieldsToRemove.push('enabledMcpjsonServers')
    }

    // Migrate disabledMcpjsonServers if it exists
    if (hasDisabledServers) {
      // Only merge into settings if the project config has actual servers to add
      if (projectConfig.disabledMcpjsonServers && projectConfig.disabledMcpjsonServers.length > 0) {
        const existingDisabledServers =
          existingSettings.disabledMcpjsonServers || []
        // Merge the servers (avoiding duplicates)
        updates.disabledMcpjsonServers = [
          ...new Set([
            ...existingDisabledServers,
            ...projectConfig.disabledMcpjsonServers,
          ]),
        ]
      }
      fieldsToRemove.push('disabledMcpjsonServers')
    }

    // Ensure mutual exclusivity: if a server is in both enabled and disabled lists,
    // remove it from the disabled list (enabled takes precedence)
    if (updates.enabledMcpjsonServers && updates.disabledMcpjsonServers) {
      const enabledSet = new Set(updates.enabledMcpjsonServers)
      updates.disabledMcpjsonServers = updates.disabledMcpjsonServers.filter(
        server => !enabledSet.has(server)
      )
    }

    // Update settings FIRST to ensure data is safely stored before removing from project config
    // If a crash occurs after settings update but before project config removal, the data
    // is preserved in settings and the migration can be safely re-run or the system will
    // use the settings value. This is the safe order (write to new location first, then delete old).
    if (Object.keys(updates).length > 0) {
      updateSettingsForSource('localSettings', updates)
    }

    // Remove migrated fields from project config after settings are safely updated
    if (fieldsToRemove.length > 0) {
      saveCurrentProjectConfig(current => {
        const updated = { ...current }
        for (const field of fieldsToRemove) {
          delete updated[field]
        }
        return updated
      })
    }

    logEvent('migration_complete', {
      migration: 'enableAllProjectMcpServersToSettings',
      fieldsMigrated: fieldsToRemove.join(','),
    })
  } catch (error) {
    logError('Failed to migrate MCP server settings', error)
  }
}
