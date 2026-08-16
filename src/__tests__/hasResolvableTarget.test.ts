import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, symlink, unlink, rmdir } from 'fs/promises';
import { join } from 'path';

// Import the function to test
import { hasResolvableTarget } from '../dev-entry';

describe('hasResolvableTarget', () => {
  const testDir = join(import.meta.dir, '..', '..', '.test-tmp', 'hasResolvableTarget-test');
  
  beforeEach(async () => {
    // Clean up and create test directory structure
    await rmdir(testDir, { recursive: true }).catch(() => {});
    await mkdir(testDir, { recursive: true });
  });
  
  afterEach(async () => {
    await rmdir(testDir, { recursive: true }).catch(() => {});
  });
  
  it('should find a regular file', async () => {
    await writeFile(join(testDir, 'foo.ts'), 'export const x = 1;');
    const result = await hasResolvableTarget(join(testDir, 'foo'));
    expect(result).toBe(true);
  });
  
  it('should find a directory with index file', async () => {
    await mkdir(join(testDir, 'mydir'));
    await writeFile(join(testDir, 'mydir', 'index.ts'), 'export const x = 1;');
    const result = await hasResolvableTarget(join(testDir, 'mydir'));
    expect(result).toBe(true);
  });
  
  it('should find a symlink to a directory with index file', async () => {
    // Create a real directory with index file
    await mkdir(join(testDir, 'real-dir'));
    await writeFile(join(testDir, 'real-dir', 'index.ts'), 'export const x = 1;');
    
    // Create a symlink to that directory
    await symlink(join(testDir, 'real-dir'), join(testDir, 'link-dir'));
    
    const result = await hasResolvableTarget(join(testDir, 'link-dir'));
    expect(result).toBe(true);
  });
  
  it('should return false for non-existent path', async () => {
    const result = await hasResolvableTarget(join(testDir, 'nonexistent'));
    expect(result).toBe(false);
  });
  
  it('should find a symlink to a directory with index.js', async () => {
    await mkdir(join(testDir, 'real-dir2'));
    await writeFile(join(testDir, 'real-dir2', 'index.js'), 'export const x = 1;');
    
    await symlink(join(testDir, 'real-dir2'), join(testDir, 'link-dir2'));
    
    const result = await hasResolvableTarget(join(testDir, 'link-dir2'));
    expect(result).toBe(true);
  });
});
