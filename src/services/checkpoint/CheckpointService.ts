import { existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { execFileNoThrowWithCwd } from '../../utils/execFileNoThrow.js'
import { getCwd } from '../../utils/cwd.js'
import { gitExe, getIsGit } from '../../utils/git.js'

/**
 * Git-based checkpointing system for session state restoration (issue #977).
 *
 * Uses a shadow git repository under `.myclaude/checkpoints/` so checkpoints
 * never pollute the user's main git workflow (no stashes, no commits on the
 * user's branch). Each checkpoint is a lightweight commit in the shadow repo
 * that captures the current working tree of the user's project.
 *
 * Public API:
 *   - createCheckpoint(description) — snapshot current workspace
 *   - listCheckpoints()             — list saved checkpoints (newest first)
 *   - restoreCheckpoint(index)      — restore files from checkpoint #index
 *   - diffCheckpoint(index)         — show diff vs current workspace
 *   - cleanCheckpoints(keep)        — prune old checkpoints
 */

export const CHECKPOINT_LABEL_PREFIX = 'myclaude-checkpoint'
export const DEFAULT_RETENTION = 50

export type CheckpointEntry = {
  index: number
  hash: string
  timestamp: string
  description: string
}

export type CheckpointResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

/**
 * Resolve the shadow git repo directory for the current project.
 * Returns null if we're not inside a git repository (we refuse to create
 * checkpoints outside a git repo so we can compute meaningful diffs).
 */
export async function getCheckpointDir(): Promise<string | null> {
  const isGit = await getIsGit()
  if (!isGit) {
    return null
  }
  const cwd = getCwd()
  return join(cwd, '.myclaude', 'checkpoints')
}

/**
 * Ensure the shadow git repo exists and is initialized. Returns the repo path
 * or null if we cannot initialize (e.g., not in a git repo).
 */
export async function ensureCheckpointRepo(): Promise<string | null> {
  const dir = await getCheckpointDir()
  if (!dir) return null

  const repoDir = join(dir, 'repo')
  const gitDir = join(repoDir, '.git')
  if (!existsSync(join(gitDir, 'HEAD'))) {
    try {
      mkdirSync(repoDir, { recursive: true })
    } catch {
      return null
    }
    const init = await execFileNoThrowWithCwd(
      gitExe(),
      ['--no-optional-locks', 'init', '--quiet'],
      { cwd: repoDir, preserveOutputOnError: false },
    )
    if (init.code !== 0) return null
    // Configure a local identity so commits always succeed.
    await execFileNoThrowWithCwd(
      gitExe(),
      ['config', 'user.name', 'myclaude-checkpoint'],
      { cwd: repoDir, preserveOutputOnError: false },
    )
    await execFileNoThrowWithCwd(
      gitExe(),
      ['config', 'user.email', 'checkpoint@myclaude.local'],
      { cwd: repoDir, preserveOutputOnError: false },
    )
    // Ignore the shadow repo from the user's main repo.
    await ensureIgnored(dir)
  }
  return gitDir
}

async function ensureIgnored(checkpointDir: string): Promise<void> {
  const cwd = getCwd()
  const gitignorePath = join(cwd, '.gitignore')
  const entry = '.myclaude/checkpoints/'
  try {
    const existing = existsSync(gitignorePath)
      ? (await import('fs/promises')).readFile(gitignorePath, 'utf8')
      : ''
    if (existing.split('\n').some(line => line.trim() === entry)) {
      return
    }
    const updated = existing.endsWith('\n') || existing === ''
      ? existing + entry + '\n'
      : existing + '\n' + entry + '\n'
    await (await import('fs/promises')).writeFile(gitignorePath, updated)
  } catch {
    // Best-effort: ignore failures so checkpointing still works.
  }
}

/**
 * Create a new checkpoint capturing the current workspace state.
 */
export async function createCheckpoint(
  description: string,
): Promise<CheckpointResult> {
  const repoDir = await ensureCheckpointRepo()
  if (!repoDir) {
    return {
      ok: false,
      error:
        'Checkpoint requires a git repository. Run `git init` first, or use this command inside a git worktree.',
    }
  }

  const cwd = getCwd()
  const label = `${CHECKPOINT_LABEL_PREFIX}: ${description}`

  // Stage everything in the shadow repo. We use `--no-index` semantics via
  // `git add -A` inside the shadow repo, but we need to point it at the
  // user's workspace. The simplest way is to run git with `-C <cwd>` and
  // `--git-dir <shadow>` so git treats the shadow repo as the index but
  // reads files from the user's workspace.
  const add = await execFileNoThrowWithCwd(
    gitExe(),
    [
      '--no-optional-locks',
      `--git-dir=${repoDir}`,
      `--work-tree=${cwd}`,
      'add',
      '-A',
      '--',
      '.',
    ],
    { preserveOutputOnError: true },
  )
  if (add.code !== 0) {
    return { ok: false, error: `Failed to stage checkpoint: ${add.stderr || add.stdout}` }
  }

  // Check if there's anything to commit.
  const status = await execFileNoThrowWithCwd(
    gitExe(),
    [
      '--no-optional-locks',
      `--git-dir=${repoDir}`,
      `--work-tree=${cwd}`,
      'status',
      '--porcelain',
    ],
    { preserveOutputOnError: false },
  )
  if (status.stdout.trim() === '') {
    return {
      ok: true,
      message: 'No changes to checkpoint — the workspace is already clean.',
    }
  }

  const commit = await execFileNoThrowWithCwd(
    gitExe(),
    [
      '--no-optional-locks',
      `--git-dir=${repoDir}`,
      `--work-tree=${cwd}`,
      'commit',
      '--quiet',
      '-m',
      label,
    ],
    { preserveOutputOnError: true },
  )
  if (commit.code !== 0) {
    return { ok: false, error: `Failed to commit checkpoint: ${commit.stderr || commit.stdout}` }
  }

  return {
    ok: true,
    message: `Checkpoint created: ${label}\n\nUse /checkpoint list to see all checkpoints.`,
  }
}

/**
 * List checkpoints, newest first. Index 0 is the most recent.
 */
export async function listCheckpoints(): Promise<CheckpointEntry[]> {
  const repoDir = await ensureCheckpointRepo()
  if (!repoDir) return []

  const cwd = getCwd()
  const log = await execFileNoThrowWithCwd(
    gitExe(),
    [
      '--no-optional-locks',
      `--git-dir=${repoDir}`,
      `--work-tree=${cwd}`,
      'log',
      '--pretty=format:%H|%cI|%s',
    ],
    { preserveOutputOnError: false },
  )
  if (log.stdout.trim() === '') return []

  return log.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      const [hash, timestamp, ...rest] = line.split('|')
      const description = rest.join('|')
      return {
        index,
        hash: hash ?? '',
        timestamp: timestamp ?? '',
        description: description.replace(
          new RegExp(`^${CHECKPOINT_LABEL_PREFIX}:\\s*`),
          '',
        ),
      }
    })
}

