import { describe, it, expect, beforeEach, jest } from 'bun:test'
import { executeFlow, generateDiffPreview, shouldContinueOnError } from '../flows/executor'
import type { FlowDefinition, FlowStep } from '../flows/executor'

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

  it('should mark step as complete when onStepComplete throws error and propagate error to caller', async () => {
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

    // Step 1 should be marked as completed (not failed) even though onStepComplete threw,
    // but the error should be propagated to the caller (issue #908).
    await expect(
      executeFlow(flow, mockContext, undefined, onStepComplete, onStepFail),
    ).rejects.toThrow('onStepComplete error')

    expect(completedSteps).toEqual(['1', '2'])
    expect(failedSteps).toEqual([])
  })

  it('should mark step as complete when onStepComplete throws error and continue flow, then propagate error to caller', async () => {
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

    // All steps should still be executed (completed), but the callback error
    // should be propagated to the caller after the flow completes (issue #908).
    await expect(
      executeFlow(flow, mockContext, undefined, onStepComplete, onStepFail),
    ).rejects.toThrow('onStepComplete error')

    expect(completedSteps).toEqual(['1', '2', '3'])
    expect(failedSteps).toEqual([])
  })

  it('should mark step as complete when onStepComplete throws error and continue flow with files, then propagate error to caller', async () => {
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

    // All steps should still be executed (completed), but the callback error
    // should be propagated to the caller after the flow completes (issue #908).
    await expect(
      executeFlow(flow, mockContext, undefined, onStepComplete, onStepFail),
    ).rejects.toThrow('onStepComplete error')

    expect(completedSteps).toEqual(['1', '2'])
    expect(failedSteps).toEqual([])
  })

  it('should still execute step and propagate onStepStart error to caller (issue #940)', async () => {
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
    const onStepStart = async (step: any, state: any) => {
      if (step.id === '1') {
        throw new Error('onStepStart error')
      }
    }
    const onStepComplete = async (step: any, state: any) => {
      completedSteps.push(step.id)
    }
    const onStepFail = async (step: any, state: any, error: Error) => {
      failedSteps.push(step.id)
    }

    // Step 1 should still be executed (completed) even though onStepStart
    // threw, but the error should be propagated to the caller (issue #940).
    await expect(
      executeFlow(flow, mockContext, onStepStart, onStepComplete, onStepFail),
    ).rejects.toThrow('onStepStart error')

    expect(completedSteps).toEqual(['1', '2'])
    expect(failedSteps).toEqual([])
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

describe('shouldContinueOnError', () => {
  const step: FlowStep = {
    id: '1',
    description: 'Test step',
  }

  it('should return true for transient error code ETIMEDOUT', async () => {
    const err = Object.assign(new Error('Operation timed out'), { code: 'ETIMEDOUT' })
    expect(await shouldContinueOnError(err, step)).toBe(true)
  })

  it('does not match plain "connect ETIMEDOUT <addr>" message without structured props (issue #895)', async () => {
    // Message formats vary across Node versions/platforms; without
    // .code/.errno the simple fallback intentionally does NOT match.
    const err = new Error('connect ETIMEDOUT 1.2.3.4:80')
    expect(await shouldContinueOnError(err, step)).toBe(false)
  })

  it('does not match hostname:port message without structured props (issue #895)', async () => {
    const err = new Error('connect ETIMEDOUT example.com:80')
    expect(await shouldContinueOnError(err, step)).toBe(false)
  })

  it('should return false for false positive "operation ETIMEDOUT completed:0 results"', async () => {
    // Issue #877: the old regex matched `ETIMEDOUT completed:0` because
    // `\S+:\d+` accepted any non-whitespace string before the colon.
    const err = new Error('operation ETIMEDOUT completed:0 results')
    expect(await shouldContinueOnError(err, step)).toBe(false)
  })

  it('should return false for false positive "operation ETIMEDOUT foo:1"', async () => {
    // Issue #877: `foo:1` is not a valid host:port or IP:port. The message
    // does not start with the code nor follow a colon, so only the address
    // alternative could match — and `foo:1` is not a valid address:port.
    const err = new Error('operation ETIMEDOUT foo:1')
    expect(await shouldContinueOnError(err, step)).toBe(false)
  })

  it('should return false for non-transient error code EACCES', async () => {
    const err = Object.assign(new Error('Permission denied'), { code: 'EACCES' })
    expect(await shouldContinueOnError(err, step)).toBe(false)
  })

  it('should return false for generic error without transient code', async () => {
    const err = new Error('Something went wrong')
    expect(await shouldContinueOnError(err, step)).toBe(false)
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

    // Per CommonMark, backslash escapes do not work inside code spans.
    // Instead, the content is wrapped in a longer backtick delimiter so
    // the inner backticks cannot terminate the span. The content ends
    // with a backtick, so it is padded with a space inside the delimiters.
    const commandLine = preview.split('\n').find(l => l.includes('**Command**'))!
    expect(commandLine).toBe('- **Command**: `` echo `malicious` ``')
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
    // Per CommonMark, backslash escapes do not work inside code spans.
    // The filename contains a single backtick, so the delimiter is two
    // backticks. Content does not start/end with a backtick, so no padding.
    expect(filesLine).toBe('- **Files**: ``file`name.txt``')
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

