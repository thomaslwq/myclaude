import type { Command } from '../../commands.js'

const voice = {
  type: 'local-jsx',
  name: 'voice',
  description: 'Start voice input mode for hands-free coding',
  aliases: ['v'],
  load: () => import('./voice.js'),
} satisfies Command

export default voice