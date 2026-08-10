import type { GlobalConfig } from '../utils/config.js'
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
export async function migrateReplBridgeEnabledToRemoteControlAtStartup(): Promise<void> {
  // Single atomic write: add the new key and remove the old key in one operation.
  // This eliminates the race window between two separate writes.
  await saveGlobalConfig(prev => {
    // `replBridgeEnabled` is a deprecated legacy key that was removed from
    // the GlobalConfig type but may still exist in old config files.
    type LegacyConfig = GlobalConfig & {
      replBridgeEnabled?: unknown
    }
    const legacy = prev as LegacyConfig
    const oldValue = legacy.replBridgeEnabled
    if (oldValue === undefined) return prev
    if (prev.remoteControlAtStartup !== undefined) return prev
    // Use a blacklist of known falsy values instead of a whitelist.
    // Any non-empty string that is not a known falsy value is treated as truthy,
    // to avoid converting unexpected values (e.g., 'active', 'enable') to false.
    const falsyValues = ['false', '0', 'no', 'off', 'disabled', '']
    const newValue =
      typeof oldValue === 'string'
        ? !falsyValues.includes(oldValue.toLowerCase().trim())
        : typeof oldValue === 'boolean'
          ? oldValue
          : !!oldValue
    const { replBridgeEnabled: _unused, ...rest } = legacy
    const next = { ...rest, remoteControlAtStartup: newValue }
    return next
  })
}
