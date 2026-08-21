import type { Command } from '../commands.js'
import type { TaskStep } from '../commands/agent.js'
import { parse } from 'shell-quote'

/**
 * Allowlist of executable program names that flow steps are permitted to
 * invoke. Flow definitions are trusted, but the `executeFlow` API accepts
 * arbitrary `FlowDefinition`s (potentially derived from user input or an
 * LLM-generated plan), so we restrict the program that may be run to a
 * known-safe set. Issue #841.
 *
 * Issue #875: interpreters (`npx`, `node`, `bun`, `yarn`, `pnpm`) are
 * intentionally excluded because they can execute arbitrary code or
 * packages (e.g. `node -e`, `npx malicious-package`), completely defeating
 * the purpose of the allowlist.
 */
const ALLOWED_COMMANDS = new Set<string>([
  // Issues #854/#886/#889/#890: git and npm were removed — git can exec
  // arbitrary commands via config hooks / rebase --exec, and npm can run
  // arbitrary code via `npm run` / `npm exec` / postinstall scripts.
  // Only stateless, non-script-executing commands remain.
  'mkdir',
  'touch',
  'cp',
  'mv',
  'echo',
  'tsc',
  'vitest',
])

/**
 * Parse a shell command string into a safe argv array and validate it
 * against an allowlist. Rejects any command that contains shell control
 * constructs (operators, substitutions, redirects, globs, etc.) or whose
 * program is not on the allowlist. This prevents command injection when a
 * flow step's `command` is derived from untrusted input. Issue #841.
 *
 * @returns a validated argv array (program + args) with no shell metacharacters.
 */
