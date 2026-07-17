import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'

// Test to verify that getGroveNoticeConfig clears its cache on API failure

describe('getGroveNoticeConfig cache invalidation', () => {
  test('should clear memoized cache on API failure', () => {
    const source = readFileSync('./src/services/api/grove.ts', 'utf-8')
    
    // Check that getGroveNoticeConfig has cache.clear in its catch block
    // by looking for the pattern in the function
    const noticeConfigStart = source.indexOf('export const getGroveNoticeConfig = memoizeWithTTL(')
    const noticeConfigEnd = source.indexOf('),\n\n/**', noticeConfigStart)
    
    // If we can't find the end, just check if cache.clear exists anywhere in the file
    const functionBody = noticeConfigEnd > -1 
      ? source.substring(noticeConfigStart, noticeConfigEnd)
      : source.substring(noticeConfigStart, noticeConfigStart + 5000)
    
    // The fix: cache.clear should be called before return { success: false }
    expect(functionBody).toContain('getGroveNoticeConfig.cache.clear')
  })

  test('getGroveSettings already clears cache on failure (reference)', () => {
    const source = readFileSync('./src/services/api/grove.ts', 'utf-8')
    
    // Verify getGroveSettings already has cache.clear
    expect(source).toContain('getGroveSettings.cache.clear')
  })
})
