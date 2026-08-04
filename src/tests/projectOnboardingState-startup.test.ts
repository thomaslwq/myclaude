import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { clearCachedSteps, getSteps } from '../projectOnboardingState.js';
import { getFsImplementation, setFsImplementation } from '../utils/fsOperations.js';
import { runWithCwdOverride } from '../utils/cwd.js';

/**
 * Mock fs implementation that counts readdirSync calls.
 *
 * Behavior overrides live directly on the mock object itself: tests set
 * `mock['/'] = { readdirResult: [...], statResult: {...} }` and the internal
 * functions read `mock[path]` at call time — so overrides can be changed
 * between calls (e.g. to simulate root mtime changing between conversations).
 *
 * getDirectoryFingerprint() recursively calls readdirSync for every directory
 * in the tree; a fast path must not trigger it.
 */
function createCountingMockFs() {
  let readdirCount = 0;
  const readdirPaths: string[] = [];
  const mock: Record<string, any> = {
    cwd: () => '/',
    existsSync: (path: string) => mock[path]?.existsResult ?? false,
    stat: async () => ({ isDirectory: () => false, isSymbolicLink: () => false }),
    readdir: async () => [],
    unlink: async () => {},
    rmdir: async () => {},
    rm: async () => {},
    mkdir: async () => {},
    readFile: async () => '',
    rename: async () => {},
    statSync: (path: string) => {
      if (mock[path]?.statError) throw mock[path].statError;
      if (mock[path]?.statResult) return mock[path].statResult;
      const isDir = Boolean(mock[path]?.readdirResult);
      return { isDirectory: () => isDir, isSymbolicLink: () => false, mtimeMs: 1000 };
    },
    lstatSync: (path: string) => {
      if (mock[path]?.lstatError) throw mock[path].lstatError;
      if (mock[path]?.lstatResult) return mock[path].lstatResult;
      const isDir = Boolean(mock[path]?.readdirResult);
      return { isDirectory: () => isDir, isSymbolicLink: () => false, mtimeMs: 1000 };
    },
    readFileSync: () => '',
    readFileBytesSync: () => Buffer.from(''),
    readSync: () => ({ buffer: Buffer.from(''), bytesRead: 0 }),
    appendFileSync: () => {},
    copyFileSync: () => {},
    unlinkSync: () => {},
    renameSync: () => {},
    linkSync: () => {},
    symlinkSync: () => {},
    readlinkSync: (path: string) => {
      if (mock[path]?.readlinkResult) return mock[path].readlinkResult;
      throw new Error('EINVAL: not a symlink');
    },
    realpathSync: (path: string) => path,
    readdirSync: (path: string) => {
      readdirCount++;
      readdirPaths.push(path);
      if (mock[path]?.readdirError) throw mock[path].readdirError;
      if (mock[path]?.readdirResult) {
        return mock[path].readdirResult.map((name: string) => ({ name }));
      }
      return [];
    },
    isDirEmptySync: (path: string) => {
      readdirCount++;
      readdirPaths.push(path);
      return mock[path]?.isDirEmptyResult ?? false;
    },
    getReaddirCount: () => readdirCount,
    getReaddirPaths: () => [...readdirPaths],
  };
  return mock;
}

let originalFs: any = null;
let mockFs: any = null;

beforeEach(() => {
  originalFs = getFsImplementation();
  clearCachedSteps();
  mockFs = createCountingMockFs();
  setFsImplementation(mockFs as any);
});

afterEach(() => {
  setFsImplementation(originalFs);
  clearCachedSteps();
});

