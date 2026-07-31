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
    readlinkSync: () => '',
    readdirStringSync: (path: string): string[] => {
      if (customBehaviors[path]?.readdirError) throw customBehaviors[path].readdirError;
      if (customBehaviors[path]?.readdirResult) return customBehaviors[path].readdirResult;
      return [];
    },
  };
}

// Store original and restore after each test
let originalFs: any = null;

test('should handle symlink cycles without infinite recursion', () => {
  originalFs = getFsImplementation();

  // Create a cycle: /cycle-root -> /cycle-root/link -> /cycle-root
  const mockFs = createMockFs({
    '/cycle-root': {
      readdirResult: ['link', 'file.txt'],
    },
    '/cycle-root/link': {
      readdirResult: ['cycle-root'],
      statResult: { isDirectory: () => true, isSymbolicLink: () => true } as any,
    },
    '/cycle-root/file.txt': {
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
  });

  setFsImplementation(mockFs as any);

  try {
    const fingerprint = getDirectoryFingerprint('/cycle-root');
    expect(fingerprint).toBeDefined();
    expect(fingerprint).toContain('file.txt');
    // Should not contain 'link' since it's a symlink
    expect(fingerprint).not.toContain('link');
  } finally {
    setFsImplementation(originalFs);
  }
});

test('should handle permission errors gracefully', () => {
  originalFs = getFsImplementation();

  const mockFs = createMockFs({
    '/error-root': {
      readdirResult: ['protected-dir', 'file.txt'],
    },
    '/error-root/protected-dir': {
      readdirResult: [],
      statError: new Error('EACCES: permission denied'),
    },
    '/error-root/file.txt': {
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
  });

  setFsImplementation(mockFs as any);

  try {
    const fingerprint = getDirectoryFingerprint('/error-root');
    expect(fingerprint).toBeDefined();
    expect(fingerprint).toContain('file.txt');
    // Should not throw despite the permission error
  } finally {
    setFsImplementation(originalFs);
  }
});

test('should skip symlinks', () => {
  originalFs = getFsImplementation();

  const mockFs = createMockFs({
    '/symlink-root': {
      readdirResult: ['symlink-dir', 'normal-file.txt'],
    },
    '/symlink-root/symlink-dir': {
      readdirResult: [],
      statResult: { isDirectory: () => true, isSymbolicLink: () => true } as any,
    },
    '/symlink-root/normal-file.txt': {
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
  });

  setFsImplementation(mockFs as any);

  try {
    const fingerprint = getDirectoryFingerprint('/symlink-root');
    expect(fingerprint).toBeDefined();
    expect(fingerprint).toContain('normal-file.txt');
    expect(fingerprint).not.toContain('symlink-dir');
  } finally {
    setFsImplementation(originalFs);
  }
});
