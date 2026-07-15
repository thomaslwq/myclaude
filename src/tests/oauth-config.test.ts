/**
 * Tests for OAuth configuration — Issue #64 (OAuth client ID override via env var without validation)
 * and Issue #80 (getOauthConfig() / getGrowthBookClientKey() executed repeatedly without caching).
 *
 * TDD Red phase: these tests should fail before the fix, pass after.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

// ── Mock environment ────────────────────────────────────────────────

const originalEnv = { ...process.env }

beforeEach(() => {
  // Clear relevant env vars before each test
  delete process.env.CLAUDE_CODE_OAUTH_CLIENT_ID
  delete process.env.USER_TYPE
  delete process.env.USE_LOCAL_OAUTH
  delete process.env.USE_STAGING_OAUTH
  delete process.env.CLAUDE_CODE_CUSTOM_OAUTH_URL
})

afterEach(() => {
  // Restore original env
  process.env = { ...originalEnv }
})

describe('getOauthConfig', () => {
  test('returns production config with valid CLIENT_ID when no env override', async () => {
    const mod = await import('../constants/oauth.js')
    mod._resetOauthConfigCache()
    const config = mod.getOauthConfig()
    expect(config.CLIENT_ID).toBe('9d1c250a-e61b-44d9-88ed-5944d1962f5e')
  })

  test('accepts valid UUID format for CLAUDE_CODE_OAUTH_CLIENT_ID', async () => {
    process.env.CLAUDE_CODE_OAUTH_CLIENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const mod = await import('../constants/oauth.js')
    mod._resetOauthConfigCache()
    const config = mod.getOauthConfig()
    expect(config.CLIENT_ID).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  })

  test('rejects invalid CLAUDE_CODE_OAUTH_CLIENT_ID (not a UUID)', async () => {
    process.env.CLAUDE_CODE_OAUTH_CLIENT_ID = 'not-a-uuid-at-all'
    const mod = await import('../constants/oauth.js')
    mod._resetOauthConfigCache()
    expect(() => mod.getOauthConfig()).toThrow()
  })

  test('rejects invalid CLAUDE_CODE_OAUTH_CLIENT_ID (empty string)', async () => {
    process.env.CLAUDE_CODE_OAUTH_CLIENT_ID = ''
    const mod = await import('../constants/oauth.js')
    mod._resetOauthConfigCache()
    const config = mod.getOauthConfig()
    // Empty string should be treated as no override, so default prod ID is used
    expect(config.CLIENT_ID).toBe('9d1c250a-e61b-44d9-88ed-5944d1962f5e')
  })

  test('rejects invalid CLAUDE_CODE_OAUTH_CLIENT_ID (partial UUID)', async () => {
    process.env.CLAUDE_CODE_OAUTH_CLIENT_ID = 'not-a-uuid'
    const mod = await import('../constants/oauth.js')
    mod._resetOauthConfigCache()
    expect(() => mod.getOauthConfig()).toThrow()
  })

  test('rejects invalid CLAUDE_CODE_OAUTH_CLIENT_ID (malformed UUID with wrong dashes)', async () => {
    process.env.CLAUDE_CODE_OAUTH_CLIENT_ID = 'a1b2c3d4e5f67890abcdef1234567890'
    const mod = await import('../constants/oauth.js')
    mod._resetOauthConfigCache()
    expect(() => mod.getOauthConfig()).toThrow()
  })

  test('accepts valid UUID v4 format for CLAUDE_CODE_OAUTH_CLIENT_ID', async () => {
    process.env.CLAUDE_CODE_OAUTH_CLIENT_ID = '550e8400-e29b-41d4-a716-446655440000'
    const mod = await import('../constants/oauth.js')
    mod._resetOauthConfigCache()
    const config = mod.getOauthConfig()
    expect(config.CLIENT_ID).toBe('550e8400-e29b-41d4-a716-446655440000')
  })
})

describe('getOauthConfig caching', () => {
  test('returns the same cached object on subsequent calls (no repeated computation)', async () => {
    const mod = await import('../constants/oauth.js')
    mod._resetOauthConfigCache()
    const first = mod.getOauthConfig()
    const second = mod.getOauthConfig()
    // Same object reference — cached, not recreated
    expect(second).toBe(first)
  })

  test('cached config survives env changes after initial call', async () => {
    const mod = await import('../constants/oauth.js')
    mod._resetOauthConfigCache()
    // First call under default (prod) env
    const first = mod.getOauthConfig()
    // Set staging env after first call
    process.env.USER_TYPE = 'ant'
    process.env.USE_STAGING_OAUTH = 'true'
    // Second call should return the same cached object as first
    const second = mod.getOauthConfig()
    expect(second).toBe(first)
    // Cleanup env
    delete process.env.USER_TYPE
    delete process.env.USE_STAGING_OAUTH
  })
})

describe('getGrowthBookClientKey caching', () => {
  test('returns the same string on subsequent calls (memoized)', async () => {
    const { getGrowthBookClientKey } = await import('../constants/keys.js')
    const first = getGrowthBookClientKey()
    const second = getGrowthBookClientKey()
    expect(second).toBe(first)
  })

  test('returns a consistent non-empty value', async () => {
    const { getGrowthBookClientKey } = await import('../constants/keys.js')
    const key = getGrowthBookClientKey()
    expect(key).toBeTruthy()
    expect(typeof key).toBe('string')
  })
})
