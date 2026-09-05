import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  autoSnapshotBeforeToolCall,
  checkpointCount,
  checkpointsEnabled,
  createCheckpoint,
  deleteCheckpoint,
  getCheckpoint,
  getCheckpointDiff,
  getCheckpointsRoot,
  listCheckpoints,
  restoreCheckpoint,
} from '../checkpoints.js'

let cwd: string
let prevDisable: string | undefined

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'myclaude-checkpoints-'))
  prevDisable = process.env.MYCLAUDE_DISABLE_CHECKPOINTS
  delete process.env.MYCLAUDE_DISABLE_CHECKPOINTS
})

afterEach(async () => {
  if (prevDisable === undefined) {
    delete process.env.MYCLAUDE_DISABLE_CHECKPOINTS
  } else {
    process.env.MYCLAUDE_DISABLE_CHECKPOINTS = prevDisable
  }
  await rm(cwd, { recursive: true, force: true })
})

async function writeWorkspaceFile(relPath: string, content: string): Promise<void> {
  const abs = join(cwd, relPath)
  await mkdir(join(abs, '..'), { recursive: true })
  await writeFile(abs, content, 'utf8')
}

async function readWorkspaceFile(relPath: string): Promise<string> {
  return readFile(join(cwd, relPath), 'utf8')
}

describe('checkpointsEnabled', () => {
  test('returns true by default', () => {
    expect(checkpointsEnabled()).toBe(true)
  })

  test('returns false when MYCLAUDE_DISABLE_CHECKPOINTS=1', () => {
    process.env.MYCLAUDE_DISABLE_CHECKPOINTS = '1'
    expect(checkpointsEnabled()).toBe(false)
  })

  test('returns false when MYCLAUDE_DISABLE_CHECKPOINTS=true', () => {
    process.env.MYCLAUDE_DISABLE_CHECKPOINTS = 'true'
    expect(checkpointsEnabled()).toBe(false)
  })
})

describe('getCheckpointsRoot', () => {
  test('returns .myclaude/checkpoints under the workspace', () => {
    expect(getCheckpointsRoot(cwd)).toBe(join(cwd, '.myclaude', 'checkpoints'))
  })
})

