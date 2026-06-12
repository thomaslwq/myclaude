/**
 * Smart tips — contextual suggestions shown to the user.
 * Tips are shown at most once, triggered by events.
 */
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'
import { getLevel } from '../buddy/evolution/index.js'
import { getCompanion } from '../buddy/companion.js'
import { getUnlockedAchievements } from '../achievements/storage.js'
import { ACHIEVEMENTS } from '../achievements/types.js'
import { getUsageStats } from '../stats/usageStats.js'

export type TipId =
  | 'welcome_buddy'
  | 'try_achievements'
  | 'try_mystats'
  | 'buddy_feed'
  | 'buddy_play'
  | 'buddy_evolution'
  | 'streak_reminder'
  | 'plugin_tip'
  | 'skill_tip'
  | 'mcp_tip'

export interface Tip {
  id: TipId
  message: string
  condition: () => boolean
  priority: number // higher = shown first
}

const TIPS: Tip[] = [
  {
    id: 'welcome_buddy',
    message: '🐾 Tip: You have a companion! Try /buddy pet, /buddy feed, or /buddy play to earn XP.',
    condition: () => !!getCompanion(),
    priority: 100,
  },
  {
    id: 'try_achievements',
    message: '🏆 Tip: Check your achievements with /achievements to see what you can unlock!',
    condition: () => getUnlockedAchievements().size < 3,
    priority: 90,
  },
  {
    id: 'try_mystats',
    message: '📊 Tip: View your usage dashboard with /mystats to track your progress.',
    condition: () => getUsageStats().totalSessions >= 3,
    priority: 80,
  },
  {
    id: 'buddy_feed',
    message: '🍽️ Tip: Your buddy looks hungry! Try /buddy feed for +15 XP.',
    condition: () => {
      const c = getCompanion()
      return !!c && getLevel() < 5
    },
    priority: 70,
  },
  {
    id: 'buddy_play',
    message: '🎾 Tip: Your buddy wants to play! Try /buddy play for +20 XP.',
    condition: () => {
      const c = getCompanion()
      return !!c && getLevel() >= 3 && getLevel() < 10
    },
    priority: 60,
  },
  {
    id: 'buddy_evolution',
    message: '✨ Tip: Keep leveling up your buddy! It may evolve at higher levels.',
    condition: () => {
      const c = getCompanion()
      return !!c && getLevel() >= 8 && getLevel() < 12
    },
    priority: 50,
  },
  {
    id: 'streak_reminder',
    message: '🔥 Tip: You\'re on a streak! Come back tomorrow to keep it going.',
    condition: () => {
      const s = getUsageStats()
      return s.consecutiveDays >= 3 && s.consecutiveDays < 7
    },
    priority: 40,
  },
  {
    id: 'plugin_tip',
    message: '🔌 Tip: Extend myclaude with plugins! Try /plugin search to find new tools.',
    condition: () => getUsageStats().totalPluginsInstalled === 0 && getUsageStats().totalSessions >= 5,
    priority: 30,
  },
  {
    id: 'skill_tip',
    message: '🎯 Tip: Use /skills to see available skill commands that can automate tasks.',
    condition: () => getUsageStats().totalSkillsUsed === 0 && getUsageStats().totalSessions >= 3,
    priority: 20,
  },
  {
    id: 'mcp_tip',
    message: '🔗 Tip: Add MCP servers with /mcp add to integrate external tools and APIs.',
    condition: () => getUsageStats().totalSessions >= 10 && getUsageStats().totalPluginsInstalled > 0,
    priority: 10,
  },
]

export function getRandomTip(): string | null {
  const config = getGlobalConfig()
  const shown = new Set(config.shownTips ?? [])

  const available = TIPS
    .filter(t => !shown.has(t.id) && t.condition())
    .sort((a, b) => b.priority - a.priority)

  if (available.length === 0) return null

  const tip = available[0]

  // Mark as shown
  saveGlobalConfig(cfg => ({
    ...cfg,
    shownTips: [...(cfg.shownTips ?? []), tip.id],
  }))

  return tip.message
}
