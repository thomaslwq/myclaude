import { describe, expect, test } from 'bun:test'
import { combineAbortSignals } from '../abortController.js'

describe('combineAbortSignals', () => {
  test('returns native AbortSignal.any when available', () => {
    if (typeof AbortSignal.any === 'function') {
      const a = new AbortController()
      const b = new AbortController()
      const combined = combineAbortSignals([a.signal, b.signal])
      expect(combined).toBeInstanceOf(AbortSignal)
    }
  })

  test('combined signal aborts when first signal aborts', () => {
    const a = new AbortController()
    const b = new AbortController()
    const combined = combineAbortSignals([a.signal, b.signal])

    let aborted = false
    combined.addEventListener('abort', () => { aborted = true })

    a.abort()
    expect(aborted).toBe(true)
    expect(combined.aborted).toBe(true)
  })

  test('combined signal aborts when second signal aborts', () => {
    const a = new AbortController()
    const b = new AbortController()
    const combined = combineAbortSignals([a.signal, b.signal])

    let aborted = false
    combined.addEventListener('abort', () => { aborted = true })

    b.abort()
    expect(aborted).toBe(true)
    expect(combined.aborted).toBe(true)
  })

  test('combined signal does not abort before any input aborts', () => {
    const a = new AbortController()
    const b = new AbortController()
    const combined = combineAbortSignals([a.signal, b.signal])
    expect(combined.aborted).toBe(false)
  })

  test('combined signal aborts immediately if any input is already aborted', () => {
    const a = new AbortController()
    a.abort()
    const b = new AbortController()
    const combined = combineAbortSignals([a.signal, b.signal])
    expect(combined.aborted).toBe(true)
  })
})
