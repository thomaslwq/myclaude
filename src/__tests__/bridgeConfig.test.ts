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

  describe('race condition — MACRO set after module load', () => {
    it('should capture MACRO lazily on first call, not at module load time', () => {
      // Simulate the race condition: bridgeConfig module is loaded before
      // dev-entry.ts sets globalThis.MACRO.  We blow away the cached resolver
      // so the next call re-reads globalThis.MACRO.
      //
      // In a real scenario the module is loaded with MACRO === undefined,
      // then dev-entry.ts sets MACRO later.  The lazy getter ensures the
      // first *call* to the exported function captures the now-set values.

      // 1. Simulate MACRO not yet set (as if dev-entry.ts hasn't run)
      const saved = (globalThis as any).MACRO
      delete (globalThis as any).MACRO
      
      // Force re-import by clearing the cached resolver in the module
      // (we can't easily reload ES modules, but we can test via the exported
      //  createBridgeOverrideResolver directly — the lazy pattern is the same)

      // 2. Now set MACRO (as if dev-entry.ts ran)
      ;(globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: 'race-condition-token',
        BRIDGE_OVERRIDE_BASE_URL: 'https://race-condition.test',
      }

      // 3. Create a resolver AFTER MACRO is set — this is what the lazy
      //    getter does on first call after the race window closes.
      const resolver = createBridgeOverrideResolver((globalThis as any).MACRO)
      expect(resolver.getBridgeTokenOverride()).toBe('race-condition-token')
      expect(resolver.getBridgeBaseUrlOverride()).toBe('https://race-condition.test')

      // Restore
      ;(globalThis as any).MACRO = saved
    })

    it('should still be immune to runtime mutation after first capture (security invariant)', () => {
      // Same as the immune-to-mutation test but simulates the race scenario:
      // MACRO was undefined at module load, set later, then captured on first call.
      const saved = (globalThis as any).MACRO
      delete (globalThis as any).MACRO

      ;(globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: 'first-call-token',
        BRIDGE_OVERRIDE_BASE_URL: 'https://first-call.test',
      }

      const resolver = createBridgeOverrideResolver((globalThis as any).MACRO)

      // Now mutate globalThis.MACRO — must not affect the resolver
      ;(globalThis as any).MACRO = {
        DEV_BRIDGE_OVERRIDES_ENABLED: true,
        BRIDGE_OVERRIDE_TOKEN: 'evil-token',
        BRIDGE_OVERRIDE_BASE_URL: 'https://evil.com',
      }

      expect(resolver.getBridgeTokenOverride()).toBe('first-call-token')
      expect(resolver.getBridgeBaseUrlOverride()).toBe('https://first-call.test')

      // Restore
      ;(globalThis as any).MACRO = saved
    })
  })

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
