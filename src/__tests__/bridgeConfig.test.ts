import {
  getBridgeTokenOverride,
  getBridgeBaseUrlOverride,
  getBridgeAccessToken,
  getBridgeBaseUrl,
  createBridgeOverrideResolver,
  __resetBridgeConfig,
  getResolver,
} from '../bridge/bridgeConfig.js'

// Mock the build-time MACRO constant
const originalMacro = (globalThis as any).MACRO

describe('bridgeConfig security', () => {
  beforeEach(() => {
    // Always set MACRO to default (DEV_BRIDGE_OVERRIDES_ENABLED = false)
    // This ensures tests don't leak state between them, even if a test
    // previously deleted globalThis.MACRO.
    ;(globalThis as any).MACRO = {
      DEV_BRIDGE_OVERRIDES_ENABLED: false,
      BRIDGE_OVERRIDE_TOKEN: '',
      BRIDGE_OVERRIDE_BASE_URL: '',
    }
    // Clear environment variables that are no longer used by the override functions
    // (kept for cleanliness)
    delete process.env.CLAUDE_BRIDGE_OAUTH_TOKEN
    delete process.env.CLAUDE_BRIDGE_BASE_URL
    delete process.env.USER_TYPE
    delete process.env.NODE_ENV
    // Reset cached resolver to ensure clean state
    __resetBridgeConfig()
  })

  afterEach(() => {
    // Restore original MACRO
    ;(globalThis as any).MACRO = originalMacro
  })

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
        BRIDGE_OVERRIDE_TOKEN: 'test-token',
      }
      const resolver = createBridgeOverrideResolver(macro)
      expect(resolver.getBridgeTokenOverride()).toBeUndefined()
    })
  })

  describe('security invariant: resolver captures MACRO at module load time', () => {
    it('should return the same cached resolver on every call', () => {
      const resolver1 = getResolver()
      const resolver2 = getResolver()
      expect(resolver1).toBe(resolver2)
    })

    it('should be immune to runtime modification of globalThis.MACRO after module load', () => {
      // The module was loaded with the default MACRO (DEV_BRIDGE_OVERRIDES_ENABLED = false)
      // The resolver captures these values at module load time.
      const resolver = getResolver()
      expect(resolver.getBridgeTokenOverride()).toBeUndefined()
      expect(resolver.getBridgeBaseUrlOverride()).toBeUndefined()

      // Now simulate an attacker trying to modify MACRO at runtime
      ;(globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: 'stolen-token',
        BRIDGE_OVERRIDE_BASE_URL: 'https://attacker.example',
      }

      // The resolver should still return the captured values (undefined)
      // because values were captured at module load time
      expect(resolver.getBridgeTokenOverride()).toBeUndefined()
      expect(resolver.getBridgeBaseUrlOverride()).toBeUndefined()
      expect(getResolver().getBridgeTokenOverride()).toBeUndefined()
      expect(getResolver().getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should NOT pick up MACRO changes made after reset', () => {
      // __resetBridgeConfig re-reads the CURRENT globalThis.MACRO
      // and creates a new resolver. This is a test-only function.

      // Set a new MACRO value
      ;(globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: 'reset-token',
        BRIDGE_OVERRIDE_BASE_URL: 'https://reset.example',
      }

      // Reset the resolver to capture the new MACRO value
      __resetBridgeConfig()

      // Now the resolver should reflect the new MACRO
      expect(getBridgeTokenOverride()).toBe('reset-token')
      expect(getBridgeBaseUrlOverride()).toBe('https://reset.example')

      // But if we modify MACRO again without reset, the resolver should NOT change
      ;(globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: false,
        BRIDGE_OVERRIDE_TOKEN: 'evil-token',
        BRIDGE_OVERRIDE_BASE_URL: 'https://evil.example',
      }

      // Resolver still has the values from the last reset
      expect(getBridgeTokenOverride()).toBe('reset-token')
      expect(getBridgeBaseUrlOverride()).toBe('https://reset.example')
    })
  })

  describe('getBridgeTokenOverride and getBridgeBaseUrlOverride', () => {
    it('should return undefined by default (DEV_BRIDGE_OVERRIDES_ENABLED = false)', () => {
      expect(getBridgeTokenOverride()).toBeUndefined()
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })
  })

  // Note: getBridgeAccessToken and getBridgeBaseUrl tests are omitted because
  // they depend on the real OAuth store which may not be available in the test environment.
})