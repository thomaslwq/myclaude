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

test('should handle symlink cycles without infinite recursion', () => {
  originalFs = getFsImplementation();

  // Create a cycle: /cycle-root -> /cycle-root/link -> /cycle-root
  const mockFs = createMockFs({
    '/cycle-root': {
      readdirResult: ['link', 'file.txt'],
      realpathResult: '/cycle-root',
    },
    '/cycle-root/link': {
      readdirResult: ['cycle-root'],
      statResult: { isDirectory: () => true, isSymbolicLink: () => true } as any,
      realpathResult: '/cycle-root',
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
    expect(fingerprint.length).toBeGreaterThan(0);
  } finally {
    setFsImplementation(originalFs);
  }
});

test('should handle symlink cycles when realpathSync fails', () => {
  originalFs = getFsImplementation();

  // Create a scenario where realpathSync fails (e.g., permission error)
  // but the path is a symlink that points to an ancestor
  // This is the exact scenario from GitHub issue #448
  const mockFs = createMockFs({
    '/root': {
      readdirResult: ['link-to-root'],
      realpathResult: '/root',
    },
    '/root/link-to-root': {
      readdirResult: ['file.txt'],
      statResult: { isDirectory: () => true, isSymbolicLink: () => true } as any,
      // realpathSync throws for this path (e.g., permission error)
      realpathError: new Error('EACCES: permission denied'),
      // readlink succeeds and returns '..' which points to /root
      readlinkResult: '..',
    },
    '/root/file.txt': {
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
  });

  setFsImplementation(mockFs as any);

  try {
    const fingerprint = getDirectoryFingerprint('/root');
    expect(fingerprint).toBeDefined();
    // Should not cause infinite recursion or stack overflow
    expect(fingerprint).toContain('link-to-root/');
  } finally {
    setFsImplementation(originalFs);
  }
});

test('should skip symlink to node_modules directory inside root', () => {
  originalFs = getFsImplementation();

  // Create a scenario: /root has a symlink 'node_modules' -> /root/node_modules (or an external dir)
  // The symlink target is 'node_modules' - should be skipped
  const mockFs = createMockFs({
    '/root': {
      readdirResult: ['node_modules', 'src'],
      realpathResult: '/root',
    },
    '/root/node_modules': {
      readdirResult: ['lodash', 'express'],
      statResult: { isDirectory: () => true, isSymbolicLink: () => true } as any,
      realpathResult: '/root/node_modules',
      readlinkResult: '/real/node_modules',
    },
    '/real/node_modules': {
      readdirResult: ['lodash', 'express'],
      statResult: { isDirectory: () => true, isSymbolicLink: () => false } as any,
      realpathResult: '/real/node_modules',
    },
    '/root/src': {
      readdirResult: [],
      statResult: { isDirectory: () => true, isSymbolicLink: () => false } as any,
    },
  });

  setFsImplementation(mockFs as any);

  const fingerprint = getDirectoryFingerprint('/root');
  
  // The fingerprint should NOT contain 'lodash' or 'express' from node_modules
  expect(fingerprint).not.toContain('lodash');
  expect(fingerprint).not.toContain('express');
  // It should contain 'src/' since it's a regular directory
  expect(fingerprint).toContain('src/');
  // It should contain 'node_modules/' since symlinks are tracked but contents skipped
  expect(fingerprint).toContain('node_modules/');

  setFsImplementation(originalFs);
});

test('should handle symlink cycles when both realpathSync and lstatSync fail', () => {
  originalFs = getFsImplementation();

  // Create a scenario where both realpathSync and lstatSync fail
  // The cycle detection should still work by checking dirPath in the stack
  const mockFs = createMockFs({
    '/root': {
      readdirResult: ['link-to-root'],
      realpathResult: '/root',
    },
    '/root/link-to-root': {
      readdirResult: ['file.txt'],
      statResult: { isDirectory: () => true, isSymbolicLink: () => true } as any,
      // realpathSync throws
      realpathError: new Error('EACCES: permission denied'),
      // lstatSync also throws (e.g., permission error on the symlink itself)
      statError: new Error('EACCES: permission denied'),
    },
    '/root/file.txt': {
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
  });

  setFsImplementation(mockFs as any);

  try {
    const fingerprint = getDirectoryFingerprint('/root');
    expect(fingerprint).toBeDefined();
    // Should not cause infinite recursion
  } finally {
    setFsImplementation(originalFs);
  }
});
