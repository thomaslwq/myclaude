import { describe, it, expect, beforeEach, jest } from 'bun:test'
import { executeFlow, generateDiffPreview } from '../flows/executor'
import type { FlowDefinition } from '../flows/executor'

// Mock bridge object: commands/file ops fail by default so the flow marks
// the step failed (issue #773 — executeCommand now routes through bridge).
const mockBridge = {
  runCommand: jest.fn().mockRejectedValue(new Error('executeCommand failed')),
  editFile: jest.fn().mockRejectedValue(new Error('executeFileOperation failed')),
}

const mockContext = {
  bridge: mockBridge,
}

describe('executeFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should mark steps as failed when executeCommand stub throws error', async () => {
    const flow: FlowDefinition = {
      name: 'test-flow',
      description: 'Test flow',
      steps: [
        {
          id: '1',
          description: 'Test step',
          command: 'echo hello',
        },
      ],
    }

    const failedSteps: string[] = []
    const onStepFail = async (step: any, state: any, error: Error) => {
      failedSteps.push(step.id)
    }

    const state = await executeFlow(flow, mockContext, undefined, undefined, onStepFail)

    expect(state.completedSteps).toHaveLength(0)
    expect(state.failedSteps).toContain('1')
  })

  it('should mark steps as failed when executeFileOperation stub throws error', async () => {
    const flow: FlowDefinition = {
      name: 'test-flow',
      description: 'Test flow',
      steps: [
        {
          id: '1',
          description: 'Test step',
          files: ['Dockerfile'],
        },
      ],
    }

    const failedSteps: string[] = []
    const onStepFail = async (step: any, state: any, error: Error) => {
      failedSteps.push(step.id)
    }

    const state = await executeFlow(flow, mockContext, undefined, undefined, onStepFail)

    expect(state.completedSteps).toHaveLength(0)
    expect(state.failedSteps).toContain('1')
  })

  it('should fail loudly on first step and stop when flow has multiple steps', async () => {
    const flow: FlowDefinition = {
      name: 'test-flow',
      description: 'Test flow',
      steps: [
        {
          id: '1',
          description: 'Test step 1',
          command: 'echo hello',
        },
        {
          id: '2',
          description: 'Test step 2',
          files: ['Dockerfile'],
        },
        {
          id: '3',
          description: 'Test step 3',
          command: 'echo world',
        },
      ],
    }

    const failedSteps: string[] = []
    const onStepFail = async (step: any, state: any, error: Error) => {
      failedSteps.push(step.id)
    }

    const state = await executeFlow(flow, mockContext, undefined, undefined, onStepFail)

    expect(state.completedSteps).toHaveLength(0)
    expect(state.failedSteps).toEqual(['1'])
  })

  it('should continue to next steps when executeCommand throws transient error with error.code', async () => {
    const transientBridge = {
      runCommand: jest.fn()
        .mockRejectedValueOnce(Object.assign(new Error('Operation timed out'), { code: 'ETIMEDOUT' }))
        .mockResolvedValueOnce(undefined),
      editFile: jest.fn().mockResolvedValue(undefined),
    }

    const flow: FlowDefinition = {
      name: 'test-flow',
      description: 'Test flow',
      steps: [
        {
          id: '1',
          description: 'Test step 1',
          command: 'echo hello',
        },
        {
          id: '2',
          description: 'Test step 2',
          command: 'echo world',
        },
      ],
    }

    const failedSteps: string[] = []
    const completedSteps: string[] = []
    const onStepComplete = async (step: any, state: any) => {
      completedSteps.push(step.id)
    }
    const onStepFail = async (step: any, state: any, error: Error) => {
      failedSteps.push(step.id)
    }

    const state = await executeFlow(flow, { bridge: transientBridge }, undefined, onStepComplete, onStepFail)

    // Step 1 failed but flow continued to step 2
    expect(failedSteps).toEqual(['1'])
    expect(completedSteps).toContain('2')
    expect(state.failedSteps).toContain('1')
    expect(state.completedSteps).toContain('2')
  })

  it('should continue to next steps when executeFileOperation throws transient error with error.code', async () => {
    const transientBridge = {
      runCommand: jest.fn().mockResolvedValue(undefined),
      editFile: jest.fn()
        .mockRejectedValueOnce(Object.assign(new Error('Operation timed out'), { code: 'ETIMEDOUT' }))
        .mockResolvedValueOnce(undefined),
    }

    const flow: FlowDefinition = {
      name: 'test-flow',
      description: 'Test flow',
      steps: [
        {
          id: '1',
          description: 'Test step 1',
          files: ['Dockerfile'],
        },
        {
          id: '2',
          description: 'Test step 2',
          files: ['README.md'],
        },
      ],
    }

    const failedSteps: string[] = []
    const completedSteps: string[] = []
    const onStepComplete = async (step: any, state: any) => {
      completedSteps.push(step.id)
    }
    const onStepFail = async (step: any, state: any, error: Error) => {
      failedSteps.push(step.id)
    }

    const state = await executeFlow(flow, { bridge: transientBridge }, undefined, onStepComplete, onStepFail)

    // Step 1 failed but flow continued to step 2
    expect(failedSteps).toEqual(['1'])
    expect(completedSteps).toContain('2')
    expect(state.failedSteps).toContain('1')
    expect(state.completedSteps).toContain('2')
  })

  it('should NOT mark steps as complete when executeCommand stub throws error', async () => {
    const flow: FlowDefinition = {
      name: 'test-flow',
      description: 'Test flow',
      steps: [
        {
          id: '1',
          description: 'Test step 1',
          command: 'echo hello',
        },
        {
          id: '2',
          description: 'Test step 2',
          files: ['Dockerfile'],
        },
      ],
    }

    const completedSteps: string[] = []
    const failedSteps: string[] = []
    const onStepComplete = async (step: any, state: any) => {
      completedSteps.push(step.id)
    }
    const onStepFail = async (step: any, state: any, error: Error) => {
      failedSteps.push(step.id)
    }

    const state = await executeFlow(flow, mockContext, undefined, onStepComplete, onStepFail)

    expect(completedSteps).toHaveLength(0)
    expect(failedSteps).toEqual(['1'])
    expect(state.completedSteps).toHaveLength(0)
    expect(state.failedSteps).toEqual(['1'])
  })

  it('should NOT mark steps as complete when executeFileOperation stub throws error', async () => {
    const flow: FlowDefinition = {
      name: 'test-flow',
      description: 'Test flow',
      steps: [
        {
          id: '1',
          description: 'Test step 1',
          files: ['Dockerfile'],
        },
        {
          id: '2',
          description: 'Test step 2',
          command: 'echo hello',
        },
      ],
    }

    const completedSteps: string[] = []
    const failedSteps: string[] = []
    const onStepComplete = async (step: any, state: any) => {
      completedSteps.push(step.id)
    }
    const onStepFail = async (step: any, state: any, error: Error) => {
      failedSteps.push(step.id)
    }

    const state = await executeFlow(flow, mockContext, undefined, onStepComplete, onStepFail)

    expect(completedSteps).toHaveLength(0)
    expect(failedSteps).toEqual(['1'])
    expect(state.completedSteps).toHaveLength(0)
    expect(state.failedSteps).toEqual(['1'])
  })

  it('should mark step as complete when onStepComplete throws error', async () => {
    const flow: FlowDefinition = {
      name: 'test-flow',
      description: 'Test flow',
      steps: [
        {
          id: '1',
          description: 'Test step 1',
        },
        {
          id: '2',
          description: 'Test step 2',
        },
      ],
    }

    const completedSteps: string[] = []
    const failedSteps: string[] = []
    const onStepComplete = async (step: any, state: any) => {
      completedSteps.push(step.id)
      if (step.id === '1') {
        throw new Error('onStepComplete error')
      }
    }
    const onStepFail = async (step: any, state: any, error: Error) => {
      failedSteps.push(step.id)
    }

    const state = await executeFlow(flow, mockContext, undefined, onStepComplete, onStepFail)

    // Step 1 should be marked as completed (not failed) even though onStepComplete threw
    expect(completedSteps).toEqual(['1', '2'])
    expect(failedSteps).toEqual([])
    expect(state.completedSteps).toEqual(['1', '2'])
    expect(state.failedSteps).toEqual([])
  })

  it('should mark step as complete when onStepComplete throws error and continue flow', async () => {
    const flow: FlowDefinition = {
      name: 'test-flow',
      description: 'Test flow',
      steps: [
        {
          id: '1',
          description: 'Test step 1',
        },
        {
          id: '2',
          description: 'Test step 2',
        },
        {
          id: '3',
          description: 'Test step 3',
        },
      ],
    }

    const completedSteps: string[] = []
    const failedSteps: string[] = []
    const onStepComplete = async (step: any, state: any) => {
      completedSteps.push(step.id)
      if (step.id === '1') {
        throw new Error('onStepComplete error')
      }
    }
    const onStepFail = async (step: any, state: any, error: Error) => {
      failedSteps.push(step.id)
    }

    const state = await executeFlow(flow, mockContext, undefined, onStepComplete, onStepFail)

    // Step 1 should be marked as completed (not failed) even though onStepComplete threw
    expect(completedSteps).toEqual(['1', '2', '3'])
    expect(failedSteps).toEqual([])
    expect(state.completedSteps).toEqual(['1', '2', '3'])
    expect(state.failedSteps).toEqual([])
  })

  it('should mark step as complete when onStepComplete throws error and continue flow with files', async () => {
    const flow: FlowDefinition = {
      name: 'test-flow',
      description: 'Test flow',
      steps: [
        {
          id: '1',
          description: 'Test step 1',
        },
        {
          id: '2',
          description: 'Test step 2',
        },
      ],
    }

    const completedSteps: string[] = []
    const failedSteps: string[] = []
    const onStepComplete = async (step: any, state: any) => {
      completedSteps.push(step.id)
      if (step.id === '1') {
        throw new Error('onStepComplete error')
      }
    }
    const onStepFail = async (step: any, state: any, error: Error) => {
      failedSteps.push(step.id)
    }

    const state = await executeFlow(flow, mockContext, undefined, onStepComplete, onStepFail)

    // Step 1 should be marked as completed (not failed) even though onStepComplete threw
    expect(completedSteps).toEqual(['1', '2'])
    expect(failedSteps).toEqual([])
    expect(state.completedSteps).toEqual(['1', '2'])
    expect(state.failedSteps).toEqual([])
  })

  it('should abort flow on first step when bridge is missing (No bridge error is fatal, issue #859)', async () => {
    // When context.bridge is undefined or lacks runCommand/editFile, every
    // step will fail with the same "No bridge..." error. The flow should
    // abort immediately after the first failure instead of wastefully
    // attempting every remaining step (issue #859).
    const flow: FlowDefinition = {
      name: 'test-flow',
      description: 'Test flow',
      steps: [
        {
          id: '1',
          description: 'Test step 1',
          command: 'echo hello',
        },
        {
          id: '2',
          description: 'Test step 2',
          command: 'echo world',
        },
        {
          id: '3',
          description: 'Test step 3',
          files: ['Dockerfile'],
        },
      ],
    }

    const failedSteps: string[] = []
    const onStepFail = async (step: any, state: any, error: Error) => {
      failedSteps.push(step.id)
      expect(error.message).toMatch(/^No bridge\.(runCommand|editFile) available/)
    }

    // context with no bridge at all
    const state = await executeFlow(flow, {}, undefined, undefined, onStepFail)

    // Only the first step should have been attempted and failed.
    expect(failedSteps).toEqual(['1'])
    expect(state.failedSteps).toEqual(['1'])
    expect(state.completedSteps).toHaveLength(0)
    expect(state.aborted).toBe(true)
  })

  it('should abort flow on first step when bridge lacks runCommand (No bridge error is fatal, issue #859)', async () => {
    const flow: FlowDefinition = {
      name: 'test-flow',
      description: 'Test flow',
      steps: [
        {
          id: '1',
          description: 'Test step 1',
          command: 'echo hello',
        },
        {
          id: '2',
          description: 'Test step 2',
          command: 'echo world',
        },
      ],
    }

    const failedSteps: string[] = []
    const onStepFail = async (step: any, state: any, error: Error) => {
      failedSteps.push(step.id)
    }

    // bridge present but missing runCommand
    const state = await executeFlow(flow, { bridge: {} }, undefined, undefined, onStepFail)

    expect(failedSteps).toEqual(['1'])
    expect(state.failedSteps).toEqual(['1'])
    expect(state.aborted).toBe(true)
  })
})

