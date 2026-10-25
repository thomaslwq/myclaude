import type { Command } from '../../commands.js'

const act = {
  type: 'local-jsx',
  name: 'act',
  description: 'Switch to act mode (exit plan mode and allow file edits)',
  argumentHint: '[<description>]',
  load: () => import('./act.js'),
} satisfies Command

export default act
