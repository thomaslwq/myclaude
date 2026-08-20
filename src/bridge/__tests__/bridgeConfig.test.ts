import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import {
  getBridgeTokenOverride,
  getBridgeBaseUrlOverride,
  createBridgeOverrideResolver,
  getResolver,
  resetResolver,
} from '../bridgeConfig.js'

// Mock the build-time MACRO constant
const originalMacro = (globalThis as any).MACRO

beforeEach(() => {
  // Always set MACRO to default (DEV_BRIDGE_OVERRIDES_ENABLED = false)
  // This ensures tests don't leak state between them, even if a test
  // previously deleted globalThis.MACRO.
  ;(globalThis as any).MACRO = {
    DEV_BRIDGE_OVERRIDES_ENABLED: false,
    BRIDGE_OVERRIDE_TOKEN: '',
    BRIDGE_OVERRIDE_BASE_URL: '',
  }
})

afterEach(() => {
  // Restore original MACRO
  ;(globalThis as any).MACRO = originalMacro
})

describe('bridgeConfig security', () => {
  describe('createBridgeOverrideResolver', () => {
    it('should capture values at creation time and be immune to later mutation', () => {
      const macro = {
        DEV_BRIDGE_OVERRIDES_ENABLED: false,
        BRIDGE_OVERRIDE_TOKEN: 'default-token',
        BRIDGE_OVERRIDE_BASE_URL: 'https://default.com',
      }
      const resolver = createBridgeOverrideResolver(macro)

      // Simulate an attacker modifying the source MACRO object
      macro.DEV_BRIDGE_OVERRIDES_ENABLED = true
      macro.BRIDGE_OVERRIDE_TOKEN = 'evil-token'
      macro.BRIDGE_OVERRIDE_BASE_URL = 'https://evil.com'

      // Resolver captured values eagerly — attacker modifications have no effect
      expect(resolver.getBridgeTokenOverride()).toBeUndefined()
      expect(resolver.getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should return token when enabled at creation time', () => {
      const macro = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: 'test-token',
      }
      const resolver = createBridgeOverrideResolver(macro)
      expect(resolver.getBridgeTokenOverride()).toBe('test-token')
    })

    it('should return base URL when enabled at creation time', () => {
      const macro = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_BASE_URL: 'https://evil.com',
      }
      const resolver = createBridgeOverrideResolver(macro)
      expect(resolver.getBridgeBaseUrlOverride()).toBe('https://evil.com')
    })

    it('should return undefined when token is empty', () => {
      const macro = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: '',
      }
      const resolver = createBridgeOverrideResolver(macro)
      expect(resolver.getBridgeTokenOverride()).toBeUndefined()
    })

    it('should return undefined when disabled even if token is set', () => {
      const macro = {
        DEV_BRIDGE_OVERRIDES_ENABLED: false,
        BRIDGE_OVERRIDE_TOKEN: 'super-secret',
        BRIDGE_OVERRIDE_BASE_URL: 'https://evil.com',
      }
      const resolver = createBridgeOverrideResolver(macro)
      expect(resolver.getBridgeTokenOverride()).toBeUndefined()
      expect(resolver.getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should handle missing macro gracefully', () => {
      const resolver = createBridgeOverrideResolver(undefined)
      expect(resolver.getBridgeTokenOverride()).toBeUndefined()
      expect(resolver.getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should handle null macro gracefully', () => {
      const resolver = createBridgeOverrideResolver(null)
      expect(resolver.getBridgeTokenOverride()).toBeUndefined()
      expect(resolver.getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should return both token and base URL when both are enabled', () => {
      const macro = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: 'my-token',
        BRIDGE_OVERRIDE_BASE_URL: 'https://my-bridge.com',
      }
      const resolver = createBridgeOverrideResolver(macro)
      expect(resolver.getBridgeTokenOverride()).toBe('my-token')
      expect(resolver.getBridgeBaseUrlOverride()).toBe('https://my-bridge.com')
    })
  })

  describe('security invariant: resolver captures MACRO at module load time', () => {
    it('should return the same cached resolver on every call', () => {
      const resolver1 = getResolver()
      const resolver2 = getResolver()
      expect(resolver1).toBe(resolver2)
    })

    it('should be immune to runtime modification of globalThis.MACRO after module load', () => {
      // The resolver was already created at module load time with DEV_BRIDGE_OVERRIDES_ENABLED = false
      // If we now set MACRO to enable overrides, the cached resolver should NOT pick it up
      ;(globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: 'runtime-token',
        BRIDGE_OVERRIDE_BASE_URL: 'https://runtime.com',
      }

      // The cached resolver should still reflect the original values
      expect(getBridgeTokenOverride()).toBeUndefined()
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })
  })

  describe('getBridgeTokenOverride and getBridgeBaseUrlOverride', () => {
    it('should return undefined by default (DEV_BRIDGE_OVERRIDES_ENABLED = false)', () => {
      expect(getBridgeTokenOverride()).toBeUndefined()
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })
  })

  describe('resetResolver', () => {
    it('should re-read current globalThis.MACRO and update the cached resolver', () => {
      // MACRO is set in beforeEach to DEV_BRIDGE_OVERRIDES_ENABLED = false
      // The resolver was captured at module load time with that value
      expect(getBridgeTokenOverride()).toBeUndefined()

      // Now change MACRO to enable overrides
      ;(globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: 'resolved-token',
        BRIDGE_OVERRIDE_BASE_URL: 'https://resolved.com',
      }

      // Without reset, the cached resolver still has the old values
      expect(getBridgeTokenOverride()).toBeUndefined()

      // Reset the resolver to re-read MACRO
      resetResolver()

      // Now the resolver should reflect the new MACRO values
      expect(getBridgeTokenOverride()).toBe('resolved-token')
      expect(getBridgeBaseUrlOverride()).toBe('https://resolved.com')
    })

    it('should work with empty MACRO (undefined)', () => {
      // Temporarily set MACRO to undefined
      ;(globalThis as any).MACRO = undefined

      // Reset should not throw
      resetResolver()

      // Should return undefined for all values
      expect(getBridgeTokenOverride()).toBeUndefined()
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })
  })
})
