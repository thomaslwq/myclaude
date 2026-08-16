import { describe, it, expect } from 'bun:test'
import { filterToolProgressMessages, toolMatchesName, findToolByName } from '../Tool'
import type { ProgressMessage } from '../types/message'
import type { ToolProgressData } from '../types/tools'

describe('filterToolProgressMessages', () => {
  it('filters out hook_progress messages and keeps tool progress', () => {
    const hookMsg = {
      type: 'progress' as const,
      data: { type: 'hook_progress', hookEvent: {}, hookName: 'PostToolUse', command: 'echo' },
    }
    const toolMsg = {
      type: 'progress' as const,
      data: { kind: 'bash', output: 'hello' },
    }
    const result = filterToolProgressMessages([hookMsg, toolMsg] as unknown as ProgressMessage<ToolProgressData>[])
    expect(result).toHaveLength(1)
    expect(result[0]!.data).toEqual(toolMsg.data)
  })

  it('returns empty array when all messages are hook progress', () => {
    const msgs = [
      { type: 'progress' as const, data: { type: 'hook_progress', hookEvent: {}, hookName: 'x', command: 'y' } },
    ]
    expect(filterToolProgressMessages(msgs as unknown as ProgressMessage<ToolProgressData>[])).toHaveLength(0)
  })
})

describe('toolMatchesName', () => {
  it('matches primary name', () => {
    expect(toolMatchesName({ name: 'Bash' }, 'Bash')).toBe(true)
  })

  it('matches an alias', () => {
    expect(toolMatchesName({ name: 'Bash', aliases: ['Run'] }, 'Run')).toBe(true)
  })

  it('does not match unrelated names', () => {
    expect(toolMatchesName({ name: 'Bash' }, 'Grep')).toBe(false)
    expect(toolMatchesName({ name: 'Bash', aliases: ['Run'] }, 'Other')).toBe(false)
  })
})

describe('findToolByName', () => {
  const tools = [
    { name: 'Bash', aliases: ['Run'] },
    { name: 'Grep' },
  ] as Parameters<typeof findToolByName>[0]

  it('finds a tool by primary name', () => {
    expect(findToolByName(tools, 'Bash')?.name).toBe('Bash')
  })

  it('finds a tool by alias', () => {
    expect(findToolByName(tools, 'Run')?.name).toBe('Bash')
  })

  it('returns undefined when not found', () => {
    expect(findToolByName(tools, 'Nope')).toBeUndefined()
  })
})