export function sanitizeCommand(command: string): string[] {
  if (typeof command !== 'string' || command.trim().length === 0) {
    throw new Error('Invalid command: empty or non-string command')
  }

  const parsed = parse(command)

  const argv: string[] = []
  for (const node of parsed) {
    if (typeof node === 'string') {
      // Even though shell-quote parses operators into object nodes, some
      // shell metacharacters (e.g. backticks in older versions) may survive
      // inside string tokens. Reject any token that contains characters
      // that could enable command substitution or injection. Issue #841.
      if (/[`$<>|;&\\\n\r]/.test(node)) {
        throw new Error(
          'Invalid command: shell metacharacter in token is not allowed (input omitted for security)',
        )
      }
      argv.push(node)
      continue
    }

    // shell-quote represents operators (`&&`, `;`, `|`, `>`), command
    // substitutions (`$()`, backticks), globs, etc. as object nodes. Any
    // such node means the input is not a simple argv command and could
    // enable command injection — reject it.
    if (node && typeof node === 'object') {
      const kind = (node as any).op || (node as any).pattern || 'shell metacharacter'
      throw new Error(
        `Invalid command: shell metacharacter/operator (${kind}) is not allowed (input omitted for security)`,
      )
    }

    // Any non-string, non-object entry is unexpected; reject defensively.
    throw new Error('Invalid command: unexpected token in command (input omitted for security)')
  }

  if (argv.length === 0) {
    throw new Error('Invalid command: no program specified')
  }

  const program = argv[0]
  if (!ALLOWED_COMMANDS.has(program)) {
    throw new Error(
      'Invalid command: program is not on the allowlist of permitted commands (input omitted for security)',
    )
  }

  // Issue #928: validate file path arguments for commands that operate on files
  // (cp, mv, touch, mkdir). These commands can read/write files outside the
  // workspace via absolute paths or path traversal (..), bypassing the
  // protections in executeFileOperation. We apply the same validation rules
  // as executeFileOperation to the path-like arguments of these commands.
  const FILE_OPERATING_COMMANDS = new Set<string>(['cp', 'mv', 'touch', 'mkdir'])
  if (FILE_OPERATING_COMMANDS.has(program)) {
    for (let i = 1; i < argv.length; i++) {
      const arg = argv[i]
      if (typeof arg !== 'string') continue

      // Reject NUL bytes (null bytes) that can be used to truncate paths on some systems
      if (arg.includes('\x00')) {
        throw new Error('Invalid command argument: NUL byte detected (input omitted for security)')
      }

      // Normalize path separators to forward slash for consistent checking
      const normalized = arg.replace(/\\/g, '/')

      // Reject absolute paths (Unix: /etc/passwd, Windows: C:/...)
      if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
        throw new Error('Invalid command argument: absolute paths are not allowed (input omitted for security)')
      }

      // Reject paths that traverse upward (either directly or embedded)
      // Checks for '..' as a path component, not just anywhere in the string
      const parts = normalized.split('/')
      for (const part of parts) {
        if (part === '..') {
          throw new Error('Invalid command argument: path traversal (..) is not allowed (input omitted for security)')
        }
      }
    }
  }

  return argv
}

export interface FlowStep {
  id: string
  description: string
  command?: string
  files?: string[]
  reasoning?: string
}

/**
 * Wrap a string in a Markdown inline code span that safely contains any
 * backticks present in the content. Per the CommonMark spec, backslash
 * escapes do NOT work inside code spans — a backtick terminates the span.
 * The correct approach is to use a backtick delimiter string that is
 * longer than the longest run of backticks in the content, and pad with
 * spaces when the content starts or ends with a backtick so the delimiters
 * are unambiguous. Issue #869, #873.
 */
function escapeCodeSpan(text: string): string {
  // Find the longest run of backticks and use one more backtick as delimiter
  const maxRun = (text.match(/`+/g) || []).reduce((m, s) => Math.max(m, s.length), 0)
  const delim = '`'.repeat(maxRun + 1)
  // Add spaces inside delimiters if content starts/ends with backtick
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : ''
  return `${delim}${pad}${text}${pad}${delim}`
}

/**
 * Escape Markdown special characters in a string so it can be safely
 * interpolated into Markdown text without injecting formatting, links,
 * headings, or HTML. Issue #869.
 */
function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/#/g, '\\#')
    // Escape & first so the &lt;/&gt; entities below stay inert (issue #887)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/!/g, '\\!')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

/**
 * Generate a human-readable diff preview of a flow's steps before they are
 * auto-applied. This allows users to review the exact changes before the
 * Buddy pet executes them (issue #864).
 *
 * All untrusted content (flow name/description, step fields) is escaped
 * before being interpolated into the Markdown string to prevent Markdown
 * injection or XSS when the preview is rendered in a web context (issue #869).
 */
export function generateDiffPreview(flow: FlowDefinition): string {
  const lines: string[] = []
  lines.push(`## Diff Preview: ${escapeMarkdown(flow.name)}`)
  lines.push(``)
  lines.push(`**Description**: ${escapeMarkdown(flow.description)}`)
  lines.push(``)
  lines.push(`**Steps (${flow.steps.length}):**`)
  lines.push(``)
  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i]
    lines.push(`### Step ${i + 1}: ${escapeMarkdown(step.description)}`)
    if (step.reasoning) {
      lines.push(`- **Reasoning**: ${escapeMarkdown(step.reasoning)}`)
    }
    if (step.command) {
      lines.push(`- **Command**: ${escapeCodeSpan(step.command)}`)
    }
    if (step.files && step.files.length > 0) {
      lines.push(`- **Files**: ${step.files.map(f => escapeCodeSpan(f)).join(', ')}`)
    }
    lines.push(``)
  }
  lines.push(`---`)
  lines.push(`Review the above changes carefully before approving.`)
  return lines.join('\n')
}

export interface FlowDefinition {
  name: string
  description: string
  steps: FlowStep[]
}

export interface FlowExecutionState {
  currentStepIndex: number
  completedSteps: string[]
  failedSteps: string[]
  totalSteps: number
  startTime: number
  aborted: boolean
}

export interface FlowExecutionOptions {
  /**
   * When true, generate a diff preview and call onPreview before executing
   * any step. If onPreview returns false (or rejects), the flow is aborted
   * before any changes are made (issue #864).
   */
  preview?: boolean
  /**
   * Callback invoked with the generated diff preview text. Return true to
   * approve execution, false to abort (issue #864).
   */
  onPreview?: (preview: string) => Promise<boolean>
}

