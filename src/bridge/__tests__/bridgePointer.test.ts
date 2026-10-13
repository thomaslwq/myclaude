import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { mkdtemp, mkdir, writeFile, rm, chmod, utimes } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

// Mock the worktree scanner so we don't shell out to git.
mock.module(
  join(import.meta.dir, '../../utils/getWorktreePathsPortable.js'),
  () => ({
    getWorktreePathsPortable: mock(() => Promise.resolve([])),
  }),
)

// Import the module under test AFTER the worktree mock is registered.
const { readBridgePointerAcrossWorktrees } = await import(
  '../bridgePointer.js'
)
const { getWorktreePathsPortable } = await import(
  '../../utils/getWorktreePathsPortable.js'
)

const VALID_POINTER = {
  sessionId: 'sess-1',
  environmentId: 'env-1',
  source: 'standalone' as const,
}

describe('readBridgePointerAcrossWorktrees', () => {
  let tmpDir: string
  let originalConfigDir: string | undefined

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bridge-pointer-test-'))
    originalConfigDir = process.env.CLAUDE_CONFIG_DIR
    process.env.CLAUDE_CONFIG_DIR = tmpDir
    mock.reset()
  })

  afterEach(async () => {
    mock.restore()
    if (originalConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR
    } else {
      process.env.CLAUDE_CONFIG_DIR = originalConfigDir
    }
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns the fast-path pointer without shelling out to git', async () => {
    const dir = '/repo/main'
    const pointerPath = join(
      tmpDir,
      'projects',
      '-repo-main',
      'bridge-pointer.json',
    )
    await mkdir(join(tmpDir, 'projects', '-repo-main'), { recursive: true })
    await writeFile(pointerPath, JSON.stringify(VALID_POINTER))

    const result = await readBridgePointerAcrossWorktrees(dir)

    expect(result).not.toBeNull()
    expect(result!.dir).toBe(dir)
    expect(result!.pointer.sessionId).toBe('sess-1')
    expect(getWorktreePathsPortable as any).not.toHaveBeenCalled()
  })

  it('returns the pointer found in a worktree sibling even when another worktree throws', async () => {
    const dir = '/repo/main'
    const wtA = '/repo/wt-a'
    const wtB = '/repo/wt-b'

    // wtA: create a directory that will fail to stat (chmod 000 on POSIX).
    const wtADir = join(tmpDir, 'projects', '-repo-wt-a')
    await mkdir(wtADir, { recursive: true })
    // Create a file inside so stat on the file path would succeed if we
    // could read the dir — but we'll make the dir unreadable.
    await writeFile(
      join(wtADir, 'bridge-pointer.json'),
      JSON.stringify(VALID_POINTER),
    )
    // wtB: valid pointer.
    const wtBDir = join(tmpDir, 'projects', '-repo-wt-b')
    await mkdir(wtBDir, { recursive: true })
    await writeFile(
      join(wtBDir, 'bridge-pointer.json'),
      JSON.stringify(VALID_POINTER),
    )

    mock(getWorktreePathsPortable as any).mockResolvedValue([dir, wtA, wtB])

    // On POSIX, chmod 000 makes stat() on the file inside fail with EACCES.
    // On Windows this is a no-op, so skip the assertion there.
    if (process.platform !== 'win32') {
      await chmod(wtADir, 0o000)
    }

    try {
      const result = await readBridgePointerAcrossWorktrees(dir)

      expect(result).not.toBeNull()
      expect(result!.dir).toBe(wtB)
      expect(result!.pointer.sessionId).toBe('sess-1')
    } finally {
      if (process.platform !== 'win32') {
        await chmod(wtADir, 0o755)
      }
    }
  })

  it('picks the freshest pointer across worktrees when all reads succeed', async () => {
    const dir = '/repo/main'
    const wtA = '/repo/wt-a'
    const wtB = '/repo/wt-b'

    const wtADir = join(tmpDir, 'projects', '-repo-wt-a')
    const wtBDir = join(tmpDir, 'projects', '-repo-wt-b')
    await mkdir(wtADir, { recursive: true })
    await mkdir(wtBDir, { recursive: true })
    await writeFile(
      join(wtADir, 'bridge-pointer.json'),
      JSON.stringify({ ...VALID_POINTER, sessionId: 'sess-old' }),
    )
    await writeFile(
      join(wtBDir, 'bridge-pointer.json'),
      JSON.stringify({ ...VALID_POINTER, sessionId: 'sess-new' }),
    )

    // Make wtA older than wtB.
    const old = new Date(Date.now() - 5000)
    const new_ = new Date(Date.now() - 1000)
    await utimes(join(wtADir, 'bridge-pointer.json'), old, old)
    await utimes(join(wtBDir, 'bridge-pointer.json'), new_, new_)

    mock(getWorktreePathsPortable as any).mockResolvedValue([dir, wtA, wtB])

    const result = await readBridgePointerAcrossWorktrees(dir)

    expect(result).not.toBeNull()
    expect(result!.dir).toBe(wtB)
    expect(result!.pointer.sessionId).toBe('sess-new')
  })
})
