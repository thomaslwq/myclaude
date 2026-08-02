import { describe, test, expect } from 'bun:test';
import { getDirectoryFingerprint } from '../projectOnboardingState.js';
import { getFsImplementation, setFsImplementation } from '../utils/fsOperations.js';

// Helper to create a mock fs implementation
function createMockFs(customBehaviors: Record<string, any>) {
  return {
    cwd: () => '/',
    existsSync: () => true,
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
      return { isDirectory: () => false, isSymbolicLink: () => false };
    },
    lstatSync: (path: string) => {
      if (customBehaviors[path]?.statError) throw customBehaviors[path].statError;
      if (customBehaviors[path]?.statResult) return customBehaviors[path].statResult;
      return { isDirectory: () => false, isSymbolicLink: () => false };
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
      return '';
    },
    realpathSync: (path: string) => {
      if (customBehaviors[path]?.realpathError) throw customBehaviors[path].realpathError;
      if (customBehaviors[path]?.realpathResult) return customBehaviors[path].realpathResult;
      return path;
    },
    readdirSync: (path: string) => {
      if (customBehaviors[path]?.readdirError) throw customBehaviors[path].readdirError;
      if (customBehaviors[path]?.readdirResult) {
        return customBehaviors[path].readdirResult.map((name: string) => ({ name } as any));
      }
      return [];
    },
  };
}

// Store original and restore after each test
let originalFs: any = null;

test('should handle deep directory recursion without stack overflow', () => {
  originalFs = getFsImplementation();

  // Create a deeply nested directory structure: /root/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z
  // This should be caught by the depth limit
  const mockFs = createMockFs({});

  // Mock the recursive structure
  let currentPath = '/root';
  for (let i = 0; i < 100; i++) {
    currentPath = `${currentPath}/dir${i}`;
    mockFs[currentPath] = {
      readdirResult: ['file.txt'],
      realpathResult: currentPath,
    };
  }

  setFsImplementation(mockFs as any);

  // This should not cause stack overflow
  const fingerprint = getDirectoryFingerprint('/root');
  expect(fingerprint).toBe('');
  setFsImplementation(originalFs);
});
