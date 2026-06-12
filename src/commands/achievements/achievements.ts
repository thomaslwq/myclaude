import type { LocalCommandCall } from '../../types/command.js'
import { getUnlockedAchievements } from '../../achievements/storage.js'
import {
  ACHIEVEMENTS,
  getAchievementsByCategory,
  CATEGORIES,
} from '../../achievements/types.js'
import type { AchievementId } from '../../achievements/types.js'

export const call: LocalCommandCall = async (args: string) => {
  const sub = args.trim().toLowerCase()

  if (sub === 'list' || sub === 'all') {
    return handleListAll()
  }

  return handleSummary()
}

function handleSummary() {
  const unlocked = getUnlockedAchievements()
  const total = Object.keys(ACHIEVEMENTS).length
  const unlockedCount = unlocked.size
  const pct = Math.round((unlockedCount / total) * 100)

  const lines: string[] = [
    '╔══════════════════════════════╗',
    '║       Achievements           ║',
    `║     ${String(unlockedCount).padStart(2)} / ${total}  (${pct}%)          ║`,
    '╚══════════════════════════════╝',
    '',
  ]

  for (const group of getAchievementsByCategory()) {
    const unlockedInGroup = group.achievements.filter(a => unlocked.has(a.id))
    if (unlockedInGroup.length === 0) continue

    lines.push(`${group.category.icon} ${group.category.label}:`)
    for (const a of unlockedInGroup) {
      lines.push(`  ${a.icon} ${a.name} — ${a.description}`)
    }
    lines.push('')
  }

  if (unlockedCount === 0) {
    lines.push('  No achievements yet! Try using myclaude to unlock some.')
    lines.push('')
  }

  lines.push(`Use /achievements list to see all ${total} achievements.`)

  return { type: 'text', value: lines.join('\n') }
}

function handleListAll() {
  const unlocked = getUnlockedAchievements()
  const total = Object.keys(ACHIEVEMENTS).length
  const unlockedCount = unlocked.size

  const lines: string[] = [
    `All Achievements (${unlockedCount}/${total}):`,
    '',
  ]

  for (const group of getAchievementsByCategory()) {
    lines.push(`${group.category.icon} ${group.category.label}:`)
    for (const a of group.achievements) {
      const done = unlocked.has(a.id)
      lines.push(
        `  ${done ? '✅' : '⬜'} ${a.icon} ${a.name}`,
      )
      lines.push(`     ${a.description}`)
    }
    lines.push('')
  }

  return { type: 'text', value: lines.join('\n') }
}
