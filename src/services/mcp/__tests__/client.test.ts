/**
 * Tests for issue #997: memoization complexity in getServerCacheKey.
 *
 * getServerCacheKey is the resolver for the memoized connectToServer.
 * lodash memoize invokes the resolver on every call (even cache hits),
 * so the resolver must be cheap. We cache the serialized key per
 * (serverRef identity, name) so repeated calls with the same serverRef
 * object skip jsonStringify entirely.
 */
import { describe, test, expect } from 'bun:test'
import { getServerCacheKey } from '../client.js'
import type { ScopedMcpServerConfig } from '../types.js'

function makeConfig(
  overrides: Partial<ScopedMcpServerConfig> = {},
): ScopedMcpServerConfig {
  return {
    type: 'stdio',
    command: 'node',
    args: ['server.js'],
    scope: 'user',
    ...overrides,
  } as ScopedMcpServerConfig
}

describe('getServerCacheKey (issue #997)', () => {
  test('returns a stable key for the same name + serverRef object', () => {
    const ref = makeConfig()
    const a = getServerCacheKey('slack', ref)
    const b = getServerCacheKey('slack', ref)
    expect(a).toBe(b)
  })

  test('returns different keys for different names with the same serverRef', () => {
    const ref = makeConfig()
    const a = getServerCacheKey('slack', ref)
    const b = getServerCacheKey('github', ref)
    expect(a).not.toBe(b)
  })

  test('returns the same key for two distinct serverRef objects with identical content', () => {
    // Two separate objects with the same content serialize to the same key.
    // This is the correct behavior: the cache key is content-based, not
    // identity-based, so a fresh config object with the same values maps to
    // the same cached connection.
    const a = getServerCacheKey('slack', makeConfig())
    const b = getServerCacheKey('slack', makeConfig())
    expect(a).toBe(b)
  })

  test('returns different keys when serverRef content differs', () => {
    const a = getServerCacheKey(
      'slack',
      makeConfig({ command: 'node', args: ['a.js'] }),
    )
    const b = getServerCacheKey(
      'slack',
      makeConfig({ command: 'node', args: ['b.js'] }),
    )
    expect(a).not.toBe(b)
  })

  test('key format is "<name>-<json>"', () => {
    const ref = makeConfig()
    const key = getServerCacheKey('slack', ref)
    expect(key.startsWith('slack-')).toBe(true)
  })

  test('skips jsonStringify on repeat calls (identity cache hit)', () => {
    // Spy on jsonStringify by monkey-patching the module export is not
    // straightforward; instead we verify the cache is hit by checking
    // that mutating the serverRef after the first call does not change
    // the returned key. This documents the identity-based semantics:
    // the key is bound to the object reference, not its current contents.
    const ref = makeConfig({ command: 'node', args: ['a.js'] })
    const first = getServerCacheKey('slack', ref)
    // Mutate the same object reference.
    ;(ref as { args: string[] }).args.push('extra.js')
    const second = getServerCacheKey('slack', ref)
    expect(second).toBe(first)
  })
})
