import { getFsImplementation } from '../../utils/fsOperations.js'
import { logForDebugging } from '../../utils/debug.js'
import { join } from 'path'
import { jsonParse, jsonStringify } from '../../utils/slowOperations.js'

/**
 * ECC Marketplace source URL.
 */
const ECC_MARKETPLACE_URL = 'https://github.com/affaan-m/ECC.git'

/**
 * Known marketplaces config file path.
 */
function getKnownMarketplacesFile(): string {
  const homeDir = process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR
    || join(process.env.HOME || process.env.USERPROFILE || '~', '.claude', 'plugins')
  return join(homeDir, 'known_marketplaces.json')
}

/**
 * Ensure the ECC marketplace is registered in known_marketplaces.json.
 * This is a no-op if already present. Runs synchronously during startup.
 */
export async function ensureEccMarketplaceRegistered(): Promise<boolean> {
  const fs = getFsImplementation()
  const configFile = getKnownMarketplacesFile()

  try {
    // Read existing config
    let config: Record<string, unknown> = {}
    try {
      const content = await fs.readFile(configFile, { encoding: 'utf-8' })
      config = jsonParse(content) as Record<string, unknown>
    } catch {
      // File doesn't exist yet — will create with just ECC
    }

    // Skip if ECC is already registered
    if (config['ecc']) return false

    // Add ECC marketplace entry with autoUpdate disabled
    config['ecc'] = {
      source: {
        source: 'git',
        url: ECC_MARKETPLACE_URL,
      },
      autoUpdate: false,
      lastUpdated: new Date().toISOString(),
    }

    // Write back
    await fs.writeFile(configFile, jsonStringify(config, null, 2), {
      encoding: 'utf-8',
    })

    logForDebugging('Registered ECC marketplace in known_marketplaces.json')
    return true
  } catch (error) {
    logForDebugging(`Failed to register ECC marketplace: ${error}`, {
      level: 'warn',
    })
    return false
  }
}
