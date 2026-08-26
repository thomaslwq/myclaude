import type { Command } from '../../commands.js'

const devServer = {
  type: 'local',
  name: 'dev-server',
  description: 'Start or check the project dev server for browser automation',
  argumentHint: '[port | stop | status]',
  progressMessage: 'checking dev server',
  load: () => import('./dev-server.js'),
} satisfies Command

export default devServer
