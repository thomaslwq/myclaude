/**
 * Achievement definitions for myclaude.
 *
 * Each achievement has:
 * - id: unique key stored in config
 * - name: user-facing title
 * - description: how to unlock
 * - icon: emoji icon
 * - check: function that returns true when unlocked
 */

export type AchievementId =
  | 'first_hatch'
  | 'first_commit'
  | 'first_review'
  | 'first_plugin'
  | 'first_skill'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'commits_10'
  | 'commits_100'
  | 'chat_100'
  | 'chat_1000'
  | 'buddy_pet_10'
  | 'buddy_pet_100'
  | 'buddy_hatched'
  | 'buddy_legendary'
  | 'buddy_shiny'
  | 'mcp_added'
  | 'model_switched'
  | 'config_changed'

export interface Achievement {
  id: AchievementId
  name: string
  description: string
  icon: string
  category: 'onboarding' | 'usage' | 'buddy' | 'streak' | 'power'
}

export const ACHIEVEMENTS: Record<AchievementId, Achievement> = {
  // ── Onboarding ──
  first_hatch: {
    id: 'first_hatch',
    name: 'New Friend',
    description: 'Hatch your first companion',
    icon: '🥚',
    category: 'onboarding',
  },
  first_commit: {
    id: 'first_commit',
    name: 'First Commit',
    description: 'Generate your first git commit message',
    icon: '📝',
    category: 'onboarding',
  },
  first_review: {
    id: 'first_review',
    name: 'Code Reviewer',
    description: 'Run your first code review',
    icon: '🔍',
    category: 'onboarding',
  },
  first_plugin: {
    id: 'first_plugin',
    name: 'Extensible',
    description: 'Install your first plugin',
    icon: '🔌',
    category: 'onboarding',
  },
  first_skill: {
    id: 'first_skill',
    name: 'Skillful',
    description: 'Use your first skill command',
    icon: '🎯',
    category: 'onboarding',
  },

  // ── Streak ──
  streak_3: {
    id: 'streak_3',
    name: 'Getting Started',
    description: 'Use myclaude for 3 consecutive days',
    icon: '🔥',
    category: 'streak',
  },
  streak_7: {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Use myclaude for 7 consecutive days',
    icon: '🔥',
    category: 'streak',
  },
  streak_30: {
    id: 'streak_30',
    name: 'Dedicated',
    description: 'Use myclaude for 30 consecutive days',
    icon: '🔥',
    category: 'streak',
  },

  // ── Usage ──
  commits_10: {
    id: 'commits_10',
    name: 'Regular Committer',
    description: 'Generate 10 commit messages',
    icon: '📝',
    category: 'usage',
  },
  commits_100: {
    id: 'commits_100',
    name: 'Commit Machine',
    description: 'Generate 100 commit messages',
    icon: '🚀',
    category: 'usage',
  },
  chat_100: {
    id: 'chat_100',
    name: 'Conversationalist',
    description: 'Send 100 messages in chat',
    icon: '💬',
    category: 'usage',
  },
  chat_1000: {
    id: 'chat_1000',
    name: 'Power User',
    description: 'Send 1000 messages in chat',
    icon: '💬',
    category: 'usage',
  },
  model_switched: {
    id: 'model_switched',
    name: 'Model Hopper',
    description: 'Switch AI model at least once',
    icon: '🔄',
    category: 'usage',
  },
  config_changed: {
    id: 'config_changed',
    name: 'Tinkerer',
    description: 'Change a configuration setting',
    icon: '⚙️',
    category: 'usage',
  },

  // ── Buddy ──
  buddy_hatched: {
    id: 'buddy_hatched',
    name: 'Buddy Up',
    description: 'Hatch a companion',
    icon: '🐣',
    category: 'buddy',
  },
  buddy_pet_10: {
    id: 'buddy_pet_10',
    name: 'Pet Lover',
    description: 'Pet your companion 10 times',
    icon: '🖐️',
    category: 'buddy',
  },
  buddy_pet_100: {
    id: 'buddy_pet_100',
    name: 'Best Friend',
    description: 'Pet your companion 100 times',
    icon: '💖',
    category: 'buddy',
  },
  buddy_legendary: {
    id: 'buddy_legendary',
    name: 'Legendary Bond',
    description: 'Hatch a legendary companion (1% chance)',
    icon: '⭐',
    category: 'buddy',
  },
  buddy_shiny: {
    id: 'buddy_shiny',
    name: 'Shiny Hunter',
    description: 'Hatch a shiny companion (1% chance)',
    icon: '✨',
    category: 'buddy',
  },

  // ── Power ──
  mcp_added: {
    id: 'mcp_added',
    name: 'Plugin Architect',
    description: 'Add an MCP server',
    icon: '🔗',
    category: 'power',
  },
}

/**
 * Category display order and labels.
 */
export const CATEGORIES: Array<{
  key: Achievement['category']
  label: string
  icon: string
}> = [
  { key: 'onboarding', label: 'Getting Started', icon: '🌟' },
  { key: 'usage', label: 'Usage', icon: '📊' },
  { key: 'streak', label: 'Streaks', icon: '🔥' },
  { key: 'buddy', label: 'Buddy', icon: '🐾' },
  { key: 'power', label: 'Power', icon: '⚡' },
]

/** Achievements grouped by category (in display order). */
export function getAchievementsByCategory(): Array<{
  category: (typeof CATEGORIES)[number]
  achievements: Achievement[]
}> {
  return CATEGORIES.map(cat => ({
    category: cat,
    achievements: Object.values(ACHIEVEMENTS).filter(a => a.category === cat.key),
  }))
}
