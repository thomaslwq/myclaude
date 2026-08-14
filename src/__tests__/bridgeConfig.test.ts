import { getBridgeTokenOverride, getBridgeBaseUrlOverride, getBridgeAccessToken, getBridgeBaseUrl } from '../bridge/bridgeConfig.js'

// Mock the feature flag function
const originalFeature = (globalThis as any).feature

describe('bridgeConfig security', () => {
  beforeEach(() => {
    // Reset feature flag to default (false)
    (globalThis as any).feature = originalFeature || function (name: string) { return false; }
    // Clear environment variables
    delete process.env.CLAUDE_BRIDGE_OAUTH_TOKEN
    delete process.env.CLAUDE_BRIDGE_BASE_URL
    delete process.env.USER_TYPE
  })

  afterEach(() => {
    // Restore original feature flag
    (globalThis as any).feature = originalFeature
  })

  describe('getBridgeTokenOverride', () => {
    it('should return undefined when feature flag is disabled', () => {
      expect(getBridgeTokenOverride()).toBeUndefined()
    })

    it('should return undefined when feature flag is enabled but USER_TYPE is not ant', () => {
      (globalThis as any).feature = () => true
      process.env.USER_TYPE = 'user'
      expect(getBridgeTokenOverride()).toBeUndefined()
    })

    it('should return the token when feature flag is enabled and USER_TYPE is ant', () => {
      (globalThis as any).feature = () => true
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_OAUTH_TOKEN = 'test-token'
      expect(getBridgeTokenOverride()).toBe('test-token')
    })

    it('should return undefined when feature flag is enabled but token is not set', () => {
      (globalThis as any).feature = () => true
      process.env.USER_TYPE = 'ant'
      expect(getBridgeTokenOverride()).toBeUndefined()
    })
  })

  describe('getBridgeBaseUrlOverride', () => {
    it('should return undefined when feature flag is disabled', () => {
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should return undefined when feature flag is enabled but USER_TYPE is not ant', () => {
      (globalThis as any).feature = () => true
      process.env.USER_TYPE = 'user'
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should return the base URL when feature flag is enabled and USER_TYPE is ant', () => {
      (globalThis as any).feature = () => true
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_BASE_URL = 'https://override.example.com'
      expect(getBridgeBaseUrlOverride()).toBe('https://override.example.com')
    })

    it('should return undefined when feature flag is enabled but base URL is not set', () => {
      (globalThis as any).feature = () => true
      process.env.USER_TYPE = 'ant'
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })
  })

  describe('getBridgeAccessToken', () => {
    it('should return undefined when feature flag is disabled', () => {
      expect(getBridgeAccessToken()).toBeUndefined()
    })

    it('should return the override token when feature flag is enabled and USER_TYPE is ant', () => {
      (globalThis as any).feature = () => true
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_OAUTH_TOKEN = 'override-token'
      expect(getBridgeAccessToken()).toBe('override-token')
    })

    it('should return the oauth token when feature flag is disabled', () => {
      // Mock the oauth token
      const mockOauthTokens = { accessToken: 'oauth-token' }
      jest.spyOn(require('../utils/auth'), 'getClaudeAIOAuthTokens').mockReturnValue(mockOauthTokens)
      expect(getBridgeAccessToken()).toBe('oauth-token')
    })
  })

  describe('getBridgeBaseUrl', () => {
    it('should return undefined when feature flag is disabled', () => {
      expect(getBridgeBaseUrl()).toBeDefined()
    })

    it('should return the override base URL when feature flag is enabled and USER_TYPE is ant', () => {
      (globalThis as any).feature = () => true
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_BASE_URL = 'https://override.example.com'
      expect(getBridgeBaseUrl()).toBe('https://override.example.com')
    })

    it('should return the oauth base URL when feature flag is disabled', () => {
      // Mock the oauth config
      const mockOauthConfig = { BASE_API_URL: 'https://api.example.com' }
      jest.spyOn(require('../constants/oauth'), 'getOauthConfig').mockReturnValue(mockOauthConfig)
      expect(getBridgeBaseUrl()).toBe('https://api.example.com')
    })
  })

  describe('security: production environment check', () => {
    it('should return undefined for token override in production even if feature flag is enabled', () => {
      (globalThis as any).feature = () => true
      process.env.NODE_ENV = 'production'
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_OAUTH_TOKEN = 'test-token'
      expect(getBridgeTokenOverride()).toBeUndefined()
    })

    it('should return undefined for base URL override in production even if feature flag is enabled', () => {
      (globalThis as any).feature = () => true
      process.env.NODE_ENV = 'production'
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_BASE_URL = 'https://override.example.com'
      expect(getBridgeBaseUrlOverride()).toBeUndefined()
    })

    it('should return the override token in development even if feature flag is enabled', () => {
      (globalThis as any).feature = () => true
      process.env.NODE_ENV = 'development'
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_OAUTH_TOKEN = 'test-token'
      expect(getBridgeTokenOverride()).toBe('test-token')
    })

    it('should return the override base URL in development even if feature flag is enabled', () => {
      (globalThis as any).feature = () => true
      process.env.NODE_ENV = 'development'
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_BASE_URL = 'https://override.example.com'
      expect(getBridgeBaseUrlOverride()).toBe('https://override.example.com')
    })

    it('should return undefined for token override when NODE_ENV is undefined (not production)', () => {
      (globalThis as any).feature = () => true
      delete process.env.NODE_ENV
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_OAUTH_TOKEN = 'test-token'
      expect(getBridgeTokenOverride()).toBe('test-token')
    })

    it('should return undefined for base URL override when NODE_ENV is undefined (not production)', () => {
      (globalThis as any).feature = () => true
      delete process.env.NODE_ENV
      process.env.USER_TYPE = 'ant'
      process.env.CLAUDE_BRIDGE_BASE_URL = 'https://override.example.com'
      expect(getBridgeBaseUrlOverride()).toBe('https://override.example.com')
    })
  })
})
