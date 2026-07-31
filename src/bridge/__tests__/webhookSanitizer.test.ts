import { describe, it, expect } from 'bun:test'
import { sanitizeInboundWebhookContent, sanitizeWebhookPayload } from '../webhookSanitizer'

describe('sanitizeInboundWebhookContent', () => {
  it('should remove script tags', () => {
    const input = '<script>alert("xss")</script>Hello World'
    const result = sanitizeInboundWebhookContent(input)
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('alert')
    expect(result).toContain('Hello World')
  })

  it('should remove iframe tags', () => {
    const input = '<iframe src="malicious.com"></iframe>Safe content'
    const result = sanitizeInboundWebhookContent(input)
    expect(result).not.toContain('<iframe>')
    expect(result).toContain('Safe content')
  })

  it('should remove event handlers', () => {
    const input = 'onclick="alert(1)" onmouseover="steal()" Safe content'
    const result = sanitizeInboundWebhookContent(input)
    expect(result).not.toContain('onclick')
    expect(result).not.toContain('onmouseover')
    expect(result).toContain('Safe content')
  })

  it('should remove javascript: protocol', () => {
    const input = 'javascript:alert(1)'
    const result = sanitizeInboundWebhookContent(input)
    expect(result).not.toContain('javascript:')
  })

  it('should remove data:text/html protocol', () => {
    const input = 'data:text/html,<script>alert(1)</script>'
    const result = sanitizeInboundWebhookContent(input)
    expect(result).not.toContain('data:text/html')
    expect(result).not.toContain('<script>')
  })

  it('should remove all HTML tags', () => {
    const input = '<div><span>Test</span></div>'
    const result = sanitizeInboundWebhookContent(input)
    expect(result).not.toContain('<div>')
    expect(result).not.toContain('<span>')
    expect(result).toContain('Test')
  })

  it('should escape HTML entities', () => {
    const input = '< > & " \''
    const result = sanitizeInboundWebhookContent(input)
    // After escaping, these should be HTML-encoded
    expect(result).toContain('&amp;')
    expect(result).toContain('&quot;')
    expect(result).toContain('&#39;')
    // The original characters should not be present
    expect(result).not.toContain('<')
    expect(result).not.toContain('>')
  })

  it('should handle arrays', () => {
    const input = ['<script>alert(1)</script>', 'Safe content']
    const result = sanitizeInboundWebhookContent(input)
    expect(result).not.toContain('<script>')
    expect(result).toContain('Safe content')
  })

  it('should handle objects', () => {
    const input = { name: '<script>alert(1)</script>', value: 'Safe' }
    const result = sanitizeInboundWebhookContent(input)
    expect(result.name).not.toContain('<script>')
    expect(result.value).toBe('Safe')
  })

  it('should handle nested objects', () => {
    const input = { user: { name: '<script>alert(1)</script>' }, items: ['<script>'] }
    const result = sanitizeInboundWebhookContent(input)
    expect(result.user.name).not.toContain('<script>')
    expect(result.items[0]).not.toContain('<script>')
  })

  it('should handle null and undefined', () => {
    expect(sanitizeInboundWebhookContent(null)).toBeNull()
    expect(sanitizeInboundWebhookContent(undefined)).toBeUndefined()
  })

  it('should handle numbers and booleans', () => {
    expect(sanitizeInboundWebhookContent(42)).toBe(42)
    expect(sanitizeInboundWebhookContent(true)).toBe(true)
    expect(sanitizeInboundWebhookContent(false)).toBe(false)
  })

  it('should handle empty strings', () => {
    expect(sanitizeInboundWebhookContent('')).toBe('')
  })

  it('should handle strings with only HTML tags', () => {
    const input = '<script>alert(1)</script><iframe>malicious</iframe>'
    const result = sanitizeInboundWebhookContent(input)
    expect(result).toBe('')
  })

  it('should preserve safe content', () => {
    const input = 'Hello World! This is safe content.'
    const result = sanitizeInboundWebhookContent(input)
    expect(result).toBe(input)
  })

  it('should handle mixed content', () => {
    const input = 'User: <script>alert(1)</script>\nMessage: <iframe>malicious</iframe>'
    const result = sanitizeInboundWebhookContent(input)
    expect(result).toContain('User:')
    expect(result).toContain('Message:')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('<iframe>')
  })
})

describe('sanitizeWebhookPayload', () => {
  it('should return the value unchanged', () => {
    const input = { test: 'value' }
    const result = sanitizeWebhookPayload(input)
    expect(result).toBe(input)
  })

  it('should work with strings', () => {
    const input = 'test string'
    const result = sanitizeWebhookPayload(input)
    expect(result).toBe(input)
  })

  it('should work with arrays', () => {
    const input = ['a', 'b']
    const result = sanitizeWebhookPayload(input)
    expect(result).toBe(input)
  })

  it('should work with null', () => {
    const input = null
    const result = sanitizeWebhookPayload(input)
    expect(result).toBe(input)
  })
})
