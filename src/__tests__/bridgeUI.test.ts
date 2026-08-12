import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test'
import { countVisualLines } from '../bridge/bridgeUI'
import { stringWidth } from '../ink/stringWidth'

// Mock process.stdout
const originalStdoutColumns = process.stdout.columns
const originalStdoutIsTTY = process.stdout.isTTY

// Mock terminal-size to simulate piped stdout
vi.mock('terminal-size', () => ({
  default: vi.fn(() => ({
    columns: 40,
    rows: 24,
  })),
}))

describe('countVisualLines', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    process.stdout.columns = originalStdoutColumns
    process.stdout.isTTY = originalStdoutIsTTY
  })

  afterEach(() => {
    process.stdout.columns = originalStdoutColumns
    process.stdout.isTTY = originalStdoutIsTTY
  })

  it('should handle empty string', () => {
    const result = countVisualLines('')
    expect(result).toBe(0)
  })

  it('should handle single line without wrapping', () => {
    const result = countVisualLines('Hello World')
    expect(result).toBe(1)
  })

  it('should handle single line with wrapping', () => {
    // The mock terminal size is 40 columns, so a line longer than 40 chars wraps
    const result = countVisualLines('This is a very long line that should wrap to multiple lines in the terminal')
    expect(result).toBeGreaterThan(1)
  })

  it('should handle newlines', () => {
    const result = countVisualLines('Line 1\nLine 2')
    expect(result).toBe(2)
  })

  it('should handle multiple newlines', () => {
    const result = countVisualLines('Line 1\n\nLine 2')
    expect(result).toBe(3)
  })

  it('should handle trailing newline', () => {
    const result = countVisualLines('Line 1\n')
    expect(result).toBe(1)
  })

  it('should handle undefined stdout.columns (piped stdout)', () => {
    process.stdout.columns = undefined
    const result = countVisualLines('Line 1\nLine 2')
    expect(result).toBe(2)
  })

  it('should handle zero stdout.columns', () => {
    process.stdout.columns = 0
    const result = countVisualLines('Line 1\nLine 2')
    expect(result).toBe(2)
  })
})
