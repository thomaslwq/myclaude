/**
 * First Party Event Logger - no-op stubs for open-source build.
 */
import { getDynamicConfig_CACHED_MAY_BE_STALE } from './growthbook.js'

export type EventSamplingConfig = {
  [eventName: string]: { sample_rate: number }
}

const EVENT_SAMPLING_CONFIG_NAME = 'tengu_event_sampling_config'

export function getEventSamplingConfig(): EventSamplingConfig {
  return getDynamicConfig_CACHED_MAY_BE_STALE<EventSamplingConfig>(
    EVENT_SAMPLING_CONFIG_NAME,
    {},
  )
}

export function shouldSampleEvent(_eventName: string): number | null {
  return null
}

export function shutdown1PEventLogging(): Promise<void> {
  return Promise.resolve()
}

export function is1PEventLoggingEnabled(): boolean {
  return false
}

export function logEventTo1P(
  _eventName: string,
  _metadata: Record<string, unknown> = {},
): void {
  // No-op
}

export type GrowthBookExperimentData = {
  experimentId: string
  variationId: number
}

export function logGrowthBookExperimentTo1P(
  _data: GrowthBookExperimentData,
): void {}

export function initialize1PEventLogging(): void {}

export async function reinitialize1PEventLoggingIfConfigChanged(): Promise<void> {}
