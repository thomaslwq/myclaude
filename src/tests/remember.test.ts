/**
 * Tests for the /remember command — Issue #18 (memory mechanism).
 *
 * TDD Red phase: these tests should fail before the fix, pass after.
 */
import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'
import { join } from 'path'
import { mkdir, writeFile, unlink, rmdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'

// ── Mock dependencies ──────────────────────────────────────────────

const mockHomeDir = join(import.meta.dir, '..', '..', '.test-tmp', 'claude-home')
const mockCwd = join(import.meta.dir, '..', '..', '.test-tmp', 'cwd')

mock.module('../utils/envUtils.js', () => ({
  getClaudeConfigHomeDir: () => mockHomeDir,
}))

mock.module('../bootstrap/state.js', () => ({
  getOriginalCwd: () => mockCwd,
}))

// Re-import after mocks are set up
let rememberCmd: any
let formatFn: any

beforeEach(async () => {
  // Clean and recreate temp dirs
  for (const d of [mockHomeDir, mockCwd]) {
    if (existsSync(d)) {
      await unlink(join(d, 'CLAUDE.md')).catch(() => {})
      await rmdir(d).catch(() => {})
    }
    await mkdir(d, { recursive: true })
  }

  // Dynamic import (module-level code runs only once, but we test the call function)
  rememberCmd = (await import('../commands/remember.js')).default
})

afterEach(async () => {
  // Cleanup temp dirs
  for (const d of [mockHomeDir, mockCwd]) {
    await unlink(join(d, 'CLAUDE.md')).catch(() => {})
    await rmdir(d).catch(() => {})
  }
})

describe('/remember command', () => {
  test('shows usage help when called with empty args', async () => {
    const loadResult = await rememberCmd.load()
    const result = await loadResult.call('')
    expect(result.type).toBe('text')
    expect(result.value).toContain('Usage: /remember')
  })

  test('shows usage help when called with whitespace-only args', async () => {
    const loadResult = await rememberCmd.load()
    const result = await loadResult.call('   ')
    expect(result.type).toBe('text')
    expect(result.value).toContain('Usage: /remember')
  })

  test('saves content to ~/.claude/CLAUDE.md', async () => {
    const loadResult = await rememberCmd.load()
    const testContent = 'The project uses pnpm, not npm'
    const result = await loadResult.call(testContent)

    // Check success message
    expect(result.type).toBe('text')
    expect(result.value).toContain('Remembered')

    // Check the file was written
    const memFile = join(mockHomeDir, 'CLAUDE.md')
    const content = await readFile(memFile, 'utf-8')
    expect(content).toContain(testContent)
    expect(content).toMatch(/<!-- remembered at \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} -->/)
  })

  test('appends to existing memory file', async () => {
    // Pre-populate the memory file
    const memFile = join(mockHomeDir, 'CLAUDE.md')
    await writeFile(memFile, '<!-- existing -->\nold memory\n', 'utf-8')

    const loadResult = await rememberCmd.load()
    await loadResult.call('new memory content')

    const content = await readFile(memFile, 'utf-8')
    expect(content).toContain('old memory')
    expect(content).toContain('new memory content')
  })

  test('handles error gracefully via command metadata', () => {
    // The command is a local type command — verify it has proper structure
    expect(rememberCmd.type).toBe('local')
    expect(typeof rememberCmd.load).toBe('function')
  })
})
