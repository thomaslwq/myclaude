import axios from 'axios'
import lodashMemoize from 'lodash-es/memoize.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../analytics/index.js'
import { getOauthAccountInfo, isConsumerSubscriber } from '../../utils/auth.js'
import { logForDebugging } from '../../utils/debug.js'
import { gracefulShutdown } from '../../utils/gracefulShutdown.js'
import { isEssentialTrafficOnly } from '../../utils/privacyLevel.js'
import { writeToStderr } from '../../utils/process.js'
import { getOauthConfig } from '../../constants/oauth.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import {
  getAuthHeaders,
  getUserAgent,
  withOAuth401Retry,
} from '../../utils/http.js'
import { logError } from '../../utils/log.js'
import { getClaudeCodeUserAgent } from '../../utils/userAgent.js'
import { Mutex } from 'async-mutex'

// Per-account mutex to prevent concurrent config writes in fetchAndStoreGroveConfig
const groveConfigMutexes = new Map<string, Mutex>()
// Mutex to protect the creation of per-account mutexes (atomic check-and-set)
const groveConfigMapMutex = new Mutex()

// Cache expiration: 24 hours
const GROVE_CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000

// Configurable timeout for Grove API requests (default: 3 seconds)
// Can be overridden via GROVE_API_TIMEOUT_MS environment variable
const GROVE_API_TIMEOUT_MS = parseInt(
  process.env.GROVE_API_TIMEOUT_MS ?? '3000',
  10,
)

/**
 * Creates a memoized async function with TTL (time-to-live) cache expiration.
 * If the cache is expired, the function re-executes and updates the cache.
 * When the cache is cleared manually (via updateGroveSettings or markGroveNoticeViewed),
 * the underlying lodash memoize cache is cleared as well.
 */
function memoizeWithTTL<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  ttlMs: number,
): T & { cache: { clear: () => void } } {
  // Track the timestamp of the last successful cache write
  let lastCachedAt = 0
  const memoized = lodashMemoize(fn) as T & { cache: { clear: () => void } }

  const originalClear = memoized.cache.clear.bind(memoized.cache)

  /**
   * Map of in-flight promises keyed by the first argument.
   * This replaces the old mutex-based approach, avoiding potential deadlocks
   * if the refresh function ever re-enters the memoized function.
   */
  const pendingRefreshes = new Map<string, Promise<any>>()

  // Per-key mutexes to prevent unnecessary blocking when different keys are used
  const keyMutexes = new Map<string, Mutex>()

  // Override the original function to check TTL
  const wrapped = (async (...args: any[]) => {
    const now = Date.now()
    const cacheExpired = lastCachedAt !== 0 && now - lastCachedAt >= ttlMs

    if (cacheExpired) {
      const key = String(args[0] ?? '_default')

      // Get or create a per-key mutex to atomically check if a refresh is
      // already in progress and start a new one if not. This prevents duplicate
      // API calls when two concurrent calls both pass the cacheExpired check
      // before either sets the pending promise, while avoiding unnecessary
      // blocking between different keys.
      let keyMutex = keyMutexes.get(key)
      if (!keyMutex) {
        keyMutex = new Mutex()
        keyMutexes.set(key, keyMutex)
      }
      const release = await keyMutex.acquire()
      try {
        // Double-check inside the mutex: another call may have already started a refresh
        const existing = pendingRefreshes.get(key)
        if (existing) {
          return existing
        }

        // Otherwise, start a new refresh and store the promise
        const refreshPromise = (async () => {
          try {
            // Double-check: another call may have already refreshed the cache
            // while we were setting up the promise.
            const now2 = Date.now()
            if (lastCachedAt !== 0 && now2 - lastCachedAt < ttlMs) {
              // Cache was refreshed by another call — use the cached value.
              return memoized(...args)
            }

            // Cache expired — try to refresh by calling the original function directly.
            // Do NOT clear the underlying lodash cache beforehand, so that if the
            // refresh fails (transient error) the old cached value is preserved.
            try {
              const freshResult = await fn(...args)
              if (
                freshResult &&
                typeof freshResult === 'object' &&
                'success' in freshResult &&
                freshResult.success === true
              ) {
                // Success — update the lodash cache with the fresh result
                originalClear()
                memoized.cache.set(args[0], freshResult)
                lastCachedAt = Date.now()
                return freshResult
              }
              // Transient failure — return the cached value (lodash still has it)
              return memoized(...args)
            } catch (error) {
              // Transient error — return the cached value (lodash still has it)
              return memoized(...args)
            }
          } finally {
            // Clean up the pending promise so future calls can start a fresh refresh
            pendingRefreshes.delete(key)
          }
        })()

        pendingRefreshes.set(key, refreshPromise)
        return refreshPromise
      } finally {
        release()
      }
    }

    try {
      const result = await memoized(...args)
      if (
        result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === true
      ) {
        // Only update timestamp on success
        lastCachedAt = Date.now()
      } else if (
        result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === false
      ) {
        // Do NOT update lastCachedAt on transient failure — this allows the
        // cache to be retried sooner (next time cacheExpired check runs).
        // The old cached value is preserved in the lodash cache.
      }
      return result
    } catch (error) {
      // Do NOT update lastCachedAt on transient errors — this allows the
      // cache to be retried sooner (next time cacheExpired check runs).
      // The old cached value is preserved in the lodash cache.
      logError(error)
      return { success: false } as any
    }
  }) as T

  wrapped.cache = {
    clear: () => {
      originalClear()
      lastCachedAt = 0
    },
  }

  return wrapped as T & { cache: { clear: () => void } }
}

