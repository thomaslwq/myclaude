import { describe, test, expect } from 'bun:test'
import { sanitizeCommand } from '../executor.js'

/**
 * Regression tests for issue #854: the ALLOWED_COMMANDS set included
 * git / npx / bun / yarn / pnpm, each of which can execute arbitrary
 * shell commands or scripts (git config hooks, npx package execution),
 * defeating the purpose of the injection allowlist.
 *
 * Fix: only stateless, non-script-executing commands remain allowlisted;
 * anything that can reach a shell or download/run code is rejected.
 */

describe('sanitizeCommand allowlist (issue #854)', () => {
  test('safe stateless commands are still allowed', () => {
    expect(() => sanitizeCommand('mkdir /tmp/x')).not.toThrow()
    expect(() => sanitizeCommand('touch /tmp/x')).not.toThrow()
    expect(() => sanitizeCommand('echo hi')).not.toThrow()
    expect(() => sanitizeCommand('cp a b')).not.toThrow()
  })

  test('git is rejected (can exec via config/hooks/rebase --exec)', () => {
    expect(() => sanitizeCommand('git config core.pager "rm -rf /"')).toThrow()
    expect(() => sanitizeCommand('git rebase --exec "curl evil"')).toThrow()
    expect(() => sanitizeCommand('git status')).toThrow()
  })

  test('npx/bun/yarn/pnpm are rejected (can download and run code)', () => {
    expect(() => sanitizeCommand('npx evil-package')).toThrow()
    expect(() => sanitizeCommand('bun run evil')).toThrow()
    expect(() => sanitizeCommand('yarn add evil')).toThrow()
    expect(() => sanitizeCommand('pnpm exec evil')).toThrow()
  })

  test('shell metacharacters are still rejected', () => {
    expect(() => sanitizeCommand('echo a; rm -rf /')).toThrow()
    expect(() => sanitizeCommand('echo $(whoami)')).toThrow()
  })
})
