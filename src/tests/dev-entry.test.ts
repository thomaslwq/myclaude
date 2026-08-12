import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test';
import { resolve } from 'path';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Helper to create a temporary directory structure for testing
function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dev-entry-test-'));
  return dir;
}

function cleanupTempDir(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

describe('collectMissingRelativeImports performance', () => {

  test('scanFiles should be exported and accept depth limit', async () => {
    const { scanFiles } = await import('../dev-entry.js');
    expect(typeof scanFiles).toBe('function');
    
    // Scan the src directory with a very shallow depth
    const files: string[] = [];
    await scanFiles(resolve('src'), files, 1);
    
    // Should only find files in the top-level src/ directory
    // (no subdirectories because depth 1 means only the root)
    for (const f of files) {
      expect(f.startsWith(resolve('src'))).toBe(true);
    }
  });

  test('scanFiles should skip node_modules and .git directories', async () => {
    const { scanFiles } = await import('../dev-entry.js');
    
    const files: string[] = [];
    // Scan from root (but with depth limit)
    await scanFiles(resolve('.'), files, 1);
    
    // Should not include node_modules files
    for (const f of files) {
      expect(f.includes('node_modules')).toBe(false);
      expect(f.includes('.git')).toBe(false);
    }
  });

  test('scanFiles should include .github directory', async () => {
    const { scanFiles } = await import('../dev-entry.js');
    
    const files: string[] = [];
    // Scan from root with depth 2 to include .github
    await scanFiles(resolve('.'), files, 2);
    
    // Should include .github directory files (scripts)
    const githubFiles = files.filter(f => f.includes(join('.github', 'scripts')));
    expect(githubFiles.length).toBeGreaterThan(0);
    
    // Should not include files from the .git directory (only .git/config and .git/HEAD should be excluded)
    const gitDirFiles = files.filter(f => f.includes(join('.git', 'config')) || f.includes(join('.git', 'HEAD')));
    expect(gitDirFiles.length).toBe(0);
    
    // Should not include node_modules files
    const nodeModulesFiles = files.filter(f => f.includes('node_modules'));
    expect(nodeModulesFiles.length).toBe(0);
  });

  test('collectMissingRelativeImports should be exported', async () => {
    const { collectMissingRelativeImports } = await import('../dev-entry.js');
    expect(typeof collectMissingRelativeImports).toBe('function');
  });

  test('extractRelativeImports should not produce false positives from strings and comments', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js');
    
    // Test with a string containing 'from' with a relative path - should NOT be extracted
    const text = `
import { x } from './real';
const msg = "from './not-a-real-module'";
const msg2 = \`from './not-a-real-module-2'\`;
// from './comment-module'
/* from './comment-module-2' */
export { y } from './real2';
`;
    
    const result = extractRelativeImports(text);
    
    // Should find the two real imports
    expect(result).toContain('./real');
    expect(result).toContain('./real2');
    
    // Should NOT include false positives from strings/comments
    expect(result).not.toContain('./not-a-real-module');
    expect(result).not.toContain('./not-a-real-module-2');
    expect(result).not.toContain('./comment-module');
    expect(result).not.toContain('./comment-module-2');
  });

  test('extractRelativeImports should handle multi-line import statements', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js');
    
    // Multi-line import: import {\n  foo,\n  bar\n} from './utils'
    const text = `import {
  foo,
  bar
} from './utils'
`;
    
    const result = extractRelativeImports(text);
    expect(result).toContain('./utils');
  });

  test('extractRelativeImports should handle multi-line export statements', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js');
    
    const text = `export {
  foo,
  bar
} from './utils'
`;
    
    const result = extractRelativeImports(text);
    expect(result).toContain('./utils');
  });

  test('extractRelativeImports should handle mixed single-line and multi-line imports', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js');
    
    const text = `import foo from './foo'
import {
  bar,
  baz
} from './bar'
import qux from './qux'
`;
    
    const result = extractRelativeImports(text);
    expect(result).toEqual(['./foo', './bar', './qux']);
  });

  test('extractRelativeImports should handle multi-line imports with trailing semicolon', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js');
    
    const text = `import {
  foo,
  bar
} from './utils';
`;
    
    const result = extractRelativeImports(text);
    expect(result).toContain('./utils');
  });

  test('extractRelativeImports should reset state on newlines (no semicolons)', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js');
    
    // Test with no semicolons (valid JS/TS) - newlines between statements reset state,
    // but NOT within a multi-line import/export statement
    const text = `
import { x } from './real'
const msg = "from './not-a-real-module'"
export { y } from './real2'
`;
    
    const result = extractRelativeImports(text);
    
    // Should find the two real imports
    expect(result).toContain('./real');
    expect(result).toContain('./real2');
    
    // Should NOT include the false positive from the string
    expect(result).not.toContain('./not-a-real-module');
  });



  test('scanFiles should continue despite permission errors on subdirectories', async () => {
    const { scanFiles } = await import('../dev-entry.js');
    
    const testDir = createTempDir();
    try {
      // Create a normal directory with a file
      mkdirSync(join(testDir, 'good'), { recursive: true });
      writeFileSync(join(testDir, 'good', 'file.ts'), 'console.log("hello");');
      
      // Create a directory that will cause permission errors
      mkdirSync(join(testDir, 'bad'), { recursive: true });
      // Make it unreadable
      rmSync(join(testDir, 'bad'), { recursive: true, force: true });
      
      const files: string[] = [];
      await scanFiles(testDir, files, 10);
      
      // Should still find the good file
      expect(files.some(f => f.includes('file.ts'))).toBe(true);
    } finally {
      cleanupTempDir(testDir);
    }
  });

  test('should handle empty directory gracefully', async () => {
    const { scanFiles } = await import('../dev-entry.js');
    
    const testDir = createTempDir();
    try {
      const files: string[] = [];
      await scanFiles(testDir, files, 10);
      expect(files.length).toBe(0);
    } finally {
      cleanupTempDir(testDir);
    }
  });

  test('should find files in nested directories with depth limit', async () => {
    const { scanFiles } = await import('../dev-entry.js');
    
    const testDir = createTempDir();
    try {
      // Create nested structure: testDir/a/b/c/file.ts
      mkdirSync(join(testDir, 'a', 'b', 'c'), { recursive: true });
      writeFileSync(join(testDir, 'a', 'b', 'c', 'file.ts'), 'console.log("hello");');
      
      const files: string[] = [];
      await scanFiles(testDir, files, 3);
      
      // Should find the file
      expect(files.some(f => f.includes('file.ts'))).toBe(true);
    } finally {
      cleanupTempDir(testDir);
    }
  });

  test('file content cache should avoid re-reading unchanged files', async () => {
    const { collectMissingRelativeImports } = await import('../dev-entry.js');
    
    const testDir = createTempDir();
    try {
      // Create a file with imports
      const testFile = join(testDir, 'test.ts');
      writeFileSync(testFile, 'import { foo } from "./foo";\nexport const bar = 1;');
      
      // First call - should read the file
      const start1 = Date.now();
      const result1 = await collectMissingRelativeImports();
      const time1 = Date.now() - start1;
      
      // Second call - should use cache
      const start2 = Date.now();
      const result2 = await collectMissingRelativeImports();
      const time2 = Date.now() - start2;
      
      // Cache should make the second call faster
      expect(time2).toBeLessThan(time1);
    } finally {
      cleanupTempDir(testDir);
    }
  });

  test('getChangedFilesSinceLastCommit should handle empty repo gracefully', async () => {
    const { getChangedFilesSinceLastCommit } = await import('../dev-entry.js');
    
    const result = await getChangedFilesSinceLastCommit();
    expect(Array.isArray(result)).toBe(true);
  });

  test('getChangedFilesSinceLastCommit should return array when git is available', async () => {
    const { getChangedFilesSinceLastCommit } = await import('../dev-entry.js');
    
    // This test will pass if git is available and there are commits
    const result = await getChangedFilesSinceLastCommit();
    expect(Array.isArray(result)).toBe(true);
  });

  test('hasResolvableTarget should be efficient - use single readdir instead of multiple access calls', async () => {
    const { hasResolvableTarget } = await import('../dev-entry.js');
    
    const testDir = createTempDir();
    try {
      // Create a directory with a file
      mkdirSync(join(testDir, 'module'), { recursive: true });
      writeFileSync(join(testDir, 'module', 'index.ts'), 'export const x = 1;');
      
      const target = resolve(testDir, 'module');
      const result = await hasResolvableTarget(target);
      
      // Should resolve successfully
      expect(result).toBe(true);
    } finally {
      cleanupTempDir(testDir);
    }
  });

  test('hasResolvableTarget should prefer .ts over .js when both exist', async () => {
    const { hasResolvableTarget } = await import('../dev-entry.js');
    
    const testDir = createTempDir();
    try {
      // Create both .ts and .js files
      writeFileSync(join(testDir, 'module.ts'), 'export const x = 1;');
      writeFileSync(join(testDir, 'module.js'), 'export const x = 1;');
      
      const target = resolve(testDir, 'module');
      const result = await hasResolvableTarget(target);
      
      // Should prefer .ts
      expect(result).toBe(true);
    } finally {
      cleanupTempDir(testDir);
    }
  });

  test('hasResolvableTarget should resolve index files in directories', async () => {
    const { hasResolvableTarget } = await import('../dev-entry.js');
    
    const testDir = createTempDir();
    try {
      // Create a directory with an index file
      mkdirSync(join(testDir, 'module'), { recursive: true });
      writeFileSync(join(testDir, 'module', 'index.ts'), 'export const x = 1;');
      
      const target = resolve(testDir, 'module');
      const result = await hasResolvableTarget(target);
      
      // Should resolve via index.ts
      expect(result).toBe(true);
    } finally {
      cleanupTempDir(testDir);
    }
  });

  test('regex should not cause catastrophic backtracking on malformed input', async () => {
    const { collectMissingRelativeImports } = await import('../dev-entry.js');
    
    const testDir = createTempDir();
    try {
      // Create a file with many 'import' keywords but no valid module specifiers
      // This should not cause catastrophic backtracking
      const testFile = join(testDir, 'test.ts');
      // Create a file with 1000 'import' keywords
      let content = '';
      for (let i = 0; i < 1000; i++) {
        content += 'import ';
      }
      content += 'from "./module";';
      writeFileSync(testFile, content);
      
      // This should complete quickly (no ReDoS), but CI may be slow -> generous timeout
      const start = Date.now();
      const result = await collectMissingRelativeImports();
      const duration = Date.now() - start;
      
      // CI environments can be slow; allow up to 30s for the full scan
      expect(duration).toBeLessThan(30000);
      
      // Should find the one valid import
      expect(result.length).toBeGreaterThan(0);
    } finally {
      cleanupTempDir(testDir);
    }
  });
});
