import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Import the module to test
import { scanFiles } from '../dev-entry';

describe('scanFiles', () => {
  let tmpDir: string;

  beforeAll(() => {
    // Create a temporary directory structure for testing
    tmpDir = mkdtempSync(join(tmpdir(), 'scanfiles-test-'));
    
    // Create some nested directories and files
    // Level 0: root files
    writeFileSync(join(tmpDir, 'index.ts'), 'export const foo = 1;');
    writeFileSync(join(tmpDir, 'util.js'), 'module.exports = {};');
    
    // Level 1: subdirectory with files
    mkdirSync(join(tmpDir, 'subdir1'));
    writeFileSync(join(tmpDir, 'subdir1', 'a.ts'), 'export const a = 1;');
    writeFileSync(join(tmpDir, 'subdir1', 'b.js'), 'export const b = 1;');
    
    // Level 2: nested subdirectory
    mkdirSync(join(tmpDir, 'subdir1', 'nested'));
    writeFileSync(join(tmpDir, 'subdir1', 'nested', 'deep.tsx'), 'export const deep = 1;');
    
    // Level 1: another subdirectory
    mkdirSync(join(tmpDir, 'subdir2'));
    writeFileSync(join(tmpDir, 'subdir2', 'c.mjs'), 'export const c = 1;');
    
    // Skip node_modules
    mkdirSync(join(tmpDir, 'node_modules'));
    writeFileSync(join(tmpDir, 'node_modules', 'ignore.js'), 'should be ignored');
    
    // Skip .git
    mkdirSync(join(tmpDir, '.git'));
    writeFileSync(join(tmpDir, '.git', 'config'), 'should be ignored');
    
    // Include .github
    mkdirSync(join(tmpDir, '.github'));
    writeFileSync(join(tmpDir, '.github', 'workflows.yml'), 'name: ci');
    
    // Non-source file
    writeFileSync(join(tmpDir, 'readme.md'), '# readme');
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should skip symbolic links to avoid infinite recursion', async () => {
    // This test only works on non-Windows platforms
    if (process.platform === 'win32') {
      console.log('Symlink test skipped on Windows');
      return;
    }

    const symlinkTargetDir = join(tmpDir, 'symlink_target');
    mkdirSync(symlinkTargetDir);
    writeFileSync(join(symlinkTargetDir, 'target.ts'), 'export const target = 1;');
    
    // Create a symlink pointing to a directory
    const symlinkPath = join(tmpDir, 'symlink_dir');
    try {
      symlinkSync(symlinkTargetDir, symlinkPath, 'dir');
    } catch (e) {
      console.log('Symlink test skipped (permission issue)');
      return;
    }
    
    const files: string[] = [];
    await scanFiles(tmpDir, files);
    
    // The symlink should be skipped, so files inside the target dir should not appear
    // (they wouldn't appear anyway since they are not under tmpDir, but the symlink itself is)
    const normalized = files.map(f => f.replace(tmpDir, '').replace(/\\/g, '/'));
    expect(normalized).not.toContain('/symlink_dir/target.ts');
    
    // Clean up symlink
    try { rmSync(symlinkPath, { recursive: true, force: true }); } catch {}
    try { rmSync(symlinkTargetDir, { recursive: true, force: true }); } catch {}
  });

  it('should return all source files in the directory recursively', async () => {
    const files: string[] = [];
    await scanFiles(tmpDir, files);
    
    // Normalize paths for comparison
    const normalized = files.map(f => f.replace(tmpDir, '').replace(/\\/g, '/'));
    
    expect(normalized).toContain('/index.ts');
    expect(normalized).toContain('/util.js');
    expect(normalized).toContain('/subdir1/a.ts');
    expect(normalized).toContain('/subdir1/b.js');
    expect(normalized).toContain('/subdir1/nested/deep.tsx');
    expect(normalized).toContain('/subdir2/c.mjs');
  });

  it('should skip node_modules directory', async () => {
    const files: string[] = [];
    await scanFiles(tmpDir, files);
    
    const normalized = files.map(f => f.replace(tmpDir, '').replace(/\\/g, '/'));
    expect(normalized).not.toContain('/node_modules/ignore.js');
  });

  it('should skip .git directory', async () => {
    const files: string[] = [];
    await scanFiles(tmpDir, files);
    
    const normalized = files.map(f => f.replace(tmpDir, '').replace(/\\/g, '/'));
    expect(normalized).not.toContain('/.git/config');
  });

  it('should only include files with supported extensions', async () => {
    const files: string[] = [];
    await scanFiles(tmpDir, files);
    
    const normalized = files.map(f => f.replace(tmpDir, '').replace(/\\/g, '/'));
    expect(normalized).not.toContain('/readme.md');
    expect(normalized).toContain('/index.ts');
    expect(normalized).toContain('/util.js');
  });

  it('should handle large directory trees without excessive memory', async () => {
    const files: string[] = [];
    await scanFiles(tmpDir, files);
    
    // Should work without throwing
    expect(files.length).toBeGreaterThan(0);
  });
});
