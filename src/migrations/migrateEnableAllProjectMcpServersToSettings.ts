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
 *
 * Merge behavior:
 * - Existing settings arrays are preserved in order with new servers appended
 * - Duplicates are removed (first occurrence wins, preserving original order)
 * - The disabled list is filtered for mutual exclusivity: if a server appears in both
 *   enabled and disabled lists, it is removed from the disabled list since the enabled list
 *   takes precedence. This resolves the ambiguous configuration.
 * - A warning event is logged when a server appears in both lists, and the conflict is resolved.
 * - Other settings fields are never overwritten
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

    // Start with existing settings arrays as the base
    const existingEnabledServers = Array.isArray(existingSettings.enabledMcpjsonServers)
      ? [...existingSettings.enabledMcpjsonServers]
      : []
    const existingDisabledServers = Array.isArray(existingSettings.disabledMcpjsonServers)
      ? [...existingSettings.disabledMcpjsonServers]
      : []

    // Merge enabledMcpjsonServers if it exists in project config
    if (hasEnabledServers) {
      if (Array.isArray(projectConfig.enabledMcpjsonServers) && projectConfig.enabledMcpjsonServers.length > 0) {
        // Merge the servers, preserving order and avoiding duplicates
        // First occurrence wins: existing items keep their position, new items are appended
        const seen = new Set(existingEnabledServers)
        for (const server of projectConfig.enabledMcpjsonServers) {
          if (!seen.has(server)) {
            existingEnabledServers.push(server)
            seen.add(server)
          }
        }
      }
      fieldsToRemove.push('enabledMcpjsonServers')
    }

    // Merge disabledMcpjsonServers if it exists in project config
    if (hasDisabledServers) {
      if (Array.isArray(projectConfig.disabledMcpjsonServers) && projectConfig.disabledMcpjsonServers.length > 0) {
        // Merge the servers, preserving order and avoiding duplicates
        const seen = new Set(existingDisabledServers)
        for (const server of projectConfig.disabledMcpjsonServers) {
          if (!seen.has(server)) {
            existingDisabledServers.push(server)
            seen.add(server)
          }
        }
      }
      fieldsToRemove.push('disabledMcpjsonServers')
    }

    // Resolve overlapping servers: if a server appears in both enabled and disabled lists,
    // remove it from the disabled list since the enabled list takes precedence.
    // This prevents ambiguous configuration where the same server is both enabled and disabled.
    const enabledSet = new Set(existingEnabledServers)
    const overlappingServers = existingDisabledServers.filter(server =>
      enabledSet.has(server)
    )
    if (overlappingServers.length > 0) {
      // Remove overlapping servers from the disabled list
      const overlappingSet = new Set(overlappingServers)
      for (let i = existingDisabledServers.length - 1; i >= 0; i--) {
        if (overlappingSet.has(existingDisabledServers[i])) {
          existingDisabledServers.splice(i, 1)
        }
      }

      logEvent('tengu_migrate_mcp_server_overlap_in_both_lists', {
        migration: 'enableAllProjectMcpServersToSettings',
        overlappingServers: overlappingServers.join(','),
        message: 'MCP server(s) appear in both enabled and disabled lists. Removed from disabled list to resolve conflict.',
      })
    }

    // Only set updates if there are actual changes from existing settings
    // This prevents overwriting other fields in the settings file
    // Also check if existing settings had the field to handle cases where mutual exclusivity
    // filtering removes all entries (e.g., all disabled servers are also in enabled list)
    const existingHadEnabledServers = Array.isArray(existingSettings.enabledMcpjsonServers)
    const existingHadDisabledServers = Array.isArray(existingSettings.disabledMcpjsonServers)
    if (existingEnabledServers.length > 0 || existingHadEnabledServers) {
      updates.enabledMcpjsonServers = existingEnabledServers
    }
    if (existingDisabledServers.length > 0 || existingHadDisabledServers) {
      updates.disabledMcpjsonServers = existingDisabledServers
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

    logEvent('tengu_migrate_enable_all_project_mcp_servers_to_settings', {
      migration: 'enableAllProjectMcpServersToSettings',
      fieldsMigrated: fieldsToRemove.join(','),
    })
  } catch (error) {
    logError('Failed to migrate MCP server settings', error)
  }
}
