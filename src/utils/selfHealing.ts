/**
 * Self-Healing "Run & Verify" loop (issue #501/#57).
 *
 * Implements the application-level half of the self-healing cycle: run a
 * verification command, parse its output for failures, apply a fix, and
 * re-run until verification passes or the attempt budget is exhausted.
 *
 * The CI-level loop (`.github/scripts/auto-fix.mjs`) drives this from GitHub
 * Actions; this module provides the same run→parse→fix→rerun primitive that
 * can be embedded in tools or scripts directly.
 */

export type RunResult = {
  /** Exit code of the verification command (0 = success). */
  exitCode: number
  /** Combined stdout/stderr output. */
  output: string
}

export type RunFn = () => Promise<RunResult>

/**
 * Extracts a list of human-readable failure descriptions from command output.
 * Default parser: any non-empty line containing "error"/"✖"/"failed".
 */
export type ErrorParser = (output: string) => string[]

export type FixFn = (
  failures: string[],
  attempt: number,
) => Promise<{ changed: boolean; summary?: string }>

export type SelfHealingOptions = {
  /** Max run→fix→rerun attempts before giving up. Default 3. */
  maxAttempts?: number
  /** Milliseconds to wait between a failed run and applying a fix. Default 0. */
  retryDelayMs?: number
  /** Optional custom failure parser. */
  parseErrors?: ErrorParser
  /** Called after each attempt with attempt number and failure list. */
  onProgress?: (attempt: number, failures: string[]) => void
}

export type SelfHealingOutcome = {
  passed: boolean
  attempts: number
  failures: string[]
  /** Short human-readable report. */
  report: string
}

const DEFAULT_MAX_ATTEMPTS = 3

export function defaultErrorParser(output: string): string[] {
  const lines = output.split('\n')
  const failures: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (
      trimmed &&
      /error|✖|failed|FAIL\b/i.test(trimmed) &&
      !/0 error/i.test(trimmed)
    ) {
      failures.push(trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed)
    }
    if (failures.length >= 20) break
  }
  return failures
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Runs the verification command and, on failure, applies fixes and re-runs
 * until verification passes or `maxAttempts` is exhausted.
 */
export async function runAndVerify(
  run: RunFn,
  fix: FixFn,
  options: SelfHealingOptions = {},
): Promise<SelfHealingOutcome> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const parseErrors = options.parseErrors ?? defaultErrorParser
  let lastFailures: string[] = []
  let attempts = 0

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt
    const result = await run()
    lastFailures = parseErrors(result.output)

    if (result.exitCode === 0 && lastFailures.length === 0) {
      return {
        passed: true,
        attempts,
        failures: [],
        report: `Verification passed on attempt ${attempt}/${maxAttempts}`,
      }
    }

    options.onProgress?.(attempt, lastFailures)

    if (attempt >= maxAttempts) {
      break
    }

    if (options.retryDelayMs && options.retryDelayMs > 0) {
      await sleep(options.retryDelayMs)
    }

    // Apply a fix for the current failures and re-run.
    const fixOutcome = await fix(lastFailures, attempt)
    if (!fixOutcome.changed) {
      // Fixer had nothing to change — a re-run would produce the same
      // result, so stop rather than spin.
      return {
        passed: false,
        attempts,
        failures: lastFailures,
        report: `Fixer made no changes after attempt ${attempt}; giving up`,
      }
    }
  }

  return {
    passed: false,
    attempts,
    failures: lastFailures,
    report: `Verification still failing after ${attempts}/${maxAttempts} attempts: ${lastFailures.length} failure(s) detected`,
  }
}
