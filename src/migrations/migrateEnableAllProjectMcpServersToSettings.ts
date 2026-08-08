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
 * - If a server appears in both enabled and disabled lists, the conflict is preserved
 *   and logged as a warning event for user review, rather than silently overriding
 *   user intent.
 * - Other settings fields are never overwritten
 *
 * Idempotency: Uses a global config flag `hasCompletedMcpServerMigration` to ensure
 * the migration runs only once, preventing duplicate log events and re-merging.
 *
 * Safety: Settings are written FIRST (step 1), then project config fields are removed (step 2).
 * If the process crashes after step 1, the migration is incomplete but harmless — the fields
 * exist in both places and the migration will complete on next run. No rollback mechanism is
 * needed because the operation is idempotent and safe in partial completion.
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

  // Build updates for settings migration
  const updates: Partial<{
    enableAllProjectMcpServers: boolean
    enabledMcpjsonServers: string[]
    disabledMcpjsonServers: string[]
  }> = {}

  const existingSettings = getSettingsForSource('localSettings') || {}

  // Migrate enableAllProjectMcpServers if it exists
  if (hasEnableAll) {
    updates.enableAllProjectMcpServers = projectConfig.enableAllProjectMcpServers
  }

  // Start with existing settings arrays as the base
  const existingEnabledServers = Array.isArray(existingSettings.enabledMcpjsonServers)
    ? [...existingSettings.enabledMcpjsonServers]
    : []
  const existingDisabledServers = Array.isArray(existingSettings.disabledMcpjsonServers)
    ? [...existingSettings.disabledMcpjsonServers]
    : []

  // Merge enabledMcpjsonServers if it exists in project config and is non-empty
  if (hasEnabledServers && Array.isArray(projectConfig.enabledMcpjsonServers) && projectConfig.enabledMcpjsonServers.length > 0) {
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

  // Merge disabledMcpjsonServers if it exists in project config and is non-empty
  if (hasDisabledServers && Array.isArray(projectConfig.disabledMcpjsonServers) && projectConfig.disabledMcpjsonServers.length > 0) {
    // Merge the servers, preserving order and avoiding duplicates
    const seen = new Set(existingDisabledServers)
    for (const server of projectConfig.disabledMcpjsonServers) {
      if (!seen.has(server)) {
        existingDisabledServers.push(server)
        seen.add(server)
      }
    }
  }

  // Detect overlapping servers: if a server appears in both enabled and disabled lists,
  // preserve the conflict for user review rather than silently overriding user intent.
  const overlappingServers = existingEnabledServers.filter(server =>
    existingDisabledServers.includes(server)
  )

  if (overlappingServers.length > 0) {
    logEvent('tengu_migrate_mcp_server_conflict_detected', {
      overlappingServers: overlappingServers.join(','),
      conflictResolution: 'preserved_for_user_review',
    })
  }

  // Set the merged arrays in updates
  // The disabled list is preserved as-is (including any overlapping servers) so that
  // an explicit user intent to disable a server is not silently overridden.
  if (hasEnabledServers) {
    updates.enabledMcpjsonServers = existingEnabledServers
  }
  if (hasDisabledServers || existingSettings.disabledMcpjsonServers !== undefined) {
    updates.disabledMcpjsonServers = existingDisabledServers
  }

  // Step 1: Write settings first (safe merge operation)
  // This is done before removing project config fields so that if the write fails,
  // no data is lost — the original fields remain in project config.
  try {
    updateSettingsForSource('localSettings', updates)
  } catch (error) {
    logError(new Error(`Failed to migrate MCP server settings to local config: ${error}`))
    throw error
  }

  // Step 2: Remove migrated fields from project config
  // If this fails, the fields exist in both places (harmless, migration is idempotent).
  saveCurrentProjectConfig((config: Record<string, any>) => {
    const updated = { ...config }
    delete updated.enableAllProjectMcpServers
    delete updated.enabledMcpjsonServers
    delete updated.disabledMcpjsonServers
    return updated
  })

  // Step 3: Mark migration as completed in global config
  saveGlobalConfig(c => ({ ...c, hasCompletedMcpServerMigration: true }))

  logEvent('tengu_migrate_enable_all_project_mcp_servers_to_settings', {
    migration: 'enableAllProjectMcpServersToSettings',
    fieldsMigrated: [
      hasEnableAll ? 'enableAllProjectMcpServers' : undefined,
      hasEnabledServers ? 'enabledMcpjsonServers' : undefined,
      hasDisabledServers ? 'disabledMcpjsonServers' : undefined,
    ].filter(Boolean).join(','),
  })
}