export async function executeFlow(
  flow: FlowDefinition,
  context: any,
  onStepStart?: (step: FlowStep, state: FlowExecutionState) => Promise<void>,
  onStepComplete?: (step: FlowStep, state: FlowExecutionState) => Promise<void>,
  onStepFail?: (step: FlowStep, state: FlowExecutionState, error: Error) => Promise<void>,
  onComplete?: (state: FlowExecutionState) => Promise<void>,
  options?: FlowExecutionOptions,
): Promise<FlowExecutionState> {
  // Issue #874: Validate step ID uniqueness. Flow definitions can be
  // LLM-generated and may contain duplicate step IDs, which would make
  // state tracking ambiguous (e.g. completedSteps/failedSteps would
  // contain the same ID for different steps). Reject such flows early.
  const ids = flow.steps.map(s => s.id)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Flow definition contains duplicate step IDs')
  }

  const state: FlowExecutionState = {
    currentStepIndex: 0,
    completedSteps: [],
    failedSteps: [],
    totalSteps: flow.steps.length,
    startTime: Date.now(),
    aborted: false,
  }

  // Collect callback errors during flow execution so they can be
  // propagated to the caller after the flow completes (issue #908).
  const callbackErrors: Error[] = []

  // Issue #864: Diff Preview Before Auto-Apply. If the preview option is
  // enabled, generate a diff preview and ask the user to approve before
  // executing any step.
  if (options?.preview && options?.onPreview) {
    const preview = generateDiffPreview(flow)
    const approved = await options.onPreview(preview)
    if (!approved) {
      state.aborted = true
      return state
    }
  }

  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i]
    state.currentStepIndex = i

    try {
      if (onStepStart) {
        await onStepStart(step, state)
      }

      // Execute the step
      if (step.command) {
        await executeCommand(step.command, context)
      }

      if (step.files && step.files.length > 0) {
        for (const file of step.files) {
          await executeFileOperation(file, context)
        }
      }

      state.completedSteps.push(step.id)

      if (onStepComplete) {
        try {
          await onStepComplete(step, state)
        } catch (callbackError) {
          // Callback errors should not mark the step as failed or stop the flow,
          // but they must be propagated to the caller so the caller knows a
          // critical failure occurred (issue #908).
          console.error(`onStepComplete callback failed for step "${step.id}":`, callbackError)
          callbackErrors.push(callbackError as Error)
        }
      }
    } catch (error) {
      state.failedSteps.push(step.id)
      if (onStepFail) {
        try {
          await onStepFail(step, state, error as Error)
        } catch (callbackError) {
          // Callback errors should not stop the flow or prevent onComplete from firing,
          // but they must be propagated to the caller so the caller knows a
          // critical failure occurred (issue #908).
          console.error(`onStepFail callback failed for step "${step.id}":`, callbackError)
          callbackErrors.push(callbackError as Error)
        }
      }
      // Decide whether to continue or stop
      const shouldContinue = await shouldContinueOnError(error as Error, step)
      if (!shouldContinue) {
        // A fatal error aborts the flow: remaining steps are skipped so we
        // don't waste time/effort producing identical failures (issue #859).
        state.aborted = true
        break
      }
    }
  }

  if (onComplete) {
    try {
      await onComplete(state)
    } catch (callbackError) {
      // Callback errors must be propagated to the caller so the caller
      // knows a critical failure occurred (issue #908).
      console.error('onComplete callback failed:', callbackError)
      callbackErrors.push(callbackError as Error)
    }
  }

  // If any callback errors were collected, propagate them to the caller
  // after the flow has completed processing all steps (issue #908).
  if (callbackErrors.length > 0) {
    // If there's only one error, throw it directly; otherwise wrap in
    // an AggregateError for completeness.
    if (callbackErrors.length === 1) {
      throw callbackErrors[0]
    }
    throw new AggregateError(callbackErrors, 'Multiple callback errors occurred during flow execution')
  }

  return state
}

export async function executeCommand(command: string, context: any): Promise<void> {
  // Issue #841: parse the command with a safe shell parser and validate it
  // against an allowlist before handing it to the bridge. This prevents
  // command injection when a flow step's `command` is derived from user
  // input or an LLM-generated plan. The bridge receives a structured argv
  // array rather than a raw shell string so it cannot be re-interpreted by
  // a shell.
  const argv = sanitizeCommand(command)

  // Issue #773: the stub never executed anything. Route through the bridge
  // API when available so flows can actually run commands.
  if (context?.bridge?.runCommand) {
    await context.bridge.runCommand(argv)
    return
  }
  throw new Error('No bridge.runCommand available to execute command (input omitted for security)')
}

