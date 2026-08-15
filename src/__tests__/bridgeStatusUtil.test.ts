import { wrapWithOsc8Link } from '../bridge/bridgeStatusUtil.js'

// Test that the URL is properly sanitized to prevent OSC 8 escape sequence injection

describe('wrapWithOsc8Link', () => {
  it('should encode percent signs in URL to prevent injection of percent-encoded escape sequences', () => {
    // A URL containing %1B (ESC) or %07 (BEL) should have the dangerous characters
    // encoded to prevent injection of escape sequences. The percent-encoded sequences
    // are first decoded, then dangerous characters are re-encoded.
    const url = 'https://example.com/%1B%5D8;;malicious%07'
    const text = 'Link'

    const result = wrapWithOsc8Link(text, url)

    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
    // The %1B (ESC) is decoded then re-encoded as %1B
    expect(result).toContain('%1B')
    // The %07 (BEL) is decoded then re-encoded as %07
    expect(result).toContain('%07')
    // The semicolons are encoded to %3B
    expect(result).toContain('%3B')
    // The URL should be a single, well-formed OSC 8 link with no injected sequences
    expect(result).toContain('\x1b]8;;https://example.com/%1B')
    expect(result).toContain('\x07Link\x1b]8;;\x07')
  })

  it('should encode backslash characters in URL', () => {
    const url = 'https://example.com/path\\backslash'
    const text = 'Link'

    const result = wrapWithOsc8Link(text, url)

    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
    // Backslash should be encoded
    expect(result).toContain('%5C')
  })

  it('should prevent injection of OSC 8 escape sequence via URL', () => {
    // An attacker could try to close the OSC 8 link early and inject arbitrary escape codes
    const url = 'https://example.com/\x1b]8;;https://evil.com\x07clicked'
    const text = 'Link'

    const result = wrapWithOsc8Link(text, url)

    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
    // The ESC character should be encoded to %1B
    expect(result).toContain('%1B')
    // The malicious URL should not appear as a separate OSC 8 sequence
    expect(result).not.toContain('\x1b]8;;https://evil.com')
  })


  it('should not break the OSC 8 sequence with special characters in URL', () => {
    // This test verifies that special characters like semicolons, newlines, and
    // escape sequences are properly handled to prevent breaking the OSC 8 escape sequence
    const url = 'https://example.com/path;with;semicolons?query=value\nnewline'
    const text = 'Click here'
    
    const result = wrapWithOsc8Link(text, url)
    
    // The result should contain the text and properly terminated OSC 8 sequences
    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
  })

  it('should handle URLs with percent-encoded characters correctly', () => {
    const url = 'https://example.com/path%20with%20spaces'
    const text = 'Link'
    
    const result = wrapWithOsc8Link(text, url)
    
    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
    // %20 should NOT be double-encoded to %2520
    expect(result).toContain('%20')
    expect(result).not.toContain('%2520')
  })

  it('should not double-encode already percent-encoded characters in URL', () => {
    // Regression test for #712: percent-encoded characters should not be double-encoded
    const url = 'https://example.com/search?q=hello%20world&page=1'
    const text = 'Search'
    
    const result = wrapWithOsc8Link(text, url)
    
    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
    // The %20 should remain as %20, not become %2520
    expect(result).toContain('%20')
    expect(result).not.toContain('%2520')
  })

  it('should handle URLs with backslashes', () => {
    const url = 'https://example.com/path\\backslash'
    const text = 'Link'
    
    const result = wrapWithOsc8Link(text, url)
    
    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
  })

  it('should handle empty URL', () => {
    const url = ''
    const text = 'Link'
    
    const result = wrapWithOsc8Link(text, url)
    
    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;\x07')
  })

  it('should prevent injection of OSC 8 escape sequence via text', () => {
    // The text should be sanitized to prevent ESC and BEL characters from
    // breaking the OSC 8 sequence. An attacker could try to inject a new
    // OSC 8 link or prematurely close the current one via the text.
    const url = 'https://example.com'
    const text = 'clicked\x1b]8;;https://evil.com\x07clicked'

    const result = wrapWithOsc8Link(text, url)

    // The ESC character should be encoded to %1B
    expect(result).toContain('%1B')
    // The BEL character should be encoded to %07
    expect(result).toContain('%07')
    // The result should still be a single well-formed OSC 8 link
    expect(result).toContain('\x1b]8;;https://example.com')
    expect(result).toContain('\x07')
    // The malicious URL should not appear as a separate OSC 8 sequence
    expect(result).not.toContain('\x1b]8;;https://evil.com')
  })

  it('should prevent injection via text with bare ESC character', () => {
    const url = 'https://example.com'
    const text = 'hello\x1bworld'

    const result = wrapWithOsc8Link(text, url)

    // ESC should be encoded
    expect(result).toContain('%1B')
    // The result should be well-formed
    expect(result).toContain('\x1b]8;;https://example.com\x07')
    expect(result).toContain('\x1b]8;;\x07')
  })

  it('should prevent injection via text with bare BEL character', () => {
    const url = 'https://example.com'
    const text = 'hello\x07world'

    const result = wrapWithOsc8Link(text, url)

    // BEL should be encoded
    expect(result).toContain('%07')
    // The result should be well-formed
    expect(result).toContain('\x1b]8;;https://example.com\x07')
    expect(result).toContain('\x1b]8;;\x07')
  })

  it('should handle URL with null character', () => {
    const url = 'https://example.com/path\x00null'
    const text = 'Link'
    
    const result = wrapWithOsc8Link(text, url)
    
    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
  })

  it('should handle URL with ASCII control characters', () => {
    const url = 'https://example.com/path\x01\x02\x03'
    const text = 'Link'
    
    const result = wrapWithOsc8Link(text, url)
    
    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
  })
})