export type AccountSettings = {
  grove_enabled: boolean | null
  grove_notice_viewed_at: string | null
}

export type GroveConfig = {
  grove_enabled: boolean
  domain_excluded: boolean
  notice_is_grace_period: boolean
  notice_reminder_frequency: number | null
}

/**
 * Result type that distinguishes between API failure and success.
 * - success: true means API call succeeded (data may still contain null fields)
 * - success: false means API call failed after retry
 */
export type ApiResult<T> = { success: true; data: T } | { success: false }

/**
 * Get the current Grove settings for the user account.
 * Returns ApiResult to distinguish between API failure and success.
 * Uses existing OAuth 401 retry, then returns failure if that doesn't help.
 *
 * Memoized for the session to avoid redundant per-render requests.
 * Cache is invalidated in updateGroveSettings() so post-toggle reads are fresh.
 */
export const getGroveSettings = memoizeWithTTL(
  async (): Promise<ApiResult<AccountSettings>> => {
    // Grove is a notification feature; during an outage, skipping it is correct.
    if (isEssentialTrafficOnly()) {
      return { success: false }
    }
    try {
      const response = await withOAuth401Retry(() => {
        const authHeaders = getAuthHeaders()
        if (authHeaders.error) {
          throw new Error(`Failed to get auth headers: ${authHeaders.error}`)
        }
        return axios.get<AccountSettings>(
          `${getOauthConfig().BASE_API_URL}/api/oauth/account/settings`,
          {
            headers: {
              ...authHeaders.headers,
              'User-Agent': getClaudeCodeUserAgent(),
            },
          },
        )
      })
      return { success: true, data: response.data }
    } catch (err) {
      logError(err)
      // Don't clear cache on transient failures — keep the last successful
      // result to avoid unnecessary API calls on intermittent network issues.
      // The cache will naturally expire after TTL (24h), allowing a retry then.
      return { success: false }
    }
  },
  GROVE_CACHE_EXPIRATION_MS,
)

/**
 * Mark that the Grove notice has been viewed by the user
 */
export async function markGroveNoticeViewed(): Promise<void> {
  try {
    await withOAuth401Retry(() => {
      const authHeaders = getAuthHeaders()
      if (authHeaders.error) {
        throw new Error(`Failed to get auth headers: ${authHeaders.error}`)
      }
      return axios.post(
        `${getOauthConfig().BASE_API_URL}/api/oauth/account/grove_notice_viewed`,
        {},
        {
          headers: {
            ...authHeaders.headers,
            'User-Agent': getClaudeCodeUserAgent(),
          },
        },
      )
    })
    // This mutates grove_notice_viewed_at server-side — Grove.tsx:87 reads it
    // to decide whether to show the dialog. Without invalidation a same-session
    // remount would read stale viewed_at:null and re-show the dialog.
    getGroveSettings.cache.clear?.()
  } catch (err) {
    logError(err)
  }
}

/**
 * Update Grove settings for the user account
 */
