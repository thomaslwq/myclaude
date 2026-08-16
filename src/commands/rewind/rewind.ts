import type { LocalCommandResult } from '../../commands.js'
import type { ToolUseContext } from '../../Tool.js'
import { execFileNoThrow } from '../../utils/execFileNoThrow.js'
import { getCwd } from '../../utils/cwd.js'
import { gitExe, getIsGit } from '../../utils/git.js'

/**
 * Checkpoint/Undo system for AI-generated changes (issue #223).
 *
 * Lightweight git-stash-based checkpoints:
 *   /checkpoint <description>   — save the current workspace state
 *   /checkpoint list            — list saved checkpoints
 *   /checkpoint restore <n>     — restore checkpoint #n (non-destructive:
 *                                 leaves the stash entry intact)
 *
 * Uses `git stash push`/`list`/`apply` so checkpoints live in the existing
 * git object store. `apply` (not `pop`) is used for restore so an unwanted
 * restore can be retried. Only enabled inside a git repository.
 */
export async function call(
  args: string,
  _context: ToolUseContext,
): Promise<LocalCommandResult> {
  const isGit = await getIsGit()
  if (!isGit) {
    return {
      type: 'text',
      value:
        'Checkpoint requires a git repository. Run `git init` first, or use this command inside a git worktree.',
    }
  }

  const trimmed = args.trim()
  if (trimmed === '' || trimmed === 'list') {
    return listCheckpoints()
  }

  if (trimmed === 'restore' || trimmed === 'undo') {
    return {
      type: 'text',
      value:
        'Usage: /checkpoint restore <n> — restore checkpoint #n (see /checkpoint list).',
    }
  }

  const restoreMatch = trimmed.match(/^(?:restore|undo)\s+(\d+)$/)
  if (restoreMatch) {
    return restoreCheckpoint(Number(restoreMatch[1]))
  }

  return createCheckpoint(trimmed)
}

async function getCheckpointListRaw(): Promise<string> {
  const { stdout } = await execFileNoThrow(
    gitExe(),
    ['--no-optional-locks', 'stash', 'list'],
    { preserveOutputOnError: false },
  )
  return stdout
}

async function createCheckpoint(description: string): Promise<LocalCommandResult> {
  const cwd = getCwd()
  const label = `myclaude-checkpoint: ${description}`

  const { stderr } = await execFileNoThrow(
    gitExe(),
    ['--no-optional-locks', 'stash', 'push', '-m', label],
    { cwd, preserveOutputOnError: true },
  )

  const status = await getCheckpointListRaw()
  if (status === '') {
    return {
      type: 'text',
      value: 'No changes to checkpoint — the workspace is already clean.',
    }
  }

  return {
    type: 'text',
    value: `Checkpoint created: ${label}\n${stderr.trim() || ''}\n\nUse /checkpoint list to see all checkpoints.`.trim(),
  }
}

async function listCheckpoints(): Promise<LocalCommandResult> {
  const stdout = await getCheckpointListRaw()
  if (stdout.trim() === '') {
    return {
      type: 'text',
      value:
        'No checkpoints yet.\n\nUsage:\n  /checkpoint <description>  — save current workspace state\n  /checkpoint list           — list checkpoints\n  /checkpoint restore <n>    — restore checkpoint #n',
    }
  }

  const lines = stdout.trim().split('\n')
  const annotated = lines
    .map((line, index) => {
      const marker = line.includes('myclaude-checkpoint')
        ? '  ← /checkpoint'
        : ''
      return `  ${index}: ${line.trim()}${marker}`
    })
    .join('\n')

  return {
    type: 'text',
    value: `Saved checkpoints:\n${annotated}\n\nRestore with: /checkpoint restore <n>`,
  }
}

async function restoreCheckpoint(index: number): Promise<LocalCommandResult> {
  const listRaw = await getCheckpointListRaw()
  const lines = listRaw.trim().split('\n').filter(Boolean)
  if (lines.length === 0) {
    return { type: 'text', value: 'No checkpoints to restore.' }
  }
  if (index < 0 || index >= lines.length) {
    return {
      type: 'text',
      value: `Invalid checkpoint index ${index}. Run /checkpoint list to see valid indices (0–${lines.length - 1}).`,
    }
  }

  const cwd = getCwd()
  const { stdout, stderr } = await execFileNoThrow(
    gitExe(),
    ['--no-optional-locks', 'stash', 'apply', `stash@{${index}}`],
    { cwd, preserveOutputOnError: true },
  )

  const detail = `${stdout.trim()}${stderr.trim() ? `\n${stderr.trim()}` : ''}`
  return {
    type: 'text',
    value: `Restored checkpoint #${index}:\n  ${lines[index]!.trim()}\n${detail ? `\n${detail}` : ''}\n\nUse /checkpoint list to review; the stash entry is kept so you can re-apply if needed.`.trim(),
  }
}

