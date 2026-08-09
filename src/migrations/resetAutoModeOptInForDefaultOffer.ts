import { logEvent } from '../services/analytics/index.js'
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'
import { logError } from '../utils/log.js'
import { getAutoModeEnabledState } from '../utils/permissions/permissionSetup.js'
import {
  getSettingsForSource,
  getInitialSettings,
  updateSettingsForSource,
} from '../utils/settings/settings.js'
import { resetSettingsCache } from '../utils/settings/settingsCache.js'
import {
  type EditableSettingSource,
} from '../utils/settings/constants.js'

/**
 * One-shot migration: clear skipAutoPermissionPrompt for users who accepted
 * the old 2-option AutoModeOptInDialog but don't have auto as their default.
 * Re-surfaces the dialog so they see the new "make it my default mode" option.
 * Guard lives in GlobalConfig (~/.claude.json), not settings.json, so it
 * survives settings resets and doesn't re-arm itself.
 *
 * Only runs when tengu_auto_mode_config.enabled === 'enabled'. For 'opt-in'
 * users, clearing skipAutoPermissionPrompt would remove auto from the carousel
 * (permissionSetup.ts:988) — the dialog would become unreachable and the
 * migration would defeat itself. In practice the ~40 target ants are all
 * 'enabled' (they reached the old dialog via bare Shift+Tab, which requires
 * 'enabled'), but the guard makes it safe regardless.
 *
 * The migration body always executes when called — the feature flag was removed
 * because it was a hardcoded `false` fallback that made the migration dead code
 * outside of Bun's compile-time macro system.
 */
export async function resetAutoModeOptInForDefaultOffer(): Promise<void> {
  const config = getGlobalConfig()
  if (config.hasResetAutoModeOptInForDefaultOffer) return
  if (getAutoModeEnabledState() !== 'enabled') return

  try {
    // Check if skipAutoPermissionPrompt is set in ANY source
    const sourcesToCheck: EditableSettingSource[] = ['userSettings', 'localSettings', 'projectSettings']
    const hasSkipInEditableSources = sourcesToCheck.some(
      source => getSettingsForSource(source)?.skipAutoPermissionPrompt === true,
    )

    // Check the effective defaultMode from merged settings (highest-priority wins)
    const effectiveSettings = getInitialSettings()
    const effectiveDefaultMode = effectiveSettings?.permissions?.defaultMode

    // Tracks whether any editable source still has the flag after a clear attempt.
    // Declared outside the if block so the completion check below can see it.
    let hasSkipAfterClear = false

    if (
      hasSkipInEditableSources &&
      effectiveDefaultMode != null &&
      effectiveDefaultMode !== 'auto'
    ) {
      // Clear skipAutoPermissionPrompt from all editable sources where it's set
      for (const source of sourcesToCheck) {
        const settings = getSettingsForSource(source)
        if (settings?.skipAutoPermissionPrompt === true) {
          await updateSettingsForSource(source, {
            skipAutoPermissionPrompt: undefined,
          })
        }
      }
      logEvent('tengu_migrate_reset_auto_opt_in_for_default_offer', {})

      // Invalidate the settings cache to ensure we read fresh data from disk
      // This prevents the race condition where getSettingsForSource returns
      // stale cached data after the write operation.
      resetSettingsCache()

      // Check if skipAutoPermissionPrompt is still set in ANY editable source
      // If it is, the migration was interrupted and we should not mark it as complete.
      // This allows the migration to be re-run until all sources are cleared.
      hasSkipAfterClear = sourcesToCheck.some(
        source => getSettingsForSource(source)?.skipAutoPermissionPrompt === true,
      )
    }

    // Check if skipAutoPermissionPrompt is still set after migration
    // (e.g., in policySettings or flagSettings which are read-only)
    const allSources = ['userSettings', 'localSettings', 'projectSettings', 'flagSettings', 'policySettings']
    const hasSkipInNonEditableSources = allSources.some(
      source => getSettingsForSource(source)?.skipAutoPermissionPrompt === true,
    )

    if (hasSkipInNonEditableSources) {
      logEvent('tengu_migrate_reset_auto_opt_in_for_default_offer_skipped', {
        reason: 'skipAutoPermissionPrompt_set_in_non_editable_sources'
      })
    }

    // Only mark the migration as complete if all editable sources were successfully
    // cleared. If the clearing block was entered but some editable source still has
    // skipAutoPermissionPrompt set (e.g., updateSettingsForSource silently failed),
    // we must NOT mark it complete so the migration can be re-run.
    const shouldMarkComplete =
      !hasSkipInEditableSources ||
      (effectiveDefaultMode != null && effectiveDefaultMode !== 'auto' && !hasSkipAfterClear)

    if (shouldMarkComplete) {
      await saveGlobalConfig(c => {
        if (c.hasResetAutoModeOptInForDefaultOffer) return c
        return { ...c, hasResetAutoModeOptInForDefaultOffer: true }
      })
    }
  } catch (error) {
    logError(new Error(`Failed to reset auto mode opt-in for default offer: ${error}`))
    throw error
  }
}
