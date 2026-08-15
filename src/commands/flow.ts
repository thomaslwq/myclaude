import type { Command } from '../commands.js'
import { getAttributionTexts } from '../utils/attribution.js'
import { getAllFlows, getFlowByName } from '../flows/definitions.js'
import { executeFlow, type FlowExecutionState } from '../flows/executor.js'

const ALLOWED_TOOLS = [
  'Bash(*)',
  'Edit(*)',
  'Read(*)',
  'List(*)',
  'Create(*)',
]

function getPromptContent(args: string): string {
  const { flow: flowAttribution } = getAttributionTexts()
  const flows = getAllFlows()

  // If no args, list all flows
  if (!args.trim()) {
    return `## Available Flows

${flows.map(flow => `- **${flow.name}**: ${flow.description}`).join('\n')}

Please specify a flow name to execute, e.g., "/flow docker-setup"`
  }

  // Try to find the flow
  const flow = getFlowByName(args.trim())
  if (!flow) {
    return `## Flow Not Found

Could not find a flow named "${args.trim()}".\n\nAvailable flows:\n${flows.map(f => `- ${f.name}: ${f.description}`).join('\n')}`
  }

  return `## Flow: ${flow.name}

**Description**: ${flow.description}

## Execution Plan

${flow.steps.map((step, index) => `${index + 1}. **${step.id}**: ${step.description}${step.reasoning ? ` - ${step.reasoning}` : ''}`).join('\n')}

## Your Task

Execute the flow step by step:

1. Start with step 1 and work through all steps sequentially
2. For each step, follow the description and reasoning provided
3. Use the available tools (Edit, Run commands, etc.) to complete each step
4. Report progress after each step
5. If a step fails, analyze the error and determine if it's recoverable
6. Continue to the next step unless the error is critical

## Important Rules

- Execute steps in order
- Report progress after each step
- Handle errors gracefully
- Verify each step completes successfully before moving to the next
${flowAttribution ? `

${flowAttribution}` : ''}`
}

const command = {
  type: 'prompt',
  name: 'flow',
  description: 'Execute pre-built workflows (flows)',
  allowedTools: ALLOWED_TOOLS,
  contentLength: 0, // Dynamic content
  progressMessage: 'executing flow',
  source: 'builtin',
  async getPromptForCommand(args: string, context: any) {
    return getPromptContent(args)
  },
  async executeFlow(args: string, context: any) {
    const flow = getFlowByName(args.trim())
    if (!flow) {
      throw new Error(`Flow not found: ${args}`)
    }

    const state = await executeFlow(
      flow,
      context,
      async (step, state) => {
        console.log(`\n▶️  Starting step ${state.currentStepIndex + 1}/${state.totalSteps}: ${step.description}`)
      },
      async (step, state) => {
        console.log(`✅ Step ${state.currentStepIndex}/${state.totalSteps} completed: ${step.description}`)
      },
      async (step, state, error) => {
        console.error(`❌ Step ${state.currentStepIndex}/${state.totalSteps} failed: ${step.description}`)
        console.error(`Error: ${error.message}`)
      },
      async (state) => {
        console.log(`\n🎉 Flow execution complete!`)
        console.log(`Completed: ${state.completedSteps.length}/${state.totalSteps}`)
        console.log(`Failed: ${state.failedSteps.length}/${state.totalSteps}`)
      }
    )

    return state
  },
}

export default command
