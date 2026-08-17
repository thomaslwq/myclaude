import { describe, test, expect } from 'bun:test'
import { executeFlow, shouldContinueOnError, type FlowDefinition } from '../executor.js'

/**
 * Regression tests for flow executor (issue #774).
 *
 * shouldContinueOnError: transient FS/network errors (EACCES/ENOENT/ETIMEDOUT)
 * are RECOVERABLE and the flow should CONTINUE (true); anything else is
 * fatal and should ABORT (false). The old code inverted this.
 */

describe('shouldContinueOnError (issue #774)', () => {
  test('transient FS errors are recoverable -> continue (true)', async () => {
    expect(await shouldContinueOnError(new Error('EACCES: permission denied'), {} as never)).toBe(true)
    expect(await shouldContinueOnError(new Error('ENOENT: no such file'), {} as never)).toBe(true)
    expect(await shouldContinueOnError(new Error('ETIMEDOUT: operation timed out'), {} as never)).toBe(true)
  })

  test('other errors are fatal -> abort (false)', async () => {
    expect(await shouldContinueOnError(new Error('SyntaxError: bad code'), {} as never)).toBe(false)
    expect(await shouldContinueOnError(new Error('EINVAL'), {} as never)).toBe(false)
  })
})

describe('executeFlow failure handling (issue #774)', () => {
  test('flow continues after a recoverable transient error', async () => {
    const flow: FlowDefinition = {
      name: 't',
      description: 'test',
      steps: [
        { id: 'a', description: 'a', command: 'mkdir /x' },
        { id: 'b', description: 'b', command: 'touch /y' },
      ],
    }
    const state = await executeFlow(
      flow,
      { bridge: { runCommand: async () => {}, editFile: async () => {} } },
      async (step) => {
        if (step.id === 'a') throw new Error('ENOENT: no such file')
      },
      undefined,
      undefined,
    )
    expect(state.completedSteps).toContain('b')
    expect(state.failedSteps).toEqual(['a'])
  })

  test('flow aborts after a fatal (non-transient) error', async () => {
    const flow: FlowDefinition = {
      name: 't',
      description: 'test',
      steps: [
        { id: 'a', description: 'a', command: 'x' },
        { id: 'b', description: 'b', command: 'y' },
      ],
    }
    const state = await executeFlow(
      flow,
      { bridge: { runCommand: async () => {}, editFile: async () => {} } },
      async (step) => {
        if (step.id === 'a') throw new Error('SyntaxError: bad')
      },
      undefined,
      undefined,
    )
    expect(state.completedSteps).not.toContain('b')
    expect(state.failedSteps).toEqual(['a'])
  })
})

describe('onStepFail callback error handling (issue #823)', () => {
  test('onStepFail throwing does not reject executeFlow and onComplete still fires', async () => {
    const flow: FlowDefinition = {
      name: 't',
      description: 'test',
      steps: [
        { id: 'a', description: 'a', command: 'mkdir /x' },
        { id: 'b', description: 'b', command: 'touch /y' },
      ],
    }
    let onCompleteCalled = false
    const state = await executeFlow(
      flow,
      { bridge: { runCommand: async () => {}, editFile: async () => {} } },
      async (step) => {
        if (step.id === 'a') throw new Error('ENOENT: no such file')
      },
      undefined,
      async () => {
        throw new Error('callback boom')
      },
      async () => {
        onCompleteCalled = true
      },
    )
    expect(state.failedSteps).toContain('a')
    expect(state.completedSteps).toContain('b')
    expect(onCompleteCalled).toBe(true)
  })
})

describe('missing bridge configuration (issue #808)', () => {
  test('shouldContinueOnError returns true for missing bridge errors', async () => {
    expect(await shouldContinueOnError(new Error('No bridge.runCommand available to execute: mkdir'), {} as never)).toBe(true)
    expect(await shouldContinueOnError(new Error('No bridge.editFile available to edit: foo'), {} as never)).toBe(true)
  })

  test('flow continues gracefully when bridge is missing (no context)', async () => {
    const flow: FlowDefinition = {
      name: 't',
      description: 'test',
      steps: [
        { id: 'a', description: 'a', command: 'mkdir /x' },
        { id: 'b', description: 'b', command: 'touch /y' },
      ],
    }
    // No bridge context provided - missing bridge is a recoverable error
    const state = await executeFlow(flow, {})
    expect(state.failedSteps).toContain('a')
    expect(state.failedSteps).toContain('b')
    expect(state.failedSteps.length).toBe(2)
  })

  test('flow continues gracefully when bridge has no runCommand', async () => {
    const flow: FlowDefinition = {
      name: 't',
      description: 'test',
      steps: [
        { id: 'a', description: 'a', command: 'mkdir /x' },
        { id: 'b', description: 'b', command: 'touch /y' },
      ],
    }
    // Bridge object exists but has no runCommand method
    const state = await executeFlow(flow, { bridge: { editFile: async () => {} } })
    expect(state.failedSteps).toContain('a')
    expect(state.failedSteps).toContain('b')
    expect(state.failedSteps.length).toBe(2)
  })
})
