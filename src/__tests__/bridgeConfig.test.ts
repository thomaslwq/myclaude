import { getBridgeTokenOverride, getBridgeBaseUrlOverride, getBridgeAccessToken, getBridgeBaseUrl } from '../bridge/bridgeConfig.js'

// Mock the build-time MACRO constant
const originalMacro = (globalThis as any).MACRO

describe('bridgeConfig security', () => {
  beforeEach(() => {
    // Reset MACRO to default (DEV_BRIDGE_OVERRIDES_ENABLED = false)
    (globalThis as any).MACRO = originalMacro || { DEV_BRIDGE_OVERRIDES_ENABLED: false }
    // Clear environment variables that are no longer used by the override functions
    // (kept for cleanliness)
    delete process.env.CLAUDE_BRIDGE_OAUTH_TOKEN
    delete process.env.CLAUDE_BRIDGE_BASE_URL
    delete process.env.USER_TYPE
    delete process.env.NODE_ENV
  })

  afterEach(() => {
    // Restore original MACRO
    (globalThis as any).MACRO = originalMacro
  })

  describe('getBridgeTokenOverride', () => {
    it('should return undefined when feature flag is disabled (compile-time constant)', () => {
      expect(getBridgeTokenOverride()).toBeUndefined()
    })

    it('should return the token when feature flag is enabled and BRIDGE_OVERRIDE_TOKEN is set in MACRO', () => {
      (globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: 'test-token',
      }
      expect(getBridgeTokenOverride()).toBe('test-token')
    })

    it('should return undefined when feature flag is enabled but BRIDGE_OVERRIDE_TOKEN is not set', () => {
      (globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: '',
      }
      expect(getBridgeTokenOverride()).toBeUndefined()
    })

    it('should return undefined when feature flag is enabled but BRIDGE_OVERRIDE_TOKEN is empty string', () => {
      (globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: '',
      }
      expect(getBridgeTokenOverride()).toBeUndefined()
    })

    it('should be secure against runtime NODE_ENV manipulation', () => {
      // Even if NODE_ENV is set to 'development' or any other value,
      // the override should not be returned because DEV_BRIDGE_OVERRIDES_ENABLED
      // is a compile-time constant that is false in production builds.
      (globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: false,
        BRIDGE_OVERRIDE_TOKEN: 'test-token',
      }
      process.env.NODE_ENV = 'development'
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_OAUTH_TOKEN = 'env-token'
      expect(getBridgeTokenOverride()).toBeUndefined()
    })

    it('should be secure against runtime environment variable injection', () => {
      // Setting CLAUDE_BRIDGE_OAUTH_TOKEN at runtime should NOT affect
      // the override because the value is read from the compile-time MACRO.
      (globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: 'macro-token',
      }
      process.env.CLAUDE_BRIDGE_OAUTH_TOKEN = 'evil-token'
      expect(getBridgeTokenOverride()).toBe('macro-token')
      expect(getBridgeTokenOverride()).not.toBe('evil-token')
    })

    it('should not be affected by USER_TYPE environment variable', () => {
      // The USER_TYPE check has been removed; the override is controlled
      // solely by the build-time MACRO.
      (globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: 'test-token',
      }
      process.env.USER_TYPE = 'attacker'
      expect(getBridgeTokenOverride()).toBe('test-token')
    })

    it('should not be affected by NODE_ENV environment variable', () => {
      // The NODE_ENV check has been removed; the override is controlled
      // solely by the build-time MACRO.
      (globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: 'test-token',
      }
      process.env.NODE_ENV = 'production'
      expect(getBridgeTokenOverride()).toBe('test-token')
    })
  })

  describe('getBridgeBaseUrlOverride', () => {
    it('should return undefined when feature flag is disabled (compile-time constant)', () => {
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should return the base URL when feature flag is enabled and BRIDGE_OVERRIDE_BASE_URL is set in MACRO', () => {
      (globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_BASE_URL: 'https://dev.example.com',
      }
      expect(getBridgeBaseUrlOverride()).toBe('https://dev.example.com')
    })

    it('should return undefined when feature flag is enabled but BRIDGE_OVERRIDE_BASE_URL is not set', () => {
      (globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
      }
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should return undefined when feature flag is enabled but BRIDGE_OVERRIDE_BASE_URL is empty string', () => {
      (globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_BASE_URL: '',
      }
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should be secure against runtime NODE_ENV manipulation', () => {
      // Even if NODE_ENV is set to 'development' or any other value,
      // the override should not be returned because DEV_BRIDGE_OVERRIDES_ENABLED
      // is a compile-time constant that is false in production builds.
      (globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: false,
        BRIDGE_OVERRIDE_BASE_URL: 'https://dev.example.com',
      }
      process.env.NODE_ENV = 'development'
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_BASE_URL = 'https://evil.example.com'
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should be secure against runtime environment variable injection', () => {
      // Setting CLAUDE_BRIDGE_BASE_URL at runtime should NOT affect
      // the override because the value is read from the compile-time MACRO.
      (globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_BASE_URL: 'https://safe.example.com',
      }
      process.env.CLAUDE_BRIDGE_BASE_URL = 'https://evil.example.com'
      expect(getBridgeBaseUrlOverride()).toBe('https://safe.example.com')
      expect(getBridgeBaseUrlOverride()).not.toBe('https://evil.example.com')
    })
  })
})
