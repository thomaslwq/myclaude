/**
 * Skill recommendation engine — suggests relevant skills based on usage.
 */
import { getUsageStats } from '../stats/usageStats.js'
import { getUnlockedAchievements } from '../achievements/storage.js'
import { getLevel } from '../buddy/evolution/index.js'

export interface SkillSuggestion {
  command: string
  description: string
  reason: string
  priority: number
}

const ALL_SKILLS: SkillSuggestion[] = [
  { command: '/commit', description: 'Generate git commit messages with AI', reason: 'You use git — let AI write your commit messages', priority: 90 },
  { command: '/review', description: 'Review code changes with AI analysis', reason: 'Improve code quality with automated reviews', priority: 85 },
  { command: '/plan', description: 'Create step-by-step implementation plans', reason: 'Plan before you code — reduce rework', priority: 80 },
  { command: '/test', description: 'Generate and run tests', reason: 'Keep your code reliable with automated tests', priority: 75 },
  { command: '/doc', description: 'Generate documentation from code', reason: 'Good docs make great projects', priority: 70 },
  { command: '/diff', description: 'Review git diff with explanations', reason: 'Understand every change before committing', priority: 65 },
  { command: '/branch', description: 'Manage git branches', reason: 'Organize your work with branching', priority: 60 },
  { command: '/config', description: 'Configure myclaude settings', reason: 'Tailor myclaude to your workflow', priority: 55 },
  { command: '/mcp add', description: 'Add MCP servers for external tools', reason: 'Connect myclaude to databases, APIs, and more', priority: 50 },
  { command: '/plugin', description: 'Install community plugins', reason: 'Extend myclaude with community tools', priority: 45 },
  { command: '/buddy pet', description: 'Pet your companion for XP', reason: 'Earn XP and bond with your buddy!', priority: 40 },
  { command: '/buddy feed', description: 'Feed your companion for XP', reason: 'Your buddy is hungry! +15 XP', priority: 35 },
  { command: '/buddy play', description: 'Play with your companion for XP', reason: 'Playtime! +20 XP for you and your buddy', priority: 30 },
  { command: '/achievements', description: 'View unlocked achievements', reason: 'See what you\'ve accomplished', priority: 25 },
  { command: '/mystats', description: 'View usage dashboard', reason: 'Track your myclaude journey', priority: 20 },
  { command: '/memory', description: 'Manage AI memory', reason: 'Help myclaude remember important context', priority: 15 },
  { command: '/sandbox', description: 'Toggle sandbox mode for safe execution', reason: 'Execute commands in a safe environment', priority: 10 },
  { command: '/theme', description: 'Change terminal theme', reason: 'Make myclaude look the way you like', priority: 5 },
  { command: '/effort', description: 'Adjust AI effort level', reason: 'Control how thorough the AI should be', priority: 3 },
  { command: '/summary', description: 'Summarize current session', reason: 'Quick recap of what you\'ve done', priority: 1 },
]

/**
 * Get personalized skill suggestions based on usage.
 * Returns top N suggestions not yet used.
 */
export function getSuggestions(maxCount = 5): SkillSuggestion[] {
  const stats = getUsageStats()
  const level = getLevel()
  const unlocked = getUnlockedAchievements()
  const usedCommands = new Set([
    ...(stats.languagesUsed),
  ])

  // Score each skill based on usage patterns
  const scored = ALL_SKILLS.map(skill => {
    let score = skill.priority

    // Boost based on experience level
    if (stats.totalSessions > 20) score += 10
    if (stats.totalSessions > 50) score += 10
    if (level > 5) score += 15

    // Boost based on achievements
    if (unlocked.size > 5) score += 10
    if (unlocked.size > 10) score += 10

    return { ...skill, score }
  })

  // Sort by score descending, take top N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map(({ score, ...skill }) => skill)
}
