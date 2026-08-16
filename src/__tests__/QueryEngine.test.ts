import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { QueryEngine, type QueryEngineConfig } from '../QueryEngine'
import type { FileStateCache } from '../query'
import type { AppState } from '../state/AppState'

const mockGetSessionId = vi.fn(() => 'session-abc')

vi.mock('../bootstrap/state.js', () => ({
  getSessionId: () => mockGetSessionId(),
  isSessionPersistenceDisabled: () => false,
}))

function makeConfig(overrides: Partial<QueryEngineConfig> = {}): QueryEngineConfig {
  const emptyAppState = {} as AppState
  return {
    cwd: '/tmp/project',
    tools: [],
    commands: [],
    mcpClients: [],
    agents: [],
    canUseTool: () => true,
    getAppState: () => emptyAppState,
    setAppState: () => {},
    readFileCache: new Map() as unknown as FileStateCache,
    initialMessages: [
      { type: 'user', message: { role: 'user', content: 'hi' } } as never,
    ],
    ...overrides,
  }
}

describe('QueryEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('constructs with an empty conversation and exposes messages', () => {
    const engine = new QueryEngine(makeConfig())
    expect(engine.getMessages()).toHaveLength(1)
  })

  it('getSessionId delegates to session state', () => {
    const engine = new QueryEngine(makeConfig())
    expect(engine.getSessionId()).toBe('session-abc')
  })

  it('setModel updates the user-specified model', () => {
    const engine = new QueryEngine(makeConfig())
    engine.setModel('claude-sonnet-4-5')
    expect(engine.getMessages()).toHaveLength(1) // state intact
  })

  it('interrupt aborts the request', () => {
    const engine = new QueryEngine(makeConfig())
    expect(() => engine.interrupt()).not.toThrow()
  })

  it('getReadFileState returns the injected cache', () => {
    const cache = new Map() as unknown as FileStateCache
    const engine = new QueryEngine(makeConfig({ readFileCache: cache }))
    expect(engine.getReadFileState()).toBe(cache)
  })

  it('handles an empty initial conversation', () => {
    const engine = new QueryEngine(makeConfig({ initialMessages: undefined }))
    expect(engine.getMessages()).toHaveLength(0)
  })
})
