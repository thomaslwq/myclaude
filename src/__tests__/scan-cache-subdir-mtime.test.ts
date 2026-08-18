import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdir, rm, writeFile, utimes } from 'fs/promises'
import { join } from 'path'
import { isScanCacheEntryFresh, scanCache, computeDirMtimeSignature } from '../dev-entry'

/**
 * Regression test for issue #852: Directory mtime-based cache invalidation
 * misses file content changes in subdirectories.
 *
 * The previous implementation only checked the top-level `src/` directory's
 * mtime. A directory's mtime only changes when entries are directly added or
 * removed in that directory — not when files in subdirectories are modified,
 * added, or deleted. Since scanFiles recurses into subdirectories, modifying
 * a file in `src/utils/foo.ts` does not change `src/`'s mtime.
 *
 * The fix uses a recursive mtime signature that collects mtimes of ALL
 * subdirectories, so any change in any subdirectory invalidates the cache.
 */
describe('scanCache subdirectory mtime invalidation (issue #852)', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = join(process.cwd(), '.test-tmp', `scan-subdir-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(join(tmpDir, 'utils'), { recursive: true })
    await mkdir(join(tmpDir, 'utils', 'deep'), { recursive: true })
    await writeFile(join(tmpDir, 'utils', 'existing.ts'), 'export const x = 1')
    await writeFile(join(tmpDir, 'utils', 'deep', 'nested.ts'), 'export const z = 3')
    scanCache.clear()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    scanCache.clear()
  })

  test('isScanCacheEntryFresh invalidates when mtimeSignature differs (string-based)', () => {
    const now = Date.now()
    const entry = { files: ['a.ts'], timestamp: now - 1_000, mtimeSignature: 'sig-abc' }
    // Same signature -> fresh
    expect(isScanCacheEntryFresh(entry, now, 'sig-abc')).toBe(true)
    // Different signature -> stale
    expect(isScanCacheEntryFresh(entry, now, 'sig-xyz')).toBe(false)
  })

  test('isScanCacheEntryFresh falls back to TTL-only when no signature', () => {
    const now = Date.now()
    const entry = { files: ['a.ts'], timestamp: now - 1_000 }
    // No currentMtimeSignature provided -> TTL only
    expect(isScanCacheEntryFresh(entry, now)).toBe(true)
    // currentMtimeSignature provided but entry has no signature -> TTL only
    expect(isScanCacheEntryFresh(entry, now, 'sig-xyz')).toBe(true)
  })

  test('computeDirMtimeSignature returns a defined string', async () => {
    const sig = await computeDirMtimeSignature(tmpDir)
    expect(sig).toBeDefined()
    expect(typeof sig).toBe('string')
    expect(sig!.length).toBeGreaterThan(0)
  })

  test('signature changes when file is added to a subdirectory', async () => {
    const sig1 = await computeDirMtimeSignature(tmpDir)
    expect(sig1).toBeDefined()

    // Add a new file in the subdirectory — this changes the subdirectory's mtime
    // but NOT the parent directory's mtime (the bug from issue #852)
    const newPath = join(tmpDir, 'utils', 'new-file.ts')
    await writeFile(newPath, 'export const y = 2')
    // Explicitly bump the subdirectory mtime to avoid same-ms resolution issues
    const future = new Date(Date.now() + 5000)
    await utimes(join(tmpDir, 'utils'), future, future)

    const sig2 = await computeDirMtimeSignature(tmpDir)
    expect(sig2).toBeDefined()
    expect(sig2).not.toBe(sig1)
  })

  test('signature changes when file is added to a deeply nested subdirectory', async () => {
    const sig1 = await computeDirMtimeSignature(tmpDir)
    expect(sig1).toBeDefined()

    // Add a new file in a deeply nested subdirectory
    const newPath = join(tmpDir, 'utils', 'deep', 'new-nested.ts')
    await writeFile(newPath, 'export const w = 4')
    const future = new Date(Date.now() + 5000)
    await utimes(join(tmpDir, 'utils', 'deep'), future, future)

    const sig2 = await computeDirMtimeSignature(tmpDir)
    expect(sig2).toBeDefined()
    expect(sig2).not.toBe(sig1)
  })

  test('signature is stable when no changes occur', async () => {
    const sig1 = await computeDirMtimeSignature(tmpDir)
    const sig2 = await computeDirMtimeSignature(tmpDir)
    expect(sig1).toBe(sig2)
  })

  test('cache entry with old signature is stale after subdirectory change', async () => {
    const sig1 = await computeDirMtimeSignature(tmpDir)
    const entry = { files: ['a.ts'], timestamp: Date.now(), mtimeSignature: sig1 }
    expect(isScanCacheEntryFresh(entry, Date.now(), sig1)).toBe(true)

    // Add a file to subdirectory and bump mtime
    await writeFile(join(tmpDir, 'utils', 'new-file.ts'), 'export const y = 2')
    const future = new Date(Date.now() + 5000)
    await utimes(join(tmpDir, 'utils'), future, future)

    const sig2 = await computeDirMtimeSignature(tmpDir)
    expect(isScanCacheEntryFresh(entry, Date.now(), sig2)).toBe(false)
  })
})