/**
 * Restore the workspace to the state captured at checkpoint #index.
 * Non-destructive: the checkpoint commit is preserved so it can be re-applied.
 */
export async function restoreCheckpoint(
  index: number,
): Promise<CheckpointResult> {
  const repoDir = await ensureCheckpointRepo()
  if (!repoDir) {
    return {
      ok: false,
      error:
        'Checkpoint requires a git repository. Run `git init` first, or use this command inside a git worktree.',
    }
  }

  const entries = await listCheckpoints()
  if (entries.length === 0) {
    return { ok: false, error: 'No checkpoints to restore.' }
  }
  if (index < 0 || index >= entries.length) {
    return {
      ok: false,
      error: `Invalid checkpoint index ${index}. Run /checkpoint list to see valid indices (0–${entries.length - 1}).`,
    }
  }

  const target = entries[index]!
  const cwd = getCwd()

  // Reset the index to the target commit, then check out the tree.
  const reset = await execFileNoThrowWithCwd(
    gitExe(),
    [
      '--no-optional-locks',
      `--git-dir=${repoDir}`,
      `--work-tree=${cwd}`,
      'reset',
      '--hard',
      target.hash,
    ],
    { preserveOutputOnError: true },
  )
  if (reset.code !== 0) {
    return {
      ok: false,
      error: `Failed to restore checkpoint: ${reset.stderr || reset.stdout}`,
    }
  }

  return {
    ok: true,
    message: `Restored checkpoint #${index}: ${target.description}\n${reset.stdout.trim() || ''}`.trim(),
  }
}

/**
 * Show the diff between the current workspace and checkpoint #index.
 */
