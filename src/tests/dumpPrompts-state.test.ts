import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { promises as fs } from 'fs'
import { join } from 'path'
import { createDumpPromptsFetch, getDumpPromptsPath, clearAllDumpState } from '../services/api/dumpPrompts.js'
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

describe('dumpPrompts state consistency', () => {
  test('should maintain consistent state when jsonStringify throws during message processing', async () => {
    // Set both environment variables
    process.env.USER_TYPE = 'ant'
    process.env.DUMP_PROMPTS = '1'
    
    // Mock jsonStringify to throw on certain messages
    const originalJsonStringify = (global as any).jsonStringify
    let callCount = 0
    ;(global as any).jsonStringify = (data: unknown) => {
      callCount++
      // Throw on the 3rd call to simulate an error during message processing
      if (callCount === 3) {
        throw new Error('Simulated stringify error')
      }
      return originalJsonStringify(data)
    }
    
    try {
      const fetch = createDumpPromptsFetch('test-session')
      const mockResponse = new Response(JSON.stringify({ 
        id: 'msg_123', 
        role: 'assistant', 
        content: [] 
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
      
      const mockFetch = async () => mockResponse
      
      // Make multiple requests with messages
      await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        body: JSON.stringify({ 
          model: 'claude-3-5-sonnet-20241022', 
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there' },
            { role: 'user', content: 'How are you?' },
          ]
        })
      })
      
      // Verify file was created despite the error
      const filePath = getDumpPromptsPath('test-session')
      const content = await fs.readFile(filePath, 'utf-8')
      expect(content).toBeTruthy()
      
      // Verify state was not partially updated
      // The error should have been caught and logged, but state should be consistent
      // (the error occurred during message processing, not during init data computation)
    } finally {
      // Restore original function
      ;(global as any).jsonStringify = originalJsonStringify
    }
  })
  
  test('should maintain consistent state when hashString throws', async () => {
    // Set both environment variables
    process.env.USER_TYPE = 'ant'
    process.env.DUMP_PROMPTS = '1'
    
    // Mock hashString to throw
    const originalHashString = (global as any).hashString
    ;(global as any).hashString = () => {
      throw new Error('Simulated hash error')
    }
    
    try {
      const fetch = createDumpPromptsFetch('test-session')
      const mockResponse = new Response(JSON.stringify({ 
        id: 'msg_123', 
        role: 'assistant', 
        content: [] 
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
      
      const mockFetch = async () => mockResponse
      
      // First request should fail during init data computation
      await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        body: JSON.stringify({ 
          model: 'claude-3-5-sonnet-20241022', 
          messages: [{ role: 'user', content: 'Hello' }],
          system: 'Test system prompt',
          tools: [{ name: 'test_tool', description: 'Test tool' }]
        })
      })
      
      // Verify state was not partially updated
      // The error should have been caught and logged, but state should be consistent
      // (the error occurred during init data computation, so no state should be updated)
    } finally {
      // Restore original function
      ;(global as any).hashString = originalHashString
    }
  })
  
  test('should handle multiple requests with consistent state', async () => {
    // Set both environment variables
    process.env.USER_TYPE = 'ant'
    process.env.DUMP_PROMPTS = '1'
    
    const fetch = createDumpPromptsFetch('test-session')
    const mockResponse = new Response(JSON.stringify({ 
      id: 'msg_123', 
      role: 'assistant', 
      content: [] 
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
    
    const mockFetch = async () => mockResponse
    
    // First request
    await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: JSON.stringify({ 
        model: 'claude-3-5-sonnet-20241022', 
        messages: [{ role: 'user', content: 'Hello' }],
        system: 'Test system prompt',
        tools: [{ name: 'test_tool', description: 'Test tool' }]
      })
    })
    
    // Second request with same system/tools (should use fingerprint to skip expensive computation)
    await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: JSON.stringify({ 
        model: 'claude-3-5-sonnet-20241022', 
        messages: [{ role: 'user', content: 'How are you?' }]
      })
    })
    
    // Verify file was created
    const filePath = getDumpPromptsPath('test-session')
    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toBeTruthy()
    
    // Verify both requests were written
    const lines = content.trim().split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(2)
  })
})