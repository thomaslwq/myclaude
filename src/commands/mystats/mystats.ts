import type { LocalCommandCall } from '../../types/command.js'
import { getUsageStats } from '../../stats/usageStats.js'
import { getLevel, getXp, getXpForNextLevel, getEvolutionStage, getInteractionCounts } from '../../buddy/evolution/index.js'
import { getCompanion } from '../../buddy/companion.js'
import { getUnlockedAchievements } from '../../achievements/storage.js'
import { ACHIEVEMENTS } from '../../achievements/types.js'
import { getSuggestions } from '../../skills/suggestions.js'
import { getRandomTip } from '../../stats/tips.js'

export const call: LocalCommandCall = async () => {
  const stats = getUsageStats()
  const companion = getCompanion()
  const unlocked = getUnlockedAchievements()

  const daysActive = Math.max(1, Math.floor((Date.now() - stats.firstUsedAt) / 86400000))
  const hoursSince = Math.floor((Date.now() - stats.firstUsedAt) / 3600000)

  const lines: string[] = [
    '╔══════════════════════════════╗',
    '║      myclaude Dashboard      ║',
    '╚══════════════════════════════╝',
    '',
  ]

  // Usage section
  lines.push('📊 Usage:')
  lines.push(`  Active days:     ${daysActive}d (${hoursSince}h since first use)`)
  lines.push(`  Sessions:        ${stats.totalSessions}`)
  lines.push(`  Commands run:    ${stats.totalCommands}`)
  lines.push(`  Chat messages:   ${stats.totalChatMessages}`)
  lines.push(`  Commits:         ${stats.totalCommits}`)
  lines.push(`  Reviews:         ${stats.totalReviews}`)
  lines.push(`  Plugins:         ${stats.totalPluginsInstalled}`)
  lines.push(`  Skills used:     ${stats.totalSkillsUsed}`)
  lines.push(`  Streak:          🔥 ${stats.consecutiveDays} days`)
  if (stats.languagesUsed.length > 0) {
    lines.push(`  Languages:       ${stats.languagesUsed.join(', ')}`)
  }
  lines.push('')

  // Achievements section
  lines.push(`🏆 Achievements: ${unlocked.size}/${Object.keys(ACHIEVEMENTS).length} unlocked`)
  lines.push('')

  // Buddy section
  if (companion) {
    const level = getLevel()
    const xp = getXp()
    const xpNext = getXpForNextLevel()
    const stage = getEvolutionStage()
    const { feed, play } = getInteractionCounts()
    const pct = Math.round((xp / xpNext) * 100)

    lines.push(`🐾 Buddy: ${companion.name} (${companion.species})`)
    lines.push(`  Level:           ${level} (${xp}/${xpNext} XP, ${pct}%)`)
    if (stage > 0) lines.push(`  Evolution:       Stage ${stage} ✨`)
    lines.push(`  Interactions:    ${stats.totalBuddyInteractions} total`)
    lines.push(`  Feed:            ${feed}x  |  Play: ${play}x`)
    lines.push('')
  }

  // Tips
  lines.push('💡 Tips:')
  if (stats.consecutiveDays >= 7) {
    lines.push('  🔥 You\'re on a hot streak! Keep it up!')
  }
  if (companion && getLevel() < 10) {
    lines.push('  🐾 Pet, feed and play with your buddy to earn XP!')
  }
  if (unlocked.size < 5) {
    lines.push('  🏆 Try /achievements to see what you can unlock!')
  }

  // Smart tip
  const tip = getRandomTip()
  if (tip) {
    lines.push('')
    lines.push(`  ${tip}`)
  }

  // Suggestions
  const suggestions = getSuggestions(4)
  if (suggestions.length > 0) {
    lines.push('')
    lines.push('🎯 Suggested for you:')
    for (const s of suggestions) {
      lines.push(`  ${s.command.padEnd(18)} ${s.description}`)
    }
  }

  lines.push('')

  return { type: 'text', value: lines.join('\n') }
}
