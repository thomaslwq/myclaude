/**
 * TDD regression tests for GitHub issues #647 / #648 / #649 / #650.
 *
 * Each test asserts the FIXED behavior. Before the fix these tests FAIL (Red);
 * after the fix they PASS (Green). Written test-first per project TDD rules.
 */
import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dir, '..', '..')

// ── #647: `require()` in ESM source breaks Node.js compatibility ──────────
// initReplBridge.ts is an ESM module ("type": "module") but used a bare
// `require('../assistant/index.js')` inside the KAIROS feature branch.
// Bare `require` is not defined in Node ESM → ReferenceError at runtime.
// Fix: use createRequire(import.meta.url) or dynamic import().
describe('issue #647: no bare require() in ESM source', () => {
  test('initReplBridge.ts must not contain a bare require() call', () => {
    const src = readFileSync(join(ROOT, 'src/bridge/initReplBridge.ts'), 'utf8')
    // The offending line was: require('../assistant/index.js')
    expect(src).not.toContain("require('../assistant/index.js')")
    // It must use an ESM-safe mechanism instead
    expect(src).toMatch(/createRequire|await import\(|import\(/u)
  })
})

// ── #648: changed-file paths resolved against CWD instead of git root ──────
// getChangedFilesSinceLastCommit() ran `git diff --name-only HEAD` +
// `git ls-files --others` (repo-root-relative output) then `resolve(f)`,
// which resolves against the process CWD → wrong path when run from a
// subdirectory. Fix: resolve against `git rev-parse --show-toplevel`.
describe('issue #648: changed-file paths resolve against repo root', () => {
  test('dev-entry.ts must resolve changed files against the git top-level', () => {
    const src = readFileSync(join(ROOT, 'src/dev-entry.ts'), 'utf8')
    // Must discover the repo root via git instead of resolving against CWD
    expect(src).toContain('rev-parse --show-toplevel')
  })

  test('getChangedFilesSinceLastCommit must not resolve() raw git output', () => {
    const src = readFileSync(join(ROOT, 'src/dev-entry.ts'), 'utf8')
    // The old buggy pattern resolved repo-relative paths with resolve(f)
    expect(src).not.toMatch(/\.map\(f => resolve\(f\)\)/u)
  })
})

// ── #649: import scanner false positives from comments / string literals ──
// The scanner must NOT report specifiers that appear inside comments or
// string literals, e.g. `// import { x } from './not-a-real-module'`.
// Fix: extract a pure, comment/string-aware matcher and use it in
// collectMissingRelativeImports().
describe('issue #649: import scanner ignores comments and strings', () => {
  test('extractRelativeImports returns only real relative import specifiers', async () => {
    const { extractRelativeImports } = await import('../dev-entry.js')
    // Real import → found
    expect(extractRelativeImports(`import { x } from './real'\n`)).toEqual(['./real'])
    // Comment containing an import-like line → ignored
    expect(extractRelativeImports(`// import { x } from './fake'\n`)).toEqual([])
    // String literal containing "from './fake'" → ignored
    expect(extractRelativeImports(`const msg = "from './not-a-real-module'"\n`)).toEqual([])
    // Block comment spanning an import → ignored
    expect(extractRelativeImports(`/*\nimport { y } from './also-fake'\n*/\n`)).toEqual([])
    // require() and dynamic import() still detected
    expect(extractRelativeImports(`require('./cjs-dep')\n`)).toEqual(['./cjs-dep'])
    expect(extractRelativeImports(`import('./lazy')\n`)).toEqual(['./lazy'])
  })
})

// ── #650: unsafe reliance on global MACRO in bridgeUI.ts ──────────────────
// printBanner read MACRO.VERSION directly; MACRO is only assigned in
// dev-entry.ts, so importing bridgeUI elsewhere throws ReferenceError.
// Fix: use globalThis.MACRO?.VERSION with a fallback.
describe('issue #650: MACRO access must be safe without the global', () => {
  test('bridgeUI.ts must not dereference MACRO.VERSION without a guard', () => {
    const src = readFileSync(join(ROOT, 'src/bridge/bridgeUI.ts'), 'utf8')
    // Bare MACRO.VERSION is a ReferenceError when the global is absent
    expect(src).not.toMatch(/MACRO\.VERSION/u)
    // Must use optional chaining / globalThis with a fallback
    expect(src).toMatch(/MACRO\?\.VERSION|globalThis.*MACRO/u)
  })
})
