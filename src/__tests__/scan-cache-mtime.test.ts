import { describe, test, expect } from 'bun:test'
import { isScanCacheEntryFresh, scanCache } from '../dev-entry'

/**
 * Regression test for issue #824: scanCache returns stale file lists for up to
 * 60 seconds after filesystem changes.
 *
 * Unlike fileContentCache which uses mtime to invalidate individual file
 * entries, scanCache only used a time-based TTL. If files are added or deleted
 * within the 60-second window, the cache returned a stale file list.
 *
 * The fix adds mtime-based invalidation: the cache entry stores the directory
 * mtime at scan time, and isScanCacheEntryFresh compares it against the
 * current directory mtime. If they differ, the entry is stale.
 */
describe('scanCache mtime invalidation (issue #824)', () => {
  test('entry with different mtime is stale even within TTL', () => {
    const now = Date.now()
    const entry = { files: ['a.ts'], timestamp: now - 1_000, mtime: 1000 }
    // Same mtime -> fresh
    expect(isScanCacheEntryFresh(entry, now, 1000)).toBe(true)
    // Different mtime -> stale (file added/deleted)
    expect(isScanCacheEntryFresh(entry, now, 2000)).toBe(false)
  })

  test('entry without mtime falls back to TTL-only check', () => {
    const now = Date.now()
    const entry = { files: ['a.ts'], timestamp: now - 1_000 }
    // No currentMtime provided -> TTL only
    expect(isScanCacheEntryFresh(entry, now)).toBe(true)
    // currentMtime provided but entry has no mtime -> TTL only
    expect(isScanCacheEntryFresh(entry, now, 9999)).toBe(true)
  })

  test('entry with mtime fresh within TTL and same mtime', () => {
    const now = Date.now()
    const entry = { files: ['a.ts'], timestamp: now - 30_000, mtime: 5000 }
    expect(isScanCacheEntryFresh(entry, now, 5000)).toBe(true)
  })

  test('entry with mtime stale after TTL even with same mtime', () => {
    const now = Date.now()
    const entry = { files: ['a.ts'], timestamp: now - 61_000, mtime: 5000 }
    expect(isScanCacheEntryFresh(entry, now, 5000)).toBe(false)
  })
})
