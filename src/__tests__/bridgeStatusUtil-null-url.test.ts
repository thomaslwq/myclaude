import { wrapWithOsc8Link } from '../bridge/bridgeStatusUtil.js'

describe('wrapWithOsc8Link with invalid URL', () => {
  it('should handle null URL gracefully', () => {
    const text = 'Link'
    const url = null
    
    // This should not throw an error
    const result = wrapWithOsc8Link(text, url)
    
    // The result should contain the text and properly terminated OSC 8 sequences
    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
  })

  it('should handle undefined URL gracefully', () => {
    const text = 'Link'
    const url = undefined
    
    // This should not throw an error
    const result = wrapWithOsc8Link(text, url)
    
    // The result should contain the text and properly terminated OSC 8 sequences
    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
  })

  it('should handle non-string URL gracefully', () => {
    const text = 'Link'
    const url = 123 as any
    
    // This should not throw an error
    const result = wrapWithOsc8Link(text, url)
    
    // The result should contain the text and properly terminated OSC 8 sequences
    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
  })

  it('should handle empty string URL gracefully', () => {
    const text = 'Link'
    const url = ''
    
    // This should work fine
    const result = wrapWithOsc8Link(text, url)
    
    // The result should contain the text and properly terminated OSC 8 sequences
    expect(result).toContain(text)
    expect(result).toContain('\x1b]8;;')
    expect(result).toContain('\x07')
  })
})