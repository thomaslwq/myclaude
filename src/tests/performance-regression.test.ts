/**
 * Performance Regression Tests
 * =============================
 *
 * These tests enforce a minimum performance baseline for critical hot paths.
 * They are run as a gate in the auto-fix CI workflow: if they fail, the
 * commit is rejected and npm publish is blocked.
 *
 * Thresholds must be set conservatively — fast enough to catch regressions
 * on CI runners, but not so tight that they flake on noisy environments.
 *
 * Current thresholds:
 *   - Onboarding fingerprint: getSteps() cache refresh < 50ms
 *   - First call (cold cache): getSteps() < 50ms
 *   - readdirSync count: ≤ 1 (no recursive directory walk)
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { clearCachedSteps, getSteps } from '../projectOnboardingState.js';
import { getFsImplementation, setFsImplementation } from '../utils/fsOperations.js';
import { runWithCwdOverride } from '../utils/cwd.js';

// ── Mock fs with counting ──

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

// ── Build a simulated large workspace ──

function buildLargeWorkspace(mockFs: any) {
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

// ── Performance Regression Tests ──

describe('PERFORMANCE REGRESSION — onboarding fingerprint', () => {
  const MAX_TIME_MS = 50;
  const MAX_READDIR_COUNT = 1;

  test(`getSteps() first call (cold cache) must complete in <${MAX_TIME_MS}ms`, () => {
    runWithCwdOverride('/', () => {
      buildLargeWorkspace(mockFs);

      const t0 = performance.now();
      const steps = getSteps();
      const elapsed = performance.now() - t0;

      expect(steps.length).toBe(2);
      expect(elapsed).toBeLessThan(MAX_TIME_MS);
    });
  });

  test(`getSteps() second call with mtime change must complete in <${MAX_TIME_MS}ms`, () => {
    runWithCwdOverride('/', () => {
      buildLargeWorkspace(mockFs);
      getSteps(); // warm cache

      // Simulate mtime change (second conversation trigger)
      mockFs['/'] = {
        readdirResult: [...mockFs['/'].readdirResult, '.claude', 'new-file.ts'],
        statResult: { isDirectory: () => false, isSymbolicLink: () => false, mtimeMs: 2000 },
      };
      const firstCount = mockFs.getReaddirCount();

      const t0 = performance.now();
      const steps = getSteps();
      const elapsed = performance.now() - t0;

      expect(steps.length).toBe(2);
      expect(elapsed).toBeLessThan(MAX_TIME_MS);

      // Must NOT do recursive directory walk (no getDirectoryFingerprint)
      const readdirDelta = mockFs.getReaddirCount() - firstCount;
      expect(readdirDelta).toBeLessThanOrEqual(MAX_READDIR_COUNT);
    });
  });
});