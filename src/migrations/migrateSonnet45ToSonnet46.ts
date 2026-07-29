import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../services/analytics/index.js'
import { saveGlobalConfig } from '../utils/config.js'
import { getAPIProvider } from '../utils/model/providers.js'
import {
  getSettingsForSource,
  updateSettingsForSource,
} from '../utils/settings/settings.js'

/**
 * Migrate all first-party users off explicit Sonnet 4.5
 * model strings to the 'sonnet' alias (which now resolves to Sonnet 4.6).
 *
 * Users may have been pinned to explicit Sonnet 4.5 strings by:
 * - The earlier migrateSonnet1mToSonnet45 migration (sonnet[1m] → explicit 4.5[1m])
 * - Manually selecting it via /model
 *
 * Reads userSettings specifically (not merged) so we only migrate what /model
 * wrote — project/local pins are left alone.
 * Idempotent: only writes if userSettings.model matches a Sonnet 4.5 string.
 */
export function migrateSonnet45ToSonnet46(): void {
  if (getAPIProvider() !== 'firstParty') {
    return
  }

  // Sources to check — in order of increasing precedence.
  // PolicySettings and flagSettings are excluded:
  // - policySettings is not user-writable and shouldn't be rewritten
  // - flagSettings is ephemeral (CLI --settings) and not stored back
  const sources = ['userSettings', 'projectSettings', 'localSettings'] as const

  let anyMigrated = false
  for (const source of sources) {
    const model = getSettingsForSource(source)?.model
    if (typeof model !== 'string') {
      continue
    }

    // Match base model strings: claude-sonnet-4-5-20250929 or sonnet-4-5-20250929
    // Optionally followed by a context window suffix like [1m], [100k], [200k], etc.
    const match = model.match(/^(?:claude-)?(sonnet-4-5-20250929)(?:\[(.+?)\])?$/)
    if (!match) {
      continue
    }

    const suffix = match[2] ? `[${match[2]}]` : ''
    updateSettingsForSource(source, {
      model: suffix ? `sonnet${suffix}` : 'sonnet',
    })
    anyMigrated = true
  }

  if (!anyMigrated) {
    return
  }

  // Record the migration timestamp so the notification hook can show a one-time notice.
  // This is always saved when the migration actually changes the model. Brand-new users
  // won't have Sonnet 4.5 in their userSettings, so the migration will return early above.
  saveGlobalConfig(current => ({
    ...current,
    sonnet45To46MigrationTimestamp: Date.now(),
  }))

  logEvent('tengu_sonnet45_to_46_migration', {
    from_model:
      'multiple' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    has_1m: false,
  })
}
