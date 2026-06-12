import type { Command } from '../../commands.js'

const buddyCmd = {
  name: 'buddy',
  description: 'Manage your terminal companion — hatch, pet, card, mute, unmute',
  argumentHint: '<hatch|pet|card|mute|unmute>',
  supportsNonInteractive: false,
  type: 'local' as const,
  load: () => import('./buddy.js'),
} satisfies Command

export default buddyCmd
