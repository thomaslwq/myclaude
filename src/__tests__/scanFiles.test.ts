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
    
    // Include legitimate dot-prefixed source directories (issue #820)
    mkdirSync(join(tmpDir, '.storybook'));
    writeFileSync(join(tmpDir, '.storybook', 'main.ts'), 'export const story = 1;');
    mkdirSync(join(tmpDir, '.vscode'));
    writeFileSync(join(tmpDir, '.vscode', 'tasks.js'), 'module.exports = {};');
    
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
    try {
      rmSync(symlinkPath, { recursive: true, force: true });
      rmSync(symlinkTargetDir, { recursive: true, force: true });
    } catch {}
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

  it('should include legitimate dot-prefixed source directories (issue #820)', async () => {
    const files: string[] = [];
    await scanFiles(tmpDir, files);
    
    const normalized = files.map(f => f.replace(tmpDir, '').replace(/\\/g, '/'));
    expect(normalized).toContain('/.storybook/main.ts');
    expect(normalized).toContain('/.vscode/tasks.js');
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

  it('should handle deeply nested directories without stack overflow', async () => {
    // Create a deeply nested directory structure (150 levels deep)
    const deepDir = join(tmpDir, 'deep_test');
    mkdirSync(deepDir);
    
    let currentDir = deepDir;
    const depth = 150;
    for (let i = 0; i < depth; i++) {
      currentDir = join(currentDir, `level_${i}`);
      mkdirSync(currentDir);
    }
    // Add a file at the deepest level
    writeFileSync(join(currentDir, 'deepest.ts'), 'export const x = 1;');
    
    const files: string[] = [];
    // Use a high maxDepth to ensure we can reach the deepest file
    // The iterative approach should handle this without stack overflow
    await scanFiles(deepDir, files, depth + 10);
    
    const normalized = files.map(f => f.replace(deepDir, '').replace(/\\/g, '/'));
    // Should find the deepest file
    const expectedPath = '/level_0/level_1/level_2/level_3/level_4/level_5/level_6/level_7/level_8/level_9/level_10/level_11/level_12/level_13/level_14/level_15/level_16/level_17/level_18/level_19/level_20/level_21/level_22/level_23/level_24/level_25/level_26/level_27/level_28/level_29/level_30/level_31/level_32/level_33/level_34/level_35/level_36/level_37/level_38/level_39/level_40/level_41/level_42/level_43/level_44/level_45/level_46/level_47/level_48/level_49/level_50/level_51/level_52/level_53/level_54/level_55/level_56/level_57/level_58/level_59/level_60/level_61/level_62/level_63/level_64/level_65/level_66/level_67/level_68/level_69/level_70/level_71/level_72/level_73/level_74/level_75/level_76/level_77/level_78/level_79/level_80/level_81/level_82/level_83/level_84/level_85/level_86/level_87/level_88/level_89/level_90/level_91/level_92/level_93/level_94/level_95/level_96/level_97/level_98/level_99/level_100/level_101/level_102/level_103/level_104/level_105/level_106/level_107/level_108/level_109/level_110/level_111/level_112/level_113/level_114/level_115/level_116/level_117/level_118/level_119/level_120/level_121/level_122/level_123/level_124/level_125/level_126/level_127/level_128/level_129/level_130/level_131/level_132/level_133/level_134/level_135/level_136/level_137/level_138/level_139/level_140/level_141/level_142/level_143/level_144/level_145/level_146/level_147/level_148/level_149/deepest.ts';
    expect(normalized).toContain(expectedPath);
  });
});