export async function updateGroveSettings(
  groveEnabled: boolean,
): Promise<void> {
  try {
    await withOAuth401Retry(() => {
      const authHeaders = getAuthHeaders()
      if (authHeaders.error) {
        throw new Error(`Failed to get auth headers: ${authHeaders.error}`)
      }
      return axios.patch(
        `${getOauthConfig().BASE_API_URL}/api/oauth/account/settings`,
        {
          grove_enabled: groveEnabled,
        },
        {
          headers: {
            ...authHeaders.headers,
            'User-Agent': getClaudeCodeUserAgent(),
          },
        },
      )
    })
    // Invalidate memoized settings so the post-toggle confirmation
    // read in privacy-settings.tsx picks up the new value.
    getGroveSettings.cache.clear?.()
  } catch (err) {
    logError(err)
  }
}

/**
 * Check if user is qualified for Grove (non-blocking, cache-first).
 *
 * This function never blocks on network - it returns cached data immediately
 * and fetches in the background if needed. On cold start (no cache), it returns
 * false and the Grove dialog won't show until the next session.
 */
export async function isQualifiedForGrove(): Promise<boolean> {
  if (!isConsumerSubscriber()) {
    return false
  }

  const accountId = getOauthAccountInfo()?.accountUuid
  if (!accountId) {
    return false
  }

  const globalConfig = getGlobalConfig()
  const cachedEntry = globalConfig.groveConfigCache?.[accountId]
  const now = Date.now()

  // No cache - fetch synchronously (with existing timeout) to get the config
  // This ensures the Grove dialog can show in the current session if eligible
  if (!cachedEntry) {
    logForDebugging(
      'Grove: No cache, fetching config synchronously',
    )
    await fetchAndStoreGroveConfig(accountId)
    // Re-read cache after fetch
    const updatedConfig = getGlobalConfig().groveConfigCache?.[accountId]
    if (updatedConfig) {
      return updatedConfig.grove_enabled
    }
    return false
  }

  // Cache exists but is stale - refresh synchronously and return updated value
  if (now - cachedEntry.timestamp > GROVE_CACHE_EXPIRATION_MS) {
    logForDebugging(
      'Grove: Cache stale, refreshing config',
    )
    await fetchAndStoreGroveConfig(accountId)
    // Re-read cache after fetch
    const updatedConfig = getGlobalConfig().groveConfigCache?.[accountId]
    if (updatedConfig) {
      return updatedConfig.grove_enabled
    }
    return cachedEntry.grove_enabled
  }

  // Cache is fresh - return it immediately
  logForDebugging('Grove: Using fresh cached config')
  return cachedEntry.grove_enabled
}

/**
 * Fetch Grove config from API and store in cach
 */
async function fetchAndStoreGroveConfig(accountId: string): Promise<void> {
  // Serialize per-account fetch-and-store operations to avoid lost updates
  // Use async-mutex for correctness and clarity
  // Use a separate mutex to protect the map check-and-set atomically
  const mapRelease = await groveConfigMapMutex.acquire()
  let mutex = groveConfigMutexes.get(accountId)
  if (!mutex) {
    mutex = new Mutex()
    groveConfigMutexes.set(accountId, mutex)
  }
  // Keep the map mutex held until after the per-account mutex is acquired
  // to ensure atomic check-and-set of the mutex instance
  const release = await mutex.acquire()
  mapRelease()
  try {
    // Retry up to 2 times with a short delay for transient failures
    let lastError: Error | undefined
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await getGroveNoticeConfig()
        if (!result.success) {
          // On failure, wait briefly and retry
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 500))
            continue
          }
          return
        }
        const groveEnabled = result.data.grove_enabled
        const cachedEntry = getGlobalConfig().groveConfigCache?.[accountId]
        if (
          cachedEntry?.grove_enabled === groveEnabled &&
          Date.now() - cachedEntry.timestamp <= GROVE_CACHE_EXPIRATION_MS
        ) {
          return
        }
        saveGlobalConfig(current => ({
          ...current,
          groveConfigCache: {
            ...current.groveConfigCache,
            [accountId]: {
              grove_enabled: groveEnabled,
              timestamp: Date.now(),
            },
          },
        }))
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
    }
    logForDebugging(`Grove: Failed to fetch and store config after 3 attempts: ${lastError}`)
  } finally {
    release()
  }
}

/**
 * Get Grove Statsig configuration from the API.
 * Returns ApiResult to distinguish between API failure and success.
 * Uses existing OAuth 401 retry, then returns failure if that doesn't help.
 */
