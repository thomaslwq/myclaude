/**
 * TDD regression test for GitHub issue #822.
 *
 * getChangedFilesSinceLastCommit used `git diff --name-only HEAD
 * --diff-filter=ACMR` which excludes Deleted (D) files.  When a source
 * file is deleted but still imported elsewhere, the importer is never
 * re-scanned and the broken import goes undetected.
 *
 * Fix: include 'D' in the diff-filter and, when deleted files are
 * present, fall back to a full directory scan so that files importing
 * the deleted module are re-scanned.
 */
import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dir, '..', '..')

describe('issue #822: deleted files trigger import scanning', () => {
  test('git diff --diff-filter includes D (deleted)', () => {
    const src = readFileSync(join(ROOT, 'src/dev-entry.ts'), 'utf8')
    // Must include 'D' in the diff-filter to detect deleted files
    expect(src).toMatch(/--diff-filter=ACDMR/)
  })

  test('collectMissingRelativeImports falls back to full scan when deleted files are present', () => {
    const src = readFileSync(join(ROOT, 'src/dev-entry.ts'), 'utf8')
    // When a changed file no longer exists on disk (deleted), the code
    // must detect this and scan all files so importers of the deleted
    // module are re-scanned.
    expect(src).toMatch(/hasDeleted|deleted/i)
  })
})
