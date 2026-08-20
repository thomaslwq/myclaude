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

// Capture globalThis.MACRO at module load time to prevent security bypasses
// via runtime modification (e.g., via prototype pollution or malicious dependency).
// This ensures that even if a compromised dependency sets globalThis.MACRO
// before this module is fully initialized, the values are already captured.
// The resolver is cached in a module-level variable; subsequent mutations to
// globalThis.MACRO have no effect on the cached resolver.
let _resolver = createBridgeOverrideResolver((globalThis as any).MACRO)

/**
 * Returns the cached resolver with values captured at module load time.
 * Subsequent mutations to globalThis.MACRO have no effect.
 */
export function getResolver() {
  return _resolver
}

/**
 * Resets the cached resolver by re-reading the current globalThis.MACRO.
 * Used only in tests to clear state between test cases.
 * @internal
 */
export function resetResolver(): void {
  _resolver = createBridgeOverrideResolver((globalThis as any).MACRO)
}

/**
 * Get the bridge token override from the cached resolver.
 */
export function getBridgeTokenOverride(): string | undefined {
  return getResolver().getBridgeTokenOverride()
}

/**
 * Get the bridge base URL override from the cached resolver.
 */
export function getBridgeBaseUrlOverride(): string | undefined {
  return getResolver().getBridgeBaseUrlOverride()
}

/**
 * Get the bridge access token from the real OAuth store.
 */
export function getBridgeAccessToken(): string | undefined {
  return getClaudeAIOAuthTokens()?.accessToken
}

/**
 * Get the bridge base URL from the real OAuth store.
 */
export function getBridgeBaseUrl(): string | undefined {
  return getOauthConfig().bridgeUrl
}
