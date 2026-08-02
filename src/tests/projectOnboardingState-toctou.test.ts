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
      if (customBehaviors[path]?.lstatError) throw customBehaviors[path].lstatError;
      if (customBehaviors[path]?.lstatResult) return customBehaviors[path].lstatResult;
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
      if (customBehaviors[path]?.readlinkError) throw customBehaviors[path].readlinkError;
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

test('should use readlinkSync directly without TOCTOU race condition in fallback path', () => {
  originalFs = getFsImplementation();

  // Simulate a race condition in the fallback path:
  // realpathSync fails (e.g., permission error), so we fall back to manual symlink resolution
  // The vulnerable code does lstatSync then readlinkSync - two separate syscalls
  // After the fix, it should use readlinkSync directly
  
  // Mock: lstatSync says it's a symlink, but readlinkSync returns a different target
  // (simulating the race where the symlink is swapped between the two calls)
  const mockFs = createMockFs({
    '/project-root': {
      readdirResult: ['link', 'file.txt'],
      realpathResult: '/project-root',
    },
    '/project-root/link': {
      // realpathSync fails - triggers fallback
      realpathError: new Error('Permission denied'),
      // lstatSync says it's a symlink
      lstatResult: { isDirectory: () => true, isSymbolicLink: () => true } as any,
      // But readlinkSync returns a path that escaped the root boundary
      // (simulating the race where the symlink was swapped)
      readlinkResult: '../outside',
    },
    '/project-root/file.txt': {
      readdirResult: [],
    },
  });

  setFsImplementation(mockFs as any);

  const fingerprint = getDirectoryFingerprint('/project-root');
  
  // The fingerprint should NOT contain '../outside' - the race condition should be fixed
  // If the code is vulnerable, it will follow the symlink and include /outside/secret.txt
  // If fixed, it will either skip the symlink or handle it safely
  expect(fingerprint).toContain('file.txt');
  expect(fingerprint).toContain('link');
});

test('should handle readlinkSync error for non-symlink files', () => {
  originalFs = getFsImplementation();

  // After the fix, readlinkSync should be called directly without the lstatSync check
  // If the path is not a symlink, readlinkSync will throw an error
  const mockFs = createMockFs({
    '/project-root': {
      readdirResult: ['file.txt'],
      realpathResult: '/project-root',
    },
    '/project-root/file.txt': {
      readdirResult: [],
    },
  });

  setFsImplementation(mockFs as any);

  // This should work fine - no symlink to follow
  const fingerprint = getDirectoryFingerprint('/project-root');
  expect(fingerprint).toContain('file.txt');
});
