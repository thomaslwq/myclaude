/**
 * Achievement checker — evaluates conditions and unlocks achievements.
 * Called from various places in the app (commands, hooks, etc.).
 */
import {
  unlockAchievement,
  hasAchievement,
  incrementCounter,
  getCounter,
} from './storage.js'
import { ACHIEVEMENTS } from './types.js'
import type { AchievementId } from './types.js'
import { getCompanion } from '../buddy/companion.js'

const NOTIFIED_KEY = 'achievement_notified'

/**
 * Get a list of achievements that were unlocked but not yet notified.
 * Caller should display them and then clear.
 */
export function getPendingAchievements(): AchievementId[] {
  try {
    const raw = JSON.parse(
      typeof process !== 'undefined'
        ? (process.env.__ACHIEVEMENT_PENDING__ || '[]')
        : '[]',
    )
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function clearPendingAchievements(): void {
  if (typeof process !== 'undefined') {
    process.env.__ACHIEVEMENT_PENDING__ = '[]'
  }
}

function notify(id: AchievementId): void {
  if (typeof process !== 'undefined') {
    try {
      const pending = JSON.parse(process.env.__ACHIEVEMENT_PENDING__ || '[]')
      pending.push(id)
      process.env.__ACHIEVEMENT_PENDING__ = JSON.stringify(pending)
    } catch {
      process.env.__ACHIEVEMENT_PENDING__ = JSON.stringify([id])
    }
  }
}

// ── Event handlers ────────────────────────────────────────────────

/** Called when a companion is hatched. */
export function checkOnBuddyHatch(): void {
  tryUnlock('buddy_hatched')

  const companion = getCompanion()
  if (companion?.rarity === 'legendary') {
    tryUnlock('buddy_legendary')
  }
  if (companion?.shiny) {
    tryUnlock('buddy_shiny')
  }
}

/** Called when the user pets their companion. */
export function checkOnBuddyPet(): void {
  const count = incrementCounter('buddy_pet')
  tryUnlock('buddy_pet_10', count >= 10)
  tryUnlock('buddy_pet_100', count >= 100)
}

/** Called when a commit message is generated. */
export function checkOnCommit(): void {
  tryUnlock('first_commit')
  const count = incrementCounter('commits')
  tryUnlock('commits_10', count >= 10)
  tryUnlock('commits_100', count >= 100)
}

/** Called when a code review is done. */
export function checkOnReview(): void {
  tryUnlock('first_review')
}

/** Called when a plugin is installed. */
export function checkOnPluginInstall(): void {
  tryUnlock('first_plugin')
}

/** Called when a skill is used. */
export function checkOnSkillUse(): void {
  tryUnlock('first_skill')
}

/** Called when an MCP server is added. */
export function checkOnMcpAdd(): void {
  tryUnlock('mcp_added')
}

/** Called when model is switched. */
export function checkOnModelSwitch(): void {
  tryUnlock('model_switched')
}

/** Called when config is changed. */
export function checkOnConfigChange(): void {
  tryUnlock('config_changed')
}

/** Called daily to check streak. */
export function checkOnDailyUse(): void {
  const config =
    typeof process !== 'undefined'
      ? { lastSeenDate: process.env.__ACHIEVEMENT_LAST_SEEN__ }
      : { lastSeenDate: undefined }
  const today = new Date().toISOString().slice(0, 10)
  const lastSeen = config.lastSeenDate

  if (typeof process !== 'undefined') {
    process.env.__ACHIEVEMENT_LAST_SEEN__ = today
  }

  if (lastSeen !== today) {
    const streak = incrementCounter('daily_streak')
    tryUnlock('streak_3', streak >= 3)
    tryUnlock('streak_7', streak >= 7)
    tryUnlock('streak_30', streak >= 30)
  }
}

// ── Internal ──────────────────────────────────────────────────────

function tryUnlock(id: AchievementId, condition = true): void {
  if (!condition) return
  if (hasAchievement(id)) return
  if (unlockAchievement(id)) {
    const achievement = ACHIEVEMENTS[id]
    // Log to console (visible in TUI)
    console.error(
      `\n  🏆 ${achievement.icon} Achievement Unlocked: ${achievement.name}`,
    )
    console.error(`     ${achievement.description}\n`)
    notify(id)
  }
}
