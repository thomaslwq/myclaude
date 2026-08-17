/**
 * Tests for the LLM fetch retry helper (.github/scripts/llm-retry.mjs)
 *
 * TDD: Red-Green-Refactor
 * Retries LLM API calls with exponential backoff on retryable errors
 * (HTTP 429 rate-limit / 5xx / network errors) so sensenova's rate
 * limiting (rpm exhausted, temporarily overloaded) doesn't immediately
 * trigger the fallback model.
 */
import { describe, test, expect } from 'bun:test'
import { fetchWithRetry } from '../../.github/scripts/llm-retry.mjs'

const ok = () => new Response('ok', { status: 200 })
const err = (status: number, body = '{"error":"boom"}') => new Response(body, { status })

describe('fetchWithRetry', () => {
  test('returns response on first successful call', async () => {
    const calls: number[] = []
    const fetchFn = async () => { calls.push(1); return ok() }
    const res = await fetchWithRetry('https://x/v1/chat/completions', { method: 'POST' }, { fetchFn, baseDelayMs: 1 })
    expect(res.status).toBe(200)
    expect(calls.length).toBe(1)
  })

  test('retries on 429 then succeeds', async () => {
    let n = 0
    const fetchFn = async () => {
      n++
      return n < 3 ? err(429, '{"error":{"code":"8","message":"rpm exhausted"}}') : ok()
    }
    const retries: number[] = []
    const res = await fetchWithRetry('https://x/v1/chat/completions', {}, {
      fetchFn,
      baseDelayMs: 1,
      onRetry: (r) => retries.push(r.attempt),
    })
    expect(res.status).toBe(200)
    expect(n).toBe(3)
    expect(retries).toEqual([1, 2])
  })

  test('throws after maxRetries on persistent 429', async () => {
    const fetchFn = async () => err(429)
    await expect(
      fetchWithRetry('https://x', {}, { fetchFn, maxRetries: 2, baseDelayMs: 1 })
    ).rejects.toThrow(/LLM API error \(429\)/)
  })

  test('does not retry non-retryable status (400)', async () => {
    let n = 0
    const fetchFn = async () => {
      n++
      return err(400, '{"error":{"message":"field MaxTokens invalid"}}')
    }
    await expect(
      fetchWithRetry('https://x', {}, { fetchFn, maxRetries: 3, baseDelayMs: 1 })
    ).rejects.toThrow(/field MaxTokens invalid/)
    expect(n).toBe(1)
  })

  test('retries on 503 then succeeds', async () => {
    let n = 0
    const fetchFn = async () => { n++; return n === 1 ? err(503) : ok() }
    const res = await fetchWithRetry('https://x', {}, { fetchFn, baseDelayMs: 1 })
    expect(res.status).toBe(200)
    expect(n).toBe(2)
  })

  test('retries network errors (fetch rejects)', async () => {
    let n = 0
    const fetchFn = async () => {
      n++
      if (n === 1) throw new Error('ECONNRESET')
      return ok()
    }
    const res = await fetchWithRetry('https://x', {}, { fetchFn, baseDelayMs: 1 })
    expect(res.status).toBe(200)
    expect(n).toBe(2)
  })

  test('maxRetries 0 means no retry', async () => {
    let n = 0
    const fetchFn = async () => { n++; return err(429) }
    await expect(
      fetchWithRetry('https://x', {}, { fetchFn, maxRetries: 0, baseDelayMs: 1 })
    ).rejects.toThrow(/LLM API error \(429\)/)
    expect(n).toBe(1)
  })
})
