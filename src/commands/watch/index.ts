import type { Command } from '../../commands.js'

const watch = {
  type: 'local',
  name: 'watch',
  description:
    'Watch file changes and auto-iterate tests/lint/TDD. Subcommands: on, off, status, tdd',
  argumentHint: '[on|off|status|tdd] [--test|--lint|--tdd] [--max <n>]',
  progressMessage: 'managing watch mode',
  supportsNonInteractive: true,
  load: () => import('./watch.js'),
} satisfies Command

export default watch
