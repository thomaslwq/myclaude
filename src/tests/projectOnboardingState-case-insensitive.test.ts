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

test('should reject symlink with case-different target outside root on case-insensitive filesystem', () => {
  originalFs = getFsImplementation();

  // Simulate a case-insensitive filesystem where:
  // - rootRealPath is '/home/user/project' (lowercase)
  // - A symlink target resolves to '/Home/User/Project/../../etc/passwd' (mixed case)
  // - realpathSync returns the mixed-case path (because the OS resolves it that way)
  // The old code: targetRealPath.startsWith(rootRealPath + pathSep) would fail because
  // '/Home/User/Project/../../etc/passwd' does not start with '/home/user/project/'
  // The new code should detect that this is actually outside the root
  
  const mockFs = createMockFs({
    '/project-root': {
      readdirResult: ['malicious-link'],
      realpathResult: '/home/user/project',
    },
    '/project-root/malicious-link': {
      statResult: { isDirectory: () => true, isSymbolicLink: () => true } as any,
      readlinkResult: '/Home/User/Project/../../etc/passwd',
    },
    '/Home/User/Project/../../etc/passwd': {
      realpathResult: '/etc/passwd',
      readdirResult: [],
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
  });

  setFsImplementation(mockFs as any);

  // The fingerprint should NOT include the malicious symlink target
  // because it points outside the root directory
  const fingerprint = getDirectoryFingerprint('/project-root');
  
  // The fingerprint should only contain the symlink entry name, not its contents
  // because the symlink target is outside the root
  expect(fingerprint).not.toContain('passwd');
  expect(fingerprint).not.toContain('etc');
  
  // The symlink itself should still be listed (as a directory entry)
  expect(fingerprint).toContain('malicious-link');

  setFsImplementation(originalFs);
});

test('should allow symlink within root even with different case', () => {
  originalFs = getFsImplementation();

  // Simulate a case-insensitive filesystem where:
  // - rootRealPath is '/home/user/project' (lowercase)
  // - A symlink target resolves to '/Home/User/Project/subdir' (mixed case)
  // This is still within the root, so it should be allowed
  
  const mockFs = createMockFs({
    '/project-root': {
      readdirResult: ['subdir-link'],
      realpathResult: '/home/user/project',
    },
    '/project-root/subdir-link': {
      statResult: { isDirectory: () => true, isSymbolicLink: () => true } as any,
      readlinkResult: '/Home/User/Project/subdir',
    },
    '/Home/User/Project/subdir': {
      realpathResult: '/Home/User/Project/subdir',
      readdirResult: ['file.txt'],
      statResult: { isDirectory: () => true, isSymbolicLink: () => false } as any,
    },
    '/Home/User/Project/subdir/file.txt': {
      statResult: { isDirectory: () => false, isSymbolicLink: () => false } as any,
    },
  });

  setFsImplementation(mockFs as any);

  const fingerprint = getDirectoryFingerprint('/project-root');
  
  // The fingerprint should include the contents of the symlink target
  // because it's within the root directory
  expect(fingerprint).toContain('file.txt');

  setFsImplementation(originalFs);
});
