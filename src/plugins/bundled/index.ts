/**
 * Built-in Plugin Initialization
 *
 * Initializes built-in plugins that ship with the CLI and appear in the
 * /plugin UI for users to enable/disable.
 *
 * Not all bundled features should be built-in plugins — use this for
 * features that users should be able to explicitly enable/disable. For
 * features with complex setup or automatic-enabling logic (e.g.
 * claude-in-chrome), use src/skills/bundled/ instead.
 *
 * To add a new built-in plugin:
 * 1. Import registerBuiltinPlugin from '../builtinPlugins.js'
 * 2. Call registerBuiltinPlugin() with the plugin definition here
 */

import { registerBuiltinPlugin } from '../builtinPlugins.js'
import { isCodeGraphInstalled } from './codegraphCheck.js'
import { initEccBuiltin } from './eccBuiltin.js'

/**
 * Initialize built-in plugins. Called during CLI startup.
 */
export function initBuiltinPlugins(): void {
  // CodeGraph — semantic code intelligence MCP server
  // Only shown in /plugin UI when the `codegraph` CLI is installed.
  // Users can enable/disable via /plugin UI (default: disabled).
  registerBuiltinPlugin({
    name: 'codegraph',
    description: 'Semantic code intelligence — surgical context, fewer tool calls',
    version: '1.0.0',
    defaultEnabled: false,
    isAvailable: () => {
      // The async check is kicked off eagerly at module load time in
      // codegraphCheck.ts. By the time the user opens the /plugin UI,
      // the check has likely completed. If it hasn't, we show the plugin
      // anyway (it will just fail to start when used if codegraph isn't
      // installed).
      void isCodeGraphInstalled().catch(() => {})
      return true
    },
    mcpServers: {
      'codegraph': {
        command: 'codegraph',
        args: ['mcp'],
      },
    },
  })
}

/**
 * Initialize ECC built-in content during startup.
 * Registers all 76 commands and 246 skills directly as bundled skills,
 * bypassing the marketplace/plugin installation pipeline entirely.
 */
export async function initSeedMarketplaces(): Promise<void> {
  await initEccBuiltin()
}
