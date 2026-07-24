import { logError } from '../utils/log.js'
import { getAPIProvider } from '../utils/model/providers.js'
import {
  getSettingsForSource,
  updateSettingsForSource,
} from '../utils/settings/settings.js'

/**
 * Migrate users on removed fennec model aliases to their new Opus 4.6 aliases.
 * - fennec-latest → opus
 * - fennec-latest[1m] → opus[1m]
 * - fennec-fast-latest → opus[1m] + fast mode
 * - opus-4-5-fast → opus + fast mode
 *
 * Reads each editable source individually (userSettings, projectSettings,
 * localSettings) so that fennec aliases are migrated wherever they appear.
 * Policy and flag settings are left alone — those are not user-writable or
 * are ephemeral.
 *
 * Idempotent: only writes when a source contains a fennec alias.
 */
export function migrateFennecToOpus(): void {
  try {
    if (getAPIProvider() !== 'firstParty') {
      return
    }

    // Sources to check — in order of increasing precedence.
    // PolicySettings and flagSettings are excluded:
    // - policySettings is not user-writable and shouldn't be rewritten
    // - flagSettings is ephemeral (CLI --settings) and not stored back
    const sources = ['userSettings', 'projectSettings', 'localSettings'] as const

    for (const source of sources) {
      const settings = getSettingsForSource(source)

      const model = settings?.model
      if (typeof model !== 'string') {
        continue
      }

      if (model.startsWith('fennec-latest[1m]')) {
        updateSettingsForSource(source, {
          model: 'opus[1m]',
        })
      } else if (model.startsWith('fennec-latest')) {
        updateSettingsForSource(source, {
          model: 'opus',
        })
      } else if (
        model.startsWith('fennec-fast-latest') ||
        model.startsWith('opus-4-5-fast')
      ) {
        updateSettingsForSource(source, {
          model: 'opus[1m]',
          fastMode: true,
        })
      }
    }
  } catch (error) {
    logError(new Error(`Failed to migrate fennec to opus: ${error}`))
  }
}
