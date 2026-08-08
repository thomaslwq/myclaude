import { saveGlobalConfig } from '../utils/config.js'

/**
 * Migrate the `replBridgeEnabled` config key to `remoteControlAtStartup`.
 *
 * The old key was an implementation detail that leaked into user-facing config.
 * This migration copies the value to the new key and removes the old one.
 * Idempotent — only acts when the old key exists and the new one doesn't.
 *
 * Uses a single atomic write to prevent data loss under concurrent access.
 * The write is protected by a file lock inside saveGlobalConfig, so even if
 * multiple processes try to migrate simultaneously, only one write will
 * succeed at a time. If the application crashes during the write, the file
 * may be truncated but the backup mechanism in saveConfigWithLock prevents
 * data loss. On next startup, the migration will be idempotent.
 */
export function migrateReplBridgeEnabledToRemoteControlAtStartup(): void {
  // Single atomic write: add the new key and remove the old key in one operation.
  // This eliminates the race window between two separate writes.
  saveGlobalConfig(prev => {
    const oldValue = (prev as Record<string, unknown>)['replBridgeEnabled']
    if (oldValue === undefined) return prev
    if (prev.remoteControlAtStartup !== undefined) return prev
    // Use explicit whitelist to avoid treating unknown values as true.
    // Only specific strings are considered truthy: 'true', '1', 'yes', 'enabled'.
    const truthyValues = ['true', '1', 'yes', 'enabled', 'on']
    const newValue =
      typeof oldValue === 'string'
        ? truthyValues.includes(oldValue.toLowerCase().trim())
        : Boolean(oldValue)
    const { replBridgeEnabled: _unused, ...rest } = prev
    const next = { ...rest, remoteControlAtStartup: newValue }
    return next
  })
}
