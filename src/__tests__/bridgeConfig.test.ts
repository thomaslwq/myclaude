import {
  getBridgeTokenOverride,
  getBridgeBaseUrlOverride,
  getBridgeAccessToken,
  getBridgeBaseUrl,
  createBridgeOverrideResolver,
} from '../bridge/bridgeConfig.js'

// Mock the build-time MACRO constant
const originalMacro = (globalThis as any).MACRO

describe('bridgeConfig security', () => {
  beforeEach(() => {
    // Reset MACRO to default (DEV_BRIDGE_OVERRIDES_ENABLED = false)
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

  // Note: the exported getters capture globalThis.MACRO at module load time.
  // These tests use the original module instance, so they only verify the
  // default (disabled) behavior unless the module is reloaded.
  describe('exported getters (module-load capture)', () => {
    it('should return undefined by default (feature flag disabled)', () => {
      expect(getBridgeTokenOverride()).toBeUndefined()
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should not be affected by runtime globalThis.MACRO replacement', () => {
      // The module captured the original MACRO at load time.
      // Replacing globalThis.MACRO at runtime must not enable the overrides.
      ;(globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: 'evil-token',
        BRIDGE_OVERRIDE_BASE_URL: 'https://evil.com',
      }
      
      expect(getBridgeTokenOverride()).toBeUndefined()
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
      expect(getBridgeAccessToken()).toBeUndefined()
    })

    it('should use production config for base URL when overrides disabled', () => {
      ;(globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: 'evil-token',
        BRIDGE_OVERRIDE_BASE_URL: 'https://evil.com',
      }
      
      // getBridgeBaseUrl falls through to the production OAuth config
      expect(getBridgeBaseUrl()).toBe('https://api.anthropic.com')
    })
  })
})
