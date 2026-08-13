import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test'
import { createBridgeLogger } from '../bridge/bridgeUI'

// Mock process.stdout
const originalStdoutColumns = process.stdout.columns
const originalStdoutIsTTY = process.stdout.isTTY

// Mock terminal-size
vi.mock('terminal-size', () => ({
  default: vi.fn(() => ({
    columns: 80,
    rows: 24,
  })),
}))

describe('bridgeUI reconnecting spinner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.stdout.columns = originalStdoutColumns
    process.stdout.isTTY = originalStdoutIsTTY
  })

  afterEach(() => {
    process.stdout.columns = originalStdoutColumns
    process.stdout.isTTY = originalStdoutIsTTY
    vi.useRealTimers()
  })

  it('should animate the reconnecting spinner at a consistent rate via timer', async () => {
    vi.useFakeTimers()
    const write = vi.fn()
    const logger = createBridgeLogger({ verbose: false, write })

    // Enter reconnecting state
    logger.updateReconnectingStatus('5s', '10s')
    write.mockClear()

    // Capture the first frame output
    const firstFrame = write.mock.calls[0]?.[0] as string

    // Simulate 150ms passing - the timer should fire and advance the spinner
    vi.advanceTimersByTime(150)

    // Capture the second frame output
    const secondFrame = write.mock.calls[1]?.[0] as string

    // The frames should be different (spinner animated)
    expect(secondFrame).toBeDefined()
    expect(secondFrame).not.toBe(firstFrame)
  })

  it('should not advance the spinner on every renderStatusLine call', () => {
    vi.useFakeTimers()
    const write = vi.fn()
    const logger = createBridgeLogger({ verbose: false, write })

    // Enter reconnecting state
    logger.updateReconnectingStatus('5s', '10s')
    write.mockClear()

    // Capture first frame
    logger.refreshDisplay()
    const frame1 = write.mock.calls[0]?.[0] as string
    write.mockClear()

    // Refresh again - should show the same frame (no tick increment on render)
    logger.refreshDisplay()
    const frame2 = write.mock.calls[0]?.[0] as string

    expect(frame2).toBe(frame1)
  })

  it('should stop the reconnecting timer when transitioning to idle', () => {
    vi.useFakeTimers()
    const write = vi.fn()
    const logger = createBridgeLogger({ verbose: false, write })

    // Enter reconnecting state
    logger.updateReconnectingStatus('5s', '10s')
    write.mockClear()

    // Transition to idle
    logger.updateIdleStatus()
    write.mockClear()

    // Advance time - no more spinner updates should happen
    vi.advanceTimersByTime(500)

    // No writes should have occurred from the reconnecting timer
    expect(write).not.toHaveBeenCalled()
  })
})