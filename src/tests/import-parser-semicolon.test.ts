import { describe, test, expect } from 'bun:test'
import { extractRelativeImports } from '../dev-entry.js'

/**
 * Regression tests for import parser issues:
 *  - #811: import statements without a trailing semicolon must still be
 *    recognized (statement terminated by newline, not just ';')
 *  - #851: unterminated multi-line comment must not cause silent import loss
 */

describe('extractRelativeImports - semicolon-less imports (issue #811)', () => {
  test('single-line import without semicolon is extracted', () => {
    const code = "import { a } from './mod-a'"
    expect(extractRelativeImports(code)).toContain('./mod-a')
  })

  test('import followed by another statement on the next line', () => {
    const nl = String.fromCharCode(10)
    const code = "import { a } from './mod-a'" + nl + "const x = 1"
    const result = extractRelativeImports(code)
    expect(result).toContain('./mod-a')
  })
})

describe('extractRelativeImports - unterminated multi-line comment (issue #851)', () => {
  test('unterminated block comment does not lose earlier imports', () => {
    const nl = String.fromCharCode(10)
    const code = "import { a } from './mod-a'" + nl + "/* comment never closed"
    const result = extractRelativeImports(code)
    expect(result).toContain('./mod-a')
  })

  test('unterminated comment at EOF does not hang', () => {
    const code = "import { a } from './mod-a'/* oops"
    const result = extractRelativeImports(code)
    expect(result).toContain('./mod-a')
  })
})
