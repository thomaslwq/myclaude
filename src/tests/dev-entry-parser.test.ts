import { describe, test, expect } from 'bun:test'

/**
 * Regression tests for extractRelativeImports parser bugs:
 *  - #752: unterminated string literal must not cause an infinite loop
 *  - #790: comment/quote detection must not read out of bounds at EOF
 *  - #791: escaped quotes inside string literals must be handled
 */

const bs = String.fromCharCode(92) // backslash
const nl = String.fromCharCode(10) // real newline

describe('extractRelativeImports - unterminated string (issue #752)', () => {
  test('unterminated single-quoted string does not hang and returns safely', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js')
    const code = "const x = 'unterminated"
    const result = extractRelativeImports(code)
    expect(Array.isArray(result)).toBe(true)
  })

  test('unterminated backtick template does not hang', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js')
    const code = 'const y = `unterminated'
    const result = extractRelativeImports(code)
    expect(Array.isArray(result)).toBe(true)
  })
})

describe('extractRelativeImports - out-of-bounds at EOF (issue #790)', () => {
  test('file ending with a lone quote does not read out of bounds', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js')
    const code = "import { a } from './x'" + nl + "const q = '"
    const result = extractRelativeImports(code)
    expect(result).toContain('./x')
  })

  test('file ending with a comment does not read out of bounds', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js')
    const code = "import { a } from './x'" + nl + '// comment at end'
    const result = extractRelativeImports(code)
    expect(result).toContain('./x')
  })
})

describe('extractRelativeImports - escaped quotes (issue #791)', () => {
  test('import specifier with escaped quote is preserved', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js')
    const code = "import x from './foo" + bs + "'bar'"
    const result = extractRelativeImports(code)
    expect(result).toContain("./foo" + bs + "'bar")
  })

  test('string with escaped backslash before quote does not end early', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js')
    const code = "const p = 'a" + bs + bs + "' + b" + nl + "import { c } from './real'" + nl
    const result = extractRelativeImports(code)
    expect(result).toContain('./real')
  })
})
