#!/usr/bin/env bun
/**
 * TODO/WORKAROUND debt gate (issue #370).
 *
 * Counts TODO / WORKAROUND annotations in src/ and fails CI when the total
 * exceeds the allowed threshold, preventing technical debt from growing
 * without bound. The threshold is intentionally permissive — this is a
 * regression gate, not a zero-debt mandate.
 *
 * Usage:
 *   bun run scripts/check-todos.mjs            # default threshold 120
 *   bun run scripts/check-todos.mjs --max 130  # custom threshold
 */

import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const SRC = join(ROOT, 'src')
const DEFAULT_MAX = 120

const maxIdx = process.argv.indexOf('--max')
const MAX_ALLOWED =
  maxIdx >= 0 ? Number(process.argv[maxIdx + 1]) : DEFAULT_MAX

const TODO_RE = /\bTODO\b|WORKAROUND/g

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      walk(full, out)
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

function main() {
  const files = walk(SRC)
  let total = 0
  const perFile = []

  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const matches = content.match(TODO_RE)
    const count = matches ? matches.length : 0
    if (count > 0) {
      total += count
      perFile.push({ file: relative(ROOT, file), count })
    }
  }

  perFile.sort((a, b) => b.count - a.count)
  console.log(`TODO/WORKAROUND annotations: ${total} (allowed: ${MAX_ALLOWED})`)
  for (const { file, count } of perFile.slice(0, 10)) {
    console.log(`  ${count.toString().padStart(3)}  ${file}`)
  }

  if (total > MAX_ALLOWED) {
    console.error(
      `\nFAIL: ${total} TODO/WORKAROUND annotations exceed the allowed threshold of ${MAX_ALLOWED}.`,
    )
    console.error(
      'Keep the codebase debt-bounded: resolve or consolidate annotations, or raise the threshold deliberately.',
    )
    process.exit(1)
  }
  console.log('PASS: annotation count is within the allowed threshold.')
}

main()
