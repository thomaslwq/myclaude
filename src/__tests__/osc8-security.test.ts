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

  test('surrogate pairs (emoji) are not corrupted into lone-surrogate escapes', () => {
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}'
    const out = wrapWithOsc8Link(family, 'https://x.com/' + family)
    // No lone-surrogate escapes may appear (they are invalid code points).
    // A lone surrogate would be a 4-digit %XXXX escape in the D800-DBFF or
    // DC00-DFFF range; a real astral code point is 5+ digits.
    expect(out).not.toMatch(/%[D-F][89A-F][0-9A-F]{2}(?![0-9A-F])/)
    // The ZWJ (U+200D) must be encoded as its full code point, not as a
    // lone high surrogate (which the old charCodeAt(0) produced).
    expect(out).toContain('%200D')
    // Astral characters that are not control chars pass through intact.
    expect(out).toContain('\u{1F468}')
    // Every %XX escape must decode to a valid (non-surrogate) code point.
    // (The decoded string itself may contain surrogate pairs from intact
    // astral characters, so we only assert on the escapes themselves.)
    const escapes = [...out.matchAll(/%([0-9A-F]{2,4})(?![0-9A-F])/g)].map(m => parseInt(m[1], 16))
    expect(escapes.every(cp => cp < 0xD800 || cp > 0xDFFF)).toBe(true)
  })

  test('CJK extension-B and other astral characters are preserved', () => {
    const out = wrapWithOsc8Link('\u{20000}', 'https://x.com')
    expect(out).not.toMatch(/%[D-F][89A-F][0-9A-F]{2}/)
    expect(out).toContain('\u{20000}')
  })

  test('a single well-formed OSC8 link, no smuggling', () => {
    const out = wrapWithOsc8Link('L', 'https://x.com/' + String.fromCharCode(0x1b) + ']8;;https://evil.com' + String.fromCharCode(0x07))
    expect(out).not.toContain(String.fromCharCode(0x1b) + ']8;;https://evil.com')
    expect(out.split(String.fromCharCode(0x1b) + ']8;;').length - 1).toBe(2) // open + close
  })
})
