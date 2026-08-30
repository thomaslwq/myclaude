/**
 * TDD tests for the `mcp discover` CLI subcommand wiring (issue #976).
 *
 * Verifies that registerMcpDiscoverCommand registers a `discover`
 * subcommand on the mcp Commander command, so users can list available
 * MCP servers from the public registry.
 */
import { describe, test, expect } from 'bun:test'
import { Command } from '@commander-js/extra-typings'
import { registerMcpDiscoverCommand } from '../discoverCommand.js'

describe('mcp discover command registration (issue #976)', () => {
  test('registers a discover subcommand on the mcp command', () => {
    const mcp = new Command('mcp')
    registerMcpDiscoverCommand(mcp)
    const names = mcp.commands.map((c) => c.name())
    expect(names).toContain('discover')
  })

  test('discover subcommand exposes a --limit option', () => {
    const mcp = new Command('mcp')
    registerMcpDiscoverCommand(mcp)
    const discover = mcp.commands.find((c) => c.name() === 'discover')
    expect(discover).toBeDefined()
    expect(discover!.options.map((o) => o.long).filter(Boolean)).toContain('--limit')
  })
})
