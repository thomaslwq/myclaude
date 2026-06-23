import { execFileNoThrow } from '../../utils/execFileNoThrow.js'

/**
 * Check if the `codegraph` CLI is installed and available.
 * Runs `codegraph --version` quietly, returns false on any failure.
 * Caches the result for the lifetime of the process.
 */
let cachedResult: boolean | null = null

export async function isCodeGraphInstalled(): Promise<boolean> {
  if (cachedResult !== null) return cachedResult

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
