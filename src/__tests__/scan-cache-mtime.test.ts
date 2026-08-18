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
 * The fix adds mtime-based invalidation: the cache entry stores an mtime
 * signature at scan time, and isScanCacheEntryFresh compares it against the
 * current mtime signature. If they differ, the entry is stale.
 *
 * Issue #852 extended this to use a recursive mtime signature covering all
 * subdirectories, since a top-level directory's mtime does not change when
 * files in subdirectories are modified.
 */
describe('scanCache mtime invalidation (issue #824)', () => {
  test('entry with different mtimeSignature is stale even within TTL', () => {
    const now = Date.now()
    const entry = { files: ['a.ts'], timestamp: now - 1_000, mtimeSignature: 'sig-1000' }
    // Same signature -> fresh
    expect(isScanCacheEntryFresh(entry, now, 'sig-1000')).toBe(true)
    // Different signature -> stale (file added/deleted)
    expect(isScanCacheEntryFresh(entry, now, 'sig-2000')).toBe(false)
  })

  test('entry without mtimeSignature falls back to TTL-only check', () => {
    const now = Date.now()
    const entry = { files: ['a.ts'], timestamp: now - 1_000 }
    // No currentMtimeSignature provided -> TTL only
    expect(isScanCacheEntryFresh(entry, now)).toBe(true)
    // currentMtimeSignature provided but entry has no signature -> TTL only
    expect(isScanCacheEntryFresh(entry, now, 'sig-9999')).toBe(true)
  })

  test('entry with mtimeSignature fresh within TTL and same signature', () => {
    const now = Date.now()
    const entry = { files: ['a.ts'], timestamp: now - 30_000, mtimeSignature: 'sig-5000' }
    expect(isScanCacheEntryFresh(entry, now, 'sig-5000')).toBe(true)
  })

  test('entry with mtimeSignature stale after TTL even with same signature', () => {
    const now = Date.now()
    const entry = { files: ['a.ts'], timestamp: now - 61_000, mtimeSignature: 'sig-5000' }
    expect(isScanCacheEntryFresh(entry, now, 'sig-5000')).toBe(false)
  })
})
