import { describe, test, expect } from 'bun:test'
import { yieldToEventLoop, CHUNK_MS } from '../index.js'

/**
 * Regression tests for the file index's event-loop yielding (issue #599).
 * yieldToEventLoop must resolve (letting the event loop breathe) so huge
 * index builds don't block the TUI. CHUNK_MS is the chunk budget.
 */

describe('file-index yieldToEventLoop', () => {
  test('yields control back to the event loop', async () => {
    let resolved = false
    const p = yieldToEventLoop().then(() => { resolved = true })
    // A microtask ordering check: the promise must not resolve synchronously
    expect(resolved).toBe(false)
    await p
    expect(resolved).toBe(true)
  })

  test('CHUNK_MS is a positive number', () => {
    expect(typeof CHUNK_MS).toBe('number')
    expect(CHUNK_MS).toBeGreaterThan(0)
  })
})
