/**
 * Session ID tag translation helpers for the CCR v2 compat layer.
 *
 * Lives in its own file (rather than workSecret.ts) so that sessionHandle.ts
 * and replBridgeTransport.ts (bridge.mjs entry points) can import from
 * workSecret.ts without pulling in these retag functions.
 *
 * The isCseShimEnabled kill switch is injected via setCseShimGate() to avoid
 * a static import of bridgeEnabled.ts → growthbook.ts → config.ts — all
 * banned from the sdk.mjs bundle (scripts/build-agent-sdk.sh). Callers that
 * already import bridgeEnabled.ts register the gate; the SDK path never does,
 * so the shim defaults to active (matching isCseShimEnabled()'s own default).
 */

let _isCseShimEnabled: (() => boolean) | undefined
let _gateLocked = false

/**
 * Register the GrowthBook gate for the cse_ shim. Called from bridge
 * init code that already imports bridgeEnabled.ts.
 *
 * Locked after the first registration: a second call (e.g. from a different
 * init path) is ignored so the translation behavior cannot change
 * mid-execution after the first toCompatSessionId call (issue #705).
 *
 * Uses a mutex-like lock to prevent race conditions where concurrent
 * calls could both pass the undefined check and register different gates.
 */
export function setCseShimGate(gate: () => boolean): void {
  if (!_gateLocked) {
    _isCseShimEnabled = gate
    _gateLocked = true
  }
}

/** Test-only: clear the gate so a fresh test can register its own. */
export function resetCseShimGateForTesting(): void {
  _isCseShimEnabled = undefined
  _gateLocked = false
}

/**
 * Re-tag a `cse_*` session ID to `session_*` for use with the v1 compat API.
 *
 * Worker endpoints (/v1/code/sessions/{id}/worker/*) want `cse_*`; that's
 * what the work poll delivers. Client-facing compat endpoints
 * (/v1/sessions/{id}, /v1/sessions/{id}/archive, /v1/sessions/{id}/events)
 * want `session_*` — compat/convert.go:27 validates TagSession. Same UUID,
 * different costume. No-op for IDs that aren't `cse_*`.
 *
 * bridgeMain holds one sessionId variable for both worker registration and
 * session-management calls. It arrives as `cse_*` from the work poll under
 * the compat gate, so archiveSession/fetchSessionTitle need this re-tag.
 */
export function toCompatSessionId(id: string): string {
  if (!id.startsWith('cse_')) return id
  if (_isCseShimEnabled !== undefined && !_isCseShimEnabled()) return id
  return 'session_' + id.slice('cse_'.length)
}

/**
 * Re-tag a `session_*` session ID to `cse_*` for infrastructure-layer calls.
 *
 * Inverse of toCompatSessionId. POST /v1/environments/{id}/bridge/reconnect
 * lives below the compat layer: once ccr_v2_compat_enabled is on server-side,
 * it looks sessions up by their infra tag (`cse_*`). createBridgeSession still
 * returns `session_*` (compat/convert.go:41) and that's what bridge-pointer
 * stores — so perpetual reconnect passes the wrong costume and gets "Session
 * not found" back. Same UUID, wrong tag. No-op for IDs that aren't `session_*`.
 */
export function toInfraSessionId(id: string): string {
  if (!id.startsWith('session_')) return id
  if (_isCseShimEnabled && !_isCseShimEnabled()) return id
  return 'cse_' + id.slice('session_'.length)
}
