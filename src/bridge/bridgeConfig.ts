/**
 * Shared bridge auth/URL resolution. Consolidates the ant-only
 * CLAUDE_BRIDGE_* dev overrides that were previously copy-pasted across
 * a dozen files — inboundAttachments, BriefTool/upload, bridgeMain,
 * initReplBridge, remoteBridgeCore, daemon workers, /rename,
 * /remote-control.
 *
 * Two layers: *Override() returns the ant-only env var (or undefined);
 * the non-Override versions fall through to the real OAuth store/config.
 * Callers that compose with a different auth source (e.g. daemon workers
 * using IPC auth) use the Override getters directly.
 */

import { getOauthConfig } from '../constants/oauth.js'
import { getClaudeAIOAuthTokens } from '../utils/auth.js'

// Use globalThis.feature injected by build script, or fallback to false
// Dynamic lookup so tests can override globalThis.feature after module load
function feature(name: string): boolean {
  const fn = (globalThis as any).feature
  return typeof fn === 'function' ? fn(name) : false
}

/** Ant-only dev override: CLAUDE_BRIDGE_OAUTH_TOKEN, else undefined. */
export function getBridgeTokenOverride(): string | undefined {
  // Gate dev overrides behind a build-time feature flag to prevent
  // production builds from being vulnerable to environment variable attacks.
  // Also add a runtime check: never allow overrides in production mode
  // even if the feature flag is misconfigured.
  if (!feature('DEV_BRIDGE_OVERRIDES') || process.env.NODE_ENV === 'production') {
    return undefined
  }
  return (
    (process.env.USER_TYPE === 'ant' &&
      process.env.CLAUDE_BRIDGE_OAUTH_TOKEN) ||
    undefined
  )
}

/** Ant-only dev override: CLAUDE_BRIDGE_BASE_URL, else undefined. */
export function getBridgeBaseUrlOverride(): string | undefined {
  // Gate dev overrides behind a build-time feature flag to prevent
  // production builds from being vulnerable to environment variable attacks.
  // Also add a runtime check: never allow overrides in production mode
  // even if the feature flag is misconfigured.
  if (!feature('DEV_BRIDGE_OVERRIDES') || process.env.NODE_ENV === 'production') {
    return undefined
  }
  return (
    (process.env.USER_TYPE === 'ant' && process.env.CLAUDE_BRIDGE_BASE_URL) ||
    undefined
  )
}

/**
 * Access token for bridge API calls: dev override first, then the OAuth
 * keychain. Undefined means "not logged in".
 */
export function getBridgeAccessToken(): string | undefined {
  return getBridgeTokenOverride() ?? getClaudeAIOAuthTokens()?.accessToken
}

/**
 * Base URL for bridge API calls: dev override first, then the production
 * OAuth config. Always returns a URL.
 */
export function getBridgeBaseUrl(): string {
  return getBridgeBaseUrlOverride() ?? getOauthConfig().BASE_API_URL
}