describe('createCheckpoint + listCheckpoints', () => {
  test('captures file contents and records metadata', async () => {
    await writeWorkspaceFile('src/a.ts', 'hello\nworld\n')
    const cp = await createCheckpoint({ files: ['src/a.ts'], cwd })
    expect(cp).toBeDefined()
    expect(cp!.id).toMatch(/^[0-9a-f]{12}$/)
    expect(cp!.files).toHaveLength(1)
    expect(cp!.files[0]!.path).toBe('src/a.ts')
    expect(cp!.files[0]!.deleted).toBe(false)
    expect(cp!.files[0]!.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(cp!.files[0]!.size).toBe('hello\nworld\n'.length)

    const list = await listCheckpoints(cwd)
    expect(list).toHaveLength(1)
    expect(list[0]!.id).toBe(cp!.id)
  })

  test('records deleted files as deleted: true', async () => {
    const cp = await createCheckpoint({ files: ['missing.txt'], cwd })
    expect(cp).toBeDefined()
    expect(cp!.files[0]!.deleted).toBe(true)
    expect(cp!.files[0]!.hash).toBe('')
    expect(cp!.files[0]!.size).toBe(0)
  })

  test('returns undefined when no files are provided', async () => {
    const cp = await createCheckpoint({ files: [], cwd })
    expect(cp).toBeUndefined()
  })

  test('returns undefined when checkpointing is disabled', async () => {
    process.env.MYCLAUDE_DISABLE_CHECKPOINTS = '1'
    await writeWorkspaceFile('a.txt', 'x')
    const cp = await createCheckpoint({ files: ['a.txt'], cwd })
    expect(cp).toBeUndefined()
  })

  test('ignores paths that escape the workspace', async () => {
    const cp = await createCheckpoint({ files: ['../outside.txt'], cwd })
    expect(cp).toBeUndefined()
  })

  test('lists newest first', async () => {
    await writeWorkspaceFile('a.txt', '1')
    const first = await createCheckpoint({ files: ['a.txt'], cwd })
    await new Promise(r => setTimeout(r, 5))
    await writeWorkspaceFile('a.txt', '2')
    const second = await createCheckpoint({ files: ['a.txt'], cwd })
    const list = await listCheckpoints(cwd)
    expect(list[0]!.id).toBe(second!.id)
    expect(list[1]!.id).toBe(first!.id)
  })

  test('enforces the max-checkpoints cap', async () => {
    await writeWorkspaceFile('a.txt', '1')
    for (let i = 0; i < 55; i++) {
      await writeWorkspaceFile('a.txt', String(i))
      await createCheckpoint({ files: ['a.txt'], cwd })
    }
    const list = await listCheckpoints(cwd)
    expect(list.length).toBeLessThanOrEqual(50)
  })
})

describe('getCheckpoint', () => {
  test('returns the checkpoint by id', async () => {
    await writeWorkspaceFile('a.txt', 'x')
    const cp = await createCheckpoint({ files: ['a.txt'], cwd })
    const found = await getCheckpoint(cp!.id, cwd)
    expect(found?.id).toBe(cp!.id)
  })

  test('returns undefined for unknown id', async () => {
    const found = await getCheckpoint('doesnotexist', cwd)
    expect(found).toBeUndefined()
  })
})

describe('restoreCheckpoint', () => {
  test('restores file contents from the checkpoint', async () => {
    await writeWorkspaceFile('a.txt', 'original')
    const cp = await createCheckpoint({ files: ['a.txt'], cwd })
    await writeWorkspaceFile('a.txt', 'mutated')
    const changed = await restoreCheckpoint(cp!.id, cwd)
    expect(changed).toContain('a.txt')
    expect(await readWorkspaceFile('a.txt')).toBe('original')
  })

  test('deletes files that were marked deleted in the checkpoint', async () => {
    await writeWorkspaceFile('a.txt', 'x')
    const cp = await createCheckpoint({ files: ['a.txt'], cwd })
    await rm(join(cwd, 'a.txt'))
    const cp2 = await createCheckpoint({ files: ['a.txt'], cwd })
    expect(cp2!.files[0]!.deleted).toBe(true)
    await writeWorkspaceFile('a.txt', 'resurrected')
    await restoreCheckpoint(cp2!.id, cwd)
    let exists = true
    try {
      await readFile(join(cwd, 'a.txt'))
    } catch {
      exists = false
    }
    expect(exists).toBe(false)
    expect((await getCheckpoint(cp!.id, cwd))?.files[0]!.deleted).toBe(false)
  })

  test('throws when the checkpoint does not exist', async () => {
    await expect(restoreCheckpoint('nope', cwd)).rejects.toThrow(/not found/i)
  })

  test('preserves the checkpoint after restore (non-destructive)', async () => {
    await writeWorkspaceFile('a.txt', 'original')
    const cp = await createCheckpoint({ files: ['a.txt'], cwd })
    await writeWorkspaceFile('a.txt', 'mutated')
    await restoreCheckpoint(cp!.id, cwd)
    const stillThere = await getCheckpoint(cp!.id, cwd)
    expect(stillThere).toBeDefined()
  })
})

describe('getCheckpointDiff', () => {
  test('reports modified files with insertions/deletions', async () => {
    await writeWorkspaceFile('a.txt', 'line1\nline2\nline3\n')
    const cp = await createCheckpoint({ files: ['a.txt'], cwd })
    await writeWorkspaceFile('a.txt', 'line1\nCHANGED\nline3\n')
    const diff = await getCheckpointDiff(cp!.id, cwd)
    expect(diff).toBeDefined()
    expect(diff!.filesChanged).toBe(1)
    expect(diff!.files[0]!.status).toBe('modified')
    expect(diff!.insertions).toBeGreaterThanOrEqual(1)
    expect(diff!.deletions).toBeGreaterThanOrEqual(1)
  })

  test('reports unchanged files when nothing changed', async () => {
    await writeWorkspaceFile('a.txt', 'same')
    const cp = await createCheckpoint({ files: ['a.txt'], cwd })
    const diff = await getCheckpointDiff(cp!.id, cwd)
    expect(diff!.filesChanged).toBe(0)
    expect(diff!.files[0]!.status).toBe('unchanged')
  })

  test('reports added files when the current file is missing', async () => {
    await writeWorkspaceFile('a.txt', 'x')
    const cp = await createCheckpoint({ files: ['a.txt'], cwd })
    await rm(join(cwd, 'a.txt'))
    const diff = await getCheckpointDiff(cp!.id, cwd)
    expect(diff!.files[0]!.status).toBe('added')
  })

  test('reports deleted files when the checkpoint had them deleted', async () => {
    const cp = await createCheckpoint({ files: ['a.txt'], cwd })
    await writeWorkspaceFile('a.txt', 'new')
    const diff = await getCheckpointDiff(cp!.id, cwd)
    expect(diff!.files[0]!.status).toBe('deleted')
  })

  test('returns undefined for unknown id', async () => {
    const diff = await getCheckpointDiff('nope', cwd)
    expect(diff).toBeUndefined()
  })
})

describe('deleteCheckpoint', () => {
  test('removes the checkpoint from the index and disk', async () => {
    await writeWorkspaceFile('a.txt', 'x')
    const cp = await createCheckpoint({ files: ['a.txt'], cwd })
    const removed = await deleteCheckpoint(cp!.id, cwd)
    expect(removed).toBe(true)
    expect(await listCheckpoints(cwd)).toHaveLength(0)
    expect(await getCheckpoint(cp!.id, cwd)).toBeUndefined()
  })

  test('returns false when the checkpoint does not exist', async () => {
    const removed = await deleteCheckpoint('nope', cwd)
    expect(removed).toBe(false)
  })
})

describe('autoSnapshotBeforeToolCall', () => {
  test('creates an auto checkpoint tagged with the tool name', async () => {
    await writeWorkspaceFile('src/a.ts', 'hello')
    const cp = await autoSnapshotBeforeToolCall('FileWriteTool', ['src/a.ts'], cwd)
    expect(cp).toBeDefined()
    expect(cp!.auto).toBe(true)
    expect(cp!.tool).toBe('FileWriteTool')
    expect(cp!.description).toBe('FileWriteTool checkpoint')
  })

  test('returns undefined when no files are provided', async () => {
    const cp = await autoSnapshotBeforeToolCall('FileWriteTool', [], cwd)
    expect(cp).toBeUndefined()
  })

  test('returns undefined when checkpointing is disabled', async () => {
    process.env.MYCLAUDE_DISABLE_CHECKPOINTS = '1'
    await writeWorkspaceFile('a.txt', 'x')
    const cp = await autoSnapshotBeforeToolCall('FileWriteTool', ['a.txt'], cwd)
    expect(cp).toBeUndefined()
  })

  test('snapshot can be restored after a tool call mutates the file', async () => {
    await writeWorkspaceFile('a.txt', 'before')
    const cp = await autoSnapshotBeforeToolCall('FileWriteTool', ['a.txt'], cwd)
    await writeWorkspaceFile('a.txt', 'after')
    await restoreCheckpoint(cp!.id, cwd)
    expect(await readWorkspaceFile('a.txt')).toBe('before')
  })
})

describe('checkpointCount', () => {
  test('returns 0 when no checkpoints exist', async () => {
    expect(await checkpointCount(cwd)).toBe(0)
  })

  test('counts stored checkpoints', async () => {
    await writeWorkspaceFile('a.txt', '1')
    await createCheckpoint({ files: ['a.txt'], cwd })
    await new Promise(r => setTimeout(r, 5))
    await writeWorkspaceFile('a.txt', '2')
    await createCheckpoint({ files: ['a.txt'], cwd })
    expect(await checkpointCount(cwd)).toBe(2)
  })
})
