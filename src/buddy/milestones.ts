/**
 * BUDDY memory system — remembers important milestones and user events.
 * Milestones are stored in config and shown in the buddy card.
 */
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'

export type MilestoneType =
  | 'first_hatch'
  | 'first_commit'
  | 'first_review'
  | 'first_plugin'
  | 'first_skill'
  | 'level_5'
  | 'level_10'
  | 'level_25'
  | 'level_50'
  | 'streak_7'
  | 'streak_30'
  | 'achievement_5'
  | 'achievement_10'
  | 'achievement_20'
  | 'commits_10'
  | 'commits_100'
  | 'pet_50'
  | 'pet_100'

export interface Milestone {
  type: MilestoneType
  label: string
  icon: string
  achievedAt: number
}

const MILESTONE_DEFS: Record<MilestoneType, { label: string; icon: string }> = {
  first_hatch: { label: 'First companion hatched', icon: '🥚' },
  first_commit: { label: 'First AI commit', icon: '📝' },
  first_review: { label: 'First code review', icon: '🔍' },
  first_plugin: { label: 'First plugin installed', icon: '🔌' },
  first_skill: { label: 'First skill used', icon: '🎯' },
  level_5: { label: 'Buddy reached level 5', icon: '⭐' },
  level_10: { label: 'Buddy reached level 10', icon: '🌟' },
  level_25: { label: 'Buddy reached level 25', icon: '💫' },
  level_50: { label: 'Buddy reached max level 50', icon: '👑' },
  streak_7: { label: '7-day streak achieved', icon: '🔥' },
  streak_30: { label: '30-day streak achieved', icon: '🔥' },
  achievement_5: { label: '5 achievements unlocked', icon: '🏆' },
  achievement_10: { label: '10 achievements unlocked', icon: '🏆' },
  achievement_20: { label: 'All achievements unlocked', icon: '🏆' },
  commits_10: { label: '10 commits generated', icon: '📝' },
  commits_100: { label: '100 commits generated', icon: '🚀' },
  pet_50: { label: '50 times pet your buddy', icon: '🖐️' },
  pet_100: { label: '100 times pet your buddy', icon: '💖' },
}

export function getMilestones(): Milestone[] {
  return getGlobalConfig().buddyMilestones ?? []
}

export function addMilestone(type: MilestoneType): boolean {
  const milestones = getMilestones()
  if (milestones.some(m => m.type === type)) return false

  const def = MILESTONE_DEFS[type]
  const milestone: Milestone = { type, ...def, achievedAt: Date.now() }

  saveGlobalConfig(cfg => ({
    ...cfg,
    buddyMilestones: [...milestones, milestone].sort((a, b) => a.achievedAt - b.achievedAt),
  }))

  return true
}

/**
 * Get milestone history as readable text.
 */
export function formatMilestones(): string {
  const milestones = getMilestones()
  if (milestones.length === 0) return 'No milestones yet.'

  return milestones
    .map(m => {
      const date = new Date(m.achievedAt)
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      return `  ${m.icon} ${m.label} (${dateStr})`
    })
    .join('\n')
}
