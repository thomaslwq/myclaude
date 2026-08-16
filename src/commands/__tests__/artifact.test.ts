import { describe, test, expect } from 'bun:test'
import artifact from '../artifact.js'

/**
 * Regression tests for the /artifact command (issue #737).
 * The command must be registered, expose a callable load(), and validate
 * that empty input produces usage text without opening a browser.
 */

describe('/artifact command (issue #737)', () => {
  test('exports a local command with the expected metadata', () => {
    expect(artifact).toBeDefined()
    expect(artifact.type).toBe('local')
    expect(artifact.name).toBe('artifact')
    expect(artifact.description).toContain('HTML')
    expect(typeof artifact.load).toBe('function')
  })

  test('empty args produce usage text without error', async () => {
    const mod = await artifact.load()
    expect(typeof mod.call).toBe('function')
    const result = await mod.call('', {} as never)
    expect(result.type).toBe('text')
    expect(String(result.value)).toContain('Artifact preview')
  })
})
