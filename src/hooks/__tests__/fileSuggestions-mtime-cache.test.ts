import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { join } from 'path'
import {
  getGitIndexMtime,
  clearFileSuggestionCaches,
} from '../fileSuggestions.js'
import { getFsImplementation, setFsImplementation } from '../../utils/fsOperations.js'

/**
 * Regression test for input lag on Windows Git Bash.
 *
 * Root cause: `startBackgroundCacheRefresh()` runs on every keystroke (via
 * the 50ms-debounced file suggestion fetch) and unconditionally calls
 * `getGitIndexMtime()`, which performs a synchronous `statSync(.git/index)`.
 * On Windows (Git Bash + antivirus/OneDrive/network mounts) each stat can
 * take 1-50ms, blocking the event loop and stuttering typing.
 *
 * Fix: TTL-cache the mtime so the stat happens at most once per second,
 * no matter how fast the user types.
 */

// Replace utils/git so findGitRoot resolves to a fixed repo root without
// walking the real filesystem (the real one is LRU-memoized over real fs).
mock.module(join(import.meta.dir, '../../utils/git.js'), () => ({
  findGitRoot: () => '/fake-repo',
  gitExe: 'git',
}))

function createCountingStatFs() {
  let statCount = 0
  const statPaths: string[] = []
  return {
    getStatCount: () => statCount,
    getStatPaths: () => [...statPaths],
    statSync: (p: string) => {
      statCount++
      statPaths.push(p)
      return {
        isDirectory: () => p.endsWith('.git'),
        isSymbolicLink: () => false,
        mtimeMs: 1000,
      }
    },
    cwd: () => '/',
    existsSync: () => false,
    stat: async () => ({ isDirectory: () => false, isSymbolicLink: () => false }),
    readdir: async () => [],
    unlink: async () => {},
    rmdir: async () => {},
    rm: async () => {},
    mkdir: async () => {},
    readFile: async () => '',
    rename: async () => {},
    lstatSync: () => ({ isDirectory: () => false, isSymbolicLink: () => false, mtimeMs: 1000 }),
    readFileSync: () => '',
    readFileBytesSync: () => Buffer.from(''),
    readSync: () => ({ buffer: Buffer.from(''), bytesRead: 0 }),
    appendFileSync: () => {},
    copyFileSync: () => {},
    unlinkSync: () => {},
    renameSync: () => {},
    linkSync: () => {},
    symlinkSync: () => {},
    readlinkSync: () => {
      throw new Error('not a symlink')
    },
    realpathSync: (p: string) => p,
    readdirSync: () => [],
    isDirEmptySync: () => false,
  }
}

let originalFs: unknown = null
let mockFs: ReturnType<typeof createCountingStatFs> = null as unknown as ReturnType<typeof createCountingStatFs>

beforeEach(() => {
  originalFs = getFsImplementation()
  mockFs = createCountingStatFs()
  setFsImplementation(mockFs as never)
  clearFileSuggestionCaches()
})

afterEach(() => {
  setFsImplementation(originalFs as never)
  clearFileSuggestionCaches()
})

describe('getGitIndexMtime — Windows Git Bash input-lag fix', () => {
  test('repeated calls within the TTL window perform only ONE .git/index stat', () => {
    const m1 = getGitIndexMtime()
    expect(m1).toBe(1000)
    // The mock must actually see the stat — proves the fs implementation is
    // wired into getGitIndexMtime (RED before the fs-impl switch).
    const statsAfterFirst = mockFs.getStatCount()
    expect(statsAfterFirst).toBeGreaterThan(0)
    expect(mockFs.getStatPaths()[0]).toBe(join('/fake-repo', '.git', 'index'))

    // Simulate fast typing: the debounced suggestion fetch fires ~20x/sec.
    for (let i = 0; i < 10; i++) {
      getGitIndexMtime()
    }

    // Exactly one stat total — a second call must reuse the TTL cache
    // (RED with the current code: every call stats again).
    expect(mockFs.getStatCount()).toBe(statsAfterFirst)
  })

  test('expires the cached mtime after the TTL window so git changes are still detected', () => {
    const realNow = Date.now
    try {
      // Simulate time passing beyond the 1s TTL between calls.
      let fakeNow = realNow()
      Date.now = () => fakeNow

      const m1 = getGitIndexMtime()
      expect(m1).toBe(1000)
      expect(mockFs.getStatCount()).toBe(1)

      // Within TTL: cached, no re-stat.
      expect(getGitIndexMtime()).toBe(1000)
      expect(mockFs.getStatCount()).toBe(1)

      // Past TTL: must re-stat to pick up git changes.
      fakeNow += 2000
      expect(getGitIndexMtime()).toBe(1000)
      expect(mockFs.getStatCount()).toBe(2)
    } finally {
      Date.now = realNow
    }
  })
})
