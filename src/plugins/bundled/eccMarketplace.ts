import { logForDebugging } from '../../utils/debug.js'
import { getFsImplementation } from '../../utils/fsOperations.js'
import { join } from 'path'
import { jsonParse, jsonStringify } from '../../utils/slowOperations.js'
import { logError } from '../../utils/log.js'
import { installPlugin } from '../../services/plugins/pluginCliCommands.js'
import { readFile } from 'fs/promises'

/**
 * ECC Marketplace source URL.
 */
const ECC_MARKETPLACE_URL = 'https://github.com/affaan-m/ECC.git'

/**
 * Get the known_marketplaces.json file path.
 */
function getKnownMarketplacesFile(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '~'
  return join(home, '.claude', 'plugins', 'known_marketplaces.json')
}

/**
 * Get the path to the built-in seed marketplace content.
 * Relative path accounts for dev (src/plugins/bundled/) and
 * production (dist/) directory layouts.
 */
function getEccSeedPath(): string {
  return join(__dirname, '..', '..', '..', '..', 'seed', 'marketplaces', 'ecc')
}

/**
 * Register ECC as a known marketplace by writing directly to
 * known_marketplaces.json, then auto-install the ECC plugin
 * so its skills, agents, and commands are immediately available.
 */
export async function ensureEccMarketplaceRegistered(): Promise<boolean> {
  try {
    const fs = getFsImplementation()
    const configFile = getKnownMarketplacesFile()
    const installLocation = getEccSeedPath()

    // Read existing config
    let config: Record<string, unknown> = {}
    try {
      const content = await fs.readFile(configFile, { encoding: 'utf-8' })
      config = jsonParse(content) as Record<string, unknown>
    } catch {
      // File doesn't exist yet
    }

    // Check if ECC is already registered with correct location
    const existing = config['ecc'] as Record<string, unknown> | undefined
    const alreadyRegistered =
      existing && existing['installLocation'] === installLocation

    if (!alreadyRegistered) {
      // Add or update ECC entry
      config['ecc'] = {
        source: {
          source: 'git',
          url: ECC_MARKETPLACE_URL,
        },
        installLocation,
        autoUpdate: false,
        lastUpdated: new Date().toISOString(),
      }

      // Write back
      const dir = join(configFile, '..')
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(configFile, jsonStringify(config, null, 2), {
        encoding: 'utf-8',
      })
      logForDebugging(
        `ECC marketplace registered with installLocation: ${installLocation}`,
      )
    } else {
      logForDebugging('ECC marketplace already registered at correct path')
    }

    // Auto-install the ECC plugin so its skills/agents are available
    await installEccPlugin()

    return true
  } catch (error) {
    logError(error)
    logForDebugging(`Failed to register ECC marketplace: ${error}`, {
      level: 'warn',
    })
    return false
  }
}

/**
 * Auto-install the ECC plugin so its skills, agents, MCPs, and
 * commands are immediately available without manual /plugin install.
 */
async function installEccPlugin(): Promise<void> {
  try {
    // Check if already installed
    const home = process.env.HOME || process.env.USERPROFILE || '~'
    const installedFile = join(
      home,
      '.claude',
      'plugins',
      'installed_plugins_v2.json',
    )

    let installed = false
    try {
      const content = await readFile(installedFile, 'utf-8')
      const parsed = JSON.parse(content)
      installed = !!parsed['ecc@ecc']
    } catch {
      // File doesn't exist yet
    }

    if (installed) {
      logForDebugging('ECC plugin already installed, skipping auto-install')
      return
    }

    // Install the plugin
    await installPlugin('ecc@ecc', 'user')
    logForDebugging('ECC plugin auto-installed successfully')
  } catch (error) {
    // Plugin install might fail on first run if marketplace content
    // isn't ready yet — that's OK, user can run /plugin install ecc@ecc
    logForDebugging(`ECC plugin auto-install: ${error}`)
  }
}