describe('getSteps() startup fast-path', () => {
  test('first call with empty cache must NOT recursively scan the directory tree', () => {
    runWithCwdOverride('/', () => {
      // Simulate a workspace with several nested directories.
      // If getDirectoryFingerprint() runs, readdirSync will be invoked
      // for the root AND every subdirectory (recursive walk).
      mockFs['/'] = { readdirResult: ['src', 'node_modules', 'README.md'] };
      mockFs['/src'] = { readdirResult: ['index.ts', 'lib'] };
      mockFs['/src/lib'] = { readdirResult: ['util.ts'] };
      mockFs['/node_modules'] = { readdirResult: ['dep-a', 'dep-b'] };

      const steps = getSteps();

      // The steps should still be computed correctly.
      expect(steps.length).toBe(2);
      expect(steps.some((s) => s.key === 'workspace')).toBe(true);
      expect(steps.some((s) => s.key === 'claudemd')).toBe(true);

      // Critical regression guard: the first cache fill must not walk the
      // whole directory tree. A full recursive fingerprint scan would call
      // readdirSync for /, /src, /src/lib and /node_modules (4+ calls).
      // The fast path only needs at most one isDirEmptySync call.
      const count = mockFs.getReaddirCount();
      expect(count).toBeLessThanOrEqual(1);
    });
  });

  test('second call within cache TTL does not rescan either', () => {
    runWithCwdOverride('/', () => {
      mockFs['/'] = { readdirResult: ['src'] };
      getSteps();
      const first = mockFs.getReaddirCount();
      getSteps();
      const second = mockFs.getReaddirCount();
      // Cached: no additional filesystem walk on the second call.
      expect(second).toBeLessThanOrEqual(first);
    });
  });

  test('second conversation after mtime change must NOT recursively scan the directory tree', () => {
    runWithCwdOverride('/', () => {
      // Simulate: first conversation fills the cache.
      mockFs['/'] = { readdirResult: ['src', 'README.md'] };
      mockFs['/src'] = { readdirResult: ['index.ts'] };
      getSteps();

      // Between conversations, root mtime changes (e.g., agent wrote files).
      // Simulate a different mtime to trigger cache invalidation.
      mockFs['/'] = {
        readdirResult: ['src', 'README.md', '.claude'],
        statResult: { isDirectory: () => false, isSymbolicLink: () => false, mtimeMs: 2000 },
      };

      // Capture the readdir count BEFORE the second call.
      const firstCount = mockFs.getReaddirCount();

      // Second conversation: getSteps() called again with mtime changed.
      const steps = getSteps();

      // Steps should still be correct.
      expect(steps.length).toBe(2);

      // The second call must NOT do a recursive directory walk.
      // A full getDirectoryFingerprint scan would walk /, /src (2+ readdir).
      // The cache refresh needs only isDirEmptySync (1 call) + existsSync.
      const count = mockFs.getReaddirCount() - firstCount;
      expect(count).toBeLessThanOrEqual(1);
    });
  });
});

describe('getSteps() performance under large workspace', () => {
  test('second conversation must complete within 50ms even with many nested directories', () => {
    runWithCwdOverride('/', () => {
      // Build a large project structure: root with 100 top-level dirs,
      // each with 10 files + 5 subdirs, each subdir with 10 files.
      // Total: 100 + 100*5 = 600 directories, 100*10 + 500*10 = 6000 files.
      // This simulates a large workspace that would block the event loop
      // if getDirectoryFingerprint() ran synchronously.
      const rootEntries: string[] = ['CLAUDE.md', 'package.json', 'README.md'];
      for (let i = 0; i < 100; i++) {
        const dirName = `pkg-${i}`;
        rootEntries.push(dirName);
        const subEntries: string[] = [];
        for (let f = 0; f < 10; f++) subEntries.push(`file-${f}.ts`);
        for (let s = 0; s < 5; s++) {
          const subDir = `sub-${s}`;
          subEntries.push(subDir);
          const subSubEntries: string[] = [];
          for (let f = 0; f < 10; f++) subSubEntries.push(`lib-${f}.ts`);
          mockFs[`/${dirName}/${subDir}`] = { readdirResult: subSubEntries };
        }
        mockFs[`/${dirName}`] = { readdirResult: subEntries };
      }
      mockFs['/'] = { readdirResult: rootEntries };

      // First call (cold cache) — baseline
      const t0 = performance.now();
      getSteps();
      const firstTime = performance.now() - t0;

      // Simulate mtime change (second conversation trigger)
      mockFs['/'] = {
        readdirResult: [...rootEntries, '.claude', 'new-file.ts'],
        statResult: { isDirectory: () => false, isSymbolicLink: () => false, mtimeMs: 2000 },
      };

      // Second call with mtime changed — must NOT do recursive walk
      const t1 = performance.now();
      const steps = getSteps();
      const secondTime = performance.now() - t1;

      // Steps should be correct
      expect(steps.length).toBe(2);

      // Second call must be fast — no recursive directory walk.
      // Even on a 600-dir/6000-file workspace, the overhead of
      // isDirEmptySync + statSync + existsSync should be < 50ms.
      // The old recursive fingerprint walk would take seconds.
      expect(secondTime).toBeLessThan(50);
      // Log the timing for visibility (not a hard assertion)
      console.log(`\n  [perf] first call: ${firstTime.toFixed(2)}ms, second call (mtime changed): ${secondTime.toFixed(2)}ms`);
    });
  });
});