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

/**
 * Regression tests for issue #925: escapeMarkdown does not escape newlines,
 * allowing Markdown structure injection (headings, lists, code blocks, etc.)
 * via multi-line flow names, descriptions, or step fields.
 *
 * Fix: replace `\r` and `\n` with a single space so untrusted text cannot
 * break out of the current Markdown line.
 */

describe('escapeMarkdown newline escaping (issue #925)', () => {
  test('newline in flow name is replaced with a space', () => {
    const out = generateDiffPreview({ name: 'normal\n\n# Malicious Heading', description: 'd', steps: [] })
    expect(out).toContain('## Diff Preview: normal  \\# Malicious Heading')
    expect(out).not.toContain('normal\n\n# Malicious Heading')
    // Must not produce a Markdown heading
    expect(out).not.toMatch(/^# Malicious Heading$/m)
  })

  test('carriage return in description is replaced with a space', () => {
    const out = generateDiffPreview({ name: 'n', description: 'line1\r\nline2', steps: [] })
    expect(out).toContain('**Description**: line1 line2')
    expect(out).not.toContain('\r')
  })

  test('newline in step description cannot inject a heading', () => {
    const out = generateDiffPreview({
      name: 'n',
      description: 'd',
      steps: [{ id: '1', description: 'step1\n# Injected Heading', reasoning: '', command: 'echo hi' }],
    })
    expect(out).toContain('### Step 1: step1 \\# Injected Heading')
    expect(out).not.toMatch(/^# Injected Heading$/m)
  })

  test('newline in step reasoning cannot inject a list', () => {
    const out = generateDiffPreview({
      name: 'n',
      description: 'd',
      steps: [{ id: '1', description: 's', reasoning: 'reason\n- [ ] malicious task', command: 'echo hi' }],
    })
    expect(out).toContain('- **Reasoning**: reason - \\[ \\] malicious task')
    expect(out).not.toMatch(/^- \[ \] malicious task$/m)
  })

  test('newlines in all fields are neutralized', () => {
    const out = generateDiffPreview({
      name: 'a\nb',
      description: 'c\nd',
      steps: [{ id: '1', description: 'e\nf', reasoning: 'g\nh', command: 'echo hi' }],
    })
    expect(out).not.toContain('\r')
    // The injected newlines must not survive into the rendered output.
    expect(out).not.toContain('a\nb')
    expect(out).not.toContain('c\nd')
    expect(out).not.toContain('e\nf')
    expect(out).not.toContain('g\nh')
  })

  test('newline in command (code span) is replaced with a space', () => {
    const out = generateDiffPreview({
      name: 'n',
      description: 'd',
      steps: [{ id: '1', description: 's', command: 'echo hi\necho bye', reasoning: '' }],
    })
    // The escaped output must not contain a raw newline from the command.
    expect(out).not.toContain('echo hi\necho bye')
    expect(out).toContain('`echo hi echo bye`')
  })

  test('newline in file path (code span) is replaced with a space', () => {
    const out = generateDiffPreview({
      name: 'n',
      description: 'd',
      steps: [{ id: '1', description: 's', files: ['path/to/file\npayload.txt'] }],
    })
    expect(out).not.toContain('path/to/file\npayload.txt')
    expect(out).toContain('`path/to/file payload.txt`')
  })
})
