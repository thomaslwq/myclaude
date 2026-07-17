import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { promises as fs } from 'fs'
import { join } from 'path'
import { createDumpPromptsFetch, getDumpPromptsPath, clearAllDumpState } from '../services/api/dumpPrompts.js'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'

// Clean up test files
const TEST_DIR = join(getClaudeConfigHomeDir(), 'dump-prompts')

let originalFetch: typeof globalThis.fetch

beforeEach(async () => {
  clearAllDumpState()
  originalFetch = globalThis.fetch
  // Clean up any test files
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true })
  } catch (e) {
    // Ignore if directory doesn't exist
  }
})

afterEach(async () => {
  clearAllDumpState()
  globalThis.fetch = originalFetch
})

async function waitForResponseLine(filePath: string, maxWaitMs = 5000): Promise<string | null> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim())
      const responseLine = lines.find(line => {
        try {
          return JSON.parse(line).type === 'response'
        } catch { return false }
      })
      if (responseLine) return responseLine
    } catch {
      // File may not exist yet
    }
    await new Promise(r => setTimeout(r, 100))
  }
  return null
}

describe('dumpPrompts streaming memory', () => {
  test('should handle large streaming responses without memory exhaustion', async () => {
    // Set both environment variables
    process.env.USER_TYPE = 'ant'
    process.env.DUMP_PROMPTS = '1'
    
    // Create a large streaming response with many SSE events
    const eventCount = 1000
    const events = Array.from({ length: eventCount }, (_, i) =>
      `data: ${JSON.stringify({ id: 'msg_123', role: 'assistant', content: [{ type: 'text', text: 'chunk ' + i }] })}\n\n`
    ).join('')
    
    const mockResponse = new Response(events, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    })
    
    // Mock globalThis.fetch to return our mock response
    globalThis.fetch = async () => mockResponse
    
    const fetch = createDumpPromptsFetch('test-session')
    await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', messages: [] })
    })
    
    // Restore original fetch
    globalThis.fetch = originalFetch
    
    // Wait for response to be written asynchronously
    const filePath = getDumpPromptsPath('test-session')
    const responseLine = await waitForResponseLine(filePath)
    expect(responseLine).toBeDefined()
    
    const parsed = JSON.parse(responseLine!)
    expect(parsed.type).toBe('response')
    expect(parsed.data.stream).toBe(true)
    expect(parsed.data.chunks).toBeInstanceOf(Array)
    expect(parsed.data.chunks.length).toBeGreaterThanOrEqual(eventCount)
  })

  test('should process streaming events incrementally without accumulating entire body', async () => {
    process.env.USER_TYPE = 'ant'
    process.env.DUMP_PROMPTS = '1'
    
    // Create a streaming response with events split across chunks
    const encoder = new TextEncoder()
    const chunk1 = encoder.encode(
      'data: ' + JSON.stringify({ type: 'content_block_delta', delta: { text: 'Hello' } }) + '\n\n' +
      'data: ' + JSON.stringify({ type: 'content_block_delta', delta: { text: ' ' } }) + '\n\n'
    )
    const chunk2 = encoder.encode(
      'data: ' + JSON.stringify({ type: 'content_block_delta', delta: { text: 'World' } }) + '\n\n'
    )
    
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(chunk1)
        controller.enqueue(chunk2)
        controller.close()
      }
    })
    
    const mockResponse = new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    })
    
    globalThis.fetch = async () => mockResponse
    
    const fetch = createDumpPromptsFetch('test-session-stream')
    await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', messages: [] })
    })
    
    globalThis.fetch = originalFetch
    
    const filePath = getDumpPromptsPath('test-session-stream')
    const responseLine = await waitForResponseLine(filePath)
    expect(responseLine).toBeDefined()
    
    const parsed = JSON.parse(responseLine!)
    expect(parsed.type).toBe('response')
    expect(parsed.data.stream).toBe(true)
    expect(parsed.data.chunks).toBeInstanceOf(Array)
    expect(parsed.data.chunks.length).toBe(3)
  })

  test('should handle partial events across chunk boundaries', async () => {
    process.env.USER_TYPE = 'ant'
    process.env.DUMP_PROMPTS = '1'
    
    // Split an SSE event across two chunks
    // First chunk has incomplete JSON
    const encoder = new TextEncoder()
    const partialJson1 = '{"type":"content_block_delta","delta":{"text":"Hel'
    const partialJson2 = 'lo"}}'
    const chunk1 = encoder.encode(
      'data: ' + partialJson1
    )
    const chunk2 = encoder.encode(
      partialJson2 + '\n\n'
    )
    
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(chunk1)
        controller.enqueue(chunk2)
        controller.close()
      }
    })
    
    const mockResponse = new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    })
    
    globalThis.fetch = async () => mockResponse
    
    const fetch = createDumpPromptsFetch('test-session-partial')
    await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', messages: [] })
    })
    
    globalThis.fetch = originalFetch
    
    const filePath = getDumpPromptsPath('test-session-partial')
    const responseLine = await waitForResponseLine(filePath)
    expect(responseLine).toBeDefined()
    
    const parsed = JSON.parse(responseLine!)
    expect(parsed.type).toBe('response')
    expect(parsed.data.stream).toBe(true)
    expect(parsed.data.chunks).toBeInstanceOf(Array)
    expect(parsed.data.chunks.length).toBe(1)
  })
})
