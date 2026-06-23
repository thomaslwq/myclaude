import { logForDebugging } from '../../utils/debug.js'
import {
  addMarketplaceSource,
  getMarketplacesCacheDir,
} from '../../utils/plugins/marketplaceManager.js'
import { installPlugin } from '../../services/plugins/pluginCliCommands.js'
import { join } from 'path'
import { readFile } from 'fs/promises'

/**
 * ECC Marketplace git URL.
 */
const ECC_MARKETPLACE_URL = 'https://github.com/affaan-m/ECC.git'

/**
 * Ensure the ECC marketplace is registered and its plugins auto-installed.
 * Uses the official addMarketplaceSource() API which handles cloning,
 * validation, and config persistence.
 *
 * First run: clones ECC repo, then installs all ECC plugins automatically.
 * Subsequent runs: no-ops (marketplace + plugins already present).
 *
 * Runs fire-and-forget during startup — never blocks the CLI.
 */
export async function ensureEccMarketplaceRegistered(): Promise<boolean> {
  try {
    // Step 1: Cache the ECC marketplace (clone if first time)
    const result = await addMarketplaceSource({
      source: 'git',
      url: ECC_MARKETPLACE_URL,
    })

    const eccName = result.name
    logForDebugging(
      `ECC marketplace registered as '${eccName}' (materialized: ${!result.alreadyMaterialized})`,
    )

    // Step 2: Auto-install all ECC plugins
    // Skip if marketplace was already cached (plugins already installed from prior run)
    await installEccPlugins(eccName)

    return true
  } catch (error) {
    logForDebugging(`Failed to register ECC marketplace: ${error}`, {
      level: 'warn',
    })
    return false
  }
}

/**
 * Auto-install all plugins from the ECC marketplace.
 * Each plugin becomes immediately usable without manual /plugin install.
 */
async function installEccPlugins(marketplaceName: string): Promise<void> {
  try {
    // Read the marketplace.json from the cached ECC repo
    const cacheDir = getMarketplacesCacheDir()
    const marketplaceDir = join(cacheDir, marketplaceName)
    const marketplaceJsonPath = join(
      marketplaceDir,
      '.claude-plugin',
      'marketplace.json',
    )

    let marketplaceData: { plugins?: Array<{ name: string }> }
    try {
      const content = await readFile(marketplaceJsonPath, 'utf-8')
      marketplaceData = JSON.parse(content)
    } catch {
      // marketplace.json not found yet — clone may still be in progress
      logForDebugging(
        'ECC marketplace.json not found yet, skipping auto-install',
      )
      return
    }

    const plugins = marketplaceData?.plugins ?? []
    if (plugins.length === 0) {
      logForDebugging('No plugins found in ECC marketplace')
      return
    }

    // Install each plugin from the ECC marketplace
    let installed = 0
    for (const plugin of plugins) {
      try {
        const pluginId = `${plugin.name}@${marketplaceName}`
        await installPlugin(pluginId, 'user')
        installed++
      } catch (pluginError) {
        // Individual plugin install failures are non-fatal
        logForDebugging(
          `Failed to auto-install ECC plugin '${plugin.name}': ${pluginError}`,
          { level: 'warn' },
        )
      }
    }

    logForDebugging(
      `Auto-installed ${installed}/${plugins.length} ECC plugins`,
    )
  } catch (error) {
    logForDebugging(`Failed to auto-install ECC plugins: ${error}`, {
      level: 'warn',
    })
  }
}
