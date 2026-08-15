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
// The MACRO values are captured at module load time into a private resolver
// to prevent security bypasses via runtime modification of globalThis.MACRO
// (e.g., via prototype pollution or malicious dependency).

/**
 * Creates a bridge override resolver from a MACRO object.
 * All values are captured eagerly at creation time, so later mutation
 * of the source object cannot affect the resolver.
 */
export function createBridgeOverrideResolver(macro: any) {
  const devEnabled = macro?.DEV_BRIDGE_OVERRIDES_ENABLED === true
  const token = macro?.BRIDGE_OVERRIDE_TOKEN || ''
  const baseUrl = macro?.BRIDGE_OVERRIDE_BASE_URL || ''

  return {
    getBridgeTokenOverride(): string | undefined {
      if (!devEnabled) {
        return undefined
      }
      return token || undefined
    },
    getBridgeBaseUrlOverride(): string | undefined {
      if (!devEnabled) {
        return undefined
      }
      return baseUrl || undefined
    },
  }
}

// Capture MACRO values at module load time — cannot be modified at runtime.
// Any later mutation of globalThis.MACRO (e.g. by malicious code) has no
// effect on the resolver used by the exported getters below.
const _resolver = createBridgeOverrideResolver((globalThis as any).MACRO)

/**
 * Ant-only dev override: CLAUDE_BRIDGE_OAUTH_TOKEN, else undefined.
 *
 * The override value is baked into the build-time MACRO so it cannot be
 * changed at runtime by setting environment variables. Only the build
 * script (scripts/build.ts) can set this value via the CLAUDE_BRIDGE_OAUTH_TOKEN
 * environment variable at build time.
 */
export function getBridgeTokenOverride(): string | undefined {
  return _resolver.getBridgeTokenOverride()
}

/**
 * Ant-only dev override: CLAUDE_BRIDGE_BASE_URL, else undefined.
 *
 * The override value is baked into the build-time MACRO so it cannot be
 * changed at runtime by setting environment variables. Only the build
 * script (scripts/build.ts) can set this value via the CLAUDE_BRIDGE_BASE_URL
 * environment variable at build time.
 */
export function getBridgeBaseUrlOverride(): string | undefined {
  return _resolver.getBridgeBaseUrlOverride()
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
