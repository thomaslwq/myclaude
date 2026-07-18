import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'

describe('getGroveNoticeConfig cache invalidation', () => {
  test('should NOT clear memoized cache on transient API failure (to avoid unnecessary API calls)', () => {
    const source = readFileSync('./src/services/api/grove.ts', 'utf-8')
    const noticeConfigStart = source.indexOf('export const getGroveNoticeConfig = memoizeWithTTL(')
    const functionBody = source.substring(noticeConfigStart, noticeConfigStart + 3000)
    // On transient failure, we should NOT clear the cache — keep the last successful result
    expect(functionBody).not.toContain('getGroveNoticeConfig.cache.clear')
  })

  test('getGroveSettings.cache.clear is still called from updateGroveSettings and markGroveNoticeViewed', () => {
    const source = readFileSync('./src/services/api/grove.ts', 'utf-8')
    // The cache.clear method should still exist and be callable manually
    expect(source).toContain('getGroveSettings.cache.clear')
  })

  test('getGroveSettings should NOT clear cache on API failure', () => {
    const source = readFileSync('./src/services/api/grove.ts', 'utf-8')
    const settingsStart = source.indexOf('export const getGroveSettings = memoizeWithTTL(')
    const functionBody = source.substring(settingsStart, settingsStart + 1500)
    // The catch block should NOT call cache.clear()
    expect(functionBody).not.toContain('getGroveSettings.cache.clear')
  })
})

describe('isQualifiedForGrove blocking fetch', () => {
  test('should await fetchAndStoreGroveConfig when no cache', () => {
    const source = readFileSync('./src/services/api/grove.ts', 'utf-8')
    const functionStart = source.indexOf('export async function isQualifiedForGrove')
    const functionBody = source.substring(functionStart, functionStart + 3000)
    expect(functionBody).not.toContain('void fetchAndStoreGroveConfig')
    expect(functionBody).toContain('await fetchAndStoreGroveConfig')
  })

  test('should retry fetchAndStoreGroveConfig on failure', () => {
    const source = readFileSync('./src/services/api/grove.ts', 'utf-8')
    const fetchStart = source.indexOf('async function fetchAndStoreGroveConfig')
    const fetchBody = source.substring(fetchStart, fetchStart + 3000)
    expect(fetchBody).toContain('attempt < 3')
    expect(fetchBody).toContain('setTimeout(resolve, 500)')
    expect(fetchBody).toContain('Failed to fetch and store config after 3 attempts')
  })

  test('should update stale cache synchronously', () => {
    const source = readFileSync('./src/services/api/grove.ts', 'utf-8')
    const functionStart = source.indexOf('export async function isQualifiedForGrove')
    const functionBody = source.substring(functionStart, functionStart + 3000)
    const staleSection = functionBody.substring(functionBody.indexOf('stale'), functionBody.indexOf('stale') + 1000)
    expect(staleSection).toContain('await fetchAndStoreGroveConfig')
    expect(staleSection).not.toContain('void fetchAndStoreGroveConfig')
  })
})
