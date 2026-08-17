import type { Command } from '../commands.js'
import type { TaskStep } from '../commands/agent.js'

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
    await onComplete(state)
  }

  return state
}

export async function executeCommand(command: string, context: any): Promise<void> {
  // Issue #773: the stub never executed anything. Route through the bridge
  // API when available so flows can actually run commands.
  if (context?.bridge?.runCommand) {
    await context.bridge.runCommand(command)
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
