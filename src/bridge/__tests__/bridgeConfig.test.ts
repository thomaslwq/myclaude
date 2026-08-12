import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { getBridgeTokenOverride, getBridgeBaseUrlOverride } from '../bridgeConfig.js'

// Polyfill for feature() in test environment
// In production builds, this is replaced by Bun's compile-time macro system
// For tests, we default to false (production behavior)
if (typeof globalThis.feature === 'undefined') {
  globalThis.feature = function feature(name: string): boolean {
    return false
  }
}

// Mock environment variables
const originalEnv = { ...process.env }

beforeEach(() => {
  // Reset environment before each test
  process.env = { ...originalEnv }
  delete process.env.USER_TYPE
  delete process.env.CLAUDE_BRIDGE_OAUTH_TOKEN
  delete process.env.CLAUDE_BRIDGE_BASE_URL
})

afterEach(() => {
  // Restore original environment
  process.env = originalEnv
})

describe('bridgeConfig security', () => {
  describe('getBridgeTokenOverride', () => {
    it('should return undefined when USER_TYPE is not ant', () => {
      process.env.USER_TYPE = 'user'
      expect(getBridgeTokenOverride()).toBeUndefined()
    })

    it('should return undefined when CLAUDE_BRIDGE_OAUTH_TOKEN is not set', () => {
      process.env.USER_TYPE = 'ant'
      expect(getBridgeTokenOverride()).toBeUndefined()
    })

    it('should be gated behind a build-time flag in production builds', () => {
      // This test verifies that the override is gated behind a build-time flag
      // In production builds, the flag should be false by default
      // @ts-ignore - accessing internal feature flag
      const isDevOverrideEnabled = globalThis.feature?.('DEV_BRIDGE_OVERRIDES') ?? false
      
      // Simulate production build (flag should be false)
      if (!isDevOverrideEnabled) {
        // If disabled (production), the token should NOT be returned even if env vars are set
        process.env.USER_TYPE = 'ant'
        process.env.CLAUDE_BRIDGE_OAUTH_TOKEN = 'test-token'
        expect(getBridgeTokenOverride()).toBeUndefined()
      } else {
        // If enabled (dev build), the token should be returned
        process.env.USER_TYPE = 'ant'
        process.env.CLAUDE_BRIDGE_OAUTH_TOKEN = 'test-token'
        expect(getBridgeTokenOverride()).toBe('test-token')
      }
    })
  })

  describe('getBridgeBaseUrlOverride', () => {
    it('should return undefined when USER_TYPE is not ant', () => {
      process.env.USER_TYPE = 'user'
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should return undefined when CLAUDE_BRIDGE_BASE_URL is not set', () => {
      process.env.USER_TYPE = 'ant'
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should be gated behind a build-time flag in production builds', () => {
      // This test verifies that the override is gated behind a build-time flag
      // In production builds, the flag should be false by default
      // @ts-ignore - accessing internal feature flag
      const isDevOverrideEnabled = globalThis.feature?.('DEV_BRIDGE_OVERRIDES') ?? false
      
      // Simulate production build (flag should be false)
      if (!isDevOverrideEnabled) {
        // If disabled (production), the URL should NOT be returned even if env vars are set
        process.env.USER_TYPE = 'ant'
        process.env.CLAUDE_BRIDGE_BASE_URL = 'https://custom.example.com'
        expect(getBridgeBaseUrlOverride()).toBeUndefined()
      } else {
        // If enabled (dev build), the URL should be returned
        process.env.USER_TYPE = 'ant'
        process.env.CLAUDE_BRIDGE_BASE_URL = 'https://custom.example.com'
        expect(getBridgeBaseUrlOverride()).toBe('https://custom.example.com')
      }
    })
  })
})
