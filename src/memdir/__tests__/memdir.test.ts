import { describe, test, expect } from 'bun:test'
import {
  truncateEntrypointContent,
  MAX_ENTRYPOINT_LINES,
  MAX_ENTRYPOINT_BYTES,
} from '../memdir.js'

/**
 * Regression tests for MEMORY.md entrypoint truncation (issue #667).
 * The index file must stay bounded in lines and bytes.
 */

describe('truncateEntrypointContent', () => {
  test('short content passes through unchanged', () => {
    const r = truncateEntrypointContent('## Topics\n- a\n- b\n')
    expect(r.wasLineTruncated).toBe(false)
    expect(r.wasByteTruncated).toBe(false)
    expect(r.content).toContain('- a')
    expect(r.content).toContain('- b')
  })

  test('truncates when line count exceeds the cap', () => {
    const manyLines = Array.from({ length: MAX_ENTRYPOINT_LINES + 10 }, (_, i) => `- item ${i}`).join('\n')
    const r = truncateEntrypointContent(manyLines)
    expect(r.wasLineTruncated).toBe(true)
    expect(r.content.split('\n').length).toBeLessThanOrEqual(MAX_ENTRYPOINT_LINES + 3) // cap + warning lines
    expect(r.content).toContain('WARNING')
  })

  test('truncates when byte count exceeds the cap', () => {
    const big = 'x'.repeat(MAX_ENTRYPOINT_BYTES + 100)
    const r = truncateEntrypointContent(big)
    expect(r.wasByteTruncated).toBe(true)
    // content before the warning suffix must not exceed the byte cap
    const warningIdx = r.content.indexOf('\n\n> WARNING')
    expect(warningIdx).toBeGreaterThan(-1)
    const preWarning = r.content.slice(0, warningIdx)
    expect(preWarning.length).toBeLessThanOrEqual(MAX_ENTRYPOINT_BYTES)
  })

  test('trims surrounding whitespace', () => {
    const r = truncateEntrypointContent('  \n## Topics\n  \n')
    expect(r.content).not.toStartWith(' ')
    expect(r.content).toContain('## Topics')
  })
})
