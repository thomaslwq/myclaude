/**
 * Datadog analytics - no-op stubs for open-source build.
 * Silently drops all Datadog events.
 */
import memoize from 'lodash-es/memoize.js'

export const initializeDatadog = memoize(async (): Promise<boolean> => {
  return false
})

export async function shutdownDatadog(): Promise<void> {}

export async function trackDatadogEvent(
  _eventName: string,
  _properties: Record<string, unknown>,
): Promise<void> {}
