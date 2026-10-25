import { describe, it, expect, beforeAll } from 'bun:test'

// Test the Plan/Act mode toggle feature (issue #1084)
// Verifies that both /plan and /act slash commands exist and are registered
// so users can explicitly switch between planning and execution modes.

let planCmd: any
let actCmd: any
let commandsModule: any

beforeAll(async () => {
  planCmd = (await import('../plan/index.ts')).default
  actCmd = (await import('../act/index.ts')).default
  commandsModule = await import('../../commands.ts')
})

describe('Plan/Act mode toggle (issue #1084)', () => {
  describe('/plan command', () => {
    it('should be defined', () => {
      expect(planCmd).toBeDefined()
    })

    it('should have name "plan"', () => {
      expect(planCmd.name).toBe('plan')
    })

    it('should have a description mentioning plan mode', () => {
      expect(planCmd.description).toBeDefined()
      expect(planCmd.description.toLowerCase()).toContain('plan')
    })

    it('should be a local-jsx command', () => {
      expect(planCmd.type).toBe('local-jsx')
    })

    it('should have a load function', () => {
      expect(typeof planCmd.load).toBe('function')
    })
  })

  describe('/act command', () => {
    it('should be defined', () => {
      expect(actCmd).toBeDefined()
    })

    it('should have name "act"', () => {
      expect(actCmd.name).toBe('act')
    })

    it('should have a description mentioning act mode', () => {
      expect(actCmd.description).toBeDefined()
      expect(actCmd.description.toLowerCase()).toContain('act')
    })

    it('should be a local-jsx command', () => {
      expect(actCmd.type).toBe('local-jsx')
    })

    it('should have a load function', () => {
      expect(typeof actCmd.load).toBe('function')
    })
  })

  describe('command registration', () => {
    it('should register the plan command in the commands module', () => {
      const allCommands = commandsModule.default || commandsModule
      expect(allCommands.plan).toBeDefined()
      expect(allCommands.plan.name).toBe('plan')
    })

    it('should register the act command in the commands module', () => {
      const allCommands = commandsModule.default || commandsModule
      expect(allCommands.act).toBeDefined()
      expect(allCommands.act.name).toBe('act')
    })
  })

  describe('Plan/Act symmetry', () => {
    it('should have both plan and act commands available', () => {
      const allCommands = commandsModule.default || commandsModule
      expect(allCommands.plan).toBeDefined()
      expect(allCommands.act).toBeDefined()
    })

    it('should have distinct command names', () => {
      expect(planCmd.name).not.toBe(actCmd.name)
    })

    it('should have distinct descriptions', () => {
      expect(planCmd.description).not.toBe(actCmd.description)
    })
  })
})
