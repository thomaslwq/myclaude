/**
 * MCP discover CLI subcommand (issue #976).
 *
 * Lists available MCP servers from the public registry so users can
 * discover servers without hand-writing mcp config JSON.
 *
 * Mirrors the addCommand.ts structure (extracted for direct testing).
 */
import { type Command } from '@commander-js/extra-typings'
import { cliError, cliOk } from '../../cli/exit.js'
import { fetchDiscoverableServers, formatDiscoverableServers } from '../../services/mcp/discovery.js'

/**
 * Registers the `mcp discover` subcommand on the given Commander command.
 */
export function registerMcpDiscoverCommand(mcp: Command): void {
  mcp
    .command('discover')
    .description(
      'List available MCP servers from the public registry.\n\n' +
        'Examples:\n' +
        '  claude mcp discover\n' +
        '  claude mcp discover --limit 20',
    )
    .option('-l, --limit <n>', 'Maximum number of servers to show', '20')
    .action(async (options) => {
      const limit = parseInt(options.limit, 10) || 20
      try {
        const servers = await fetchDiscoverableServers()
        const shown = servers.slice(0, limit)
        const body = formatDiscoverableServers(shown)
        const extra =
          servers.length > shown.length
            ? `\n(${servers.length - shown.length} more available; use --limit to show more)`
            : ''
        cliOk(`${body}${extra}`)
      } catch (error) {
        cliError(`Failed to discover MCP servers: ${error instanceof Error ? error.message : String(error)}`)
      }
    })
}
