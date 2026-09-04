import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test'

// Mock the IDE RPC call so we can observe which client is used
const callIdeRpcMock = mock(async (_tool: string, _params: unknown, client: unknown) => {
  callIdeRpcMock.lastClient = client
  return []
})
;(callIdeRpcMock as any).lastClient = undefined

mock.module('../services/mcp/client.js', () => ({
  callIdeRpc: (...args: unknown[]) => callIdeRpcMock(...args),
}))

import { DiagnosticTrackingService } from '../services/diagnosticTracking.js'

function makeClient(id: string) {
  return { type: 'connected', name: 'ide', id } as any
}

describe('DiagnosticTrackingService client freshness', () => {
  beforeEach(() => {
    callIdeRpcMock.mockClear()
    ;(callIdeRpcMock as any).lastClient = undefined
  })

  afterAll(() => {
    // Restore the real callIdeRpc module so other test files are unaffected
    mock.restore()
  })

  it('does not cache the connected mcpClient across query starts', async () => {
    const service = new DiagnosticTrackingService()
    const firstClient = makeClient('client-1')
    const secondClient = makeClient('client-2')

    // First query start: initialize with the first client
    await service.handleQueryStart([firstClient])

    // Simulate the IDE client being replaced/reconnected
    await service.handleQueryStart([secondClient])

    // A diagnostic fetch must use the fresh client, not the cached one
    await service.getNewDiagnostics()

    expect(callIdeRpcMock).toHaveBeenCalledTimes(1)
    expect((callIdeRpcMock as any).lastClient).toBe(secondClient)
    expect((callIdeRpcMock as any).lastClient).not.toBe(firstClient)
  })

  it('resolves the IDE client at call time, not at initialization time', async () => {
    const service = new DiagnosticTrackingService()
    const firstClient = makeClient('client-1')
    const secondClient = makeClient('client-2')

    // The service must not snapshot the client object; it should re-resolve
    // the connected client from the clients list on every call.
    const clients = [firstClient]
    await service.handleQueryStart(clients)

    // Client is swapped without another handleQueryStart call
    clients[0] = secondClient

    await service.beforeFileEdited('/tmp/some-file.ts')

    expect((callIdeRpcMock as any).lastClient).toBe(secondClient)
  })

  it('returns empty diagnostics when no IDE client is connected', async () => {
    const service = new DiagnosticTrackingService()
    await service.handleQueryStart([])

    const result = await service.getNewDiagnostics()

    expect(result).toEqual([])
    expect(callIdeRpcMock).not.toHaveBeenCalled()
  })

  it('does not call the IDE when never initialized', async () => {
    const service = new DiagnosticTrackingService()
    await service.getNewDiagnostics()
    await service.beforeFileEdited('/tmp/some-file.ts')
    await service.ensureFileOpened('file:///tmp/some-file.ts')

    expect(callIdeRpcMock).not.toHaveBeenCalled()
  })

  it('resets tracked state on subsequent query starts', async () => {
    const service = new DiagnosticTrackingService()
    const client = makeClient('client-1')

    await service.handleQueryStart([client])

    // Establish a baseline for a file
    callIdeRpcMock.mockImplementationOnce(async () => [
      { type: 'text', text: JSON.stringify([{ uri: 'file:///tmp/a.ts', diagnostics: [] }]) },
    ])
    await service.beforeFileEdited('/tmp/a.ts')

    // New query start should reset tracked state
    await service.handleQueryStart([client])

    // No baseline anymore -> no diagnostics reported
    callIdeRpcMock.mockImplementationOnce(async () => [
      { type: 'text', text: JSON.stringify([{ uri: 'file:///tmp/a.ts', diagnostics: [] }]) },
    ])
    const result = await service.getNewDiagnostics()
    expect(result).toEqual([])
  })

  it('clears state on shutdown and stops calling the IDE', async () => {
    const service = new DiagnosticTrackingService()
    const client = makeClient('client-1')

    await service.handleQueryStart([client])
    await service.shutdown()

    await service.getNewDiagnostics()
    expect(callIdeRpcMock).not.toHaveBeenCalled()
  })
})
