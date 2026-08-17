import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Import the module to test
import { scanFiles } from '../dev-entry';

describe('scanFiles concurrency', () => {
  let tmpDir: string;
  let maxConcurrentReaddirs = 0;
  let activeReaddirs = 0;
  let realReaddir: typeof import('fs/promises').readdir;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'scanfiles-conc-'));

    // Create many sibling directories, each with a file
    for (let i = 0; i < 20; i++) {
      const sub = join(tmpDir, `sub_${i}`);
      mkdirSync(sub);
      writeFileSync(join(sub, `file_${i}.ts`), 'export const x = 1;');
    }
    // Also a root file
    writeFileSync(join(tmpDir, 'root.ts'), 'export const r = 1;');
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should process sibling directories concurrently (not sequentially)', async () => {
    const fsPromises = await import('fs/promises');
    realReaddir = fsPromises.readdir;
    maxConcurrentReaddirs = 0;
    activeReaddirs = 0;

    // Use mock.module to wrap readdir with a delay + concurrency tracking
    mock.module('fs/promises', () => {
      const original = fsPromises;
      return {
        ...original,
        readdir: async (...args: any[]) => {
          activeReaddirs++;
          if (activeReaddirs > maxConcurrentReaddirs) {
            maxConcurrentReaddirs = activeReaddirs;
          }
          // Small delay to force overlap
          await new Promise((r) => setTimeout(r, 10));
          try {
            return await (realReaddir as any)(...args);
          } finally {
            activeReaddirs--;
          }
        },
      };
    });

    try {
      const files: string[] = [];
      await scanFiles(tmpDir, files);

      // With 20 sibling directories, concurrency should be > 1
      expect(maxConcurrentReaddirs).toBeGreaterThan(1);
      // All files should be found
      expect(files.length).toBe(21);
    } finally {
      mock.restore();
    }
  });
});
