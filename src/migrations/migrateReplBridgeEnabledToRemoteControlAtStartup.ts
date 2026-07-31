import { saveGlobalConfig } from '../utils/config.js'

/**
 * Migrate the `replBridgeEnabled` config key to `remoteControlAtStartup`.
 *
 * The old key was an implementation detail that leaked into user-facing config.
 * This migration copies the value to the new key and removes the old one.
 * Idempotent — only acts when the old key exists and the new one doesn't.
 *
 * Uses a two-phase write to ensure crash safety:
 * 1. First write: add the new key (remoteControlAtStartup) while keeping the old key.
 * 2. Second write: remove the old key (replBridgeEnabled).
 *
 * This prevents data loss if the application crashes mid-write — at any point,
 * at least one of the keys (old or new) is present in the config.
 */
export function migrateReplBridgeEnabledToRemoteControlAtStartup(): void {
  // Phase 1: Add the new key while keeping the old key.
  // This ensures we never lose the config value, even if we crash here.
  saveGlobalConfig(prev => {
    const oldValue = (prev as Record<string, unknown>)['replBridgeEnabled']
    if (oldValue === undefined) return prev
    if (prev.remoteControlAtStartup !== undefined) return prev
    // Use explicit string check to avoid Boolean('false') === true bug
    const newValue =
      typeof oldValue === 'string' ? oldValue === 'true' : Boolean(oldValue)
    return { ...prev, remoteControlAtStartup: newValue }
  })

  // Phase 2: Remove the old key.
  // If we crash during this write, the new key is already set and the old key
  // still exists — the migration will be idempotent on next startup.
  saveGlobalConfig(prev => {
    const oldValue = (prev as Record<string, unknown>)['replBridgeEnabled']
    if (oldValue === undefined) return prev
    // If remoteControlAtStartup is somehow not set yet (shouldn't happen after
    // phase 1, but be safe), migrate it first before removing the old key.
    if (prev.remoteControlAtStartup === undefined) {
      const newValue =
        typeof oldValue === 'string' ? oldValue === 'true' : Boolean(oldValue)
      return {
        ...prev,
        remoteControlAtStartup: newValue,
        replBridgeEnabled: undefined as unknown as undefined,
      }
    }
    const next = { ...prev }
    delete next.replBridgeEnabled
    return next
  })
}
