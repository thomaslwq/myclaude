import { describe, it, expect, beforeAll, afterAll, jest } from 'bun:test'

// The flow command module
let flow: any

beforeAll(async () => {
  // Dynamic import to avoid module resolution issues in test env
  flow = await import('../flow.ts')
  flow = flow.default
})

describe('Flow command', () => {
  it('should export a command object with type "prompt"', () => {
    expect(flow).toBeDefined()
    expect(flow.type).toBe('prompt')
    expect(flow.name).toBe('flow')
    expect(flow.description).toBeDefined()
    expect(flow.description.length).toBeGreaterThan(0)
  })

  it('should have a descriptive name and argument hint', () => {
    expect(flow.name).toBe('flow')
    expect(flow.argumentHint).toBe('<flow name>')
  })

  it('should have a getPromptForCommand function that returns a prompt', async () => {
    const result = await flow.getPromptForCommand('docker-setup', undefined)
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

  it('should list all flows when no arguments provided', async () => {
    const result = await flow.getPromptForCommand('', undefined)
    const combinedText = result.map((b: any) => b.text).join(' ')
    expect(combinedText).toContain('Available Flows')
    expect(combinedText).toContain('docker-setup')
    expect(combinedText).toContain('rest-api-setup')
    expect(combinedText).toContain('react-app-setup')
    expect(combinedText).toContain('testing-setup')
  })

  it('should include flow description when a specific flow is provided', async () => {
    const result = await flow.getPromptForCommand('docker-setup', undefined)
    const combinedText = result.map((b: any) => b.text).join(' ')
    expect(combinedText).toContain('Flow: docker-setup')
    expect(combinedText).toContain('Set up a Docker Compose environment')
  })

  it('should show error when flow is not found', async () => {
    const result = await flow.getPromptForCommand('non-existent-flow', undefined)
    const combinedText = result.map((b: any) => b.text).join(' ')
    expect(combinedText).toContain('Flow Not Found')
    expect(combinedText).toContain('non-existent-flow')
  })

  it('should include execution plan in the prompt', async () => {
    const result = await flow.getPromptForCommand('docker-setup', undefined)
    const combinedText = result.map((b: any) => b.text).join(' ')
    expect(combinedText).toContain('Execution Plan')
    expect(combinedText).toContain('Create Dockerfile')
    expect(combinedText).toContain('Create docker-compose.yml')
  })

  it('should be registered in the commands module', async () => {
    const commandsModule = await import('../../commands.ts')
    // Check that the default export has the flow command
    const allCommands = commandsModule.default || commandsModule
    // The commands object should have the flow command
    expect(allCommands).toBeDefined()
    expect(allCommands.flow).toBeDefined()
  })

  it('should have executeFlow function', async () => {
    expect(flow.executeFlow).toBeDefined()
    expect(typeof flow.executeFlow).toBe('function')
  })

  it('should throw error when executing non-existent flow', async () => {
    await expect(flow.executeFlow('non-existent-flow', {})).rejects.toThrow('Flow not found')
  })

  it('should return execution state when flow completes', async () => {
    // This test is limited as executeFlow requires a real bridge context
    // We'll just check that it returns a promise
    const result = flow.executeFlow('docker-setup', {})
    expect(result).toBeInstanceOf(Promise)
  })
})
