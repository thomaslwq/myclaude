import { describe, test, expect } from 'bun:test'
import { sequential } from '../utils/sequential.js'

describe('sequential wrapper', () => {
  test('should preserve function signature with multiple arguments', async () => {
    const fn = async (
      entryOrSid: string | number,
      url: string,
      headers: Record<string, string>,
      isFetch = false,
    ) => {
      if (isFetch) {
        return ['entry1', 'entry2'] as string[]
      } else {
        return true
      }
    }

    const wrapped = sequential(fn)

    // Test with 4 arguments (append mode)
    const result1 = await wrapped('entry1', 'https://example.com', { 'Content-Type': 'application/json' }, false)
    expect(result1).toBe(true)

    // Test with 4 arguments (fetch mode)
    const result2 = await wrapped('sessionId', 'https://example.com', { Authorization: 'Bearer token' }, true)
    expect(result2).toEqual(['entry1', 'entry2'])

    // Test with 3 arguments (default isFetch = false)
    const result3 = await wrapped('entry2', 'https://example.com', { 'Content-Type': 'application/json' })
    expect(result3).toBe(true)
  })

  test('should execute calls sequentially', async () => {
    const executionOrder: number[] = []

    const fn = async (id: number, delay: number) => {
      await new Promise(resolve => setTimeout(resolve, delay))
      executionOrder.push(id)
      return id
    }

    const wrapped = sequential(fn)

    const promises = [
      wrapped(1, 30),
      wrapped(2, 10),
      wrapped(3, 0),
    ]

    const results = await Promise.all(promises)
    expect(results).toEqual([1, 2, 3])
    // Should execute in order, regardless of delay
    expect(executionOrder).toEqual([1, 2, 3])
  })

  test('should work with the exact signature used in sessionIngress.ts', async () => {
    // Simulate the exact usage pattern from sessionIngress.ts
    const fn = async (
      entryOrSid: string | { type: string; content: string },
      url: string,
      headers: Record<string, string>,
      isFetch = false,
    ) => {
      if (isFetch) {
        const sid = entryOrSid as string
        return [{ uuid: sid, message: 'test' }]
      } else {
        const entry = entryOrSid as { type: string; content: string }
        return !!entry
      }
    }

    const wrapped = sequential(fn)

    // Fetch mode
    const fetchResult = await wrapped('session-123', 'https://api.example.com/session', { Authorization: 'Bearer token' }, true)
    expect(fetchResult).toEqual([{ uuid: 'session-123', message: 'test' }])

    // Append mode
    const appendResult = await wrapped({ type: 'text', content: 'hello' }, 'https://api.example.com/session', { Authorization: 'Bearer token' }, false)
    expect(appendResult).toBe(true)

    // Append mode with default isFetch
    const appendResult2 = await wrapped({ type: 'text', content: 'world' }, 'https://api.example.com/session', { Authorization: 'Bearer token' })
    expect(appendResult2).toBe(true)
  })
})
