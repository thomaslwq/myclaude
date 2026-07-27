import { describe, test, expect } from 'bun:test';

describe('CACHE_MAX_AGE_MS constant', () => {
  test('should be <= 30000ms (30 seconds) for responsive invalidation', async () => {
    // Read the source file to check the CACHE_MAX_AGE_MS constant
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.join(import.meta.dir, '..', 'projectOnboardingState.ts'),
      'utf8'
    );
    // Match the full numeric literal including underscores, then remove underscores
    const match = source.match(/const CACHE_MAX_AGE_MS = ([\d_]+)/);
    expect(match).not.toBeNull();
    if (match) {
      const value = parseInt(match[1].replace(/_/g, ''), 10);
      expect(value).toBeLessThanOrEqual(30000);
      expect(value).toBeGreaterThan(0);
    }
  });
});
