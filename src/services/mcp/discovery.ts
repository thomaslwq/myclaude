/**
 * MCP Extension Marketplace Discovery (issue #976).
 *
 * Provides a discovery mechanism that lists available MCP servers from a
 * public registry, so users don't have to hand-write mcp config JSON.
 *
 * Pure, testable core:
 *   - extractDiscoverableServers(payload) — parse a registry response into
 *     {name, url} entries (normalize, dedup, skip malformed).
 *   - formatDiscoverableServers(servers)  — render a human-readable list.
 *
 * The async fetch wrapper reuses the same public MCP registry endpoint
 * already used by officialRegistry.ts.
 */
import axios from 'axios'
import { errorMessage } from '../../utils/errors.js'

export type DiscoverableMcpServer = {
  /** Stable display name derived from the URL (e.g. "linear"). */
  name: string
  /** Normalized server URL (no query string, no trailing slash). */
  url: string
}

type RegistryPayload = {
  servers?: Array<{
    server?: {
      remotes?: Array<{ url?: string }>
    }
  }>
}

/** Public MCP registry endpoint (same source as officialRegistry.ts). */
export const MCP_REGISTRY_URL =
  'https://api.anthropic.com/mcp-registry/v0/servers?version=latest&visibility=commercial'

export function normalizeRegistryUrl(url: string): string | undefined {
  try {
    const u = new URL(url)
    u.search = ''
    return u.toString().replace(/\/$/, '')
  } catch {
    return undefined
  }
}

/** Derive a stable display name from a normalized server URL. */
export function nameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').filter(Boolean).pop()
    return (last || u.hostname.split('.')[0]).toLowerCase()
  } catch {
    return url
  }
}

/**
 * Parse a registry response into a deduplicated list of discoverable
 * MCP servers. Malformed entries and unparseable URLs are skipped.
 */
export function extractDiscoverableServers(payload: unknown): DiscoverableMcpServer[] {
  if (!payload || typeof payload !== 'object') return []
  const { servers } = payload as RegistryPayload
  if (!Array.isArray(servers)) return []

  const seen = new Set<string>()
  const out: DiscoverableMcpServer[] = []
  for (const entry of servers) {
    const remotes = entry?.server?.remotes
    if (!Array.isArray(remotes)) continue
    for (const remote of remotes) {
      const raw = remote?.url
      if (typeof raw !== 'string') continue
      const normalized = normalizeRegistryUrl(raw)
      if (!normalized) continue
      if (seen.has(normalized)) continue
      seen.add(normalized)
      out.push({ name: nameFromUrl(normalized), url: normalized })
    }
  }
  return out
}

/**
 * Render a human-readable numbered list for the `/mcp discover` output.
 */
export function formatDiscoverableServers(servers: DiscoverableMcpServer[]): string {
  if (servers.length === 0) {
    return 'No MCP servers found in the registry.'
  }
  const lines = servers.map((s, i) => `${i + 1}. ${s.name} — ${s.url}`)
  return lines.join('\n')
}

/**
 * Fetch and parse the public MCP registry. Returns [] on any failure so
 * callers can degrade gracefully (issue #976 requires non-blocking UX).
 */
export async function fetchDiscoverableServers(timeoutMs = 5000): Promise<DiscoverableMcpServer[]> {
  try {
    const response = await axios.get<RegistryPayload>(MCP_REGISTRY_URL, { timeout: timeoutMs })
    return extractDiscoverableServers(response.data)
  } catch (error) {
    console.error(`[mcp-discover] Failed to fetch MCP registry: ${errorMessage(error)}`)
    return []
  }
}
