/**
 * Retry an LLM API call with exponential backoff on retryable errors.
 *
 * Sensenova's free tier rate-limits aggressively (429 "rpm exhausted",
 * "temporarily overloaded"), which previously caused the primary model to
 * fail and immediately fall back to the backup LLM. This helper retries
 * 429 / 5xx / network errors a few times with backoff before giving up.
 *
 * Exported for unit testing (inject fetchFn and a small baseDelayMs).
 */

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * @param {string} url
 * @param {RequestInit} options
 * @param {{maxRetries?: number, baseDelayMs?: number, fetchFn?: typeof fetch, onRetry?: (info: {attempt: number, delayMs: number, error: Error}) => void}} opts
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options, opts = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 5000,
    fetchFn = fetch,
    onRetry = () => {},
  } = opts;

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let retryable = false;
    try {
      const response = await fetchFn(url, options);
      if (response.ok) {
        return response;
      }
      const errText = await response.text().catch(() => 'unknown error');
      lastError = new Error(`LLM API error (${response.status}): ${errText.slice(0, 500)}`);
      retryable = RETRYABLE_STATUS.has(response.status);
    } catch (err) {
      // Network-level failure (fetch rejected / body unreadable) — retryable.
      lastError = err;
      retryable = true;
    }
    if (!retryable || attempt >= maxRetries) {
      throw lastError;
    }
    const delayMs = baseDelayMs * 2 ** attempt;
    onRetry({ attempt: attempt + 1, delayMs, error: lastError });
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw lastError;
}
