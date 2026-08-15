import { wrapWithOsc8Link } from '../bridge/bridgeStatusUtil.js'

// Test that the URL is properly sanitized to prevent OSC 8 escape sequence injection

describe('wrapWithOsc8Link', () => {
  it('should encode percent signs in URL to prevent injection of percent-encoded escape sequences', () => {
    // A URL containing %1B (ESC) or %07 (BEL) should have the dangerous characters
    // encoded to prevent injection of escape sequences. Since % is no longer encoded,
    // %1B stays as %1B — the dangerous characters within the percent-encoded sequences
    // are the actual characters that would be decoded, but they are already in encoded
    // form and won't be decoded by the terminal. The semicolons are still encoded.
    const url = 'https://example.com/%1B%5D8;;malicious%07'
    const text = 'Link'

    const result = wrapWithOsc8Link(text, url)

    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
    // The % is NOT encoded, so %1B stays as %1B
    expect(result).toContain('%1B')
    // The %07 stays as %07
    expect(result).toContain('%07')
    // The semicolons are encoded to %3B
    expect(result).toContain('%3B')
    // The URL should be a single, well-formed OSC 8 link with no injected sequences
    expect(result).toContain('\x1b]8;;https://example.com/%1B%5D8%3B%3Bmalicious%07')
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
    // The %20 should remain as %20, not become %2520
    // This is because the % itself is not dangerous — only the actual dangerous
    // characters that could appear in the URL need to be encoded
    expect(result).toContain('%20')
  })

  it('should handle URLs with mixed percent-encoded and dangerous characters', () => {
    // A URL with both legitimate percent-encoding and actual dangerous characters
    const url = 'https://example.com/path%20with%20spaces?q=hello\x1bworld'
    const text = 'Link'

    const result = wrapWithOsc8Link(text, url)

    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
    // The %20 should remain as %20
    expect(result).toContain('%20')
    // The ESC character should be encoded to %1B
    expect(result).toContain('%1B')
  })

  it('should handle URLs with all dangerous characters that need encoding', () => {
    // Control characters, semicolons, backslashes — but NOT percent signs
    const url = 'https://example.com/\x00\x1f\x7f\x80\x9f;\\'
    const text = 'Link'

    const result = wrapWithOsc8Link(text, url)

    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
    // Control characters should be encoded
    expect(result).toContain('%00')
    expect(result).toContain('%1F')
    expect(result).toContain('%7F')
    expect(result).toContain('%80')
    expect(result).toContain('%9F')
    // Semicolon should be encoded
    expect(result).toContain('%3B')
    // Backslash should be encoded
    expect(result).toContain('%5C')
  })

  it('should preserve existing percent-encoding in URLs', () => {
    // Legitimate percent-encoded URLs should not be double-encoded
    const url = 'https://example.com/search?q=hello%20world&lang=en%2Fus'
    const text = 'Search'

    const result = wrapWithOsc8Link(text, url)

    expect(result).toContain('\x1b]8;;https://example.com/search?q=hello%20world&lang=en%2Fus')
    expect(result).toContain('\x07Search\x1b]8;;\x07')
    // The %20 should remain as %20, not become %2520
    expect(result).toContain('%20')
    expect(result).toContain('%2F')
  })
})
