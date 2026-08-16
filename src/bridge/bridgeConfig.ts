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

// Lazily-initialised resolver that reads globalThis.MACRO on first use.
// This defers capture until the entry point (dev-entry.ts) has set MACRO,
// avoiding a race condition where bridgeConfig.ts is imported before
// dev-entry.ts executes.  After the first call the values are cached, so
// later mutation of globalThis.MACRO has no effect (security invariant).
//
// If getResolver() is called before MACRO is set, we return a throw-away
// resolver with no overrides (i.e. devEnabled = false).  This resolver is
// NOT cached, so the next call after MACRO is set will create the real
// cached resolver.  This avoids the bug where the first call creates a
// cached resolver with undefined MACRO, incorrectly disabling overrides
// for subsequent callers.
let _resolver: ReturnType<typeof createBridgeOverrideResolver> | undefined
let _macroRef: any = undefined

function getResolver() {
  const currentMacro = (globalThis as any).MACRO
  // If MACRO is not yet set (e.g. before dev-entry.ts runs), return a
  // temporary resolver that has no overrides.  The resolver is NOT cached
  // so the next call will try again.  This avoids capturing a resolver
  // with undefined MACRO that would incorrectly disable overrides.
  if (currentMacro === undefined) {
    return createBridgeOverrideResolver(undefined)
  }
  // MACRO is defined — create or reuse the cached resolver.
  if (!_resolver) {
    _resolver = createBridgeOverrideResolver(currentMacro)
    _macroRef = currentMacro
  }
  return _resolver
}

/**
 * Resets the cached resolver. Used only in tests to clear state between
 * test cases. Not exported for production use.
 * @internal
 */
export function __resetBridgeConfig(): void {
  _resolver = undefined
  _macroRef = undefined
}

/**
 * Ant-only dev override: CLAUDE_BRIDGE_OAUTH_TOKEN, else undefined.
 *
 * The override value is baked into the build-time MACRO so it cannot be
 * changed at runtime by setting environment variables. Only the build
 * script (scripts/build.ts) can set this value via the CLAUDE_BRIDGE_OAUTH_TOKEN
 * environment variable at build time.
 */
export function getBridgeTokenOverride(): string | undefined {
  return getResolver().getBridgeTokenOverride()
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
  return getResolver().getBridgeBaseUrlOverride()
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
