import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { Command } from '../commands.js'

interface TaskPlan {
  steps: TaskStep[]
  summary: string
}

interface TaskStep {
  id: string
  description: string
  command?: string
  files?: string[]
  reasoning?: string
}

interface ExecutionState {
  currentStepIndex: number
  completedSteps: string[]
  failedSteps: string[]
  totalSteps: number
  startTime: number
}

function getPrompt(args: string): string {
  const taskDesc = args.trim() || '(no description provided)'

  return `You are an autonomous coding agent. Your goal is to complete the user's request by breaking it down into concrete steps and executing them.

## User's Request

${taskDesc}

## Your Task

1. **Analyze the request** and understand what needs to be done
2. **Create a plan** with 3-7 concrete steps. Each step should be:
   - Specific and actionable
   - Can be executed using available tools (edit files, run commands, etc.)
   - Logical order (start with setup, then core changes, then verification)
3. **For each step**, provide:
   - A clear description of what to do
   - The specific command or file changes needed
   - Brief reasoning for why this step is important

## Planning Guidelines

- Break down complex tasks into smaller, manageable steps
- Include setup steps (install dependencies, create files, etc.)
- Include verification steps (run tests, build, check output)
- Consider edge cases and potential issues
- Keep the plan realistic and achievable

## Example Plan Structure

1. **Setup**: Install dependencies, set up environment
2. **Create files**: Generate necessary files based on requirements
3. **Implement core logic**: Write the main functionality
4. **Add tests**: Write tests to verify the implementation
5. **Run verification**: Execute tests and build to ensure everything works
6. **Cleanup**: Remove temporary files or unnecessary changes

## Important Rules

- Always provide a clear, numbered plan
- Each step should be independent and executable
- Include verification steps to ensure the task is complete
- Be realistic about what can be done in a single step
- If the request is too vague, ask for clarification before planning`
}

function getExecutionPrompt(step: TaskStep, state: ExecutionState): string {
  return `## Current Step: ${step.id}

**Description**: ${step.description}
**Reasoning**: ${step.reasoning || 'No specific reasoning provided.'}

## Context

- **Progress**: ${state.completedSteps.length}/${state.totalSteps} steps completed
- **Failed Steps**: ${state.failedSteps.length} steps failed
- **Current Step**: ${state.currentStepIndex + 1} of ${state.totalSteps}

## Available Tools

You have access to the following tools:
- **Edit files**: Modify code files
- **Run commands**: Execute shell commands (git, npm, bun, etc.)
- **Read files**: Inspect file contents
- **List files**: Explore directory structure
- **Create files**: Generate new files

## Your Task

Execute this step by:
1. Understanding what needs to be done based on the description
2. Using the appropriate tools to accomplish the task
3. Verifying the step completed successfully
4. Reporting the results

**Important**: Only execute this step. Do not plan or execute other steps. Complete this step and report back before moving to the next one.`
}

function getCompletionPrompt(state: ExecutionState, summary: string): string {
  const duration = ((Date.now() - state.startTime) / 1000).toFixed(2)
  const successRate = state.failedSteps.length === 0 ? '100%' : `${Math.round(((state.totalSteps - state.failedSteps.length) / state.totalSteps) * 100)}%`

  return `## Task Completed Successfully! 🎉

### Summary
${summary}

### Execution Statistics
- **Total Steps**: ${state.totalSteps}
- **Completed**: ${state.completedSteps.length}
- **Failed**: ${state.failedSteps.length}
- **Success Rate**: ${successRate}
- **Duration**: ${duration} seconds

### Completed Steps
${state.completedSteps.map((id, i) => `${i + 1}. ${id}`).join('\n')}

### Failed Steps
${state.failedSteps.length > 0 ? state.failedSteps.map((id, i) => `${i + 1}. ${id}`).join('\n') : 'None'}

The task has been completed. You can now report back to the user with these results.`
}

function getErrorPrompt(step: TaskStep, error: string): string {
  return `## Step Failed ❌

**Step**: ${step.description}
**Error**: ${error}

## Your Task

1. Analyze the error and understand what went wrong
2. Try to fix the issue or find an alternative approach
3. If the step cannot be completed, report the failure clearly
4. If you can fix it, retry the step

**Important**: Only handle this step. Do not move to the next step until this one is resolved.`
}

const agent: Command = {
  type: 'prompt',
  name: 'agent',
  description: 'Autonomous agent mode - plan and execute tasks step-by-step',
  argumentHint: '<task description>',
  progressMessage: 'agent mode executing',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args, context): Promise<ContentBlockParam[]> {
    const taskDesc = args.trim() || '(no description provided)'
    
    // First, get the plan from the LLM
    const planPrompt = getPrompt(taskDesc)
    
    // We'll use a two-step process:
    // 1. First call to get the plan
    // 2. Then execute each step
    // For now, we'll return the planning prompt
    // The actual execution will be handled by the LLM in subsequent turns
    
    return [
      { type: 'text', text: planPrompt },
      { 
        type: 'text', 
        text: `
## Execution Instructions

After you receive this plan, you will execute each step one by one. For each step:
1. Read the step description carefully
2. Use the available tools to execute it
3. Report the results
4. Only move to the next step after completing the current one

**Important**: You are in autonomous mode. Execute the plan step-by-step without asking for confirmation between steps. Report progress after each step.

**Plan received. Start executing the first step.**`
      }
    ]
  },
}

export default agent
