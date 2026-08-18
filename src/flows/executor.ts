import type { Command } from '../commands.js'
import type { TaskStep } from '../commands/agent.js'
import { parse } from 'shell-quote'

/**
 * Allowlist of executable program names that flow steps are permitted to
 * invoke. Flow definitions are trusted, but the `executeFlow` API accepts
 * arbitrary `FlowDefinition`s (potentially derived from user input or an
 * LLM-generated plan), so we restrict the program that may be run to a
 * known-safe set. Issue #841.
 */
const ALLOWED_COMMANDS = new Set<string>([
  'npm',
  'npx',
  'node',
  'bun',
  'yarn',
  'pnpm',
  'mkdir',
  'touch',
  'cp',
  'mv',
  'echo',
  'git',
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
          `Invalid command: shell metacharacter in token "${node}" is not allowed: "${command}"`,
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
        `Invalid command: shell metacharacter/operator (${kind}) is not allowed: "${command}"`,
      )
    }

    // Any non-string, non-object entry is unexpected; reject defensively.
    throw new Error(`Invalid command: unexpected token in command: "${command}"`)
  }

  if (argv.length === 0) {
    throw new Error('Invalid command: no program specified')
  }

  const program = argv[0]
  if (!ALLOWED_COMMANDS.has(program)) {
    throw new Error(
      `Invalid command: program "${program}" is not on the allowlist of permitted commands`,
    )
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
}

export async function executeFlow(
  flow: FlowDefinition,
  context: any,
  onStepStart?: (step: FlowStep, state: FlowExecutionState) => Promise<void>,
  onStepComplete?: (step: FlowStep, state: FlowExecutionState) => Promise<void>,
  onStepFail?: (step: FlowStep, state: FlowExecutionState, error: Error) => Promise<void>,
  onComplete?: (state: FlowExecutionState) => Promise<void>
): Promise<FlowExecutionState> {
  const state: FlowExecutionState = {
    currentStepIndex: 0,
    completedSteps: [],
    failedSteps: [],
    totalSteps: flow.steps.length,
    startTime: Date.now(),
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
          // Callback errors should not mark the step as failed or stop the flow.
          console.error(`onStepComplete callback failed for step "${step.id}":`, callbackError)
        }
      }
    } catch (error) {
      state.failedSteps.push(step.id)
      if (onStepFail) {
        try {
          await onStepFail(step, state, error as Error)
        } catch (callbackError) {
          // Callback errors should not stop the flow or prevent onComplete from firing.
          console.error(`onStepFail callback failed for step "${step.id}":`, callbackError)
        }
      }
      // Decide whether to continue or stop
      const shouldContinue = await shouldContinueOnError(error as Error, step)
      if (!shouldContinue) {
        break
      }
    }
  }

  if (onComplete) {
    try {
      await onComplete(state)
    } catch (callbackError) {
      // Callback errors should not cause the executeFlow promise to reject
      // after the flow has completed processing all steps. This is
      // consistent with the error handling for onStepComplete/onStepFail.
      console.error('onComplete callback failed:', callbackError)
    }
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
  throw new Error('No bridge.runCommand available to execute: ' + command)
}

export async function executeFileOperation(file: string, context: any): Promise<void> {
  // Issue #773: the stub never executed anything. Route through the bridge
  // API when available so flows can actually edit files.
  if (context?.bridge?.editFile) {
    await context.bridge.editFile(file)
    return
  }
  throw new Error('No bridge.editFile available to edit: ' + file)
}

export async function shouldContinueOnError(error: Error, step: FlowStep): Promise<boolean> {
  // Check for transient FS/network error codes on the error object itself
  // (Node.js system errors expose these via error.code, e.g. EACCES, ENOENT,
  // ETIMEDOUT). Also check the error message as a fallback for wrapped errors.
  const transientCodes = ['EACCES', 'ENOENT', 'ETIMEDOUT']
  const err = error as any
  if (err.code && transientCodes.includes(err.code)) {
    return true
  }

  // Check error message for transient error codes (for wrapped/system errors)
  if (transientCodes.some(code => error.message.includes(code))) {
    return true
  }

  // Missing bridge configuration is a recoverable error — the step fails but
  // the flow should continue so the remaining steps can still be attempted
  // (issue #808).
  if (error.message.includes('No bridge')) {
    return true
  }

  // Any other error is fatal and aborts the flow.
  return false
}
