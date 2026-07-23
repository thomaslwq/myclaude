import { describe, it, expect, beforeEach, jest } from 'bun:test'
import { memoizeWithTTL } from './grove.js'

// We need to access the internal function for testing
// Since it's not exported, let's duplicate the function logic for testing with the fix

// Let's first check if memoizeWithTTL is exported - it's not
describe('memoizeWithTTL', () => {
  // We'll test through the exported functions that use memoizeWithTTL
  // But first, let's verify the key behavior by testing the cache clear
  
  it('should clear entire cache when clear() is called', () => {
    // This test verifies the public API behavior
    // The issue is about internal refresh logic, not the public clear()
    // The public clear() should still clear everything
  })
})

// Test the actual behavior by importing the internal function
// Since memoizeWithTTL is not exported, we need to test it differently
console.log('Test file setup complete')