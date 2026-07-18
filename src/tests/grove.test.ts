import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'

describe('getGroveNoticeConfig cache invalidation', () => {
  test('should clear memoized cache on API failure', () => {
    const source = readFileSync('./src/services/api/grove.ts', 'utf-8')
    const noticeConfigStart = source.indexOf('export const getGroveNoticeConfig = memoizeWithTTL(')
    const functionBody = source.substring(noticeConfigStart, noticeConfigStart + 3000)
    expect(functionBody).toContain('getGroveNoticeConfig.cache.clear')
  })

  test('getGroveSettings already clears cache on failure (reference)', () => {
    const source = readFileSync('./src/services/api/grove.ts', 'utf-8')
    expect(source).toContain('getGroveSettings.cache.clear')
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
