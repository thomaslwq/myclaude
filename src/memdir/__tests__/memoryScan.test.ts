import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { mkdtemp, mkdir, writeFile, rm, utimes } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  scanMemoryFiles,
  SCAN_CONCURRENCY,
} from '../memoryScan.js'

/**
 * Regression tests for issue #999: scanMemoryFiles must not flood the event
 * loop with unbounded concurrent fs reads when the memory directory is large.
 */
describe('scanMemoryFiles', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'memdir-scan-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('returns [] when the directory does not exist', async () => {
    const result = await scanMemoryFiles(
      join(dir, 'does-not-exist'),
      new AbortController().signal,
    )
    expect(result).toEqual([])
  })

  test('ignores MEMORY.md and non-.md files', async () => {
    await writeFile(join(dir, 'MEMORY.md'), '---\ndescription: index\n---\n')
    await writeFile(join(dir, 'notes.txt'), 'not markdown')
    await writeFile(
      join(dir, 'a.md'),
      '---\ndescription: alpha\ntype: user\n---\nbody\n',
    )
    const result = await scanMemoryFiles(dir, new AbortController().signal)
    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe('a.md')
    expect(result[0].description).toBe('alpha')
    expect(result[0].type).toBe('user')
  })

  test('sorts newest-first by mtime', async () => {
    const now = Date.now()
    const oldTime = new Date(now - 60_000)
    const newTime = new Date(now)
    await writeFile(join(dir, 'old.md'), '---\ndescription: old\n---\n')
    await writeFile(join(dir, 'new.md'), '---\ndescription: new\n---\n')
    await utimes(join(dir, 'old.md'), oldTime, oldTime)
    await utimes(join(dir, 'new.md'), newTime, newTime)

    const result = await scanMemoryFiles(dir, new AbortController().signal)
    expect(result.map(h => h.filename)).toEqual(['new.md', 'old.md'])
  })

  test('caps results at MAX_MEMORY_FILES (200)', async () => {
    const count = 250
    for (let i = 0; i < count; i++) {
      const name = `f${String(i).padStart(3, '0')}.md`
      await writeFile(
        join(dir, name),
        `---\ndescription: file ${i}\n---\nbody\n`,
      )
    }
    const result = await scanMemoryFiles(dir, new AbortController().signal)
    expect(result.length).toBe(200)
  })

  test('respects the SCAN_CONCURRENCY cap (no event-loop flooding)', async () => {
    // Instrument readFileInRange to observe peak concurrency.
    let active = 0
    let peak = 0

    const readFileInRangeMock = mock(async (..._args: unknown[]) => {
      active++
      if (active > peak) peak = active
      // Yield so other queued tasks can start (and so peak is observable).
      await new Promise(r => setTimeout(r, 0))
      try {
        return {
          content: '---\ndescription: mocked\n---\nbody\n',
          lineCount: 4,
          totalLines: 4,
          totalBytes: 40,
          readBytes: 40,
          mtimeMs: Date.now(),
        }
      } finally {
        active--
      }
    })

    mock.module('../../utils/readFileInRange.js', () => ({
      readFileInRange: readFileInRangeMock,
      FileTooLargeError: class extends Error {},
    }))

    try {
      // Import AFTER the mock is registered so memoryScan picks up the mock.
      const { scanMemoryFiles: scan } = await import('../memoryScan.js')

      const count = SCAN_CONCURRENCY * 4
      for (let i = 0; i < count; i++) {
        await writeFile(join(dir, `f${i}.md`), '---\ndescription: x\n---\n')
      }
      const result = await scan(dir, new AbortController().signal)
      expect(result.length).toBe(count)
      expect(peak).toBeLessThanOrEqual(SCAN_CONCURRENCY)
      expect(peak).toBeGreaterThan(1) // sanity: we did parallelize
    } finally {
      mock.restore()
    }
  })

  test('tolerates individual file read failures', async () => {
    // Instrument readFileInRange to fail on one file and succeed on another.
    const readFileInRangeMock = mock(async (filePath: string) => {
      if (filePath.endsWith('bad.md')) {
        throw new Error('simulated read failure')
      }
      return {
        content: '---\ndescription: good\n---\n',
        lineCount: 3,
        totalLines: 3,
        totalBytes: 30,
        readBytes: 30,
        mtimeMs: Date.now(),
      }
    })

    mock.module('../../utils/readFileInRange.js', () => ({
      readFileInRange: readFileInRangeMock,
      FileTooLargeError: class extends Error {},
    }))

    try {
      const { scanMemoryFiles: scan } = await import('../memoryScan.js')
      await writeFile(join(dir, 'good.md'), '---\ndescription: good\n---\n')
      await writeFile(join(dir, 'bad.md'), '---\ndescription: bad\n---\n')
      const result = await scan(dir, new AbortController().signal)
      // The failing file must be filtered out; the good file must survive.
      expect(result.map(h => h.filename)).not.toContain('bad.md')
      expect(result.map(h => h.filename)).toContain('good.md')
    } finally {
      mock.restore()
    }
  })

  test('aborts cleanly when the signal is already aborted', async () => {
    await writeFile(join(dir, 'a.md'), '---\ndescription: a\n---\n')
    const ctrl = new AbortController()
    ctrl.abort()
    const result = await scanMemoryFiles(dir, ctrl.signal)
    // Either empty (all reads rejected) or partial; must not throw.
    expect(Array.isArray(result)).toBe(true)
  })
})
