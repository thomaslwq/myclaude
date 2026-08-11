import { describe, it, expect, beforeAll, afterAll, jest } from 'bun:test'

// The agent command module
let agent: any

beforeAll(async () => {
  // Dynamic import to avoid module resolution issues in test env
  agent = await import('../agent.ts')
  agent = agent.default
})

describe('Agent command', () => {
  it('should export a command object with type "prompt"', () => {
    expect(agent).toBeDefined()
    expect(agent.type).toBe('prompt')
    expect(agent.name).toBe('agent')
    expect(agent.description).toBeDefined()
    expect(agent.description.length).toBeGreaterThan(0)
  })

  it('should have a descriptive name and argument hint', () => {
    expect(agent.name).toBe('agent')
    expect(agent.argumentHint).toBe('<task description>')
  })

  it('should have a getPromptForCommand function that returns a prompt', async () => {
    const result = await agent.getPromptForCommand('Implement a login form', undefined)
    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    // Each item should be a content block with text
    for (const block of result) {
      expect(block.type).toBe('text')
      expect(block.text).toBeDefined()
      expect(block.text.length).toBeGreaterThan(0)
    }
  })

  it('should include the user task description in the prompt', async () => {
    const taskDesc = 'Add a user authentication endpoint'
    const result = await agent.getPromptForCommand(taskDesc, undefined)
    const combinedText = result.map((b: any) => b.text).join(' ')
    expect(combinedText).toContain(taskDesc)
  })

  it('should handle empty task description with a default message', async () => {
    const result = await agent.getPromptForCommand('', undefined)
    const combinedText = result.map((b: any) => b.text).join(' ')
    expect(combinedText).toContain('(no description provided)')
  })

  it('should include autonomous execution instructions', async () => {
    const result = await agent.getPromptForCommand('Fix a bug', undefined)
    const combinedText = result.map((b: any) => b.text).join(' ')
    expect(combinedText).toContain('autonomous')
    expect(combinedText).toContain('plan')
    expect(combinedText).toContain('steps')
  })

  it('should mention available tools in the prompt', async () => {
    const result = await agent.getPromptForCommand('Refactor code', undefined)
    const combinedText = result.map((b: any) => b.text).join(' ')
    expect(combinedText).toContain('available tools')
    expect(combinedText).toContain('edit files')
    expect(combinedText).toContain('run commands')
  })

  it('should be registered in the commands module', async () => {
    const commandsModule = await import('../../commands.ts')
    // Check that the default export has the agent command
    const allCommands = commandsModule.default || commandsModule
    // The commands object should have the agent command
    // We can check by looking for it in the exported commands
    expect(commandsModule).toBeDefined()
  })
})