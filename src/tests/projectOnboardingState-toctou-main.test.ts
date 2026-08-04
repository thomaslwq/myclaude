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

test('should handle TOCTOU race condition in main path (lstatSync then readlinkSync)', () => {
  originalFs = getFsImplementation();

  // Simulate a TOCTOU race condition in the main path:
  // In the vulnerable code, lstatSync would be called first to check if an entry is a symlink,
  // then readlinkSync would be called to resolve it. Between these two syscalls, the symlink
  // could be changed. The fix uses readlinkSync directly as the single atomic syscall.
  const mockFs = createMockFs({
    '/project-root': {
      readdirResult: ['link', 'file.txt'],
      realpathResult: '/project-root',
    },
    '/project-root/link': {
      // readlinkSync returns a path that would be followed if the code were vulnerable
      // to TOCTOU (simulating the race where the symlink was swapped)
      readlinkResult: '../outside',
    },
    '/project-root/file.txt': {
      readdirResult: [],
    },
  });

  setFsImplementation(mockFs as any);

  const fingerprint = getDirectoryFingerprint('/project-root');
  
  // The fingerprint should NOT contain '../outside' - the TOCTOU race condition should be fixed
  // If the code is vulnerable, it will follow the symlink and include /outside content
  // If fixed, it should handle the symlink safely
  expect(fingerprint).toContain('file.txt');
  expect(fingerprint).toContain('link');
  expect(fingerprint).not.toContain('../outside');
  expect(fingerprint).not.toContain('outside');
});

test('should handle readlinkSync error for non-symlink files in main path', () => {
  originalFs = getFsImplementation();

  // After the fix, readlinkSync is called directly without the lstatSync check
  // If the path is not a symlink, readlinkSync will throw an error which is caught
  // and then lstatSync is used to determine if it's a directory or regular file
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
