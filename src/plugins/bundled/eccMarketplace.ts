import { logForDebugging } from '../../utils/debug.js'
import { registerSeedMarketplaces } from '../../utils/plugins/marketplaceManager.js'

/**
 * Register ECC as a seed marketplace.
 * The seed directory is set via CLAUDE_CODE_PLUGIN_SEED_DIR in cli.tsx
 * at startup. registerSeedMarketplaces() copies the seed entry to
 * known_marketplaces.json on first run. Subsequent runs are no-ops.
 */
export async function ensureEccMarketplaceRegistered(): Promise<boolean> {
  try {
    const changed = await registerSeedMarketplaces()
    logForDebugging(
      changed
        ? 'ECC seed marketplace registered'
        : 'ECC marketplace already registered, skipped',
    )
    return true
  } catch (error) {
    logForDebugging(`Failed to register ECC marketplace: ${error}`, {
      level: 'warn',
    })
    return false
  }
}
