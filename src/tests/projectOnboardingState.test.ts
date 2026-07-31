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

test('should skip common ignored directories', () => {
  originalFs = getFsImplementation();

  const mockFs = createMockFs({
    '/test-root': {
      readdirResult: [
        'node_modules',
        '.git',
        'dist',
        'build',
        '.next',
        'out',
        'coverage',
        'target',
        'vendor',
        '__pycache__',
        '.cache',
        '.mypy_cache',
        '.svn',
        '.hg',
        'normal-file.txt',
      ],
    },
    '/test-root/target': {
      readdirResult: ['subdir', 'file.txt'],
    },
    '/test-root/vendor': {
      readdirResult: ['lib', 'file.txt'],
    },
    '/test-root/__pycache__': {
      readdirResult: ['__init__.pyc', 'module.pyc'],
    },
    '/test-root/.cache': {
      readdirResult: ['cache-file.txt'],
    },
    '/test-root/.mypy_cache': {
      readdirResult: ['__pycache__'],
    },
    '/test-root/.svn': {
      readdirResult: ['entries'],
    },
    '/test-root/.hg': {
      readdirResult: ['store'],
    },
    '/test-root/normal-file.txt': {
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
  });

  setFsImplementation(mockFs as any);

  try {
    const fingerprint = getDirectoryFingerprint('/test-root');
    expect(fingerprint).toBeDefined();
    // Should not contain any of the skipped directories
    expect(fingerprint).not.toContain('node_modules/');
    expect(fingerprint).not.toContain('.git/');
    expect(fingerprint).not.toContain('dist/');
    expect(fingerprint).not.toContain('build/');
    expect(fingerprint).not.toContain('.next/');
    expect(fingerprint).not.toContain('out/');
    expect(fingerprint).not.toContain('coverage/');
    expect(fingerprint).not.toContain('target/');
    expect(fingerprint).not.toContain('vendor/');
    expect(fingerprint).not.toContain('__pycache__/');
    expect(fingerprint).not.toContain('.cache/');
    expect(fingerprint).not.toContain('.mypy_cache/');
    expect(fingerprint).not.toContain('.svn/');
    expect(fingerprint).not.toContain('.hg/');
    // Should contain the normal file
    expect(fingerprint).toContain('normal-file.txt');
  } finally {
    setFsImplementation(originalFs);
  }
});
