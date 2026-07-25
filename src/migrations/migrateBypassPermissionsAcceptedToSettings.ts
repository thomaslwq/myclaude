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
      // Only migrate if the user has not explicitly opted out (set to false)
      const userExplicitlyOptedOut =
        getSettingsForSource('userSettings')?.skipDangerousModePermissionPrompt === false ||
        getSettingsForSource('localSettings')?.skipDangerousModePermissionPrompt === false ||
        getSettingsForSource('flagSettings')?.skipDangerousModePermissionPrompt === false ||
        getSettingsForSource('policySettings')?.skipDangerousModePermissionPrompt === false

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
  }
}
