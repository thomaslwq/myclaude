import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import pkg from '../../package.json'

// Save original state
const originalMACRO = (globalThis as any).MACRO
const originalEnv = process.env.CLAUDE_CODE_ENTRYPOINT

describe('getAttributionHeader', () => {
  beforeEach(() => {
    // Clear MACRO to simulate environment without build-time macro injection
    delete (globalThis as any).MACRO
    delete process.env.CLAUDE_CODE_ENTRYPOINT
    delete process.env.CLAUDE_CODE_ATTRIBUTION_HEADER
  })

  afterEach(() => {
    // Restore original state
    if (originalMACRO) {
      ;(globalThis as any).MACRO = originalMACRO
    } else {
      delete (globalThis as any).MACRO
    }
    if (originalEnv) {
      process.env.CLAUDE_CODE_ENTRYPOINT = originalEnv
    } else {
      delete process.env.CLAUDE_CODE_ENTRYPOINT
    }
  })

  it('should fall back to package.json version when MACRO is not available', async () => {
    // Dynamic import to get fresh module without MACRO
    const { getAttributionHeader } = await import('../constants/system.js')
    const result = getAttributionHeader('test-fingerprint')
    expect(result).toContain(`cc_version=${pkg.version}.test-fingerprint`)
    expect(result).toContain('cc_entrypoint=unknown')
  })

  it('should use MACRO version when available', async () => {
    ;(globalThis as any).MACRO = { VERSION: '1.2.3' }
    const { getAttributionHeader } = await import('../constants/system.js')
    const result = getAttributionHeader('test-fp')
    expect(result).toContain('cc_version=1.2.3.test-fp')
  })

  it('should respect CLAUDE_CODE_ENTRYPOINT env var', async () => {
    process.env.CLAUDE_CODE_ENTRYPOINT = 'test-entrypoint'
    const { getAttributionHeader } = await import('../constants/system.js')
    const result = getAttributionHeader('fp')
    expect(result).toContain('cc_entrypoint=test-entrypoint')
  })

  it('should return empty string when attribution header is disabled', async () => {
    process.env.CLAUDE_CODE_ATTRIBUTION_HEADER = 'false'
    const { getAttributionHeader } = await import('../constants/system.js')
    const result = getAttributionHeader('fp')
    expect(result).toBe('')
  })
})
