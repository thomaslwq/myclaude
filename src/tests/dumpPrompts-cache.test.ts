import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { promises as fs } from 'fs'
import { join } from 'path'
import { createDumpPromptsFetch, getDumpPromptsPath, clearAllDumpState, addApiRequestToCache, getLastApiRequests, clearApiRequestCache } from '../services/api/dumpPrompts.js'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'

// Clean up test files
const TEST_DIR = join(getClaudeConfigHomeDir(), 'dump-prompts')

beforeEach(async () => {
  clearAllDumpState()
  // Clean up any test files
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true })
  } catch (e) {
    // Ignore if directory doesn't exist
  }
})

afterEach(async () => {
  clearAllDumpState()
})

describe('dumpPrompts cache security', () => {
  test('should NOT cache full request data including sensitive prompts', async () => {
    // Set both environment variables to enable dumping
    process.env.USER_TYPE = 'ant'
    process.env.DUMP_PROMPTS = '1'
    
    // Create a sensitive request with user prompts
    const sensitiveRequest = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        { role: 'user', content: 'This is a sensitive user prompt that should not be cached in memory' },
        { role: 'user', content: 'Another secret message' }
      ],
      system: 'You are a helpful assistant with access to sensitive data.'
    }
    
    // Add the request to cache
    addApiRequestToCache(sensitiveRequest)
    
    // Get cached requests
    const cached = getLastApiRequests()
    
    // Verify that sensitive data is NOT in the cache
    expect(cached.length).toBeGreaterThan(0)
    
    // Check that the cached request does NOT contain the sensitive prompts
    const cachedRequest = cached[0].request as any
    expect(cachedRequest.messages).toBeUndefined()
    expect(cachedRequest.system).toBeUndefined()
    expect(cachedRequest.content).toBeUndefined()
    
    // Verify that only metadata is stored (model name, hash)
    expect(cachedRequest.model).toBe('claude-3-5-sonnet-20241022')
    expect(cachedRequest.requestHash).toBeDefined()
    expect(cached[0].timestamp).toBeDefined()
  })
  
  test('should clear cache when clearApiRequestCache is called', async () => {
    process.env.USER_TYPE = 'ant'
    process.env.DUMP_PROMPTS = '1'
    
    const sensitiveRequest = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: 'Secret message' }]
    }
    
    addApiRequestToCache(sensitiveRequest)
    expect(getLastApiRequests().length).toBeGreaterThan(0)
    
    clearApiRequestCache()
    expect(getLastApiRequests().length).toBe(0)
  })
})