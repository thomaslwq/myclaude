import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { clearCachedSteps, getSteps } from '../projectOnboardingState.js';
import { getFsImplementation, setFsImplementation } from '../utils/fsOperations.js';

// Mock fs implementation that counts readdirSync calls.
// getDirectoryFingerprint() recursively calls readdirSync for every
// directory in the tree; a startup fast-path must not trigger it.
function createCountingMockFs(customBehaviors: Record<string, any>) {
  let readdirCount = 0;
  const readdirPaths: string[] = [];
  return {
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
    statSync: (path: string) => {
      if (customBehaviors[path]?.statError) throw customBehaviors[path].statError;
      if (customBehaviors[path]?.statResult) return customBehaviors[path].statResult;
      return { isDirectory: () => false, isSymbolicLink: () => false, mtimeMs: 1000 };
    },
    lstatSync: (path: string) => {
      if (customBehaviors[path]?.statError) throw customBehaviors[path].statError;
      return { isDirectory: () => false, isSymbolicLink: () => false, mtimeMs: 1000 };
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
      if (customBehaviors[path]?.readlinkResult) return customBehaviors[path].readlinkResult;
      throw new Error('EINVAL: not a symlink');
    },
    realpathSync: (path: string) => path,
    readdirSync: (path: string) => {
      readdirCount++;
      readdirPaths.push(path);
      if (customBehaviors[path]?.readdirError) throw customBehaviors[path].readdirError;
      if (customBehaviors[path]?.readdirResult) {
        return customBehaviors[path].readdirResult.map((name: string) => ({ name } as any));
      }
      return [];
    },
    isDirEmptySync: (path: string) => {
      readdirCount++;
      readdirPaths.push(path);
      return false;
    },
    getReaddirCount: () => readdirCount,
    getReaddirPaths: () => [...readdirPaths],
  };
}

let originalFs: any = null;
let mockFs: any = null;

beforeEach(() => {
  originalFs = getFsImplementation();
  clearCachedSteps();
  mockFs = createCountingMockFs({});
  setFsImplementation(mockFs as any);
});

afterEach(() => {
  setFsImplementation(originalFs);
  clearCachedSteps();
});

describe('getSteps() startup fast-path', () => {
  test('first call with empty cache must NOT recursively scan the directory tree', () => {
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

  test('second call within cache TTL does not rescan either', () => {
    mockFs['/'] = { readdirResult: ['src'] };
    getSteps();
    const first = mockFs.getReaddirCount();
    getSteps();
    const second = mockFs.getReaddirCount();
    // Cached: no additional filesystem walk on the second call.
    expect(second).toBeLessThanOrEqual(first);
  });
});
