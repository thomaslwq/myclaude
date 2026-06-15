import type { Command } from '../../commands.js'

const mystatsCmd = {
  name: 'mystats',
  description: 'View your coding statistics and usage dashboard',
  aliases: ['stats', 'dashboard'],
  supportsNonInteractive: false,
  type: 'local' as const,
  load: () => import('./mystats.js'),
} satisfies Command

export default mystatsCmd
