import { describe, test, expect } from 'bun:test'
import { WebBrowserTool } from '../WebBrowserTool.js'

/**
 * Regression tests for browser automation tool (issue #695).
 * The tool must reject non-http(s) URLs and only open valid ones.
 */

describe('WebBrowserTool (issue #695)', () => {
  test('exports a buildTool instance with the expected name', () => {
    expect(WebBrowserTool).toBeDefined()
    expect(WebBrowserTool.name).toBe('web_browser_open')
    expect(typeof WebBrowserTool.call).toBe('function')
  })

  test('input schema validates a plain http URL', async () => {
    const parsed = WebBrowserTool.inputSchema.safeParse({ url: 'https://example.com' })
    expect(parsed.success).toBe(true)
  })

  test('input schema rejects empty URL', async () => {
    const parsed = WebBrowserTool.inputSchema.safeParse({ url: '' })
    expect(parsed.success).toBe(false)
  })

  test('rejects javascript: URLs via validateUrl', async () => {
    const { validateUrl } = await import('../../../utils/browser.js')
    expect(() => validateUrl('javascript:alert(1)')).toThrow()
    expect(() => validateUrl('file:///etc/passwd')).toThrow()
  })

  test('accepts http/https schemes', async () => {
    const { validateUrl } = await import('../../../utils/browser.js')
    expect(() => validateUrl('http://a.com')).not.toThrow()
    expect(() => validateUrl('https://a.com')).not.toThrow()
  })
})
