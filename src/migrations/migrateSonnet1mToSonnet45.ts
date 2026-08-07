import { logError } from '../utils/log.js'
import {
  getMainLoopModelOverride,
  setMainLoopModelOverride,
} from '../bootstrap/state.js'
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'
import {
  getSettingsForSource,
  updateSettingsForSource,
} from '../utils/settings/settings.js'
import { CLAUDE_SONNET_4_5_CONFIG } from '../utils/model/configs.js'

/**
 * Migrate users who had "sonnet[1m]" saved to the explicit Sonnet 4.5 model.
 *
 * The "sonnet" alias now resolves to Sonnet 4.6, so users who previously set
 * "sonnet[1m]" (targeting Sonnet 4.5 with 1M context) need to be pinned to the
 * explicit version to preserve their intended model.
 *
 * This is needed because Sonnet 4.6 1M was offered to a different group of users than
 * Sonnet 4.5 1M, so we needed to pin existing sonnet[1m] users to Sonnet 4.5 1M.
 *
 * The target model string is derived from the centralized model config registry
 * (CLAUDE_SONNET_4_5_CONFIG) rather than hardcoding a version-tied string, so the
 * migration stays valid if the model ID changes.
 *
 * Reads from userSettings specifically (not merged settings) so we don't
 * promote a project-scoped "sonnet[1m]" to the global default. Runs once,
 * tracked by a completion flag in global config.
 */
export function migrateSonnet1mToSonnet45(): void {
  const config = getGlobalConfig()
  if (config.sonnet1m45MigrationComplete) {
    return
  }

  const sonnet45Model = CLAUDE_SONNET_4_5_CONFIG.firstParty
  const sonnet45Model1m = `${sonnet45Model}[1m]`

  try {
    // Sources to check — in order of increasing precedence.
    // PolicySettings and flagSettings are excluded:
    // - policySettings is not user-writable and shouldn't be rewritten
    // - flagSettings is ephemeral (CLI --settings) and not stored back
    const sources = ['userSettings', 'projectSettings', 'localSettings'] as const

    let anyMigrated = false
    for (const source of sources) {
      const model = getSettingsForSource(source)?.model
      if (model === 'sonnet[1m]') {
        updateSettingsForSource(source, {
          model: sonnet45Model1m,
        })
        anyMigrated = true
      }
    }

    // Also migrate the in-memory override if already set
    const override = getMainLoopModelOverride()
    if (override === 'sonnet[1m]') {
      setMainLoopModelOverride(sonnet45Model1m)
    }

    saveGlobalConfig(current => ({
      ...current,
      sonnet1m45MigrationComplete: true,
    }))
  } catch (error) {
    logError(new Error(`Failed to migrate sonnet[1m] to ${sonnet45Model1m}: ${error}`))
  }
}
