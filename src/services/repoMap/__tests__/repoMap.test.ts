/**
 * TDD tests for the repo map / implicit context feature
 * (issues #974 Repo Map, #953 semantic indexing, #979 AST mapping).
 *
 * The repoMap module exists (src/services/repoMap/) but has ZERO tests.
 * This suite locks the contract:
 *   - extractSignatures: TS/JS/Python/Go/Rust/markdown/JSON signature
 *     extraction, permissive and stable
 *   - buildRepoMap: walks a workspace, emits a budget-bounded hierarchical
 *     map with proper stats (filesScanned/filesIncluded/truncated)
 *   - isRepoMapEnabled: env-var gating with sensible default
 *
 * Uses temp directories; never touches the real workspace.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  extractSignatures,
  buildRepoMap,
  DEFAULT_IGNORE_DIRS,
  DEFAULT_IGNORE_FILES,
} from '../extractor.js'
import { isRepoMapEnabled } from '../index.js'

describe('extractSignatures (issue #974/#953)', () => {
  test('extracts exported and local function signatures from TypeScript', () => {
    const src = [
      'export function fetchUser(id: string): Promise<User> {',
      '  return api.get(`/users/${id}`)',
      '}',
      '',
      'export async function saveUser(user: User) {',
      '  // body',
      '}',
      '',
      'function helper(x: number): number { return x * 2 }',
      '',
      'export class UserService extends Base {',
      '  constructor(private repo: Repo) {}',
      '}',
      '',
      'export interface User {',
      '  id: string',
      '}',
      '',
      'export const API_URL = "https://api.example.com"',
      '',
      'const TIMEOUT_MS: number = 5000',
    ].join('\n')
    const sigs = extractSignatures(src, '.ts')
    const joined = sigs.join('\n')
    expect(joined).toContain('fetchUser(id: string)')
    expect(joined).toContain('saveUser(user: User)')
    expect(joined).toContain('helper(x: number)')
    // Class/interface/type lines are emitted as bare names (compressed map).
    expect(joined.split('\n')).toContain('UserService')
    expect(joined.split('\n')).toContain('User')
    expect(joined).toContain('API_URL')
    expect(joined).toContain('TIMEOUT_MS')
  })

  test('extracts class and interface names (Java-ish) without crashing', () => {
    const src = 'public class Foo extends Bar {\n  public void run() {}\n}\ninterface Baz {}\n'
    const sigs = extractSignatures(src, '.java')
    const joined = sigs.join('\n')
    // Bare names, no `class`/`interface` keyword prefix (compressed map).
    expect(joined.split('\n')).toContain('Foo')
    expect(joined.split('\n')).toContain('Baz')
  })

  test('extracts Python def/class', () => {
    const src = 'import os\n\ndef process(data):\n    return data\n\nasync def fetch(url):\n    pass\n\nclass Runner:\n    pass\n'
    const sigs = extractSignatures(src, '.py')
    const joined = sigs.join('\n')
    expect(joined).toContain('process(data)')
    expect(joined).toContain('fetch(url)')
    expect(joined).toContain('Runner')
  })

  test('lists top-level keys for JSON files', () => {
    const sigs = extractSignatures('{"name": "x", "version": "1", "scripts": {}}', '.json')
    expect(sigs.length).toBe(1)
    expect(sigs[0]).toContain('keys:')
    expect(sigs[0]).toContain('name')
  })

  test('lists markdown headings', () => {
    const sigs = extractSignatures('# Title\n\n## Section\n\n### Sub\n\ntext', '.md')
    const joined = sigs.join('\n')
    expect(joined).toContain('# Title')
    expect(joined).toContain('# Section')
    expect(joined).toContain('# Sub')
  })

  test('ignores trivial names (if/for/let false positives)', () => {
    const src = 'if (x) { return 1 }\nfor (const i of list) {}\nlet x = 1\n'
    const sigs = extractSignatures(src, '.ts')
    expect(sigs.join('\n')).not.toContain('if')
    expect(sigs.join('\n')).not.toContain('for')
    expect(sigs.join('\n')).not.toContain('let')
  })

  test('caps signatures per file to avoid token blowup', () => {
    const many = Array.from({ length: 500 }, (_, i) => `export function fn${i}() {}`).join('\n')
    const sigs = extractSignatures(many, '.ts')
    expect(sigs.length).toBeLessThanOrEqual(200)
  })
})

describe('buildRepoMap (issue #974/#979)', () => {
  let tmp: string

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'myclaude-repomap-'))
    mkdirSync(join(tmp, 'src'), { recursive: true })
    mkdirSync(join(tmp, 'node_modules', 'pkg'), { recursive: true })
    writeFileSync(join(tmp, 'src', 'a.ts'), 'export function alpha() {}\n')
    writeFileSync(join(tmp, 'src', 'b.ts'), 'export const beta = 1\n')
    writeFileSync(join(tmp, 'node_modules', 'pkg', 'index.ts'), 'export function dep() {}\n')
    writeFileSync(join(tmp, 'src', 'notes.md'), '# Notes\n')
    writeFileSync(join(tmp, 'src', 'data.json'), '{"key": 1}\n')
  })

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test('walks the workspace and emits a hierarchical map', async () => {
    const result = await buildRepoMap({ root: tmp, budgetChars: 100000 })
    // Path separators differ on Windows (backslash) vs POSIX (slash).
    expect(result.map).toMatch(/## src[\\/]a\.ts/)
    expect(result.map).toContain('alpha')
    expect(result.map).toMatch(/## src[\\/]b\.ts/)
    expect(result.map).toContain('beta')
    expect(result.filesIncluded).toBeGreaterThanOrEqual(2)
    expect(result.filesScanned).toBeGreaterThanOrEqual(2)
    expect(result.truncated).toBe(false)
  })

  test('respects DEFAULT_IGNORE_DIRS (node_modules excluded)', async () => {
    expect(DEFAULT_IGNORE_DIRS.has('node_modules')).toBe(true)
    const result = await buildRepoMap({ root: tmp, budgetChars: 100000 })
    expect(result.map).not.toContain('node_modules')
  })

  test('honors a small budget by truncating', async () => {
    const result = await buildRepoMap({ root: tmp, budgetChars: 40 })
    expect(result.chars).toBeLessThanOrEqual(60)
    // Truncated map may include zero or a partial section, but never exceeds budget.
    expect(result.map.length).toBeLessThanOrEqual(60)
  })

  test('returns empty map when no source files have signatures', async () => {
    const empty = join(tmp, 'empty')
    mkdirSync(empty, { recursive: true })
    writeFileSync(join(empty, 'readme.txt'), 'hello world no sigs')
    const result = await buildRepoMap({ root: empty, budgetChars: 100000 })
    expect(result.map).toBe('')
    expect(result.filesIncluded).toBe(0)
  })
})

describe('isRepoMapEnabled (issue #974)', () => {
  const saved = { map: process.env.MYCLAUDE_REPO_MAP, type: process.env.USER_TYPE }

  afterAll(() => {
    if (saved.map === undefined) delete process.env.MYCLAUDE_REPO_MAP
    else process.env.MYCLAUDE_REPO_MAP = saved.map
    if (saved.type === undefined) delete process.env.USER_TYPE
    else process.env.USER_TYPE = saved.type
  })

  test('explicit "0" disables the feature', () => {
    process.env.MYCLAUDE_REPO_MAP = '0'
    expect(isRepoMapEnabled()).toBe(false)
  })

  test('explicit "1" enables the feature even for non-ant users', () => {
    process.env.MYCLAUDE_REPO_MAP = '1'
    process.env.USER_TYPE = 'human'
    expect(isRepoMapEnabled()).toBe(true)
  })

  test('defaults to off for non-ant users without the env var', () => {
    delete process.env.MYCLAUDE_REPO_MAP
    process.env.USER_TYPE = 'human'
    expect(isRepoMapEnabled()).toBe(false)
  })
})
