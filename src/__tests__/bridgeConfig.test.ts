import { getBridgeTokenOverride, getBridgeBaseUrlOverride, getBridgeAccessToken, getBridgeBaseUrl } from '../bridge/bridgeConfig.js'

// Mock the build-time MACRO constant
const originalMacro = (globalThis as any).MACRO

describe('bridgeConfig security', () => {
  beforeEach(() => {
    // Reset MACRO to default (DEV_BRIDGE_OVERRIDES_ENABLED = false)
    (globalThis as any).MACRO = originalMacro || { DEV_BRIDGE_OVERRIDES_ENABLED: false }
    // Clear environment variables
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

    it('should return undefined when feature flag is enabled but USER_TYPE is not ant', () => {
      (globalThis as any).MACRO = { DEV_BRIDGE_OVERRIDES_ENABLED: true }
      process.env.USER_TYPE = 'user'
      expect(getBridgeTokenOverride()).toBeUndefined()
    })

    it('should return the token when feature flag is enabled and USER_TYPE is ant', () => {
      (globalThis as any).MACRO = { DEV_BRIDGE_OVERRIDES_ENABLED: true }
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_OAUTH_TOKEN = 'test-token'
      expect(getBridgeTokenOverride()).toBe('test-token')
    })

    it('should return undefined when feature flag is enabled but token is not set', () => {
      (globalThis as any).MACRO = { DEV_BRIDGE_OVERRIDES_ENABLED: true }
      process.env.USER_TYPE = 'ant'
      expect(getBridgeTokenOverride()).toBeUndefined()
    })

    it('should be secure against runtime NODE_ENV manipulation', () => {
      // Even if NODE_ENV is set to 'development' or any other value,
      // the override should not be returned because DEV_BRIDGE_OVERRIDES_ENABLED
      // is a compile-time constant that is false in production builds.
      (globalThis as any).MACRO = { DEV_BRIDGE_OVERRIDES_ENABLED: false }
      process.env.NODE_ENV = 'development'
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_OAUTH_TOKEN = 'test-token'
      expect(getBridgeTokenOverride()).toBeUndefined()
    })
  })

  describe('getBridgeBaseUrlOverride', () => {
    it('should return undefined when feature flag is disabled (compile-time constant)', () => {
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should return undefined when feature flag is enabled but USER_TYPE is not ant', () => {
      (globalThis as any).MACRO = { DEV_BRIDGE_OVERRIDES_ENABLED: true }
      process.env.USER_TYPE = 'user'
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should return the base URL when feature flag is enabled and USER_TYPE is ant', () => {
      (globalThis as any).MACRO = { DEV_BRIDGE_OVERRIDES_ENABLED: true }
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_BASE_URL = 'https://override.example.com'
      expect(getBridgeBaseUrlOverride()).toBe('https://override.example.com')
    })

    it('should return undefined when feature flag is enabled but base URL is not set', () => {
      (globalThis as any).MACRO = { DEV_BRIDGE_OVERRIDES_ENABLED: true }
      process.env.USER_TYPE = 'ant'
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should be secure against runtime NODE_ENV manipulation', () => {
      // Even if NODE_ENV is set to 'development' or any other value,
      // the override should not be returned because DEV_BRIDGE_OVERRIDES_ENABLED
      // is a compile-time constant that is false in production builds.
      (globalThis as any).MACRO = { DEV_BRIDGE_OVERRIDES_ENABLED: false }
      process.env.NODE_ENV = 'development'
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_BASE_URL = 'https://override.example.com'
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })
  })

  describe('getBridgeAccessToken', () => {
    it('should return undefined when feature flag is disabled (compile-time constant)', () => {
      expect(getBridgeAccessToken()).toBeUndefined()
    })

    it('should return the override token when feature flag is enabled and USER_TYPE is ant', () => {
      (globalThis as any).MACRO = { DEV_BRIDGE_OVERRIDES_ENABLED: true }
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_OAUTH_TOKEN = 'test-token'
      expect(getBridgeAccessToken()).toBe('test-token')
    })
  })

  describe('getBridgeBaseUrl', () => {
    it('should return the override URL when feature flag is enabled and USER_TYPE is ant', () => {
      (globalThis as any).MACRO = { DEV_BRIDGE_OVERRIDES_ENABLED: true }
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_BASE_URL = 'https://override.example.com'
      expect(getBridgeBaseUrl()).toBe('https://override.example.com')
    })
  })
})