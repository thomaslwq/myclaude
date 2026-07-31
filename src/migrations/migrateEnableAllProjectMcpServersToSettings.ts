import { logEvent } from '../services/analytics/index.js'
import {
  getCurrentProjectConfig,
  saveCurrentProjectConfig,
  getGlobalConfig,
  saveGlobalConfig,
} from '../utils/config.js'
import { logError } from '../utils/log.js'
import {
  deleteSettingsField,
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
  // Capture file content hash for concurrent change detection
  const originalSettingsHash = JSON.stringify(originalSettings)

  // Track which fields we are migrating (for rollback)
  const migratedFields: Array<
    | 'enableAllProjectMcpServers'
    | 'enabledMcpjsonServers'
    | 'disabledMcpjsonServers'
  > = []

  // Declare updates outside try block so it's accessible in the catch block for rollback
  const updates: Partial<{
    enableAllProjectMcpServers: boolean
    enabledMcpjsonServers: string[]
    disabledMcpjsonServers: string[]
  }> = {}

  try {
    const existingSettings = originalSettings

    // Migrate enableAllProjectMcpServers if it exists
    if (hasEnableAll) {
      updates.enableAllProjectMcpServers = projectConfig.enableAllProjectMcpServers
      migratedFields.push('enableAllProjectMcpServers')
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
      // Preserve empty arrays to maintain semantic meaning (explicit list of zero servers)
      // vs undefined which means 'use defaults'
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
      migratedFields.push('enabledMcpjsonServers')
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
      migratedFields.push('disabledMcpjsonServers')
    }

    // Resolve overlapping servers: if a server appears in both enabled and disabled lists,
    // remove it from the disabled list since the enabled list takes precedence.
    // This prevents ambiguous configuration where the same server is both enabled and disabled.
    const overlappingServers = existingEnabledServers.filter((server: string) =>
      existingDisabledServers.includes(server)
    )

    if (overlappingServers.length > 0) {
      logEvent('tengu_migrate_mcp_server_overlap_in_both_lists', {
        overlappingServers: overlappingServers.join(','),
        resolvedBy: 'removing_from_disabled_list',
      })

      // Remove overlapping servers from the disabled list
      updates.disabledMcpjsonServers = existingDisabledServers.filter(
        (server: string) => !overlappingServers.includes(server)
      )
    } else {
      updates.disabledMcpjsonServers = existingDisabledServers
    }

    updates.enabledMcpjsonServers = existingEnabledServers

    // Remove migrated fields from project config FIRST to avoid a window where
    // both settings and project config carry the same data (duplicate state).
    // If this step fails, the rollback will restore both.
    saveCurrentProjectConfig((config: Record<string, any>) => {
      const updated = { ...config }
      for (const field of migratedFields) {
        delete updated[field]
      }
      return updated
    })

    // Apply updates to settings AFTER project config fields are removed.
    // This ensures we never have both sources holding the same fields simultaneously.
    // Check for concurrent changes before writing
    const currentSettings = getSettingsForSource('localSettings') || {}
    const currentSettingsHash = JSON.stringify(currentSettings)
    if (currentSettingsHash !== originalSettingsHash) {
      logError(
        'MIGRATION WARNING: Settings file was modified concurrently during migration. ' +
        'The migration will abort to prevent data loss. ' +
        'Original settings hash: ' + originalSettingsHash +
        ', Current settings hash: ' + currentSettingsHash
      )
      // Abort the migration instead of overwriting
      throw new Error(
        'Migration aborted due to concurrent changes to settings file. ' +
        'Please ensure no other processes are modifying the settings file and try again.'
      )
    }
    updateSettingsForSource('localSettings', updates)

    // Mark migration as completed in global config
    saveGlobalConfig(c => ({ ...c, hasCompletedMcpServerMigration: true }))

    logEvent('tengu_migrate_enable_all_project_mcp_servers_to_settings', {
      migration: 'enableAllProjectMcpServersToSettings',
      fieldsMigrated: migratedFields.join(','),
    })
  } catch (error) {
    // Rollback: restore original state in case of failure
    logError('Failed to migrate MCP server settings, rolling back', error)

    let rollbackFailed = false

    // Attempt rollback of settings by restoring the original full settings object.
    // We pass the original settings values for the fields that were migrated.
    // For fields that didn't exist before migration, we use deleteSettingsField
    // to explicitly remove them from the settings file.
    try {
      // Check for concurrent changes to the settings file
      const currentSettings = getSettingsForSource('localSettings') || {}
      const currentSettingsHash = JSON.stringify(currentSettings)
      if (currentSettingsHash !== originalSettingsHash) {
        logError(
          'MIGRATION WARNING: Settings file was modified concurrently. ' +
          'The rollback will abort to prevent data loss. ' +
          'Original settings hash: ' + originalSettingsHash +
          ', Current settings hash: ' + currentSettingsHash
        )
        // Abort the rollback instead of overwriting
        throw new Error(
          'Rollback aborted due to concurrent changes to settings file. ' +
          'Please ensure no other processes are modifying the settings file.'
        )
      }

      // Only revert the specific fields that were migrated, not the entire settings object.
      // This preserves any concurrent changes to other keys made by other processes.
      const rollbackUpdates: Record<string, unknown> = {}
      for (const field of migratedFields) {
        if (field in originalSettings) {
          rollbackUpdates[field] = originalSettings[field]
        } else {
          // Field didn't exist before migration — explicitly delete it.
          deleteSettingsField('localSettings', field)
        }
      }
      updateSettingsForSource('localSettings', rollbackUpdates)

      // Restore original project config fields if they were removed
      saveCurrentProjectConfig((config: Record<string, any>) => {
        const updated = { ...config }
        for (const field of migratedFields) {
          if (field in originalProjectConfig) {
            updated[field] = originalProjectConfig[field]
          }
        }
        return updated
      })
    } catch (rollbackError) {
      logError('Rollback of settings failed', rollbackError)
      rollbackFailed = true
    }

    if (rollbackFailed) {
      logError(
        'Migration failed and rollback was incomplete. ' +
        'The settings file may be in an inconsistent state. ' +
        'Please check the settings file manually.'
      )
      // Do NOT mark migration as completed when rollback fails, so the user can retry
      // or manually fix the state. The migration flag will not be set.
      throw error
    }
  }
}
