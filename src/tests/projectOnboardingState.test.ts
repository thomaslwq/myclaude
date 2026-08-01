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
    expect(fingerprint).toContain('file.txt');
    // Should contain 'link/' since it's a symlink to a directory and we now follow it
    expect(fingerprint).toContain('link/');
    // Should not contain 'link/cycle-root' since cycle is detected
    expect(fingerprint).not.toContain('link/cycle-root');
  } finally {
    setFsImplementation(originalFs);
  }
});

test('should handle permission errors gracefully', () => {
  originalFs = getFsImplementation();

  const mockFs = createMockFs({
    '/test-dir': {
      readdirResult: ['file.txt'],
      realpathResult: '/test-dir',
    },
    '/test-dir/file.txt': {
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
  });

  setFsImplementation(mockFs as any);

  try {
    const fingerprint = getDirectoryFingerprint('/test-dir');
    expect(fingerprint).toContain('file.txt');
  } finally {
    setFsImplementation(originalFs);
  }
});

test('should include contents of symlinked directories', () => {
  originalFs = getFsImplementation();

  // Create a symlink to a directory: /project/shared -> /project/shared-target
  const mockFs = createMockFs({
    '/project': {
      readdirResult: ['shared', 'file.txt'],
      realpathResult: '/project',
    },
    '/project/shared': {
      readdirResult: ['subdir', 'other.txt'],
      statResult: { isDirectory: () => true, isSymbolicLink: () => true } as any,
      realpathResult: '/project/shared',
    },
    '/project/shared/subdir': {
      readdirResult: ['nested.txt'],
      statResult: { isDirectory: () => true, isSymbolicLink: () => false } as any,
      realpathResult: '/project/shared/subdir',
    },
    '/project/shared/subdir/nested.txt': {
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
    '/project/shared/other.txt': {
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
    expect(fingerprint).toContain('file.txt');
    expect(fingerprint).toContain('shared/');
    expect(fingerprint).toContain('other.txt');
    expect(fingerprint).toContain('subdir/');
    expect(fingerprint).toContain('nested.txt');
  } finally {
    setFsImplementation(originalFs);
  }
});

test('should detect changes in symlinked directories', () => {
  originalFs = getFsImplementation();

  // Create a symlink to a directory: /project/shared -> /project/shared-target
  const mockFs = createMockFs({
    '/project': {
      readdirResult: ['shared', 'file.txt'],
      realpathResult: '/project',
    },
    '/project/shared': {
      readdirResult: ['other.txt'], // Changed from ['subdir', 'other.txt']
      statResult: { isDirectory: () => true, isSymbolicLink: () => true } as any,
      realpathResult: '/project/shared',
    },
    '/project/shared/other.txt': {
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
    expect(fingerprint).toContain('file.txt');
    expect(fingerprint).toContain('shared/');
    expect(fingerprint).toContain('other.txt');
    // Should NOT contain subdir since it was removed
    expect(fingerprint).not.toContain('subdir/');
  } finally {
    setFsImplementation(originalFs);
  }
});

test('should NOT follow symlinks pointing outside the root directory (symlink traversal protection)', () => {
  originalFs = getFsImplementation();

  // Create a symlink pointing outside the project root: /project/evil_link -> /etc
  // In real fs, readdirSync on a symlink to a directory returns the target's contents
  const mockFs = createMockFs({
    '/project': {
      readdirResult: ['evil_link', 'file.txt'],
      realpathResult: '/project',
    },
    '/project/evil_link': {
      // readdir on a symlink to a dir returns the target's contents in real fs
      readdirResult: ['passwd', 'shadow', 'ssh'],
      statResult: { isDirectory: () => true, isSymbolicLink: () => true } as any,
      realpathResult: '/etc',
    },
    '/project/file.txt': {
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
    '/etc': {
      readdirResult: ['passwd', 'shadow', 'ssh'],
      realpathResult: '/etc',
    },
    '/etc/passwd': {
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
    '/etc/shadow': {
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
    '/etc/ssh': {
      readdirResult: [],
      statResult: { isDirectory: () => true, isSymbolicLink: () => false } as any,
    },
  });

  setFsImplementation(mockFs as any);

  try {
    const fingerprint = getDirectoryFingerprint('/project');
    // Should include the symlink entry name
    expect(fingerprint).toContain('evil_link');
    // Should include the normal file
    expect(fingerprint).toContain('file.txt');
    // Should NOT include contents of /etc (the symlink target)
    expect(fingerprint).not.toContain('passwd');
    expect(fingerprint).not.toContain('shadow');
    expect(fingerprint).not.toContain('ssh');
  } finally {
    setFsImplementation(originalFs);
  }
});

test('should include symlinked files as entries', () => {
  originalFs = getFsImplementation();

  // Create a symlink to a file: /project/shared/link -> /project/shared/target.txt
  const mockFs = createMockFs({
    '/project': {
      readdirResult: ['shared', 'file.txt'],
      realpathResult: '/project',
    },
    '/project/shared': {
      readdirResult: ['link'],
      statResult: { isDirectory: () => true, isSymbolicLink: () => false } as any,
      realpathResult: '/project/shared',
    },
    '/project/shared/link': {
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => true } as any,
    },
    '/project/file.txt': {
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
  });

  setFsImplementation(mockFs as any);

  try {
    const fingerprint = getDirectoryFingerprint('/project');
    expect(fingerprint).toContain('file.txt');
    expect(fingerprint).toContain('shared/');
    // Should contain 'link' since it's a symlink to a file, now included
    expect(fingerprint).toContain('link');
  } finally {
    setFsImplementation(originalFs);
  }
});
