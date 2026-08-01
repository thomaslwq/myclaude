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

test('should include trailing slash for symlinked directories inside root', () => {
  originalFs = getFsImplementation();

  const mockFs = createMockFs({
    '/project': {
      readdirResult: ['symlink-dir', 'file.txt'],
      realpathResult: '/project',
    },
    '/project/symlink-dir': {
      readdirResult: ['nested.txt'],
      statResult: { isDirectory: () => true, isSymbolicLink: () => true } as any,
      realpathResult: '/project/symlink-dir',
    },
    '/project/symlink-dir/nested.txt': {
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
    '/project/file.txt': {
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
  });

  setFsImplementation(mockFs as any);

  try {
    const fingerprint = getDirectoryFingerprint('/project');
    expect(fingerprint).toContain('symlink-dir/');
  } finally {
    setFsImplementation(originalFs);
  }
});

test('should include trailing slash for symlinked directories outside root', () => {
  originalFs = getFsImplementation();

  const mockFs = createMockFs({
    '/project': {
      readdirResult: ['symlink-outside'],
      realpathResult: '/project',
    },
    '/project/symlink-outside': {
      readdirResult: ['external.txt'],
      statResult: { isDirectory: () => true, isSymbolicLink: () => true } as any,
      realpathResult: '/external/path',
    },
    '/external/path/external.txt': {
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
  });

  setFsImplementation(mockFs as any);

  try {
    const fingerprint = getDirectoryFingerprint('/project');
    // The issue is that symlinked directories outside root don't have a trailing slash
    // This test will fail before the fix
    expect(fingerprint).toContain('symlink-outside/');
  } finally {
    setFsImplementation(originalFs);
  }
});