describe('generateDiffPreview', () => {
  it('should escape backticks in step.command so inline code spans cannot be broken', () => {
    const flow: FlowDefinition = {
      name: 'test-flow',
      description: 'Test flow',
      steps: [
        {
          id: '1',
          description: 'Test step',
          command: 'echo `malicious`',
        },
      ],
    }

    const preview = generateDiffPreview(flow)

    // The backticks in the command should be escaped, so the inline code
    // span should contain the entire command verbatim.
    expect(preview).toContain('\\`malicious\\`')
    // There should be exactly two backticks that are part of the Markdown
    // inline-code delimiters (the ones wrapping the command), plus the
    // escaped backticks inside.
    const commandLine = preview.split('\n').find(l => l.includes('**Command**'))!
    expect(commandLine).toBe('- **Command**: `echo \\`malicious\\``')
  })

  it('should escape Markdown special characters in step.description', () => {
    const flow: FlowDefinition = {
      name: 'test-flow',
      description: 'Test flow',
      steps: [
        {
          id: '1',
          description: '### Injected heading',
        },
      ],
    }

    const preview = generateDiffPreview(flow)

    // The leading # should be escaped so it doesn't render as a heading.
    expect(preview).toContain('\\#\\#\\# Injected heading')
    expect(preview).not.toMatch(/### Step 1: ### Injected heading/)
  })

  it('should escape Markdown special characters in step.reasoning', () => {
    const flow: FlowDefinition = {
      name: 'test-flow',
      description: 'Test flow',
      steps: [
        {
          id: '1',
          description: 'Test step',
          reasoning: '![x](https://evil.com/x.png)',
        },
      ],
    }

    const preview = generateDiffPreview(flow)

    // The image syntax should be escaped so it doesn't render as an image.
    expect(preview).toContain('\\!')
    expect(preview).toContain('\\[')
    expect(preview).toContain('\\(')
  })

  it('should escape backticks in step.files', () => {
    const flow: FlowDefinition = {
      name: 'test-flow',
      description: 'Test flow',
      steps: [
        {
          id: '1',
          description: 'Test step',
          files: ['file`name.txt'],
        },
      ],
    }

    const preview = generateDiffPreview(flow)

    const filesLine = preview.split('\n').find(l => l.includes('**Files**'))!
    // Backtick inside filename should be escaped with a backslash
    expect(filesLine).toBe('- **Files**: `file\\`name.txt`')
  })

  it('should escape Markdown special characters in flow.name and flow.description', () => {
    const flow: FlowDefinition = {
      name: 'evil`name',
      description: '### Injected heading',
      steps: [],
    }

    const preview = generateDiffPreview(flow)

    expect(preview).toContain('\\#\\#\\# Injected heading')
    expect(preview).toContain('evil\\`name')
  })
})

