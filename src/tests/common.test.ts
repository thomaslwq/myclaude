import { getLocalISODate, getLocalMonthYear } from '../constants/common.js'
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

// Mock process.env before importing the module
const originalEnv = { ...process.env }

beforeEach(() => {
  // Clear the env var before each test
  delete process.env.CLAUDE_CODE_OVERRIDE_DATE
})

afterEach(() => {
  // Restore original env after each test
  process.env = { ...originalEnv }
})

describe('getLocalISODate', () => {
  test('returns current date when CLAUDE_CODE_OVERRIDE_DATE is not set', () => {
    const result = getLocalISODate()
    // Should be in YYYY-MM-DD format
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/)
    // Should be today's date
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(result).toBe(expected)
  })

  test('returns override date when set to valid ISO date', () => {
    const testDate = '2024-12-25'
    process.env.CLAUDE_CODE_OVERRIDE_DATE = testDate
    const result = getLocalISODate()
    expect(result).toBe(testDate)
  })

  test('returns current date when override date is invalid format', () => {
    const invalidDate = 'not-a-date'
    process.env.CLAUDE_CODE_OVERRIDE_DATE = invalidDate
    const result = getLocalISODate()
    // Should fall back to current date
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(result).not.toBe(invalidDate)
  })

  test('returns current date when override date has invalid day', () => {
    const invalidDate = '2024-02-30' // February 30 doesn't exist
    process.env.CLAUDE_CODE_OVERRIDE_DATE = invalidDate
    const result = getLocalISODate()
    // Should fall back to current date
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(result).not.toBe(invalidDate)
  })

  test('returns current date when override date has invalid month', () => {
    const invalidDate = '2024-13-01' // Month 13 doesn't exist
    process.env.CLAUDE_CODE_OVERRIDE_DATE = invalidDate
    const result = getLocalISODate()
    // Should fall back to current date
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(result).not.toBe(invalidDate)
  })

  test('returns current date when override date has invalid year', () => {
    const invalidDate = 'abc-01-01'
    process.env.CLAUDE_CODE_OVERRIDE_DATE = invalidDate
    const result = getLocalISODate()
    // Should fall back to current date
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(result).not.toBe(invalidDate)
  })

  test('returns current date when override date is in wrong format (no hyphens)', () => {
    const invalidDate = '20241225'
    process.env.CLAUDE_CODE_OVERRIDE_DATE = invalidDate
    const result = getLocalISODate()
    // Should fall back to current date
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(result).not.toBe(invalidDate)
  })

  test('returns current date when override date is in wrong format (too short)', () => {
    const invalidDate = '2024-1-1'
    process.env.CLAUDE_CODE_OVERRIDE_DATE = invalidDate
    const result = getLocalISODate()
    // Should fall back to current date
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(result).not.toBe(invalidDate)
  })

  test('returns current date when override date is in wrong format (too long)', () => {
    const invalidDate = '2024-12-25T12:00:00Z'
    process.env.CLAUDE_CODE_OVERRIDE_DATE = invalidDate
    const result = getLocalISODate()
    // Should fall back to current date
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(result).not.toBe(invalidDate)
  })

  test('returns current date when override date is in wrong format (extra characters)', () => {
    const invalidDate = '2024-12-25 extra'
    process.env.CLAUDE_CODE_OVERRIDE_DATE = invalidDate
    const result = getLocalISODate()
    // Should fall back to current date
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(result).not.toBe(invalidDate)
  })
})

describe('getLocalMonthYear', () => {
  test('returns current month/year when CLAUDE_CODE_OVERRIDE_DATE is not set', () => {
    const result = getLocalMonthYear()
    expect(result).toMatch(/\w+ \d{4}/)
  })

  test('returns override month/year when set to valid ISO date', () => {
    const testDate = '2024-12-25'
    process.env.CLAUDE_CODE_OVERRIDE_DATE = testDate
    const result = getLocalMonthYear()
    expect(result).toBe('December 2024')
  })

  test('returns current month/year when override date is invalid', () => {
    const invalidDate = 'not-a-date'
    process.env.CLAUDE_CODE_OVERRIDE_DATE = invalidDate
    const result = getLocalMonthYear()
    expect(result).toMatch(/\w+ \d{4}/)
  })
})
