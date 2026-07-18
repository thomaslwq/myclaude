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

describe('dumpPrompts security', () => {
  test('should NOT write to disk when USER_TYPE is not ant', async () => {
    // Set USER_TYPE to something other than 'ant'
    process.env.USER_TYPE = 'user'
    
    const fetch = createDumpPromptsFetch('test-session')
    const mockResponse = new Response(JSON.stringify({ id: 'msg_123', role: 'assistant', content: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
    
    // Mock the actual fetch to return our mock response
    const mockFetch = async () => mockResponse
    
    await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', messages: [] })
    })
    
    // Verify no file was created
    const filePath = getDumpPromptsPath('test-session')
    try {
      await fs.access(filePath)
      expect.fail('File should not exist when USER_TYPE is not ant')
    } catch (e) {
      expect(e.code).toBe('ENOENT')
    }
  })

  test('should NOT write to disk when USER_TYPE is ant but DUMP_PROMPTS is not set', async () => {
    // Set USER_TYPE to 'ant' but DUMP_PROMPTS is not set
    process.env.USER_TYPE = 'ant'
    delete process.env.DUMP_PROMPTS
    
    const fetch = createDumpPromptsFetch('test-session')
    const mockResponse = new Response(JSON.stringify({ id: 'msg_123', role: 'assistant', content: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
    
    const mockFetch = async () => mockResponse
    await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', messages: [] })
    })
    
    // Verify no file was created
    const filePath = getDumpPromptsPath('test-session')
    try {
      await fs.access(filePath)
      expect.fail('File should not exist when DUMP_PROMPTS is not set')
    } catch (e) {
      expect(e.code).toBe('ENOENT')
    }
  })

  test('should write to disk when both USER_TYPE=ant and DUMP_PROMPTS=1', async () => {
    // Set both environment variables
    process.env.USER_TYPE = 'ant'
    process.env.DUMP_PROMPTS = '1'
    
    const fetch = createDumpPromptsFetch('test-session')
    const mockResponse = new Response(JSON.stringify({ id: 'msg_123', role: 'assistant', content: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
    
    const mockFetch = async () => mockResponse
    await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', messages: [] })
    })
    
    // Verify file was created
    const filePath = getDumpPromptsPath('test-session')
    await fs.access(filePath)
    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toContain('init')
  })

  test('should NOT write to disk when DUMP_PROMPTS=0', async () => {
    // Set USER_TYPE to 'ant' but DUMP_PROMPTS is explicitly set to 0
    process.env.USER_TYPE = 'ant'
    process.env.DUMP_PROMPTS = '0'
    
    const fetch = createDumpPromptsFetch('test-session')
    const mockResponse = new Response(JSON.stringify({ id: 'msg_123', role: 'assistant', content: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
    
    const mockFetch = async () => mockResponse
    await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', messages: [] })
    })
    
    // Verify no file was created
    const filePath = getDumpPromptsPath('test-session')
    try {
      await fs.access(filePath)
      expect.fail('File should not exist when DUMP_PROMPTS=0')
    } catch (e) {
      expect(e.code).toBe('ENOENT')
    }
  })

  test('should NOT write to disk when NODE_ENV=production even if env vars are set', async () => {
    // Set NODE_ENV to production
    process.env.NODE_ENV = 'production'
    process.env.USER_TYPE = 'ant'
    process.env.DUMP_PROMPTS = '1'
    
    const fetch = createDumpPromptsFetch('test-session')
    const mockResponse = new Response(JSON.stringify({ id: 'msg_123', role: 'assistant', content: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
    
    const mockFetch = async () => mockResponse
    await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', messages: [] })
    })
    
    // Verify no file was created
    const filePath = getDumpPromptsPath('test-session')
    try {
      await fs.access(filePath)
      expect.fail('File should not exist when NODE_ENV=production')
    } catch (e) {
      expect(e.code).toBe('ENOENT')
    }
    
    // Clean up
    delete process.env.NODE_ENV
  })
})
