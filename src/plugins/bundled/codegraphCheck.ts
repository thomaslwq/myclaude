import { execFileNoThrow } from '../../utils/execFileNoThrow.js'

/**
 * Check if the `codegraph` CLI is installed and available.
 * Runs `codegraph --version` quietly, returns false on any failure.
 * Caches the result for the lifetime of the process.
 */
let cachedResult: boolean | null = null
let checkStarted = false

export async function isCodeGraphInstalled(): Promise<boolean> {
  if (cachedResult !== null) return cachedResult
  if (checkStarted) {
    // Another call already kicked off the check; wait for it
    // by returning via the cachedResult (will be a spin loop, but
    // in practice the check completes within 3 seconds)
    await new Promise<void>(resolve => {
      const check = setInterval(() => {
        if (cachedResult !== null) {
          clearInterval(check)
          resolve()
        }
      }, 50)
    })
    return cachedResult
  }
  checkStarted = true

  try {
    const result = await execFileNoThrow('codegraph', ['--version'], {
      timeout: 3000,
      stdin: 'ignore',
    })
    cachedResult = result.code === 0
  } catch {
    cachedResult = false
  }
  return cachedResult
}

/**
 * Synchronous check — returns the cached result if available,
 * or kicks off the async check and returns null if not yet known.
 */
export function isCodeGraphAvailable(): boolean | null {
  if (cachedResult !== null) return cachedResult
  // Kick off the async check if not started
  if (!checkStarted) {
    checkStarted = true
    void isCodeGraphInstalled().catch(() => {})
  }
  return null // Not yet known
}

// Kick off the check eagerly at module load time
void isCodeGraphInstalled().catch(() => {})
