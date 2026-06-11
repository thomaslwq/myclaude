/**
 * Analytics sink stubs - silently drops all events.
 * All analytics/telemetry is disabled in the open-source build.
 */
import { attachAnalyticsSink } from './index.js'

function logEventImpl(_eventName: string, _metadata: Record<string, unknown>): void {
  // Silently dropped
}

function logEventAsyncImpl(
  _eventName: string,
  _metadata: Record<string, unknown>,
): Promise<void> {
  return Promise.resolve()
}

export function initializeAnalyticsGates(): void {
  // No-op for open-source build
}

/**
 * Initialize the analytics sink.
 * Idempotent: safe to call multiple times.
 */
export function initializeAnalyticsSink(): void {
  attachAnalyticsSink({
    logEvent: logEventImpl,
    logEventAsync: logEventAsyncImpl,
  })
}
