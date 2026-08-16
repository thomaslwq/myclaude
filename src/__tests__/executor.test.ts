import { describe, it, expect, beforeEach, jest } from 'bun:test'
import { executeFlow } from '../flows/executor'
import type { FlowDefinition } from '../flows/executor'

// Mock bridge object
const mockBridge = {
  runCommand: jest.fn(),
  editFile: jest.fn(),
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
})
