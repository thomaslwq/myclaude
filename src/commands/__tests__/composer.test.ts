import { describe, it, expect, beforeAll } from 'bun:test'

// The composer command module
let composer: any

beforeAll(async () => {
  composer = await import('../composer.ts')
  composer = composer.default
})

describe('Composer command', () => {
  it('should export a command object with type "prompt"', () => {
    expect(composer).toBeDefined()
    expect(composer.type).toBe('prompt')
    expect(composer.name).toBe('composer')
    expect(composer.description).toBeDefined()
    expect(composer.description.length).toBeGreaterThan(0)
  })

  it('should have a descriptive name and argument hint', () => {
    expect(composer.name).toBe('composer')
    expect(composer.argumentHint).toBe('<feature description>')
  })

  it('should have a getPromptForCommand function that returns a prompt', async () => {
    const result = await composer.getPromptForCommand('Add a login form with validation', undefined)
    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    for (const block of result) {
      expect(block.type).toBe('text')
      expect(block.text).toBeDefined()
      expect(block.text.length).toBeGreaterThan(0)
    }
  })

  it('should include the user feature description in the prompt', async () => {
    const featureDesc = 'Implement a user profile page'
    const result = await composer.getPromptForCommand(featureDesc, undefined)
    const combinedText = result.map((b: any) => b.text).join(' ')
    expect(combinedText).toContain(featureDesc)
  })

  it('should handle empty feature description with a default message', async () => {
    const result = await composer.getPromptForCommand('', undefined)
    const combinedText = result.map((b: any) => b.text).join(' ')
    expect(combinedText).toContain('(no description provided)')
  })

  it('should include multi-file editing instructions', async () => {
    const result = await composer.getPromptForCommand('Add a feature', undefined)
    const combinedText = result.map((b: any) => b.text).join(' ')
    expect(combinedText).toContain('multi-file')
    expect(combinedText).toContain('edit')
    expect(combinedText).toContain('files')
  })

  it('should mention planning across files', async () => {
    const result = await composer.getPromptForCommand('Add a feature', undefined)
    const combinedText = result.map((b: any) => b.text).join(' ')
    expect(combinedText).toContain('plan')
    expect(combinedText).toContain('files')
  })

  it('should mention verification steps', async () => {
    const result = await composer.getPromptForCommand('Add a feature', undefined)
    const combinedText = result.map((b: any) => b.text).join(' ')
    expect(combinedText).toContain('verify')
    expect(combinedText).toContain('test')
  })
})
