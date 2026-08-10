import { logEvent } from '../services/analytics/index.js'
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'
import { logError } from '../utils/log.js'
import {
  getSettingsForSource,
  hasSkipDangerousModePermissionPrompt,
  updateSettingsForSource,
} from '../utils/settings/settings.js'

/**
 * Migration: Move bypassPermissionsModeAccepted from global config to settings.json
 * as skipDangerousModePermissionPrompt. This is a better home since settings.json
 * is the user-configurable settings file.
 */
export function migrateBypassPermissionsAcceptedToSettings(): void {
  const globalConfig = getGlobalConfig()

  if (!globalConfig.bypassPermissionsModeAccepted) {
    return
  }

  try {
    if (!hasSkipDangerousModePermissionPrompt()) {
      // Only migrate if the user has not explicitly opted out (set to false).
      // Resolve the effective value across sources in priority order
      // (userSettings > localSettings > flagSettings > policySettings) rather
      // than checking each source independently — a lower-priority `false`
      // must not mask a higher-priority `true` (or vice versa).
      const effectiveSkip = (
        ['userSettings', 'localSettings', 'flagSettings', 'policySettings'] as const
      )
        .map(source => getSettingsForSource(source)?.skipDangerousModePermissionPrompt)
        .find(value => value !== undefined)

      const userExplicitlyOptedOut = effectiveSkip === false

      if (!userExplicitlyOptedOut) {
        updateSettingsForSource('userSettings', {
          skipDangerousModePermissionPrompt: true,
        })
      }
    }

    logEvent('tengu_migrate_bypass_permissions_accepted', {})

    saveGlobalConfig(current => {
      if (!('bypassPermissionsModeAccepted' in current)) return current
      const { bypassPermissionsModeAccepted: _, ...updatedConfig } = current
      return updatedConfig
    })
  } catch (error) {
    logError(
      new Error(`Failed to migrate bypass permissions accepted: ${error}`),
    )
    throw error
  }
}
