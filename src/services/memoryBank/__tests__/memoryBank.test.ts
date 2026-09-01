/**
 * TDD tests for issue #961: Memory Bank (persistent project context).
 *
 * The issue asks for a project-level memory bank under `.myclaude/memory/`
 * with structured markdown files read at session start. We implement the
 * testable core as pure filesystem functions:
 *
 *   - MEMORY_BANK_FILES        — the canonical set of markdown files
 *   - getMemoryBankDir(root)   — `.myclaude/memory/` path under a project
 *   - defaultTemplate(name)    — starter markdown template per file
 *   - ensureMemoryBank(root)   — create missing files with templates
 *   - listMemoryBankFiles(root) — existing files + byte sizes
 *   - readMemoryBank(root)     — file-name → content map for context injection
 *
 * Uses a temp directory so tests never touch the real repo.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  MEMORY_BANK_FILES,
  getMemoryBankDir,
  defaultTemplate,
  ensureMemoryBank,
  listMemoryBankFiles,
  readMemoryBank,
} from '../memoryBank.js'

let tmpRoot: string
let projectRoot: string

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'myclaude-memorybank-'))
  projectRoot = join(tmpRoot, 'project')
})

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('issue #961: memory bank constants', () => {
  test('defines the canonical set of markdown files', () => {
    expect(MEMORY_BANK_FILES).toContain('project.md')
    expect(MEMORY_BANK_FILES).toContain('architecture.md')
    expect(MEMORY_BANK_FILES).toContain('conventions.md')
    expect(MEMORY_BANK_FILES).toContain('active-context.md')
    expect(MEMORY_BANK_FILES).toContain('decisions.md')
    expect(MEMORY_BANK_FILES.every((f) => f.endsWith('.md'))).toBe(true)
  })

  test('defaultTemplate returns a non-empty markdown skeleton per file', () => {
    for (const f of MEMORY_BANK_FILES) {
      const tpl = defaultTemplate(f)
      expect(typeof tpl).toBe('string')
      expect(tpl.length).toBeGreaterThan(10)
      expect(tpl).toContain('#')
    }
  })
})

describe('issue #961: getMemoryBankDir', () => {
  test('resolves to .myclaude/memory under the project root', () => {
    const dir = getMemoryBankDir(projectRoot)
    expect(dir).toBe(join(projectRoot, '.myclaude', 'memory'))
  })
})

describe('issue #961: ensureMemoryBank + listMemoryBankFiles', () => {
  test('creates all missing files with templates', () => {
    ensureMemoryBank(projectRoot)
    for (const f of MEMORY_BANK_FILES) {
      const p = join(projectRoot, '.myclaude', 'memory', f)
      expect(existsSync(p)).toBe(true)
      expect(readFileSync(p, 'utf-8')).toContain('#')
    }
  })

  test('is idempotent — second call does not fail or duplicate', () => {
    ensureMemoryBank(projectRoot)
    ensureMemoryBank(projectRoot)
    const files = readdirSync(join(projectRoot, '.myclaude', 'memory'))
    for (const f of MEMORY_BANK_FILES) {
      expect(files.filter((x) => x === f).length).toBe(1)
    }
  })

  test('listMemoryBankFiles returns existing files with sizes', () => {
    const listed = listMemoryBankFiles(projectRoot)
    expect(listed.length).toBe(MEMORY_BANK_FILES.length)
    for (const f of listed) {
      expect(MEMORY_BANK_FILES).toContain(f.name)
      expect(f.bytes).toBeGreaterThan(0)
    }
  })
})

describe('issue #961: readMemoryBank', () => {
  test('returns a name → content map for context injection', () => {
    const bank = readMemoryBank(projectRoot)
    expect(Object.keys(bank).sort()).toEqual([...MEMORY_BANK_FILES].sort())
    for (const f of MEMORY_BANK_FILES) {
      expect(bank[f].length).toBeGreaterThan(10)
    }
  })

  test('returns empty map when the memory dir does not exist', () => {
    const other = join(tmpRoot, 'no-memory-project')
    expect(readMemoryBank(other)).toEqual({})
  })
})
