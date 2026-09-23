import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { FsOperations } from '../../utils/fsOperations.js'
import { getFsImplementation, setFsImplementation } from '../../utils/fsOperations.js'
import { verifyMemoryStore } from '../memdir.js'

/**
 * Regression tests for issue #1012: persistent memory must fail loud on
 * session start. If the memory store directory cannot be read (permissions,
 * corruption, a file squatting on the directory), operators must be told
 * explicitly instead of silently running with session amnesia.
 */

type MockDir = {
  dirs: Set<string>
  files: Map<string, string>
  /** paths for which stat() throws EACCES (unreadable) */
  bad: Set<string>
}

/**
 * Minimal FsOperations mock: only implements the calls verifyMemoryStore
 * makes (existsSync, stat, readdir, readFile). Cast at the call site —
 * existing pattern in fileSuggestions-mtime-cache.test.ts.
 */
function makeMockFs(dir: MockDir): FsOperations {
  const notFound = (path: string): Error => {
    const e = new Error(`ENOENT: no such file or directory, stat '${path}'`)
    e.code = 'ENOENT'
    return e
  }
  const accDenied = (path: string): Error => {
    const e = new Error(`EACCES: permission denied, stat '${path}'`)
    e.code = 'EACCES'
    return e
  }
  const fsImpl = {
    existsSync: (path: string) =>
      dir.dirs.has(path) || dir.files.has(path) || dir.bad.has(path),
    stat: async (path: string) => {
      if (dir.bad.has(path)) throw accDenied(path)
      if (!dir.dirs.has(path) && !dir.files.has(path)) throw notFound(path)
      const isDir = dir.dirs.has(path)
      return { isDirectory: () => isDir, isFile: () => !isDir } as never
    },
    readdir: async (path: string) => {
      if (dir.bad.has(path)) throw accDenied(path)
      if (!dir.dirs.has(path)) throw notFound(path)
      return [...dir.files.keys()]
        .filter(f => f.startsWith(path))
        .map(f => ({ name: f.slice(path.length) } as never))
    },
    readFile: async (path: string) => {
      if (dir.bad.has(path)) throw accDenied(path)
      const content = dir.files.get(path)
      if (content === undefined) throw notFound(path)
      return content
    },
  }
  return fsImpl as never as FsOperations
}

describe('verifyMemoryStore', () => {
  let dir: string
  let originalFs: FsOperations

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'memdir-verify-'))
    originalFs = getFsImplementation()
  })

  afterEach(async () => {
    setFsImplementation(originalFs as never)
    await rm(dir, { recursive: true, force: true })
  })

  test('directory missing → ok (nothing to load yet, fresh install)', async () => {
    const missing = join(dir, 'does-not-exist')
    setFsImplementation(
      makeMockFs({ dirs: new Set(), files: new Map(), bad: new Set() }),
    )
    const r = await verifyMemoryStore(missing)
    expect(r.status).toBe('ok')
    expect(r.entrypointPresent).toBe(false)
    expect(r.diagnostics.some(d => d.includes('missing'))).toBe(true)
  })

  test('readable dir with MEMORY.md → ok with content loaded', async () => {
    const store = join(dir, 'memory')
    await mkdir(store, { recursive: true })
    await writeFile(join(store, 'MEMORY.md'), '## Topics\n- user prefers TDD\n')
    const r = await verifyMemoryStore(store)
    expect(r.status).toBe('ok')
    expect(r.entrypointPresent).toBe(true)
    expect(r.entrypointContent).toContain('user prefers TDD')
    expect(r.diagnostics).toEqual([])
  })

  test('readable dir without MEMORY.md → ok (empty store is valid)', async () => {
    const store = join(dir, 'memory')
    await mkdir(store, { recursive: true })
    await writeFile(join(store, 'notes.md'), '---\ndescription: n\n---\nbody\n')
    const r = await verifyMemoryStore(store)
    expect(r.status).toBe('ok')
    expect(r.entrypointPresent).toBe(false)
    expect(r.entrypointContent).toBe('')
    expect(r.diagnostics).toEqual([])
  })

  test('unreadable directory → error (fail loud)', async () => {
    setFsImplementation(
      makeMockFs({
        dirs: new Set([dir]),
        files: new Map([[join(dir, 'MEMORY.md'), 'secret']]),
        bad: new Set([dir]),
      }),
    )
    const r = await verifyMemoryStore(dir)
    expect(r.status).toBe('error')
    expect(r.error).toMatch(/EACCES|permission/i)
    expect(r.path).toBe(dir)
  })

  test('path is a file, not a directory → error (fail loud)', async () => {
    await writeFile(join(dir, 'memory'), 'just a file')
    const r = await verifyMemoryStore(join(dir, 'memory'))
    expect(r.status).toBe('error')
    expect(r.error.toLowerCase()).toContain('not a directory')
  })

  test('directory with no memory files at all → ok (empty store is valid)', async () => {
    const store = join(dir, 'memory')
    await mkdir(store, { recursive: true })
    await writeFile(join(dir, 'unrelated.txt'), 'outside store')
    const r = await verifyMemoryStore(store)
    expect(r.status).toBe('ok')
    expect(r.entrypointPresent).toBe(false)
    expect(r.entrypointContent).toBe('')
    expect(r.diagnostics.some(d => d.includes('empty'))).toBe(true)
  })
})
