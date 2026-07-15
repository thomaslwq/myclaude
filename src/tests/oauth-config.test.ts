/**
 * Tests for OAuth configuration — Issue #64 (OAuth client ID override via env var without validation).
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
    const { getOauthConfig } = await import('../constants/oauth.js')
    const config = getOauthConfig()
    expect(config.CLIENT_ID).toBe('9d1c250a-e61b-44d9-88ed-5944d1962f5e')
  })

  test('accepts valid UUID format for CLAUDE_CODE_OAUTH_CLIENT_ID', async () => {
    process.env.CLAUDE_CODE_OAUTH_CLIENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const { getOauthConfig } = await import('../constants/oauth.js')
    const config = getOauthConfig()
    expect(config.CLIENT_ID).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  })

  test('rejects invalid CLAUDE_CODE_OAUTH_CLIENT_ID (not a UUID)', async () => {
    process.env.CLAUDE_CODE_OAUTH_CLIENT_ID = 'not-a-uuid-at-all'
    const { getOauthConfig } = await import('../constants/oauth.js')
    expect(() => getOauthConfig()).toThrow()
  })

  test('rejects invalid CLAUDE_CODE_OAUTH_CLIENT_ID (empty string)', async () => {
    process.env.CLAUDE_CODE_OAUTH_CLIENT_ID = ''
    const { getOauthConfig } = await import('../constants/oauth.js')
    const config = getOauthConfig()
    // Empty string should be treated as no override, so default prod ID is used
    expect(config.CLIENT_ID).toBe('9d1c250a-e61b-44d9-88ed-5944d1962f5e')
  })

  test('rejects invalid CLAUDE_CODE_OAUTH_CLIENT_ID (partial UUID)', async () => {
    process.env.CLAUDE_CODE_OAUTH_CLIENT_ID = 'not-a-uuid'
    const { getOauthConfig } = await import('../constants/oauth.js')
    expect(() => getOauthConfig()).toThrow()
  })

  test('rejects invalid CLAUDE_CODE_OAUTH_CLIENT_ID (malformed UUID with wrong dashes)', async () => {
    process.env.CLAUDE_CODE_OAUTH_CLIENT_ID = 'a1b2c3d4e5f67890abcdef1234567890'
    const { getOauthConfig } = await import('../constants/oauth.js')
    expect(() => getOauthConfig()).toThrow()
  })

  test('accepts valid UUID v4 format for CLAUDE_CODE_OAUTH_CLIENT_ID', async () => {
    process.env.CLAUDE_CODE_OAUTH_CLIENT_ID = '550e8400-e29b-41d4-a716-446655440000'
    const { getOauthConfig } = await import('../constants/oauth.js')
    const config = getOauthConfig()
    expect(config.CLIENT_ID).toBe('550e8400-e29b-41d4-a716-446655440000')
  })
})
