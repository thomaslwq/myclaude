import { logError } from '../utils/log.js'
import { getAPIProvider } from '../utils/model/providers.js'
import {
  getSettingsForSource,
  updateSettingsForSource,
} from '../utils/settings/settings.js'

/**
 * Extract the context-length suffix from a model name (e.g., [1m], [100k], [200k]).
 * Returns the suffix (including brackets) if found, otherwise an empty string.
 */
function extractSuffix(model: string): string {
  return model.match(/\[\d+[km]\]$/)?.[0] ?? ''
}

/**
 * Migrate users on removed fennec model aliases to their new Opus 4.6 aliases.
 * - fennec-latest → opus
 * - fennec-latest[1m] → opus[1m]
 * - fennec-fast-latest → opus + fast mode (suffix preserved if present)
 * - opus-4-5-fast → opus + fast mode (suffix preserved if present)
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

      const model = (settings?.model ?? '').trim()
      if (typeof model !== 'string' || model === '') {
        continue
      }

      if (model.startsWith('fennec-latest')) {
        const suffix = extractSuffix(model)
        updateSettingsForSource(source, {
          model: `opus${suffix}`,
        })
      } else if (
        model.startsWith('fennec-fast-latest') ||
        model.startsWith('opus-4-5-fast')
      ) {
        const suffix = extractSuffix(model)
        // Preserve the existing fastMode setting if it exists, otherwise omit it
        // to avoid overwriting the implicit default behavior
        const existingFastMode = settings?.fastMode
        const update: { model: string; fastMode?: boolean } = {
          model: `opus${suffix}`,
        }
        if (existingFastMode !== undefined) {
          update.fastMode = existingFastMode
        }
        updateSettingsForSource(source, update)
      }
    }
  } catch (error) {
    logError(new Error(`Failed to migrate fennec to opus: ${error}`))
    throw error
  }
}
