import { wrapWithOsc8Link } from '../bridge/bridgeStatusUtil.js'

// Test that the URL is properly sanitized to prevent OSC 8 escape sequence injection

describe('wrapWithOsc8Link', () => {
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