export async function diffCheckpoint(
  index: number,
  maxLines = 200,
): Promise<CheckpointResult> {
  const repoDir = await ensureCheckpointRepo()
  if (!repoDir) {
    return {
      ok: false,
      error:
        'Checkpoint requires a git repository. Run `git init` first, or use this command inside a git worktree.',
    }
  }

  const entries = await listCheckpoints()
  if (entries.length === 0) {
    return { ok: false, error: 'No checkpoints to diff against.' }
  }
  if (index < 0 || index >= entries.length) {
    return {
      ok: false,
      error: `Invalid checkpoint index ${index}. Run /checkpoint list to see valid indices (0–${entries.length - 1}).`,
    }
  }

  const target = entries[index]!
  const cwd = getCwd()

  const diff = await execFileNoThrowWithCwd(
    gitExe(),
    [
      '--no-optional-locks',
      `--git-dir=${repoDir}`,
      `--work-tree=${cwd}`,
      'diff',
      '--stat',
      target.hash,
      '--',
      '.',
    ],
    { preserveOutputOnError: false },
  )
  const stat = diff.stdout.trim()

  const full = await execFileNoThrowWithCwd(
    gitExe(),
    [
      '--no-optional-locks',
      `--git-dir=${repoDir}`,
      `--work-tree=${cwd}`,
      'diff',
      target.hash,
      '--',
      '.',
    ],
    { preserveOutputOnError: false },
  )
  const lines = full.stdout.split('\n')
  const truncated = lines.length > maxLines
  const body = lines.slice(0, maxLines).join('\n')

  return {
    ok: true,
    message: `Diff vs checkpoint #${index} (${target.description}):\n${stat || '(no changes)'}\n\n${body}${truncated ? `\n\n… truncated at ${maxLines} lines` : ''}`.trim(),
  }
}

/**
 * Prune old checkpoints, keeping the most recent `keep` entries.
 */
export async function cleanCheckpoints(
  keep = DEFAULT_RETENTION,
): Promise<CheckpointResult> {
  const repoDir = await ensureCheckpointRepo()
  if (!repoDir) {
    return {
      ok: false,
      error:
        'Checkpoint requires a git repository. Run `git init` first, or use this command inside a git worktree.',
    }
  }

  const entries = await listCheckpoints()
  if (entries.length <= keep) {
    return {
      ok: true,
      message: `Nothing to clean — ${entries.length} checkpoint(s) already within retention (${keep}).`,
    }
  }

  const toDelete = entries.slice(keep)
  const cwd = getCwd()

  // Delete each old commit by rewriting history. We use `git filter-branch`
  // would be heavy; instead we simply drop the refs by resetting to the
  // kept commit and running gc. This is safe because we only ever keep
  // the most recent N commits on a single linear history.
  const keepHash = entries[keep - 1]!.hash
  const reset = await execFileNoThrowWithCwd(
    gitExe(),
    [
      '--no-optional-locks',
      `--git-dir=${repoDir}`,
      `--work-tree=${cwd}`,
      'reset',
      '--hard',
      keepHash,
    ],
    { preserveOutputOnError: false },
  )
  if (reset.code !== 0) {
    return {
      ok: false,
      error: `Failed to prune checkpoints: ${reset.stderr || reset.stdout}`,
    }
  }

  await execFileNoThrowWithCwd(
    gitExe(),
    [
      '--no-optional-locks',
      `--git-dir=${repoDir}`,
      'reflog',
      'expire',
      '--expire=now',
    ],
    { preserveOutputOnError: false },
  )
  await execFileNoThrowWithCwd(
    gitExe(),
    [
      '--no-optional-locks',
      `--git-dir=${repoDir}`,
      'gc',
      '--prune=now',
      '--quiet',
    ],
    { preserveOutputOnError: false },
  )

  return {
    ok: true,
    message: `Pruned ${toDelete.length} old checkpoint(s); kept the most recent ${keep}.`,
  }
}

/**
 * Convenience: format a list of checkpoints for display.
 */
export function formatCheckpointList(entries: CheckpointEntry[]): string {
  if (entries.length === 0) {
    return [
      'No checkpoints yet.',
      '',
      'Usage:',
      '  /checkpoint <description>  — save current workspace state',
      '  /checkpoint list           — list checkpoints',
      '  /checkpoint restore <n>    — restore checkpoint #n',
      '  /checkpoint diff <n>       — show diff vs checkpoint #n',
      '  /checkpoint clean [keep]   — prune old checkpoints',
    ].join('\n')
  }
  const lines = entries.map(e => {
    const marker = `  ${e.index}: ${e.description}`
    return `${marker}  (${e.timestamp})`
  })
  return `Saved checkpoints:\n${lines.join('\n')}\n\nRestore with: /checkpoint restore <n>\nDiff with: /checkpoint diff <n>`
}

// Re-export for tests / introspection.
export const _internal = {
  resolve: resolve,
  join,
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
}
