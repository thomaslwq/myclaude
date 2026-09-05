import { createHash } from 'crypto'
import { diffLines } from 'diff'
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'path'

/**
 * Checkpoint / snapshot system for safe experimentation during agentic
 * coding sessions (issue #987).
 *
 * Design goals:
 *   - Self-contained: does not require a git repository (unlike the
 *     existing /checkpoint command which shells out to `git stash`).
 *   - Lightweight: only copies the files that were actually touched by
 *     the tool call, preserving their relative path under
 *     `.myclaude/checkpoints/<id>/`.
 *   - Non-destructive: `restoreCheckpoint` copies the snapshot back over
 *     the working tree but leaves the snapshot intact so a bad restore
 *     can be retried.
 *   - Diff-friendly: `getCheckpointDiff` returns a per-file summary of
 *     what would change if the checkpoint were restored.
 *   - Automatic: `autoSnapshotBeforeToolCall` is a fire-and-forget hook
 *     that file-modifying tools can call before executing, so users get
 *     an undo timeline without having to remember to snapshot manually.
 *
 * Storage layout (relative to `cwd`):
 *   .myclaude/checkpoints/
 *     index.json                    — ordered list of checkpoint metadata
 *     <id>/                         — one directory per checkpoint
 *       manifest.json               — files changed + hashes
 *       files/<relpath>             — snapshot of each file's contents
 */

export type CheckpointFileEntry = {
  /** Path relative to the workspace root. */
  path: string
  /** SHA-256 of the file contents at snapshot time. */
  hash: string
  /** Size in bytes at snapshot time. */
  size: number
  /** True when the file did not exist at snapshot time. */
  deleted: boolean
}

export type Checkpoint = {
  /** Short unique id (first 12 chars of a content hash). */
  id: string
  /** ISO-8601 timestamp of when the checkpoint was created. */
  timestamp: string
  /** Human-readable description (e.g. tool name + file list). */
  description: string
  /** Files captured in this checkpoint. */
  files: CheckpointFileEntry[]
  /** True when the checkpoint was created automatically by a tool call. */
  auto: boolean
  /** Optional tool name that triggered the checkpoint. */
  tool?: string
}

export type CheckpointDiffEntry = {
  path: string
  /** 'added' | 'deleted' | 'modified' | 'unchanged' */
  status: 'added' | 'deleted' | 'modified' | 'unchanged'
  insertions: number
  deletions: number
}

export type CheckpointDiff = {
  id: string
  files: CheckpointDiffEntry[]
  filesChanged: number
  insertions: number
  deletions: number
}

const DEFAULT_MAX = 50
const DEFAULT_ROOT = '.myclaude'
const CHECKPOINTS_DIR = 'checkpoints'
const INDEX_FILE = 'index.json'

/**
 * Returns true when automatic checkpointing is enabled. Enabled by
 * default; can be disabled with `MYCLAUDE_DISABLE_CHECKPOINTS=1`.
 */
export function checkpointsEnabled(): boolean {
  const v = process.env.MYCLAUDE_DISABLE_CHECKPOINTS
  if (v === '1' || v === 'true' || v === 'yes') return false
  return true
}

/**
 * Returns the absolute path to the checkpoints root directory for a
 * given workspace. Does not create the directory.
 */
export function getCheckpointsRoot(cwd: string = process.cwd()): string {
  return join(cwd, DEFAULT_ROOT, CHECKPOINTS_DIR)
}

function toPosix(p: string): string {
  return p.split('\\').join('/')
}

function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12)
}

function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex')
}

type IndexEntry = Checkpoint

type Index = { version: 1; checkpoints: IndexEntry[] }

async function readIndex(root: string): Promise<Index> {
  try {
    const raw = await readFile(join(root, INDEX_FILE), 'utf8')
    const parsed = JSON.parse(raw) as Partial<Index>
    if (!parsed || !Array.isArray(parsed.checkpoints)) {
      return { version: 1, checkpoints: [] }
    }
    return { version: 1, checkpoints: parsed.checkpoints as IndexEntry[] }
  } catch {
    return { version: 1, checkpoints: [] }
  }
}

async function writeIndex(root: string, index: Index): Promise<void> {
  await mkdir(root, { recursive: true })
  await writeFile(
    join(root, INDEX_FILE),
    JSON.stringify(index, null, 2),
    'utf8',
  )
}

