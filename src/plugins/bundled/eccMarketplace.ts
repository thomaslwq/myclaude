import { logForDebugging } from '../../utils/debug.js'
import {
  addMarketplaceSource,
  loadKnownMarketplacesConfig,
} from '../../utils/plugins/marketplaceManager.js'

/**
 * ECC Marketplace git URL.
 */
const ECC_MARKETPLACE_URL = 'https://github.com/affaan-m/ECC.git'

/**
 * Ensure the ECC marketplace is registered and its content is cached.
 * Uses the official addMarketplaceSource() API which handles cloning,
 * validation, and config persistence.
 *
 * This runs once at startup (fire-and-forget, non-blocking).
 * Subsequent runs are no-ops since addMarketplaceSource detects
 * existing entries.
 */
export async function ensureEccMarketplaceRegistered(): Promise<boolean> {
  try {
    // Skip if already registered — avoids unnecessary git clone
    const existing = await loadKnownMarketplacesConfig()
    if (existing['ecc']) {
      logForDebugging('ECC marketplace already registered, skipping')
      return true
    }

    // Register via the standard marketplace API — handles clone + config
    const result = await addMarketplaceSource({
      source: 'git',
      url: ECC_MARKETPLACE_URL,
    })

    logForDebugging(
      `ECC marketplace registered as '${result.name}' (materialized: ${!result.alreadyMaterialized})`,
    )
    return true
  } catch (error) {
    logForDebugging(`Failed to register ECC marketplace: ${error}`, {
      level: 'warn',
    })
    return false
  }
}
