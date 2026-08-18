import { describe, it, expect } from 'bun:test'
import {
  WORKER_AGENT,
  getCoordinatorAgents,
  REFACTOR_AGENT,
  TEST_AGENT,
} from '../coordinator/workerAgent'

describe('workerAgent', () => {
  it('exports WORKER_AGENT constant', () => {
    expect(WORKER_AGENT).toBe('worker')
  })

  it('exports getCoordinatorAgents function', () => {
    expect(typeof getCoordinatorAgents).toBe('function')
  })

  it('getCoordinatorAgents returns an array of agent definitions', () => {
    const agents = getCoordinatorAgents()
    expect(Array.isArray(agents)).toBe(true)
    expect(agents.length).toBeGreaterThan(0)
  })

  it('includes a general-purpose worker agent', () => {
    const agents = getCoordinatorAgents()
    const worker = agents.find(a => a.agentType === WORKER_AGENT)
    expect(worker).toBeDefined()
    expect(worker!.source).toBe('built-in')
    expect(worker!.baseDir).toBe('built-in')
    expect(typeof worker!.getSystemPrompt).toBe('function')
  })

  it('includes a specialized refactor agent', () => {
    const agents = getCoordinatorAgents()
    const refactorAgent = agents.find(a => a.agentType === REFACTOR_AGENT)
    expect(refactorAgent).toBeDefined()
    expect(refactorAgent!.source).toBe('built-in')
    expect(refactorAgent!.baseDir).toBe('built-in')
    expect(typeof refactorAgent!.getSystemPrompt).toBe('function')
  })

  it('includes a specialized test agent', () => {
    const agents = getCoordinatorAgents()
    const testAgent = agents.find(a => a.agentType === TEST_AGENT)
    expect(testAgent).toBeDefined()
    expect(testAgent!.source).toBe('built-in')
    expect(testAgent!.baseDir).toBe('built-in')
    expect(typeof testAgent!.getSystemPrompt).toBe('function')
  })

  it('all agents have valid whenToUse descriptions', () => {
    const agents = getCoordinatorAgents()
    for (const agent of agents) {
      expect(typeof agent.whenToUse).toBe('string')
      expect(agent.whenToUse.length).toBeGreaterThan(0)
    }
  })

  it('all agents have tools array', () => {
    const agents = getCoordinatorAgents()
    for (const agent of agents) {
      expect(Array.isArray(agent.tools)).toBe(true)
    }
  })

  it('getSystemPrompt returns non-empty string for each agent', () => {
    const agents = getCoordinatorAgents()
    for (const agent of agents) {
      const prompt = agent.getSystemPrompt({
        options: {},
      } as any)
      expect(typeof prompt).toBe('string')
      expect(prompt.length).toBeGreaterThan(0)
    }
  })
})
