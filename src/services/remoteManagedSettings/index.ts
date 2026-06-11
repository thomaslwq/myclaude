/**
 * Remote Managed Settings - no-op stubs for open-source build.
 * All functions return defaults (disabled/empty).
 */

export function initializeRemoteManagedSettingsLoadingPromise(): void {}

export function isEligibleForRemoteManagedSettings(): boolean {
  return false
}

export async function waitForRemoteManagedSettingsToLoad(): Promise<void> {}

export async function loadRemoteManagedSettings(): Promise<void> {}

export async function clearRemoteManagedSettingsCache(): Promise<void> {}

export async function refreshRemoteManagedSettings(): Promise<void> {}

export function startBackgroundPolling(): void {}

export function stopBackgroundPolling(): void {}
