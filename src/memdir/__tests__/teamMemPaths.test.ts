import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, mkdirSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  PathTraversalError,
  MAX_REALPATH_DEPTH,
  validateTeamMemWritePath,
  validateTeamMemKey,
  isTeamMemPath,
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

/**
 * Tests for isTeamMemPath symlink escape prevention (issue #994).
 *
 * isTeamMemPath previously did NOT resolve symlinks, creating a security gap
 * where read operations could escape via symlinks while write operations were
 * blocked. This test suite verifies that isTeamMemPath now resolves symlinks
 * consistently with validateTeamMemWritePath.
 */

describe('isTeamMemPath symlink escape prevention (issue #994)', () => {
  const ENV = 'CLAUDE_COWORK_MEMORY_PATH_OVERRIDE'
  let saved: string | undefined
  let tmpDir: string
  let teamDir: string
  let outsideDir: string

  beforeEach(() => {
    saved = process.env[ENV]
    tmpDir = mkdtempSync(join(tmpdir(), 'team-mem-symlink-'))
    process.env[ENV] = tmpDir
    ;(getAutoMemPath as unknown as { cache?: { clear?: () => void } }).cache?.clear?.()
    teamDir = join(tmpDir, 'team')
    mkdirSync(teamDir, { recursive: true })
    outsideDir = join(tmpDir, 'outside')
    mkdirSync(outsideDir, { recursive: true })
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

  test('returns true for a normal path inside the team dir', () => {
    const filePath = join(teamDir, 'subdir', 'file.md')
    expect(isTeamMemPath(filePath)).toBe(true)
  })

  test('returns false for a path outside the team dir', () => {
    const filePath = join(outsideDir, 'file.md')
    expect(isTeamMemPath(filePath)).toBe(false)
  })

  test('returns false when a symlink inside team dir points outside', () => {
    // Create a symlink inside teamDir that points to outsideDir
    const symlinkPath = join(teamDir, 'escape-link')
    symlinkSync(outsideDir, symlinkPath, 'dir')
    // The path through the symlink should be rejected
    const escapedPath = join(symlinkPath, 'file.md')
    expect(isTeamMemPath(escapedPath)).toBe(false)
  })

  test('returns false for a dangling symlink inside team dir', () => {
    // Create a dangling symlink (target does not exist)
    const symlinkPath = join(teamDir, 'dangling-link')
    symlinkSync(join(tmpDir, 'nonexistent-target'), symlinkPath, 'dir')
    const escapedPath = join(symlinkPath, 'file.md')
    expect(isTeamMemPath(escapedPath)).toBe(false)
  })

  test('returns false for a symlink loop inside team dir', () => {
    // Create a symlink loop
    const link1 = join(teamDir, 'loop1')
    const link2 = join(teamDir, 'loop2')
    symlinkSync(link2, link1, 'dir')
    symlinkSync(link1, link2, 'dir')
    const escapedPath = join(link1, 'file.md')
    expect(isTeamMemPath(escapedPath)).toBe(false)
  })

  test('returns true for a symlink inside team dir that points within team dir', () => {
    // Create a symlink that points to another location within teamDir
    const realSubdir = join(teamDir, 'real-subdir')
    mkdirSync(realSubdir, { recursive: true })
    const symlinkPath = join(teamDir, 'inner-link')
    symlinkSync(realSubdir, symlinkPath, 'dir')
    // The path through the symlink should be accepted
    const innerPath = join(symlinkPath, 'file.md')
    expect(isTeamMemPath(innerPath)).toBe(true)
  })

  test('returns false for path traversal via .. segments', () => {
    const escapedPath = join(teamDir, '..', 'outside', 'file.md')
    expect(isTeamMemPath(escapedPath)).toBe(false)
  })

  test('returns false for a prefix-attack path (team-evil)', () => {
    const evilDir = join(tmpDir, 'team-evil')
    mkdirSync(evilDir, { recursive: true })
    const evilPath = join(evilDir, 'file.md')
    expect(isTeamMemPath(evilPath)).toBe(false)
  })

  test('returns false for a symlink pointing to a file outside team dir', () => {
    // Create a file outside teamDir
    const outsideFile = join(outsideDir, 'secret.txt')
    writeFileSync(outsideFile, 'secret content')
    // Create a symlink inside teamDir pointing to the outside file
    const symlinkPath = join(teamDir, 'secret-link')
    symlinkSync(outsideFile, symlinkPath, 'file')
    // The path through the symlink should be rejected
    expect(isTeamMemPath(symlinkPath)).toBe(false)
  })

  test('returns true for the team dir with trailing separator', () => {
    // getTeamMemPath() includes a trailing separator, so the team dir
    // path with a trailing separator matches.
    expect(isTeamMemPath(teamDir + '/')).toBe(true)
  })

  test('returns true for a file directly in the team dir', () => {
    const filePath = join(teamDir, 'MEMORY.md')
    expect(isTeamMemPath(filePath)).toBe(true)
  })
})
