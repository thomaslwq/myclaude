import { describe, test, expect } from 'bun:test'
import { wrapWithOsc8Link } from '../bridge/bridgeStatusUtil.js'
const bs = String.fromCharCode(92)

/**
 * Security regression tests for OSC8 terminal injection (issue #769).
 * sanitizeOsc8Part must neutralize ESC/BEL, C1 controls, semicolons,
 * backslashes, Unicode separators and zero-width chars — encoding each as
 * %XX (code-point hex, uppercase) without double-encoding percent sequences.
 */

describe('OSC8 sanitization completeness (issue #769)', () => {
  test('ESC and BEL are encoded in url', () => {
    const out = wrapWithOsc8Link('L', 'https://x.com/' + String.fromCharCode(0x1b) + ']8;;evil' + String.fromCharCode(0x07))
    expect(out).not.toContain(String.fromCharCode(0x1b) + ']8;;evil')
    expect(out).toContain('%1B')
    expect(out).toContain('%07')
  })

  test('C1 control (CSI 0x9b) is encoded in text', () => {
    const out = wrapWithOsc8Link('L' + String.fromCharCode(0x9b) + '31m', 'https://x.com')
    expect(out).toContain('%9B')
  })

  test('semicolons and backslashes are encoded', () => {
    const out = wrapWithOsc8Link('L', 'https://x.com/a;b' + bs + 'c')
    expect(out).toContain('%3B')
    expect(out).toContain('%5C')
  })

  test('Unicode line/paragraph separators and zero-width chars are encoded', () => {
    const out = wrapWithOsc8Link('L' + String.fromCharCode(0x2028, 0x2029, 0x200b), 'https://x.com')
    expect(out).toContain('%2028')
    expect(out).toContain('%2029')
    expect(out).toContain('%200B')
  })

  test('legitimate percent encoding is preserved (no double-encode)', () => {
    const out = wrapWithOsc8Link('L', 'https://x.com/q=hello%20world')
    expect(out).toContain('hello%20world')
    expect(out).not.toContain('%2520')
  })

  test('a single well-formed OSC8 link, no smuggling', () => {
    const out = wrapWithOsc8Link('L', 'https://x.com/' + String.fromCharCode(0x1b) + ']8;;https://evil.com' + String.fromCharCode(0x07))
    expect(out).not.toContain(String.fromCharCode(0x1b) + ']8;;https://evil.com')
    expect(out.split(String.fromCharCode(0x1b) + ']8;;').length - 1).toBe(2) // open + close
  })
})
