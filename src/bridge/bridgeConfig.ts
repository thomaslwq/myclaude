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

// Use globalThis.MACRO injected by build script at compile time.
// This is a build-time constant that cannot be changed at runtime.
// In production builds, DEV_BRIDGE_OVERRIDES_ENABLED is always false.
function isDevBridgeOverridesEnabled(): boolean {
  return (globalThis as any).MACRO?.DEV_BRIDGE_OVERRIDES_ENABLED === true
}

/** Ant-only dev override: CLAUDE_BRIDGE_OAUTH_TOKEN, else undefined. */
export function getBridgeTokenOverride(): string | undefined {
  // Gate dev overrides behind a build-time macro to prevent
  // production builds from being vulnerable to environment variable attacks.
  // The isDevBridgeOverridesEnabled() function checks globalThis.MACRO which
  // is injected at compile time by the build script. In production builds,
  // DEV_BRIDGE_OVERRIDES_ENABLED is always false. This is a compile-time
  // constant, not a runtime check, so it cannot be bypassed by setting
  // NODE_ENV or other environment variables.
  if (!isDevBridgeOverridesEnabled()) {
    return undefined
  }
  return (
    (process.env.NODE_ENV === 'development' &&
      process.env.USER_TYPE === 'ant' &&
      process.env.CLAUDE_BRIDGE_OAUTH_TOKEN) ||
    undefined
  )
}

/** Ant-only dev override: CLAUDE_BRIDGE_BASE_URL, else undefined. */
export function getBridgeBaseUrlOverride(): string | undefined {
  // Gate dev overrides behind a build-time macro to prevent
  // production builds from being vulnerable to environment variable attacks.
  // The isDevBridgeOverridesEnabled() function checks globalThis.MACRO which
  // is injected at compile time by the build script. In production builds,
  // DEV_BRIDGE_OVERRIDES_ENABLED is always false. This is a compile-time
  // constant, not a runtime check, so it cannot be bypassed by setting
  // NODE_ENV or other environment variables.
  if (!isDevBridgeOverridesEnabled()) {
    return undefined
  }
  return (
    (process.env.NODE_ENV === 'development' &&
      process.env.USER_TYPE === 'ant' &&
      process.env.CLAUDE_BRIDGE_BASE_URL) ||
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
