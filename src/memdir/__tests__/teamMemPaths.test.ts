import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  PathTraversalError,
  MAX_REALPATH_DEPTH,
  validateTeamMemWritePath,
  validateTeamMemKey,
} from '../teamMemPaths.js'
import { getAutoMemPath } from '../paths.js'

/**
 * Regression tests for realpathDeepestExisting depth cap (issue #995).
 *
 * realpathDeepestExisting walks up the directory tree until realpath() succeeds.
 * Without an upper bound, a maliciously constructed path with thousands of
 * components could drive the loop indefinitely, causing excessive CPU usage
 * or a stack overflow. The walk is now bounded by MAX_REALPATH_DEPTH and
 * throws PathTraversalError when exceeded.
 */

describe('realpathDeepestExisting depth cap (issue #995)', () => {
  const ENV = 'CLAUDE_COWORK_MEMORY_PATH_OVERRIDE'
  let saved: string | undefined
  let tmpDir: string

  beforeEach(() => {
    saved = process.env[ENV]
    tmpDir = mkdtempSync(join(tmpdir(), 'team-mem-depth-'))
    process.env[ENV] = tmpDir
    // getAutoMemPath is memoized on project root; clear so the new env
    // override takes effect for each test.
    ;(getAutoMemPath as unknown as { cache?: { clear?: () => void } }).cache?.clear?.()
  })

  afterEach(() => {
    if (saved === undefined) {
      delete process.env[ENV]
    } else {
      process.env[ENV] = saved
    }
    rmSync(tmpDir, { recursive: true, force: true })
    ;(getAutoMemPath as unknown as { cache?: { clear?: () => void } }).cache?.clear?.()
  })

  test('MAX_REALPATH_DEPTH is a positive finite integer', () => {
    expect(Number.isInteger(MAX_REALPATH_DEPTH)).toBe(true)
    expect(MAX_REALPATH_DEPTH).toBeGreaterThan(0)
  })

  test('rejects a path whose depth exceeds MAX_REALPATH_DEPTH', async () => {
    // Build a path with far more than MAX_REALPATH_DEPTH segments. resolve()
    // preserves every segment, so realpathDeepestExisting will walk up past
    // the cap and throw PathTraversalError instead of looping indefinitely.
    const deepPath = join(tmpDir, 'team', 'a/'.repeat(MAX_REALPATH_DEPTH + 100))
    await expect(validateTeamMemWritePath(deepPath)).rejects.toThrow(
      PathTraversalError,
    )
  })

  test('rejects a deep relative key via validateTeamMemKey', async () => {
    const deepKey = 'a/'.repeat(MAX_REALPATH_DEPTH + 100)
    await expect(validateTeamMemKey(deepKey)).rejects.toThrow(
      PathTraversalError,
    )
  })

  test('accepts a normal-depth path inside the team dir', async () => {
    const okPath = join(tmpDir, 'team', 'subdir', 'file.md')
    await expect(validateTeamMemWritePath(okPath)).resolves.toBe(okPath)
  })
})
