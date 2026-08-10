import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { isTerminalTaskStatus, generateTaskId, createTaskStateBase, type TaskStatus, type TaskType } from '../Task'

const mockGetTaskOutputPath = vi.fn(() => '/tmp/tasks/abc.jsonl')

vi.mock('../utils/task/diskOutput.js', () => ({
  getTaskOutputPath: (id: string) => mockGetTaskOutputPath(id),
}))

describe('isTerminalTaskStatus', () => {
  it('returns true for completed/failed/killed', () => {
    expect(isTerminalTaskStatus('completed')).toBe(true)
    expect(isTerminalTaskStatus('failed')).toBe(true)
    expect(isTerminalTaskStatus('killed')).toBe(true)
  })

  it('returns false for pending/running', () => {
    expect(isTerminalTaskStatus('pending')).toBe(false)
    expect(isTerminalTaskStatus('running')).toBe(false)
  })
})

describe('generateTaskId', () => {
  const types: TaskType[] = [
    'local_bash',
    'local_agent',
    'remote_agent',
    'in_process_teammate',
    'local_workflow',
    'monitor_mcp',
    'dream',
  ]

  it('uses the documented per-type prefix', () => {
    const expectedPrefix: Record<TaskType, string> = {
      local_bash: 'b',
      local_agent: 'a',
      remote_agent: 'r',
      in_process_teammate: 't',
      local_workflow: 'w',
      monitor_mcp: 'm',
      dream: 'd',
    }
    for (const type of types) {
      expect(generateTaskId(type).startsWith(expectedPrefix[type]!)).toBe(true)
    }
  })

  it('generates unique ids and total length = prefix + 8 chars', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const id = generateTaskId('local_bash')
      expect(id.length).toBe(9) // 1 prefix + 8 alphabet chars
      ids.add(id)
    }
    expect(ids.size).toBe(100)
  })

  it('falls back to x prefix for unknown types', () => {
    expect(generateTaskId('dream' as TaskType).startsWith('d')).toBe(true)
  })
})

describe('createTaskStateBase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a pending task state with expected fields', () => {
    const before = Date.now()
    const state = createTaskStateBase('task-1', 'local_bash', 'run ls')
    const after = Date.now()

    expect(state.id).toBe('task-1')
    expect(state.type).toBe('local_bash')
    expect(state.status).toBe('pending')
    expect(state.description).toBe('run ls')
    expect(state.toolUseId).toBeUndefined()
    expect(state.startTime).toBeGreaterThanOrEqual(before)
    expect(state.startTime).toBeLessThanOrEqual(after)
    expect(state.outputOffset).toBe(0)
    expect(state.notified).toBe(false)
    expect(state.outputFile).toBe('/tmp/tasks/abc.jsonl')
  })

  it('carries toolUseId when provided', () => {
    const state = createTaskStateBase('task-2', 'local_agent', 'delegate', 'tool-use-9')
    expect(state.toolUseId).toBe('tool-use-9')
  })

  it('defers to getTaskOutputPath for output file', () => {
    createTaskStateBase('task-3', 'local_bash', 'x')
    expect(mockGetTaskOutputPath).toHaveBeenCalledWith('task-3')
  })
})
