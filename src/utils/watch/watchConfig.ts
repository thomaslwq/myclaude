import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Watch mode configuration schema.
 *
 * Stored at `.myclaude/watch.json` in the project root. All fields are optional;
 * missing fields fall back to the defaults in {@link DEFAULT_WATCH_CONFIG}.
 */
export type WatchTriggers = {
  test?: string[]
  lint?: string[]
  build?: string[]
}

export type WatchConfig = {
  include: string[]
  exclude: string[]
  triggers: WatchTriggers
  debounceMs: number
  cooldownMs: number
  maxIterations: number
  maxTokenSpend: number
  autoApply: boolean
  requireApproval: boolean
}

export const DEFAULT_WATCH_CONFIG: WatchConfig = {
  include: ['src/**/*.{ts,tsx,js,jsx}', 'test/**/*.{ts,tsx,js,jsx}'],
  exclude: ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'],
  triggers: {
    test: ['test/**/*.test.{ts,tsx,js,jsx}', 'src/**/*.test.{ts,tsx,js,jsx}'],
    lint: ['src/**/*.{ts,tsx,js,jsx}'],
    build: ['src/**/*.{ts,tsx,js,jsx}'],
  },
  debounceMs: 500,
  cooldownMs: 2000,
  maxIterations: 10,
  maxTokenSpend: 100000,
  autoApply: false,
  requireApproval: true,
}

export const WATCH_CONFIG_FILENAME = 'watch.json'
export const WATCH_CONFIG_DIR = '.myclaude'

/**
 * Resolve the absolute path to the watch config file for a given project root.
 */
export function getWatchConfigPath(projectRoot: string): string {
  return join(projectRoot, WATCH_CONFIG_DIR, WATCH_CONFIG_FILENAME)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

/**
 * Coerce a partial / possibly-invalid config object into a fully-populated
 * {@link WatchConfig}. Unknown keys are ignored; invalid values fall back to
 * defaults. This keeps the loader resilient to user-edited JSON.
 */
export function normalizeWatchConfig(
  raw: unknown,
): WatchConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_WATCH_CONFIG, triggers: { ...DEFAULT_WATCH_CONFIG.triggers } }
  }
  const obj = raw as Record<string, unknown>
  const triggersRaw =
    obj.triggers && typeof obj.triggers === 'object'
      ? (obj.triggers as Record<string, unknown>)
      : {}

  return {
    include: isStringArray(obj.include) ? obj.include : [...DEFAULT_WATCH_CONFIG.include],
    exclude: isStringArray(obj.exclude) ? obj.exclude : [...DEFAULT_WATCH_CONFIG.exclude],
    triggers: {
      test: isStringArray(triggersRaw.test)
        ? triggersRaw.test
        : [...DEFAULT_WATCH_CONFIG.triggers.test ?? []],
      lint: isStringArray(triggersRaw.lint)
        ? triggersRaw.lint
        : [...DEFAULT_WATCH_CONFIG.triggers.lint ?? []],
      build: isStringArray(triggersRaw.build)
        ? triggersRaw.build
        : [...DEFAULT_WATCH_CONFIG.triggers.build ?? []],
    },
    debounceMs: isNumber(obj.debounceMs) ? obj.debounceMs : DEFAULT_WATCH_CONFIG.debounceMs,
    cooldownMs: isNumber(obj.cooldownMs) ? obj.cooldownMs : DEFAULT_WATCH_CONFIG.cooldownMs,
    maxIterations: isNumber(obj.maxIterations)
      ? obj.maxIterations
      : DEFAULT_WATCH_CONFIG.maxIterations,
    maxTokenSpend: isNumber(obj.maxTokenSpend)
      ? obj.maxTokenSpend
      : DEFAULT_WATCH_CONFIG.maxTokenSpend,
    autoApply: isBoolean(obj.autoApply) ? obj.autoApply : DEFAULT_WATCH_CONFIG.autoApply,
    requireApproval: isBoolean(obj.requireApproval)
      ? obj.requireApproval
      : DEFAULT_WATCH_CONFIG.requireApproval,
  }
}

/**
 * Load the watch config from `<projectRoot>/.myclaude/watch.json`.
 *
 * Returns the defaults when the file is missing or unparseable. Never throws.
 */
export function loadWatchConfig(projectRoot: string): WatchConfig {
  const path = getWatchConfigPath(projectRoot)
  if (!existsSync(path)) {
    return normalizeWatchConfig(null)
  }
  try {
    const text = readFileSync(path, 'utf8')
    const parsed = JSON.parse(text)
    return normalizeWatchConfig(parsed)
  } catch {
    return normalizeWatchConfig(null)
  }
}
