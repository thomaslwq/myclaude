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
      // Resolve the effective value across USER-CONFIGURABLE sources only
      // (userSettings > localSettings). flagSettings and policySettings are
      // excluded — they are not user-configurable, so an admin policy or
      // ephemeral CLI flag setting `false` must not block the migration
      // (issue #586).
      const effectiveSkip = (
        ['userSettings', 'localSettings'] as const
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
