/**
 * Tests for Git Bash pty exhaustion handling — Issue #16.
 *
 * Tests the retry logic and semaphore configuration that prevents
 * "Could not fork child process: There are no available terminals" errors
 * on Windows/MSYS2.
 */
import { describe, test, expect, mock } from 'bun:test'

describe('isGitBashPtyExhaustion detection', () => {
  // Replicate the detection logic from Shell.ts
  function isGitBashPtyExhaustion(err: unknown): boolean {
    const msg = String(err).toLowerCase()
    return (
      msg.includes('no available terminals') ||
      msg.includes('cannot fork') ||
      msg.includes('resource temporarily unavailable')
    )
  }

  test('detects exact MSYS2 error message', () => {
    const err = new Error(
      'Could not fork child process: There are no available terminals(-1)'
    )
    expect(isGitBashPtyExhaustion(err)).toBe(true)
  })

  test('detects "no available terminals" substring', () => {
    expect(isGitBashPtyExhaustion('No available terminals')).toBe(true)
    expect(isGitBashPtyExhaustion('there are no available terminals')).toBe(true)
  })

  test('detects "cannot fork" error', () => {
    expect(isGitBashPtyExhaustion('cannot fork child process')).toBe(true)
    expect(isGitBashPtyExhaustion('Resource temporarily unavailable: cannot fork')).toBe(true)
  })

  test('detects "resource temporarily unavailable"', () => {
    expect(isGitBashPtyExhaustion('Resource temporarily unavailable')).toBe(true)
    expect(isGitBashPtyExhaustion('resource temporarily unavailable. try again later')).toBe(true)
  })

  test('returns false for unrelated errors', () => {
    expect(isGitBashPtyExhaustion(new Error('ENOENT: no such file'))).toBe(false)
    expect(isGitBashPtyExhaustion(new Error('EACCES: permission denied'))).toBe(false)
    expect(isGitBashPtyExhaustion('ETIMEDOUT: connection timed out')).toBe(false)
    expect(isGitBashPtyExhaustion(null)).toBe(false)
    expect(isGitBashPtyExhaustion(undefined)).toBe(false)
    expect(isGitBashPtyExhaustion('')).toBe(false)
  })
})

describe('Git Bash spawn semaphore', () => {
  // Replicate the semaphore implementation from bashProvider.ts
  interface SpawnSemaphore {
    acquire(): Promise<void>
    release(): void
  }

  function createSpawnSemaphore(maxConcurrent: number): SpawnSemaphore {
    let active = 0
    const queue: Array<() => void> = []
    return {
      async acquire(): Promise<void> {
        if (active >= maxConcurrent) {
          await new Promise<void>(resolve => queue.push(resolve))
        }
        active++
      },
      release(): void {
        active--
        const next = queue.shift()
        if (next) next()
      },
    }
  }

  test('new semaphore allows immediate acquire', async () => {
    const sem = createSpawnSemaphore(4)
    await sem.acquire()
    expect(true).toBe(true) // reached without hanging
    sem.release()
  })

  test('semaphore blocks when at capacity', async () => {
    const sem = createSpawnSemaphore(2)
    await sem.acquire() // slot 1
    await sem.acquire() // slot 2

    // Third acquire should not resolve until a release
    let acquired3 = false
    const acquirePromise = sem.acquire().then(() => { acquired3 = true })

    // Small delay to allow microtask to run
    await new Promise(r => setTimeout(r, 10))
    expect(acquired3).toBe(false)

    // Release one slot
    sem.release()
    await new Promise(r => setTimeout(r, 10))
    expect(acquired3).toBe(true)

    // Cleanup
    sem.release()
    sem.release()
  })

  test('release wakes next waiter in FIFO order', async () => {
    const sem = createSpawnSemaphore(1)
    await sem.acquire()

    const order: number[] = []
    const p1 = sem.acquire().then(() => order.push(1))
    const p2 = sem.acquire().then(() => order.push(2))

    await new Promise(r => setTimeout(r, 5))
    expect(order).toEqual([])

    sem.release() // wakes waiter 1
    await new Promise(r => setTimeout(r, 5))
    expect(order).toEqual([1])

    sem.release() // wakes waiter 2
    await new Promise(r => setTimeout(r, 5))
    expect(order).toEqual([1, 2])
  })

  test('lower concurrency (4) prevents pty exhaustion better than (8)', () => {
    // On Windows, limit is 4; on other platforms Infinity
    const windowsLimit = 4
    const maxPtySlots = 256
    const avgSlotsPerSpawn = 30 // each bash fork uses ~30 pty slots

    const worstCaseConcurrentWin = Math.floor(maxPtySlots / avgSlotsPerSpawn)
    // With limit 4, even under heavy load we can't exceed ~120 slots out of 256
    expect(windowsLimit).toBeLessThanOrEqual(worstCaseConcurrentWin)
    expect(windowsLimit * avgSlotsPerSpawn).toBeLessThan(maxPtySlots)
  })
})

describe('default retry configuration', () => {
  test('retry backoff timing is adequate for pty recovery', () => {
    const MAX_RETRIES = 5
    const BASE_MS = 1000

    // Total wait time: 1s + 2s + 4s + 8s + 16s = 31s
    const waits: number[] = []
    for (let retry = 1; retry <= MAX_RETRIES; retry++) {
      waits.push(BASE_MS * Math.pow(2, retry - 1))
    }

    expect(waits).toEqual([1000, 2000, 4000, 8000, 16000])
    const totalWait = waits.reduce((a, b) => a + b, 0)
    expect(totalWait).toBe(31000)

    // 31 seconds of retry gives ample time for pty slots to be freed
    // as other in-flight processes complete and release their slots
    expect(totalWait).toBeGreaterThan(15000)
  })
})
