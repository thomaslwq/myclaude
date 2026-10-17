import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { join } from 'node:path'

// We mock the growthbook module so we can control what
// checkGate_CACHED_OR_BLOCKING returns (including never resolving).
const growthbookPath = join(import.meta.dir, '../../services/analytics/growthbook.js')
const authPath = join(import.meta.dir, '../../utils/auth.js')
const envUtilsPath = join(import.meta.dir, '../../utils/envUtils.js')
const semverPath = join(import.meta.dir, '../../utils/semver.js')

let gateImpl: (gate: string) => Promise<boolean> = () => Promise.resolve(false)

mock.module(growthbookPath, () => ({
  checkGate_CACHED_OR_BLOCKING: (gate: string) => gateImpl(gate),
  getDynamicConfig_CACHED_MAY_BE_STALE: (_n: string, d: unknown) => d,
  getFeatureValue_CACHED_MAY_BE_STALE: (_f: string, d: unknown) => d,
}))

mock.module(authPath, () => ({
  isClaudeAISubscriber: () => true,
  hasProfileScope: () => true,
  getOauthAccountInfo: () => ({ organizationUuid: 'org-1' }),
}))

mock.module(envUtilsPath, () => ({
  isEnvTruthy: (_v: string | undefined) => false,
}))

mock.module(semverPath, () => ({
  lt: (_a: string, _b: string) => false,
}))

// `feature` is a build-time macro from bun:bundle. In tests it isn't
// defined, so we stub it to always return true so the BRIDGE_MODE path
// is exercised.
mock.module('bun:bundle', () => ({
  feature: (_name: string) => true,
}))

const originalMacro = (globalThis as any).MACRO

beforeEach(() => {
  gateImpl = () => Promise.resolve(false)
  ;(globalThis as any).MACRO = {
    VERSION: '1.0.0',
  }
})

afterEach(() => {
  ;(globalThis as any).MACRO = originalMacro
})

// Import AFTER mocks are registered so the module picks them up.
const bridgeEnabled = await import('../bridgeEnabled.js')

describe('isBridgeEnabledBlocking', () => {
  it('returns false when the gate resolves false', async () => {
    gateImpl = () => Promise.resolve(false)
    expect(await bridgeEnabled.isBridgeEnabledBlocking()).toBe(false)
  })

  it('returns true when the gate resolves true', async () => {
    gateImpl = () => Promise.resolve(true)
    expect(await bridgeEnabled.isBridgeEnabledBlocking()).toBe(true)
  })

  it('does not hang when the gate never resolves (gh-1066)', async () => {
    // A promise that never settles — simulates an unreachable GrowthBook.
    gateImpl = () => new Promise<boolean>(() => {})

    const start = Date.now()
    const result = await bridgeEnabled.isBridgeEnabledBlocking()
    const elapsed = Date.now() - start

    expect(result).toBe(false)
    // Must resolve well within the 5s timeout; allow generous slack for CI.
    expect(elapsed).toBeLessThan(6_000)
  })
})

describe('getBridgeDisabledReason', () => {
  it('returns a diagnostic when the gate never resolves (gh-1066)', async () => {
    gateImpl = () => new Promise<boolean>(() => {})

    const start = Date.now()
    const reason = await bridgeEnabled.getBridgeDisabledReason()
    const elapsed = Date.now() - start

    expect(reason).toBe('Remote Control is not yet enabled for your account.')
    expect(elapsed).toBeLessThan(6_000)
  })

  it('returns null when the gate resolves true', async () => {
    gateImpl = () => Promise.resolve(true)
    expect(await bridgeEnabled.getBridgeDisabledReason()).toBeNull()
  })
})
