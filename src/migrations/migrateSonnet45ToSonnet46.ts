import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../services/analytics/index.js'
import {
  isMaxSubscriber,
  isProSubscriber,
  isTeamPremiumSubscriber,
} from '../utils/auth.js'
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'
import { getAPIProvider } from '../utils/model/providers.js'
import {
  getSettingsForSource,
  updateSettingsForSource,
} from '../utils/settings/settings.js'

/**
 * Migrate Pro/Max/Team Premium first-party users off explicit Sonnet 4.5
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

  if (!isProSubscriber() && !isMaxSubscriber() && !isTeamPremiumSubscriber()) {
    return
  }

  const model = getSettingsForSource('userSettings')?.model
  if (typeof model !== 'string') {
    return
  }

  // Match base model strings: claude-sonnet-4-5-20250929 or sonnet-4-5-20250929
  // Optionally followed by a context window suffix like [1m], [100k], [200k], etc.
  const match = model.match(/^(?:claude-)?(sonnet-4-5-20250929)(?:\[(.+?)\])?$/)
  if (!match) {
    return
  }

  const suffix = match[2] ? `[${match[2]}]` : ''
  updateSettingsForSource('userSettings', {
    model: suffix ? `sonnet${suffix}` : 'sonnet',
  })

  // Skip notification for brand-new users — they never experienced the old default
  const config = getGlobalConfig()
  if (config.numStartups > 1) {
    saveGlobalConfig(current => ({
      ...current,
      sonnet45To46MigrationTimestamp: Date.now(),
    }))
  }

  logEvent('tengu_sonnet45_to_46_migration', {
    from_model:
      model as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    has_1m: suffix === '[1m]',
  })
}