export async function executeFileOperation(file: string, context: any): Promise<void> {
  // Issue #855: reject path traversal and other dangerous patterns
  if (typeof file !== 'string') {
    throw new Error('Invalid file path: must be a string')
  }

  // Reject NUL bytes (null bytes) that can be used to truncate paths on some systems
  if (file.includes('\x00')) {
    throw new Error('Invalid file path: NUL byte detected')
  }

  // Normalize path separators to forward slash for consistent checking
  const normalized = file.replace(/\\/g, '/')

  // Reject absolute paths (Unix: /etc/passwd, Windows: C:/...)
  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error('Invalid file path: absolute paths are not allowed')
  }

  // Reject paths that traverse upward (either directly or embedded)
  // Checks for '..' as a path component, not just anywhere in the string
  const parts = normalized.split('/')
  for (const part of parts) {
    if (part === '..') {
      throw new Error('Invalid file path: path traversal (..) is not allowed')
    }
  }

  // Issue #773: the stub never executed anything. Route through the bridge
  // API when available so flows can actually edit files.
  if (context?.bridge?.editFile) {
    await context.bridge.editFile(file)
    return
  }
  throw new Error('No bridge.editFile available to edit file (input omitted for security)')
}

export async function shouldContinueOnError(error: Error, step: FlowStep): Promise<boolean> {
  // Only genuinely transient errors are recoverable: network timeouts and
  // common transient network failures that DO resolve on retry (connection
  // reset, network unreachable, broken pipe, temporary DNS failure (EAI_AGAIN)).
  // EACCES (permission denied), ENOENT (file not found), ENOTFOUND (DNS lookup
  // failed — hostname does not exist), and ECONNREFUSED (service not listening)
  // are permanent — retrying produces the same failure — so they stay fatal
  // (issues #774/#850/#888: transient-continue, permanent-abort).
  const transientCodes = [
    'ETIMEDOUT',
    'ECONNRESET',
    'ENETUNREACH',
    'EPIPE',
    'EAI_AGAIN',
  ]
  const err = error as any

  // Primary classification: rely on STRUCTURED error properties that Node.js
  // and libuv attach to system errors. These are stable across Node versions
  // and platforms, unlike error message strings (issue #895). The previous
  // implementation used increasingly complex regex patterns against
  // `error.message` (issues #866/#868/#877), which is fragile because message
  // formats vary across Node versions and platforms.
  //
  // Node.js system errors set:
  //   - `error.code`    e.g. "ETIMEDOUT", "ECONNREFUSED"
  //   - `error.errno`   either a numeric libuv errno or the string code
  //   - `error.syscall` e.g. "connect", "read"
  // We check `code` first (the canonical property), then `errno` (which some
  // errors set to the string code even when `code` is absent).
  const codeFromProps = typeof err.code === 'string' ? err.code : typeof err.errno === 'string' ? err.errno : null
  if (codeFromProps && transientCodes.includes(codeFromProps)) {
    return true
  }

  // Fallback: a SIMPLE, well-documented message-based match. This is a last
  // resort for errors that carry a transient code only inside their message
  // (e.g. errors re-thrown without preserving structured properties). To stay
  // maintainable, we intentionally do NOT try to match every Node.js message
  // variant (such as "connect ETIMEDOUT <addr:port>"); those cases should be
  // fixed at the source by preserving structured properties instead of
  // growing the regex further (issue #895).
  //
  // We only match a code that appears at the start of the message or
  // immediately after a colon (optionally preceded by whitespace), which is
  // how Node/libc formats some system errors (e.g. "ETIMEDOUT: operation timed
  // out" or "request failed: ETIMEDOUT"). A word boundary after the code
  // avoids matching substrings like "ETIMEDOUTS" (issue #866).
  if (transientCodes.some(code => new RegExp(`(^|:\\s*)${code}\\b`).test(error.message))) {
    return true
  }

  // Missing bridge configuration is a fatal error — if the bridge is
  // unavailable at step 1, it will still be unavailable at every subsequent
  // step, so continuing would only produce N identical failures with no
  // useful work done (issue #859). The previous behavior treated this as
  // recoverable (issue #808), but "recoverable" was misleading: there is no
  // point attempting remaining steps when the underlying capability is
  // missing for the whole flow. Match the exact "No bridge.<method>
  // available" prefix produced by executeCommand/executeFileOperation to
  // avoid false positives from unrelated messages that merely contain the
  // substring "No bridge" (issue #866).
  if (/^No bridge\.(runCommand|editFile) available/.test(error.message)) {
    return false
  }

  // Any other error is fatal and aborts the flow.
  return false
}
