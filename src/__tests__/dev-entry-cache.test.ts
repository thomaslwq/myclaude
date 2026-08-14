import { describe, it, expect, beforeEach } from 'bun:test';
import { fileContentCache, scanCache } from '../dev-entry';

describe('Cache eviction', () => {
  beforeEach(() => {
    // Clear caches before each test
    fileContentCache.clear();
    scanCache.clear();
  });

  it('should not exceed max size for fileContentCache', () => {
    const MAX_SIZE = 1000;
    // Add more entries than the max size
    for (let i = 0; i < MAX_SIZE + 100; i++) {
      fileContentCache.set(`/path/file${i}.ts`, { content: `content${i}`, mtime: Date.now() });
    }
    // The cache should not exceed the max size
    expect(fileContentCache.size).toBeLessThanOrEqual(MAX_SIZE);
  });

  it('should not exceed max size for scanCache', () => {
    const MAX_SIZE = 1000;
    // Add more entries than the max size
    for (let i = 0; i < MAX_SIZE + 100; i++) {
      scanCache.set(`/dir/dir${i}`, { files: [`file${i}.ts`], timestamp: Date.now() });
    }
    // The cache should not exceed the max size
    expect(scanCache.size).toBeLessThanOrEqual(MAX_SIZE);
  });

  it('should not exceed max size even with many entries', () => {
    const MAX_SIZE = 1000;
    // Add many more entries than the max size
    for (let i = 0; i < MAX_SIZE * 10; i++) {
      fileContentCache.set(`/path/file${i}.ts`, { content: `content${i}`, mtime: Date.now() });
    }
    // The cache should not exceed the max size
    expect(fileContentCache.size).toBeLessThanOrEqual(MAX_SIZE);
  });

  it('should evict older entries for fileContentCache', () => {
    const MAX_SIZE = 1000;
    // Add 3/4 of max size
    for (let i = 0; i < MAX_SIZE * 3 / 4; i++) {
      fileContentCache.set(`/path/file${i}.ts`, { content: `content${i}`, mtime: Date.now() });
    }
    // All entries should still be present
    for (let i = 0; i < MAX_SIZE * 3 / 4; i++) {
      expect(fileContentCache.get(`/path/file${i}.ts`)).toBeDefined();
    }
  });
});
