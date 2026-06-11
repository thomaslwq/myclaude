/**
 * GrowthBook stubs - All functions return defaults.
 * Feature flags and A/B testing are disabled in the open-source build.
 */
import { memoize } from 'lodash-es'
import { getGrowthBookClientKey } from '../../constants/keys.js'

export type GrowthBookUserAttributes = {
  id: string
  sessionId: string
  deviceID: string
  platform: 'win32' | 'darwin' | 'linux'
  apiBaseUrlHost?: string
  organizationUUID?: string
  accountUUID?: string
  userType?: string
  subscriptionType?: string
  rateLimitTier?: string
  firstTokenTime?: number
  email?: string
  appVersion?: string
  github?: Record<string, string>
}

type GrowthBookRefreshListener = () => void | Promise<void>

const refreshListeners = new Set<GrowthBookRefreshListener>()

export function onGrowthBookRefresh(
  listener: GrowthBookRefreshListener,
): () => void {
  refreshListeners.add(listener)
  return () => { refreshListeners.delete(listener) }
}

export function hasGrowthBookEnvOverride(_feature: string): boolean {
  return false
}

export function getAllGrowthBookFeatures(): Record<string, unknown> {
  return {}
}

export function getGrowthBookConfigOverrides(): Record<string, unknown> {
  return {}
}

export function setGrowthBookConfigOverride(
  _feature: string,
  _value: unknown,
): void {}

export function clearGrowthBookConfigOverrides(): void {}

export function getApiBaseUrlHost(): string | undefined {
  return process.env.ANTHROPIC_BASE_URL
    ? new URL(process.env.ANTHROPIC_BASE_URL).hostname
    : undefined
}

let _gbInitialized = false
const _initSignal: Promise<void> = Promise.resolve()

export function initializeGrowthBook(): Promise<void> {
  _gbInitialized = true
  return Promise.resolve()
}

export function hasGrowthBookBeenInitialized(): boolean {
  return _gbInitialized
}

export function waitForGrowthBookInit(): Promise<void> {
  return _initSignal
}

export async function getFeatureValue_DEPRECATED<T>(
  _feature: string,
  defaultValue: T,
): Promise<T> {
  return defaultValue
}

export function getFeatureValue_CACHED_MAY_BE_STALE<T>(
  _feature: string,
  defaultValue: T,
): T {
  return defaultValue
}

export function getFeatureValue_CACHED_WITH_REFRESH<T>(
  _feature: string,
  defaultValue: T,
): T {
  return defaultValue
}

export function checkStatsigFeatureGate_CACHED_MAY_BE_STALE(
  _gate: string,
): boolean {
  return false
}

export async function checkSecurityRestrictionGate(
  _gate: string,
): Promise<boolean> {
  return false
}

export async function checkGate_CACHED_OR_BLOCKING(
  _gate: string,
): Promise<boolean> {
  return false
}

export function refreshGrowthBookAfterAuthChange(): void {}

export function resetGrowthBook(): void {
  refreshListeners.clear()
}

export async function refreshGrowthBookFeatures(): Promise<void> {}

export function setupPeriodicGrowthBookRefresh(): void {}

export function stopPeriodicGrowthBookRefresh(): void {}

export async function getDynamicConfig_BLOCKS_ON_INIT<T>(
  _configName: string,
  defaultValue: T,
): Promise<T> {
  return defaultValue
}

export function getDynamicConfig_CACHED_MAY_BE_STALE<T>(
  _configName: string,
  defaultValue: T,
): T {
  return defaultValue
}
