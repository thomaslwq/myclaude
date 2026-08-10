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
export async function migrateFennecToOpus(): Promise<void> {
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

      // Match known model aliases with optional context-length suffixes (e.g., [1m], [1M], [100k])
      // Case-insensitive matching is intentional; both lowercase and uppercase suffixes are preserved.
      // Use * to match zero or more suffixes (multiple suffixes are allowed).
      // Non-capturing group: actual suffixes are extracted separately below.
      const fennecFastLatestMatch = model.match(/^fennec-fast-latest(?:\[\d+[kKmM]\])*$/i)
      const opus45FastMatch = model.match(/^opus-4-5-fast(?:\[\d+[kKmM]\])*$/i)
      const fennecLatestMatch = model.match(/^fennec-latest(?:\[\d+[kKmM]\])*$/i)

      if (fennecFastLatestMatch || opus45FastMatch) {
        // Extract all suffixes (e.g., [1m][200k])
        const suffixTokens = model.match(/\[\d+[kKmM]\]/gi)
        const suffix = suffixTokens ? suffixTokens.join('') : ''
        // Preserve the existing fastMode setting if it exists, otherwise set it to true
        // because fennec-fast-latest and opus-4-5-fast are fast mode models
        const existingFastMode = settings?.fastMode
        const update: { model: string; fastMode?: boolean } = {
          model: `opus${suffix}`,
          fastMode: existingFastMode !== undefined ? existingFastMode : true,
        }
        await updateSettingsForSource(source, update)
      } else if (fennecLatestMatch) {
        // Extract all suffixes (e.g., [1m][200k])
        const suffixTokens = model.match(/\[\d+[kKmM]\]/gi)
        const suffix = suffixTokens ? suffixTokens.join('') : ''
        await updateSettingsForSource(source, {
          model: `opus${suffix}`,
        })
      }
    }
  } catch (error) {
    logError(new Error(`Failed to migrate fennec to opus: ${error}`))
    throw error
  }
}