export const getGroveNoticeConfig = memoizeWithTTL(
  async (): Promise<ApiResult<GroveConfig>> => {
    // Grove is a notification feature; during an outage, skipping it is correct.
    if (isEssentialTrafficOnly()) {
      return { success: false }
    }
    try {
      const response = await withOAuth401Retry(() => {
        const authHeaders = getAuthHeaders()
        if (authHeaders.error) {
          throw new Error(`Failed to get auth headers: ${authHeaders.error}`)
        }
        return axios.get<GroveConfig>(
          `${getOauthConfig().BASE_API_URL}/api/claude_code_grove`,
          {
            headers: {
              ...authHeaders.headers,
              'User-Agent': getUserAgent(),
            },
            timeout: GROVE_API_TIMEOUT_MS, // Short timeout - if slow, skip Grove dialog
          },
        )
      })

      // Map the API response to the GroveConfig type
      const {
        grove_enabled,
        domain_excluded,
        notice_is_grace_period,
        notice_reminder_frequency,
      } = response.data

      return {
        success: true,
        data: {
          grove_enabled,
          domain_excluded: domain_excluded ?? false,
          notice_is_grace_period: notice_is_grace_period ?? true,
          notice_reminder_frequency,
        },
      }
    } catch (err) {
      logError(err)
      // Log timeout specifically for better debugging
      if (axios.isAxiosError(err) && err.code === 'ECONNABORTED') {
        logForDebugging(
          `Grove: API request timed out after ${GROVE_API_TIMEOUT_MS}ms. This may cause the Grove dialog to be suppressed for users with slow connections.`,
        )
      }
      // Don't clear cache on transient failures — keep the last successful
      // result to avoid unnecessary API calls on intermittent network issues.
      // The cache will naturally expire after TTL (24h), allowing a retry then.
      return { success: false }
    }
  },
  GROVE_CACHE_EXPIRATION_MS,
)

/**
 * Determines whether the Grove dialog should be shown.
 * Returns false if either API call failed (after retry) - we hide the dialog on API failure.
 */
export function calculateShouldShowGrove(
  settingsResult: ApiResult<AccountSettings>,
  configResult: ApiResult<GroveConfig>,
  showIfAlreadyViewed: boolean,
): boolean {
  // Hide dialog on API failure (after retry)
  if (!settingsResult.success || !configResult.success) {
    return false
  }

  const settings = settingsResult.data
  const config = configResult.data

  const hasChosen = settings.grove_enabled !== null
  if (hasChosen) {
    return false
  }
  if (showIfAlreadyViewed) {
    return true
  }
  if (!config.notice_is_grace_period) {
    return true
  }
  // Check if we need to remind the user to accept the terms and choose
  // whether to help improve Claude.
  const reminderFrequency = config.notice_reminder_frequency
  if (reminderFrequency !== null && settings.grove_notice_viewed_at) {
    const daysSinceViewed = Math.floor(
      (Date.now() - new Date(settings.grove_notice_viewed_at).getTime()) /
        (1000 * 60 * 60 * 24),
    )
    return daysSinceViewed >= reminderFrequency
  } else {
    // Show if never viewed before
    const viewedAt = settings.grove_notice_viewed_at
    return viewedAt === null || viewedAt === undefined
  }
}

export async function checkGroveForNonInteractive(): Promise<void> {
  const [settingsResult, configResult] = await Promise.all([
    getGroveSettings(),
    getGroveNoticeConfig(),
  ])

  // Check if user hasn't made a choice yet (returns false on API failure)
  const shouldShowGrove = calculateShouldShowGrove(
    settingsResult,
    configResult,
    false,
  )

  if (shouldShowGrove) {
    // shouldShowGrove is only true if both API calls succeeded
    const config = configResult.success ? configResult.data : null
    logEvent('tengu_grove_print_viewed', {
      dismissable:
        config?.notice_is_grace_period as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    if (config === null || config.notice_is_grace_period) {
      // Grace period is still active - show informational message and continue
      writeToStderr(
        '\nAn update to our Consumer Terms and Privacy Policy will take effect on October 8, 2025. Run `claude` to review the updated terms.\n\n',
      )
      await markGroveNoticeViewed()
    } else {
      // Grace period has ended - show error message and exit
      writeToStderr(
        '\n[ACTION REQUIRED] An update to our Consumer Terms and Privacy Policy has taken effect on October 8, 2025. You must run `claude` to review the updated terms.\n\n',
      )
      await gracefulShutdown(1)
    }
  }
}