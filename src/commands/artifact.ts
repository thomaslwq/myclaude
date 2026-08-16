import { tmpdir } from 'os'
import { join } from 'path'
import { writeFileSync } from 'fs'
import type { Command } from '../commands.js'
import type { LocalCommandCall } from '../types/command.js'
import { openBrowser } from '../utils/browser.js'

const call: LocalCommandCall = async (args, _context) => {
  const html = args.trim()
  if (!html) {
    return { type: 'text', value: 'Artifact preview: pass HTML to render' }
  }
  const file = join(tmpdir(), 'myclaude-artifact-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.html')
  writeFileSync(file, html, 'utf-8')
  const opened = await openBrowser('file://' + file)
  return {
    type: 'text',
    value: opened ? 'Artifact preview opened in browser (' + file + ')' : 'Artifact written to ' + file,
  }
}

const artifact = {
  type: 'local',
  name: 'artifact',
  description: 'Render HTML and preview it in the default browser',
  argumentHint: '<html>',
  isEnabled: () => true,
  supportsNonInteractive: false,
  load: () => Promise.resolve({ call }),
} satisfies Command

export default artifact
