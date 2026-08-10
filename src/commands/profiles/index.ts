import type { Command } from '../../commands.js'

const profiles: Command = {
  type: 'local',
  name: 'profiles',
  description: 'Show active custom instruction profiles',
  argumentHint: '',
  supportsNonInteractive: true,
  load: () => import('./profiles.js'),
}

export default profiles
