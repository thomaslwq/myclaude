/**
 * TDD tests for issue #976: MCP Extension Marketplace Discovery.
 *
 * The issue asks for a discovery mechanism that lists available MCP
 * servers from a public registry so users don't have to hand-write
 * mcp config JSON. We implement the testable core as pure functions:
 *
 *   - extractDiscoverableServers(payload)  — parse a registry response
 *     into {name, url} entries (dedup, normalize, skip malformed).
 *   - formatDiscoverableServers(servers)   — render a human-readable list
 *     for the `/mcp discover` command output.
 *
 * The thin async fetch wrapper (fetchDiscoverableServers) reuses the
 * existing public MCP registry endpoint already used by officialRegistry.ts.
 */
import { describe, test, expect } from 'bun:test'
import {
  extractDiscoverableServers,
  formatDiscoverableServers,
  type DiscoverableMcpServer,
} from '../discovery.js'

describe('extractDiscoverableServers (issue #976)', () => {
  test('extracts server URLs from a valid registry payload', () => {
    const payload = {
      servers: [
        {
          server: {
            remotes: [{ url: 'https://example.com/mcp/sentry' }, { url: 'https://example.com/mcp/sentry/' }],
          },
        },
        {
          server: {
            remotes: [{ url: 'https://mcp.example.net/github' }],
          },
        },
      ],
    }
    const servers = extractDiscoverableServers(payload)
    expect(servers.length).toBe(2)
    // trailing slash and query strings are normalized away → dedup works
    expect(servers[0].url).toBe('https://example.com/mcp/sentry')
    expect(servers[1].url).toBe('https://mcp.example.net/github')
  })

  test('deduplicates identical servers across entries', () => {
    const payload = {
      servers: [
        { server: { remotes: [{ url: 'https://x.io/mcp?a=1' }, { url: 'https://x.io/mcp' }] } },
        { server: { remotes: [{ url: 'https://x.io/mcp/' }] } },
      ],
    }
    const servers = extractDiscoverableServers(payload)
    expect(servers.length).toBe(1)
    expect(servers[0].url).toBe('https://x.io/mcp')
  })

  test('skips malformed entries and empty payloads gracefully', () => {
    expect(extractDiscoverableServers({})).toEqual([])
    expect(extractDiscoverableServers({ servers: [] })).toEqual([])
    expect(
      extractDiscoverableServers({
        servers: [
          { server: { remotes: [] } },
          { server: {} },
          { server: { remotes: [{ url: 'not-a-url' }] } },
          'garbage',
        ],
      }),
    ).toEqual([])
  })

  test('derives a stable display name from the URL when none is given', () => {
    const servers = extractDiscoverableServers({
      servers: [{ server: { remotes: [{ url: 'https://registry.example/servers/linear' }] } }],
    })
    expect(servers[0].name).toBe('linear')
  })
})

describe('formatDiscoverableServers (issue #976)', () => {
  test('renders a numbered list with name and url', () => {
    const servers: DiscoverableMcpServer[] = [
      { name: 'sentry', url: 'https://example.com/mcp/sentry' },
      { name: 'github', url: 'https://mcp.example.net/github' },
    ]
    const out = formatDiscoverableServers(servers)
    expect(out).toContain('1. sentry')
    expect(out).toContain('https://example.com/mcp/sentry')
    expect(out).toContain('2. github')
  })

  test('returns an empty hint for no servers', () => {
    expect(formatDiscoverableServers([])).toContain('No MCP servers')
  })
})
