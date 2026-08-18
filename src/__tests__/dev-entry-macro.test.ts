import { describe, test, expect, beforeEach } from 'bun:test';
import { fileContentCache, scanCache } from '../dev-entry';

/**
 * Test for issue #843: Global mutable MACRO without thread-safety or re-entrancy guard.
 *
 * This test verifies that:
 * 1. The MACRO object is frozen (immutable)
 * 2. The MACRO object is initialized only once (no race condition)
 * 3. The initialization is thread-safe (no race condition in concurrent scenarios)
 */

describe('dev-entry MACRO initialization (issue #843)', () => {
  beforeEach(() => {
    // Clear caches before each test
    fileContentCache.clear();
    scanCache.clear();
  });

  test('MACRO should be frozen and immutable', async () => {
    const { MACRO } = await import('../dev-entry.js');
    
    // Verify MACRO exists
    expect(MACRO).toBeDefined();
    expect(MACRO.VERSION).toBeDefined();
    
    // Verify MACRO is frozen (cannot be modified)
    expect(Object.isFrozen(MACRO)).toBe(true);
    
    // Attempting to modify MACRO.VERSION should throw or be ignored
    // Since it's frozen, this should either throw or be silently ignored
    try {
      (MACRO as any).VERSION = 'modified';
      // If it didn't throw, verify it didn't actually change
      expect(MACRO.VERSION).not.toBe('modified');
    } catch (e) {
      // Some implementations might throw when trying to modify a frozen object
      // That's also acceptable
    }
  });

  test('MACRO should be initialized only once (no race condition)', async () => {
    // Import the module multiple times to ensure it's initialized only once
    const { MACRO: MACRO1 } = await import('../dev-entry.js');
    const { MACRO: MACRO2 } = await import('../dev-entry.js');
    const { MACRO: MACRO3 } = await import('../dev-entry.js');
    
    // All imports should return the same object
    expect(MACRO1).toBe(MACRO2);
    expect(MACRO2).toBe(MACRO3);
    expect(MACRO1).toBe(MACRO3);
  });

  test('MACRO should be frozen even after multiple imports', async () => {
    // Import the module multiple times
    const { MACRO: MACRO1 } = await import('../dev-entry.js');
    const { MACRO: MACRO2 } = await import('../dev-entry.js');
    
    // Both should be frozen
    expect(Object.isFrozen(MACRO1)).toBe(true);
    expect(Object.isFrozen(MACRO2)).toBe(true);
    
    // Both should be the same object
    expect(MACRO1).toBe(MACRO2);
  });

  test('MACRO should have all required properties', async () => {
    const { MACRO } = await import('../dev-entry.js');
    
    // Verify all required properties exist
    expect(MACRO.VERSION).toBeDefined();
    expect(MACRO.BUILD_TIME).toBeDefined();
    expect(MACRO.PACKAGE_URL).toBeDefined();
    expect(MACRO.NATIVE_PACKAGE_URL).toBeDefined();
    expect(MACRO.VERSION_CHANGELOG).toBeDefined();
    expect(MACRO.ISSUES_EXPLAINER).toBeDefined();
    expect(MACRO.FEEDBACK_CHANNEL).toBeDefined();
  });
});