async function fileExists(p: string): Promise<boolean> {
  try {
    const s = await stat(p)
    return s.isFile()
  } catch {
    return false
  }
}

/**
 * Creates a checkpoint capturing the current contents of `files`.
 *
 * Files that do not exist on disk are recorded as `deleted: true` so a
 * later restore can recreate them (or confirm their absence).
 */
export async function createCheckpoint(
  opts: {
    description?: string
    files: string[]
    cwd?: string
    auto?: boolean
    tool?: string
  },
): Promise<Checkpoint | undefined> {
  if (!checkpointsEnabled()) return undefined
  const cwd = opts.cwd ?? process.cwd()
  const root = getCheckpointsRoot(cwd)
  const files: CheckpointFileEntry[] = []

  for (const rawPath of opts.files) {
    const absPath = isAbsolute(rawPath) ? rawPath : resolve(cwd, rawPath)
    const relPath = toPosix(relative(cwd, absPath))
    if (relPath.startsWith('..') || isAbsolute(relPath)) continue

    const entry: CheckpointFileEntry = {
      path: relPath,
      hash: '',
      size: 0,
      deleted: false,
    }
    try {
      const buf = await readFile(absPath)
      entry.hash = sha256(buf)
      entry.size = buf.length
    } catch {
      entry.deleted = true
    }
    files.push(entry)
  }

  if (files.length === 0) return undefined

  const description =
    opts.description ??
    (opts.tool ? `${opts.tool} checkpoint` : 'manual checkpoint')
  const timestamp = new Date().toISOString()
  const id = shortHash(`${timestamp}:${description}:${files.map(f => f.path).join(',')}`)

  const cpDir = join(root, id)
  const filesDir = join(cpDir, 'files')
  await mkdir(filesDir, { recursive: true })

  for (const entry of files) {
    if (entry.deleted) continue
    const src = resolve(cwd, entry.path)
    const dst = join(filesDir, entry.path)
    await mkdir(dirname(dst), { recursive: true })
    await cp(src, dst, { recursive: false })
  }

  const manifest: Checkpoint = {
    id,
    timestamp,
    description,
    files,
    auto: opts.auto ?? false,
    tool: opts.tool,
  }
  await writeFile(
    join(cpDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  )

  const index = await readIndex(root)
  index.checkpoints.unshift(manifest)
  const max = DEFAULT_MAX
  if (index.checkpoints.length > max) {
    const overflow = index.checkpoints.splice(max)
    for (const stale of overflow) {
      await rm(join(root, stale.id), { recursive: true, force: true }).catch(
        () => {},
      )
    }
  }
  await writeIndex(root, index)
  return manifest
}

/**
 * Lists all checkpoints, newest first.
 */
export async function listCheckpoints(
  cwd: string = process.cwd(),
): Promise<Checkpoint[]> {
  const root = getCheckpointsRoot(cwd)
  const index = await readIndex(root)
  return index.checkpoints
}

/**
 * Returns a single checkpoint by id, or undefined when not found.
 */
export async function getCheckpoint(
  id: string,
  cwd: string = process.cwd(),
): Promise<Checkpoint | undefined> {
  const root = getCheckpointsRoot(cwd)
  const index = await readIndex(root)
  return index.checkpoints.find(c => c.id === id)
}

/**
 * Computes a diff summary between the current working tree and the
 * given checkpoint. Does not modify any files.
 */
export async function getCheckpointDiff(
  id: string,
  cwd: string = process.cwd(),
): Promise<CheckpointDiff | undefined> {
  const checkpoint = await getCheckpoint(id, cwd)
  if (!checkpoint) return undefined
  const root = getCheckpointsRoot(cwd)
  const filesDir = join(root, checkpoint.id, 'files')

  const entries: CheckpointDiffEntry[] = []
  for (const entry of checkpoint.files) {
    const currentAbs = resolve(cwd, entry.path)
    const snapshotAbs = join(filesDir, entry.path)
    const currentExists = await fileExists(currentAbs)
    const snapshotExists = await fileExists(snapshotAbs)

    if (!currentExists && !snapshotExists) {
      entries.push({ path: entry.path, status: 'unchanged', insertions: 0, deletions: 0 })
      continue
    }
    if (!currentExists && snapshotExists) {
      // Restoring would add the file back.
      const snap = await readFile(snapshotAbs, 'utf8').catch(() => '')
      const lines = snap.split('\n').length
      entries.push({ path: entry.path, status: 'added', insertions: lines, deletions: 0 })
      continue
    }
    if (currentExists && !snapshotExists) {
      // Restoring would delete the file.
      const cur = await readFile(currentAbs, 'utf8').catch(() => '')
      const lines = cur.split('\n').length
      entries.push({ path: entry.path, status: 'deleted', insertions: 0, deletions: lines })
      continue
    }
    const cur = await readFile(currentAbs, 'utf8').catch(() => '')
    const snap = await readFile(snapshotAbs, 'utf8').catch(() => '')
    if (cur === snap) {
      entries.push({ path: entry.path, status: 'unchanged', insertions: 0, deletions: 0 })
      continue
    }
    const changes = diffLines(cur, snap)
    let insertions = 0
    let deletions = 0
    for (const c of changes) {
      if (c.added) insertions += c.count ?? 0
      else if (c.removed) deletions += c.count ?? 0
    }
    entries.push({ path: entry.path, status: 'modified', insertions, deletions })
  }

  return {
    id: checkpoint.id,
    files: entries,
    filesChanged: entries.filter(e => e.status !== 'unchanged').length,
    insertions: entries.reduce((s, e) => s + e.insertions, 0),
    deletions: entries.reduce((s, e) => s + e.deletions, 0),
  }
}

/**
 * Restores the given checkpoint over the working tree. Files that were
 * marked `deleted` in the checkpoint are removed from disk; files that
 * exist in the snapshot are copied back. The checkpoint itself is
 * preserved so a bad restore can be retried.
 *
 * Returns the list of file paths that were actually changed.
 */
export async function restoreCheckpoint(
  id: string,
  cwd: string = process.cwd(),
): Promise<string[]> {
  const checkpoint = await getCheckpoint(id, cwd)
  if (!checkpoint) throw new Error(`Checkpoint not found: ${id}`)
  const root = getCheckpointsRoot(cwd)
  const filesDir = join(root, checkpoint.id, 'files')
  const changed: string[] = []

  for (const entry of checkpoint.files) {
    const target = resolve(cwd, entry.path)
    if (entry.deleted) {
      try {
        await rm(target, { force: true })
        changed.push(entry.path)
      } catch {
        // Already absent; nothing to do.
      }
      continue
    }
    const src = join(filesDir, entry.path)
    try {
      await mkdir(dirname(target), { recursive: true })
      await cp(src, target, { recursive: false })
      changed.push(entry.path)
    } catch {
      // Snapshot file missing; skip.
    }
  }
  return changed
}

/**
 * Deletes a checkpoint and its on-disk snapshot. Returns true when the
 * checkpoint existed and was removed.
 */
export async function deleteCheckpoint(
  id: string,
  cwd: string = process.cwd(),
): Promise<boolean> {
  const root = getCheckpointsRoot(cwd)
  const index = await readIndex(root)
  const before = index.checkpoints.length
  index.checkpoints = index.checkpoints.filter(c => c.id !== id)
  if (index.checkpoints.length === before) return false
  await rm(join(root, id), { recursive: true, force: true }).catch(() => {})
  await writeIndex(root, index)
  return true
}

/**
 * Fire-and-forget hook for file-modifying tools. Creates a checkpoint
 * capturing the current contents of `files` before the tool mutates
 * them, so a subsequent `/checkpoint restore <id>` can undo the change.
 *
 * Safe to call unconditionally: returns undefined when checkpointing is
 * disabled or when no files are provided.
 */
export async function autoSnapshotBeforeToolCall(
  tool: string,
  files: string[],
  cwd: string = process.cwd(),
): Promise<Checkpoint | undefined> {
  if (!checkpointsEnabled()) return undefined
  if (!files || files.length === 0) return undefined
  return createCheckpoint({
    files,
    cwd,
    auto: true,
    tool,
    description: `${tool} checkpoint`,
  })
}

/**
 * Returns the total number of checkpoints currently stored. Useful for
 * TUI status lines and tests.
 */
export async function checkpointCount(
  cwd: string = process.cwd(),
): Promise<number> {
  const list = await listCheckpoints(cwd)
  return list.length
}
