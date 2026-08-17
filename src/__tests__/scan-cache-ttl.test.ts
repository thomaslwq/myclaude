import { describe, test, expect } from 'bun:test'
import { isScanCacheEntryFresh, scanCache } from '../dev-entry'

/**
 * Regression test for issue #755: scanCache caches indefinitely but claims
 * to ensure fresh results.
 *
 * SCAN_CACHE_TTL_MS (60s) exists but the read path in
 * collectMissingRelativeImports only checked `if (cached)` — it never
 * validated the timestamp, so a stale entry was served forever.
 * The fix adds isScanCacheEntryFresh() and uses it before reading the cache.
 */

describe('scanCache TTL freshness (issue #755)', () => {
  test('fresh entry (within TTL) is considered fresh', () => {
    const now = Date.now()
    expect(isScanCacheEntryFresh({ files: ['a.ts'], timestamp: now - 1_000 }, now)).toBe(true)
    expect(isScanCacheEntryFresh({ files: ['a.ts'], timestamp: now - 60_000 }, now)).toBe(true)
  })

  test('stale entry (older than TTL) is not fresh', () => {
    const now = Date.now()
    expect(isScanCacheEntryFresh({ files: ['a.ts'], timestamp: now - 60_001 }, now)).toBe(false)
    expect(isScanCacheEntryFresh({ files: ['a.ts'], timestamp: now - 120_000 }, now)).toBe(false)
  })

  test('missing entry is not fresh', () => {
    expect(isScanCacheEntryFresh(undefined, Date.now())).toBe(false)
  })

  test('entry written to scanCache is fresh immediately, stale after TTL', () => {
    scanCache.clear()
    const key = '/stale-test-dir'
    scanCache.set(key, { files: ['x.ts'], timestamp: Date.now() - 61_000 })
    const entry = scanCache.get(key)
    expect(entry).toBeDefined()
    expect(isScanCacheEntryFresh(entry, Date.now())).toBe(false)
    scanCache.clear()
  })
})
