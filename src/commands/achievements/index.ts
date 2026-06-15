import type { Command } from '../../commands.js'

const achievementsCmd = {
  name: 'achievements',
  description: 'View your unlocked achievements and progress',
  aliases: ['achieve', 'ach'],
  supportsNonInteractive: false,
  type: 'local' as const,
  load: () => import('./achievements.js'),
} satisfies Command

export default achievementsCmd
