import { checkDuplicateKeysInJson } from '../validate.js'
import { describe, it, expect } from 'bun:test'

describe('checkDuplicateKeysInJson', () => {
  it('should detect duplicate keys in simple bindings', () => {
    const json = `[
      {
        "context": "Global",
        "bindings": {
          "ctrl+k": "action:show",
          "ctrl+k": "action:show"
        }
      }
    ]`
    const warnings = checkDuplicateKeysInJson(json)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].type).toBe('duplicate')
    expect(warnings[0].key).toBe('ctrl+k')
    expect(warnings[0].context).toBe('Global')
  })

  it('should not detect duplicates across different contexts', () => {
    const json = `[
      {
        "context": "Global",
        "bindings": { "ctrl+k": "action:show" }
      },
      {
        "context": "Chat",
        "bindings": { "ctrl+k": "action:show" }
      }
    ]`
    const warnings = checkDuplicateKeysInJson(json)
    expect(warnings).toHaveLength(0)
  })

  it('should handle nested objects in bindings values without false positives', () => {
    const json = `[
      {
        "context": "Global",
        "bindings": {
          "ctrl+k": {
            "key": "value",
            "nested": {
              "ctrl+k": "action:show"
            }
          }
        }
      }
    ]`
    const warnings = checkDuplicateKeysInJson(json)
    // Only one key at the bindings level, so no duplicate
    expect(warnings).toHaveLength(0)
  })

  it('should detect duplicates when values have nested objects', () => {
    const json = `[
      {
        "context": "Global",
        "bindings": {
          "ctrl+k": {
            "key": "value"
          },
          "ctrl+k": "action:show"
        }
      }
    ]`
    const warnings = checkDuplicateKeysInJson(json)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].key).toBe('ctrl+k')
    expect(warnings[0].context).toBe('Global')
  })

  it('should handle keys with escaped quotes', () => {
    const json = `[
      {
        "context": "Global",
        "bindings": {
          "key\\\"with\\\"quotes": "action:show"
        }
      }
    ]`
    const warnings = checkDuplicateKeysInJson(json)
    expect(warnings).toHaveLength(0)
  })

  it('should handle strings containing braces', () => {
    const json = `[
      {
        "context": "Global",
        "bindings": {
          "ctrl+k": "command:show{debug}"
        }
      }
    ]`
    const warnings = checkDuplicateKeysInJson(json)
    expect(warnings).toHaveLength(0)
  })

  it('should handle multiple duplicate keys', () => {
    const json = `[
      {
        "context": "Global",
        "bindings": {
          "ctrl+k": "action:show",
          "ctrl+k": "action:show",
          "ctrl+k": "action:show"
        }
      }
    ]`
    const warnings = checkDuplicateKeysInJson(json)
    expect(warnings).toHaveLength(1)
  })

  it('should correctly handle unicode escapes in keys', () => {
    const json = `[
      {
        "context": "Global",
        "bindings": {
          "\\u0041": "action:show",
          "\\u0042": "action:other"
        }
      }
    ]`
    const warnings = checkDuplicateKeysInJson(json)
    expect(warnings).toHaveLength(0)
  })

  it('should not skip characters after unicode escapes', () => {
    const json = `[
      {
        "context": "Global",
        "bindings": {
          "\\u0041X": "action:show",
          "\\u0041Y": "action:other"
        }
      }
    ]`
    // "\u0041X" decodes to "AX", "\u0041Y" decodes to "AY"
    // These are different keys, no duplicate should be detected
    const warnings = checkDuplicateKeysInJson(json)
    expect(warnings).toHaveLength(0)
  })

  it('should detect duplicates when unicode escape matches a following key', () => {
    const json = `[
      {
        "context": "Global",
        "bindings": {
          "\\u0041X": "action:show",
          "AX": "action:other"
        }
      }
    ]`
    // "\u0041X" decodes to "AX", which is the same as the second key
    const warnings = checkDuplicateKeysInJson(json)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].key).toBe('AX')
  })

  it('should handle empty bindings', () => {
    const json = `[
      {
        "context": "Global",
        "bindings": {}
      }
    ]`
    const warnings = checkDuplicateKeysInJson(json)
    expect(warnings).toHaveLength(0)
  })

  it('should handle missing context with duplicates', () => {
    const json = `[
      {
        "bindings": {
          "ctrl+k": "action:show",
          "ctrl+k": "action:show"
        }
      }
    ]`
    const warnings = checkDuplicateKeysInJson(json)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].context).toBe('unknown')
  })

  it('should detect duplicates with deeply nested objects in values', () => {
    const json = `[
      {
        "context": "Global",
        "bindings": {
          "ctrl+k": {
            "key": "value",
            "nested": {
              "ctrl+l": "action:show"
            }
          },
          "ctrl+k": "action:show"
        }
      }
    ]`
    const warnings = checkDuplicateKeysInJson(json)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].key).toBe('ctrl+k')
  })
})
