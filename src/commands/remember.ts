import { appendFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'
import { getOriginalCwd } from '../bootstrap/state.js'
import type { Command } from '../commands.js'
import type { LocalCommandCall, LocalCommandResult } from '../types/command.js'

/** Format a remember entry with timestamp. */
function formatEntry(content: string): string {
  const now = new Date()
  const ts = now.toISOString().replace('T', ' ').slice(0, 19)
  return `\n<!-- remembered at ${ts} -->\n${content.trim()}\n`
}

const call: LocalCommandCall = async (args): Promise<LocalCommandResult> => {
  const text = args.trim()
  if (!text) {
    return {
      type: 'text',
      value: `Usage: /remember <what to remember>

Saves important information to your memory file (~/.claude/CLAUDE.md) so it's available in future sessions.

Examples:
  /remember The project uses pnpm, not npm
  /remember The CI pipeline runs on GitHub Actions with Node 20
  /remember My local dev server runs on port 5173`,
    }
  }

  try {
    const homeDir = getClaudeConfigHomeDir()
    await mkdir(homeDir, { recursive: true })

    const memFile = join(homeDir, 'CLAUDE.md')
    const entry = formatEntry(text)
    await appendFile(memFile, entry, 'utf-8')

    return {
      type: 'text',
      value: `✅ Remembered! Saved to ~/.claude/CLAUDE.md

This information will be available in all future sessions.

Use /memory to view or edit all saved memories.`,
    }
  } catch (err) {
    return { type: 'text', value: `Error saving memory: ${err}` }
  }
}

const remember: Command = {
  type: 'local',
  name: 'remember',
  description: 'Save important information to memory for reuse in future sessions',
  argumentHint: '<what to remember>',
  supportsNonInteractive: true,
  load: async () => ({ call }),
}

export default remember
