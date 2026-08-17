/**
 * TDD regression test for GitHub issue #830:
 * generateAndPatch has no .catch() handler — potential unhandled promise rejection.
 *
 * The fire-and-forget call to generateSessionTitle passes AbortSignal.timeout(15_000).
 * If the underlying implementation doesn't swallow the abort, the timeout surfaces as
 * a rejection. With only a .then() handler and no .catch(), this becomes an unhandled
 * promise rejection that can crash the process.
 *
 * Fix: add a .catch(() => {}) handler to the promise chain.
 */
import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dir, '..', '..')

describe('issue #830: generateAndPatch must handle rejection', () => {
  test('generateAndPatch promise chain has a .catch() handler', () => {
    const src = readFileSync(
      join(ROOT, 'src/bridge/initReplBridge.ts'),
      'utf8',
    )
    // Locate the generateAndPatch function body and verify it contains .catch()
    const generateAndPatchStart = src.indexOf('const generateAndPatch =')
    expect(generateAndPatchStart).toBeGreaterThan(-1)
    // Slice from the function start to the end of the function (next `const onUserMessage`)
    const onUserMessageStart = src.indexOf('const onUserMessage =', generateAndPatchStart)
    expect(onUserMessageStart).toBeGreaterThan(-1)
    const fnBody = src.slice(generateAndPatchStart, onUserMessageStart)
    // Must have a .catch() handler to avoid unhandled promise rejection
    expect(fnBody).toContain('.catch(')
  })
})
