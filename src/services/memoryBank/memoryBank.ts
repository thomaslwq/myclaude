/**
 * Memory Bank (issue #961): persistent project context across sessions.
 *
 * Stores structured markdown files under `.myclaude/memory/` so a fresh
 * session can instantly understand the project (goals, architecture,
 * conventions, active work, decisions) without the user re-explaining.
 *
 * This module provides the testable filesystem core:
 *   - MEMORY_BANK_FILES       — canonical set of markdown files
 *   - getMemoryBankDir(root)  — `.myclaude/memory/` under a project root
 *   - defaultTemplate(name)   — starter markdown skeleton per file
 *   - ensureMemoryBank(root)  — create missing files with templates
 *   - listMemoryBankFiles(root) — existing files + byte sizes
 *   - readMemoryBank(root)    — name → content map for context injection
 *
 * Session-start injection and the `/memory` slash command build on these.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'

export const MEMORY_BANK_FILES = [
  'project.md',
  'architecture.md',
  'conventions.md',
  'active-context.md',
  'decisions.md',
] as const

export type MemoryBankFileName = (typeof MEMORY_BANK_FILES)[number]

const TEMPLATES: Record<MemoryBankFileName, string> = {
  'project.md': `# Project Brief

<!-- Core project description, goals, and scope. Auto-discovered on first run. -->
`,
  'architecture.md': `# Architecture

<!-- Key files, patterns, and directory structure. -->
`,
  'conventions.md': `# Conventions

<!-- Coding standards, naming, testing patterns discovered in this project. -->
`,
  'active-context.md': `# Active Context

<!-- Current work focus, recent changes, next steps. -->
`,
  'decisions.md': `# Decisions

<!-- Log of significant technical decisions and rationale. -->
`,
}

/** Resolve the memory bank directory under a project root. */
export function getMemoryBankDir(projectRoot: string): string {
  return join(projectRoot, '.myclaude', 'memory')
}

/** Starter markdown template for a memory bank file. */
export function defaultTemplate(name: string): string {
  return TEMPLATES[name as MemoryBankFileName] ?? `# ${name}\n`
}

/** Create missing memory bank files (idempotent). */
export function ensureMemoryBank(projectRoot: string): string[] {
  const dir = getMemoryBankDir(projectRoot)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const created: string[] = []
  for (const f of MEMORY_BANK_FILES) {
    const p = join(dir, f)
    if (!existsSync(p)) {
      writeFileSync(p, defaultTemplate(f), 'utf-8')
      created.push(f)
    }
  }
  return created
}

/** List existing memory bank files with byte sizes. */
export function listMemoryBankFiles(projectRoot: string): Array<{ name: string; bytes: number }> {
  const dir = getMemoryBankDir(projectRoot)
  if (!existsSync(dir)) return []
  return MEMORY_BANK_FILES.filter((f) => existsSync(join(dir, f))).map((f) => ({
    name: f,
    bytes: statSync(join(dir, f)).size,
  }))
}

/** Read all memory bank files into a name → content map (empty if absent). */
export function readMemoryBank(projectRoot: string): Record<string, string> {
  const dir = getMemoryBankDir(projectRoot)
  if (!existsSync(dir)) return {}
  const out: Record<string, string> = {}
  for (const f of MEMORY_BANK_FILES) {
    const p = join(dir, f)
    if (existsSync(p)) {
      out[f] = readFileSync(p, 'utf-8')
    }
  }
  return out
}

/** Read the directory listing for diagnostics (kept small on purpose). */
export function _listDirNames(projectRoot: string): string[] {
  const dir = getMemoryBankDir(projectRoot)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
}
