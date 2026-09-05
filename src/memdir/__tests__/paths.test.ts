import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { hasAutoMemPathOverride } from '../paths.js'

/**
 * Regression tests for validateMemoryPath (issue #986).
 *
 * validateMemoryPath is exercised indirectly via hasAutoMemPathOverride(),
 * which returns true iff CLAUDE_COWORK_MEMORY_PATH_OVERRIDE is set to a
 * path that passes validation.
 *
 * The previous implementation rejected any path with length < 3 as a
 * fragile proxy for rejecting the root path "/". That inadvertently
 * rejected legitimate short absolute paths like "/a" (length 2).
 */

describe('validateMemoryPath (via hasAutoMemPathOverride)', () => {
  const ENV = 'CLAUDE_COWORK_MEMORY_PATH_OVERRIDE'
  let saved: string | undefined

  beforeEach(() => {
    saved = process.env[ENV]
    delete process.env[ENV]
  })

  afterEach(() => {
    if (saved === undefined) {
      delete process.env[ENV]
    } else {
      process.env[ENV] = saved
    }
  })

  test('accepts short absolute path "/a" (length 2)', () => {
    process.env[ENV] = '/a'
    expect(hasAutoMemPathOverride()).toBe(true)
  })

  test('accepts short absolute path "/ab" (length 3)', () => {
    process.env[ENV] = '/ab'
    expect(hasAutoMemPathOverride()).toBe(true)
  })

  test('accepts typical absolute path', () => {
    process.env[ENV] = '/tmp/memory'
    expect(hasAutoMemPathOverride()).toBe(true)
  })

  test('rejects the root path "/"', () => {
    process.env[ENV] = '/'
    expect(hasAutoMemPathOverride()).toBe(false)
  })

  test('rejects relative paths', () => {
    process.env[ENV] = '../foo'
    expect(hasAutoMemPathOverride()).toBe(false)
  })

  test('rejects empty string', () => {
    process.env[ENV] = ''
    expect(hasAutoMemPathOverride()).toBe(false)
  })

  test('rejects null byte', () => {
    process.env[ENV] = '/tmp/\0evil'
    expect(hasAutoMemPathOverride()).toBe(false)
  })
})
