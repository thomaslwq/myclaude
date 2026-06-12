/**
 * Usage statistics tracking for /mystats dashboard.
 */
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'

export type UsageStats = {
  firstUsedAt: number
  totalSessions: number
  totalCommands: number
  totalCommits: number
  totalReviews: number
  totalChatMessages: number
  totalPluginsInstalled: number
  totalSkillsUsed: number
  totalBuddyInteractions: number
  lastActiveDate: string // YYYY-MM-DD
  consecutiveDays: number
  languagesUsed: string[]
}

const DEFAULT_STATS: UsageStats = {
  firstUsedAt: Date.now(),
  totalSessions: 0,
  totalCommands: 0,
  totalCommits: 0,
  totalReviews: 0,
  totalChatMessages: 0,
  totalPluginsInstalled: 0,
  totalSkillsUsed: 0,
  totalBuddyInteractions: 0,
  lastActiveDate: new Date().toISOString().slice(0, 10),
  consecutiveDays: 1,
  languagesUsed: [],
}

export function getUsageStats(): UsageStats {
  return getGlobalConfig().usageStats ?? DEFAULT_STATS
}

function saveStats(update: Partial<UsageStats>): UsageStats {
  const current = getUsageStats()
  const next = { ...current, ...update }
  saveGlobalConfig(cfg => ({ ...cfg, usageStats: next }))
  return next
}

/** Track daily login and streak */
export function trackDailyLogin(): void {
  const stats = getUsageStats()
  const today = new Date().toISOString().slice(0, 10)
  if (stats.lastActiveDate === today) return

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const streak = stats.lastActiveDate === yesterday
    ? stats.consecutiveDays + 1
    : 1

  saveStats({
    lastActiveDate: today,
    consecutiveDays: streak,
    totalSessions: stats.totalSessions + 1,
  })
}

export function trackCommand(): void {
  const stats = getUsageStats()
  saveStats({ totalCommands: stats.totalCommands + 1 })
}

export function trackCommit(): void {
  const stats = getUsageStats()
  saveStats({ totalCommits: stats.totalCommits + 1 })
}

export function trackReview(): void {
  const stats = getUsageStats()
  saveStats({ totalReviews: stats.totalReviews + 1 })
}

export function trackChatMessage(): void {
  const stats = getUsageStats()
  saveStats({ totalChatMessages: stats.totalChatMessages + 1 })
}

export function trackPluginInstall(): void {
  const stats = getUsageStats()
  saveStats({ totalPluginsInstalled: stats.totalPluginsInstalled + 1 })
}

export function trackSkillUse(): void {
  const stats = getUsageStats()
  saveStats({ totalSkillsUsed: stats.totalSkillsUsed + 1 })
}

export function trackBuddyInteraction(): void {
  const stats = getUsageStats()
  saveStats({ totalBuddyInteractions: stats.totalBuddyInteractions + 1 })
}

export function trackLanguage(lang: string): void {
  const stats = getUsageStats()
  if (!stats.languagesUsed.includes(lang)) {
    saveStats({ languagesUsed: [...stats.languagesUsed, lang] })
  }
}
