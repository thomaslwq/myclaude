import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { scanFiles } from '../dev-entry';

describe('scanFiles deterministic order', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'scanfiles-order-'));

    // Create multiple sibling directories with files in a known layout.
    // The order in which these are created on disk is not guaranteed to match
    // lexical order, so a deterministic scanner must sort entries.
    mkdirSync(join(tmpDir, 'zdir'));
    writeFileSync(join(tmpDir, 'zdir', 'z.ts'), 'export const z = 1;');

    mkdirSync(join(tmpDir, 'adir'));
    writeFileSync(join(tmpDir, 'adir', 'a.ts'), 'export const a = 1;');

    mkdirSync(join(tmpDir, 'mdir'));
    writeFileSync(join(tmpDir, 'mdir', 'm.ts'), 'export const m = 1;');

    // Root-level files
    writeFileSync(join(tmpDir, 'root2.ts'), 'export const r2 = 1;');
    writeFileSync(join(tmpDir, 'root1.ts'), 'export const r1 = 1;');
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should produce a deterministic, breadth-first sorted output order', async () => {
    const files: string[] = [];
    await scanFiles(tmpDir, files);

    const normalized = files.map((f) =>
      f.replace(tmpDir, '').replace(/\\/g, '/')
    );

    // With a FIFO queue and sorted directory entries, the output should be
    // a deterministic breadth-first traversal: root files first (sorted),
    // then each subdirectory's files (sorted) in directory order.
    const expected = [
      '/root1.ts',
      '/root2.ts',
      '/adir/a.ts',
      '/mdir/m.ts',
      '/zdir/z.ts',
    ];
    expect(normalized).toEqual(expected);
  });

  it('should produce the same order across multiple invocations', async () => {
    const run1: string[] = [];
    await scanFiles(tmpDir, run1);

    const run2: string[] = [];
    await scanFiles(tmpDir, run2);

    expect(run1).toEqual(run2);
  });
});
