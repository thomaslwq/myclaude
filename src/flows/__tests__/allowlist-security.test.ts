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
    expect(() => sanitizeCommand('mkdir mydir')).not.toThrow()
    expect(() => sanitizeCommand('touch myfile')).not.toThrow()
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

  test('rejects path traversal via file arguments in allowed commands (issue #928)', () => {
    // Absolute paths should be rejected
    expect(() => sanitizeCommand('cp /etc/passwd ./leaked')).toThrow()
    expect(() => sanitizeCommand('touch /etc/cron.d/backdoor')).toThrow()
    expect(() => sanitizeCommand('mkdir /root/evil')).toThrow()
    expect(() => sanitizeCommand('mv /etc/shadow ./stolen')).toThrow()

    // Path traversal via .. should be rejected
    expect(() => sanitizeCommand('cp ../../secret.txt ./stolen')).toThrow()
    expect(() => sanitizeCommand('mv ../../secret.txt ./stolen')).toThrow()
    expect(() => sanitizeCommand('touch ../../evil.txt')).toThrow()
    expect(() => sanitizeCommand('mkdir ../../evil')).toThrow()

    // NUL bytes should be rejected
    // Use an actual NUL byte character (\x00 = 0x00)
    expect(() => sanitizeCommand('cp foo' + '\x00' + 'bar ./safe')).toThrow()
  })

  test('allows valid relative paths in allowed commands (issue #928)', () => {
    // Valid relative paths should still be allowed
    expect(() => sanitizeCommand('cp ./safe/file.txt ./dest/')).not.toThrow()
    expect(() => sanitizeCommand('mv file.txt backup/')).not.toThrow()
    expect(() => sanitizeCommand('touch newfile.txt')).not.toThrow()
    expect(() => sanitizeCommand('mkdir ./newdir')).not.toThrow()
    expect(() => sanitizeCommand('echo hello world')).not.toThrow()
  })

  test('rejects path traversal for tsc arguments (issue #934)', () => {
    // Absolute paths
    expect(() => sanitizeCommand('tsc --project /etc/evil/tsconfig.json')).toThrow()
    // Path traversal via ..
    expect(() => sanitizeCommand('tsc --project ../../evil/tsconfig.json')).toThrow()
  })

  test('rejects path traversal for vitest arguments (issue #934)', () => {
    // Absolute paths
    expect(() => sanitizeCommand('vitest /etc/evil/test.ts')).toThrow()
    // Path traversal via ..
    expect(() => sanitizeCommand('vitest ../../evil/test.ts')).toThrow()
  })

  test('allows valid relative paths for tsc and vitest (issue #934)', () => {
    // Valid relative paths should still be allowed
    expect(() => sanitizeCommand('tsc --project ./tsconfig.json')).not.toThrow()
    expect(() => sanitizeCommand('vitest ./test/suite.test.ts')).not.toThrow()
  })

  test('rejects path traversal via --flag=/absolute/path syntax (issue #939)', () => {
    // Absolute path embedded in = syntax (bypasses startsWith('/') check)
    expect(() => sanitizeCommand('tsc --project=/etc/evil/tsconfig.json')).toThrow()
    expect(() => sanitizeCommand('vitest --config=/etc/evil/vitest.config.ts')).toThrow()
    expect(() => sanitizeCommand('cp --target-directory=/etc/evil ./file')).toThrow()

    // Path traversal via .. embedded in = syntax
    expect(() => sanitizeCommand('tsc --project=../../evil/tsconfig.json')).toThrow()
    expect(() => sanitizeCommand('vitest --config=../../evil/vitest.config.ts')).toThrow()

    // Windows drive path embedded in = syntax
    expect(() => sanitizeCommand('tsc --project=C:/evil/tsconfig.json')).toThrow()
  })

  test('allows valid relative paths in = syntax (issue #939)', () => {
    expect(() => sanitizeCommand('tsc --project=./tsconfig.json')).not.toThrow()
    expect(() => sanitizeCommand('vitest --config=./vitest.config.ts')).not.toThrow()
  })
})
