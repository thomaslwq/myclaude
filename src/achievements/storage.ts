/**
 * Achievement storage — persisted in GlobalConfig.
 */
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'
import type { AchievementId } from './types.js'

/**
 * Get the set of unlocked achievement IDs.
 */
export function getUnlockedAchievements(): Set<AchievementId> {
  const config = getGlobalConfig()
  return new Set(config.unlockedAchievements ?? [])
}

/**
 * Check if a specific achievement has been unlocked.
 */
export function hasAchievement(id: AchievementId): boolean {
  return getUnlockedAchievements().has(id)
}

/**
 * Unlock an achievement. No-op if already unlocked.
 * Returns true if newly unlocked.
 */
export function unlockAchievement(id: AchievementId): boolean {
  const unlocked = getUnlockedAchievements()
  if (unlocked.has(id)) return false
  unlocked.add(id)
  saveGlobalConfig(current => ({
    ...current,
    unlockedAchievements: [...unlocked],
  }))
  return true
}

/**
 * Record an event counter in config.
 * Used for achievements that need X occurrences (e.g., pet 10 times).
 */
export function incrementCounter(key: string): number {
  const config = getGlobalConfig()
  const counters = config.achievementCounters ?? {}
  const current = (counters[key] ?? 0) + 1
  saveGlobalConfig(cfg => ({
    ...cfg,
    achievementCounters: { ...counters, [key]: current },
  }))
  return current
}

export function getCounter(key: string): number {
  return (getGlobalConfig().achievementCounters ?? {})[key] ?? 0
}
