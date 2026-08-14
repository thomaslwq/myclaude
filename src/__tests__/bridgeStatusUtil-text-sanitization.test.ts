import { wrapWithOsc8Link } from '../bridge/bridgeStatusUtil.js'

describe('wrapWithOsc8Link text sanitization', () => {
  it('should sanitize text to prevent OSC 8 escape sequence injection', () => {
    // Text containing ESC character should be sanitized
    const text = 'Link\x1b[31mred\x1b[0m'
    const url = 'https://example.com'
    const result = wrapWithOsc8Link(text, url)
    
    // The original text is no longer in the output; ESC is encoded to %1B
    expect(result).not.toContain('\x1b[31mred\x1b[0m')
    expect(result).toContain('Link%1B[31mred%1B[0m')
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
    // The ESC character should be encoded to %1B
    expect(result).toContain('%1B')
  })

  it('should sanitize text containing BEL character', () => {
    // Text containing BEL character should be sanitized
    const text = 'Link\x07beep'
    const url = 'https://example.com'
    const result = wrapWithOsc8Link(text, url)
    
    // The original text is no longer in the output; BEL is encoded to %07
    expect(result).not.toContain('\x07beep')
    expect(result).toContain('Link%07beep')
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
    // The BEL character should be encoded to %07
    expect(result).toContain('%07')
  })

  it('should sanitize text containing multiple control characters', () => {
    // Text containing multiple control characters
    const text = 'Link\x01\x02\x03\x1b\x07'
    const url = 'https://example.com'
    const result = wrapWithOsc8Link(text, url)
    
    expect(result).toContain('Link%01%02%03%1B%07')
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
    // All control characters should be encoded
    expect(result).toContain('%01')
    expect(result).toContain('%02')
    expect(result).toContain('%03')
    expect(result).toContain('%1B')
    expect(result).toContain('%07')
  })

  it('should not break the OSC 8 sequence when text contains control characters', () => {
    // Text with control characters should not break the OSC 8 sequence
    const text = 'Link\x1b[31mred\x1b[0m'
    const url = 'https://example.com'
    const result = wrapWithOsc8Link(text, url)
    
    // The result should contain properly terminated OSC 8 sequences
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
    // The sanitized text should appear after the first BEL and before the closing OSC 8 sequence
    expect(result).toContain('\x1b]8;;https://example.com\x07Link%1B[31mred%1B[0m\x1b]8;;\x07')
  })

  it('should handle text with null character', () => {
    const text = 'Link\x00null'
    const url = 'https://example.com'
    const result = wrapWithOsc8Link(text, url)
    
    expect(result).toContain('Link%00null')
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
    // The null character should be encoded to %00
    expect(result).toContain('%00')
  })

  it('should handle text with semicolon', () => {
    const text = 'Link;with;semicolons'
    const url = 'https://example.com'
    const result = wrapWithOsc8Link(text, url)
    
    expect(result).toContain('Link%3Bwith%3Bsemicolons')
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
    // The semicolon should be encoded to %3B
    expect(result).toContain('%3B')
  })

  it('should handle text with backslash', () => {
    const text = 'Link\\backslash'
    const url = 'https://example.com'
    const result = wrapWithOsc8Link(text, url)
    
    expect(result).toContain('Link%5Cbackslash')
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
    // The backslash should be encoded to %5C
    expect(result).toContain('%5C')
  })

  it('should handle text with percent sign', () => {
    const text = 'Link%20with%20percent'
    const url = 'https://example.com'
    const result = wrapWithOsc8Link(text, url)
    
    expect(result).toContain('Link%2520with%2520percent')
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
    // The percent sign should be encoded to %25
    expect(result).toContain('%25')
  })

  it('should handle normal text without control characters', () => {
    const text = 'Normal link text'
    const url = 'https://example.com'
    const result = wrapWithOsc8Link(text, url)
    
    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
  })

  it('should handle text with emoji', () => {
    const text = 'Link\u{1F440} eyes'
    const url = 'https://example.com'
    const result = wrapWithOsc8Link(text, url)
    
    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
  })

  it('should handle text with CJK characters', () => {
    const text = '链接文本'
    const url = 'https://example.com'
    const result = wrapWithOsc8Link(text, url)
    
    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
  })
})
