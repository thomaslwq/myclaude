import { describe, test, expect } from 'bun:test'
import { generateDiffPreview } from '../executor.js'

/**
 * Regression tests for issue #887: escapeMarkdown does not escape `&`,
 * enabling HTML entity injection and XSS in rendered markdown
 * (e.g. a flow name of `&lt;script&gt;` passes through unescaped & and
 * the literal entity sequence can render as an HTML tag).
 *
 * Fix: escape `&` first (so the produced `&lt;`/`&gt;` sequences are
 * themselves safe), before `<` and `>`.
 */

describe('escapeMarkdown ampersand escaping (issue #887)', () => {
  test('ampersand is escaped to &amp;', () => {
    const out = generateDiffPreview({ name: 'a & b', description: 'd', steps: [] })
    expect(out).toContain('a &amp; b')
    expect(out).not.toContain('a & b')
  })

  test('entity-injection sequence is neutralized', () => {
    // Raw text `&lt;script&gt;` must not survive as a renderable entity.
    const out = generateDiffPreview({ name: '&lt;script&gt;', description: 'd', steps: [] })
    expect(out).not.toContain('&lt;script&gt;')
    // & -> &amp;, so the original entity is now inert: &amp;lt;script&amp;gt;
    expect(out).toContain('&amp;lt;script&amp;gt;')
  })

  test('angle brackets are still escaped', () => {
    const out = generateDiffPreview({ name: '<b>x</b>', description: 'd', steps: [] })
    expect(out).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})
