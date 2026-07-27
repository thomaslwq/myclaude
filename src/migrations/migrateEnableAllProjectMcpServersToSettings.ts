import { logEvent } from '../services/analytics/index.js'
import {
  getCurrentProjectConfig,
  saveCurrentProjectConfig,
  getGlobalConfig,
  saveGlobalConfig,
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
 *
 * Idempotency: Uses a global config flag `hasCompletedMcpServerMigration` to ensure
 * the migration runs only once, preventing duplicate log events and re-merging.
 */
export function migrateEnableAllProjectMcpServersToSettings(): void {
  // Check if migration has already completed successfully
  const globalConfig = getGlobalConfig()
  if (globalConfig.hasCompletedMcpServerMigration) {
    return
  }

  const projectConfig = getCurrentProjectConfig()

  // Check if any field exists in project config
  const hasEnableAll = projectConfig.enableAllProjectMcpServers !== undefined
  const hasEnabledServers = Array.isArray(projectConfig.enabledMcpjsonServers)
  const hasDisabledServers = Array.isArray(projectConfig.disabledMcpjsonServers)

  if (!hasEnableAll && !hasEnabledServers && !hasDisabledServers) {
    // No fields to migrate, but mark as completed to avoid unnecessary checks
    saveGlobalConfig(c => ({ ...c, hasCompletedMcpServerMigration: true }))
    return
  }

  // Save original state for rollback in case of failure
  const originalSettings = getSettingsForSource('localSettings') || {}
  const originalProjectConfig = { ...projectConfig }
  const originalSettingsKeys = new Set(Object.keys(originalSettings))

  try {
    const existingSettings = originalSettings
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
    // Only set the field if:
    // - Settings already had it (preserve existing data even if empty), OR
    // - The project config has a non-empty array to migrate
    const existingHadEnabledServers = Array.isArray(existingSettings.enabledMcpjsonServers)
    const existingHadDisabledServers = Array.isArray(existingSettings.disabledMcpjsonServers)

    const hasNonEmptyEnabledServers =
      hasEnabledServers &&
      Array.isArray(projectConfig.enabledMcpjsonServers) &&
      projectConfig.enabledMcpjsonServers.length > 0
    const hasNonEmptyDisabledServers =
      hasDisabledServers &&
      Array.isArray(projectConfig.disabledMcpjsonServers) &&
      projectConfig.disabledMcpjsonServers.length > 0

    if (existingHadEnabledServers || hasNonEmptyEnabledServers) {
      updates.enabledMcpjsonServers = existingEnabledServers
    }
    if (existingHadDisabledServers || hasNonEmptyDisabledServers) {
      updates.disabledMcpjsonServers = existingDisabledServers
    }

    // Apply updates to settings
    updateSettingsForSource('localSettings', updates)

    // Remove migrated fields from project config
    saveCurrentProjectConfig((config: Record<string, any>) => {
      const updated = { ...config }
      for (const field of fieldsToRemove) {
        delete updated[field]
      }
      return updated
    })

    // Mark migration as completed in global config
    saveGlobalConfig(c => ({ ...c, hasCompletedMcpServerMigration: true }))

    logEvent('tengu_migrate_enable_all_project_mcp_servers_to_settings', {
      migration: 'enableAllProjectMcpServersToSettings',
      fieldsMigrated: fieldsToRemove.join(','),
    })
  } catch (error) {
    // Rollback: restore original state in case of failure
    logError('Failed to migrate MCP server settings, rolling back', error)
    try {
      // Compute rollback updates: restore original values and remove any fields that were added by migration
      const rollbackUpdates: Record<string, unknown> = { ...originalSettings }
      // Figure out which keys were added by migration (exist in current settings but not in original)
      const currentSettings = getSettingsForSource('localSettings') || {}
      for (const key of Object.keys(currentSettings)) {
        if (!originalSettingsKeys.has(key)) {
          // Key was added by migration - set to undefined to delete it
          rollbackUpdates[key] = undefined
        }
      }
      updateSettingsForSource('localSettings', rollbackUpdates)
    } catch (rollbackError) {
      logError('Rollback of settings failed', rollbackError)
    }
    try {
      saveCurrentProjectConfig((config: Record<string, any>) => ({
        ...config,
        ...originalProjectConfig,
      }))
    } catch (rollbackError) {
      logError('Rollback of project config failed', rollbackError)
    }
    logError('Rollback complete (may have partial failures): original MCP server settings restoration attempted', error)
  }
}
