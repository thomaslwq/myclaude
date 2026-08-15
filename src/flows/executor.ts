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
        await onStepComplete(step, state)
      }
    } catch (error) {
      state.failedSteps.push(step.id)
      if (onStepFail) {
        await onStepFail(step, state, error as Error)
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

async function executeCommand(command: string, context: any): Promise<void> {
  // This is a simplified version. In a real implementation,
  // you would use the bridge API to execute commands
  console.log(`Executing command: ${command}`)
  // await context.bridge.runCommand(command)
}

async function executeFileOperation(file: string, context: any): Promise<void> {
  // This is a simplified version. In a real implementation,
  // you would use the bridge API to edit files
  console.log(`Executing file operation: ${file}`)
  // await context.bridge.editFile(file)
}

async function shouldContinueOnError(error: Error, step: FlowStep): Promise<boolean> {
  // Check if the error is recoverable
  const errorMessages = [
    'EACCES',
    'ENOENT',
    'ETIMEDOUT',
  ]
  return !errorMessages.some(msg => error.message.includes(msg))
}
