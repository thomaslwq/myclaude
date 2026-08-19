import { describe, it, expect } from 'bun:test'
import {
  WORKER_AGENT,
  REFACTOR_AGENT,
  TEST_AGENT,
  RESEARCH_AGENT,
  getCoordinatorAgents,
} from '../coordinator/workerAgent'
import type { BuiltInAgentDefinition } from '../tools/AgentTool/loadAgentsDir.js'

describe('sub-agent orchestration', () => {
  describe('getCoordinatorAgents', () => {
    it('returns an array of agent definitions', () => {
      const agents = getCoordinatorAgents()
      expect(Array.isArray(agents)).toBe(true)
      expect(agents.length).toBeGreaterThanOrEqual(4)
    })

    it('includes a research agent with read-only tool whitelist', () => {
      const agents = getCoordinatorAgents()
      const research = agents.find(a => a.agentType === RESEARCH_AGENT)
      expect(research).toBeDefined()
      expect(research!.source).toBe('built-in')
      expect(research!.baseDir).toBe('built-in')
      expect(typeof research!.getSystemPrompt).toBe('function')
      // Research agent must NOT have tools: ['*'] — it should be restricted
      expect(research!.tools).not.toEqual(['*'])
      expect(research!.tools).toBeDefined()
      expect(research!.tools!.length).toBeGreaterThan(0)
      // Research agent should have read-only tools, not write tools
      expect(research!.tools).not.toContain('Edit')
      expect(research!.tools).not.toContain('Write')
    })

    it('all agents have maxTurns budget control', () => {
      const agents = getCoordinatorAgents()
      for (const agent of agents) {
        expect(agent.maxTurns).toBeDefined()
        expect(typeof agent.maxTurns).toBe('number')
        expect(agent.maxTurns!).toBeGreaterThan(0)
      }
    })

    it('research agent has lower maxTurns than worker agent', () => {
      const agents = getCoordinatorAgents()
      const research = agents.find(a => a.agentType === RESEARCH_AGENT)
      const worker = agents.find(a => a.agentType === WORKER_AGENT)
      expect(research!.maxTurns!).toBeLessThanOrEqual(worker!.maxTurns!)
    })

    it('all agents have valid whenToUse descriptions', () => {
      const agents = getCoordinatorAgents()
      for (const agent of agents) {
        expect(typeof agent.whenToUse).toBe('string')
        expect(agent.whenToUse.length).toBeGreaterThan(0)
      }
    })

    it('research agent getSystemPrompt returns non-empty string', () => {
      const agents = getCoordinatorAgents()
      const research = agents.find(a => a.agentType === RESEARCH_AGENT)!
      const prompt = research.getSystemPrompt({
        options: {},
      } as any)
      expect(typeof prompt).toBe('string')
      expect(prompt.length).toBeGreaterThan(0)
    })

    it('research agent prompt mentions read-only or research context', () => {
      const agents = getCoordinatorAgents()
      const research = agents.find(a => a.agentType === RESEARCH_AGENT)!
      const prompt = research.getSystemPrompt({
        options: {},
      } as any)
      const lower = prompt.toLowerCase()
      expect(
        lower.includes('read-only') ||
          lower.includes('research') ||
          lower.includes('read only'),
      ).toBe(true)
    })
  })
})
