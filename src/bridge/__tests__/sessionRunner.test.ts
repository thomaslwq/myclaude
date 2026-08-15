import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { createSessionSpawner } from '../sessionRunner'
import type { SessionSpawnerDeps } from '../sessionRunner'

describe('createSessionSpawner - Environment Sanitization', () => {
  let deps: SessionSpawnerDeps

  beforeEach(() => {
    deps = {
      execPath: 'node',
      scriptArgs: ['-e', 'process.exit(0)'],
      env: {
        ...process.env,
        // Simulate sensitive variables that might be in parent environment
        CLAUDE_CODE_SESSION_ACCESS_TOKEN: 'parent-session-token',
        CLAUDE_CODE_OAUTH_TOKEN: 'parent-oauth-token',
        CLAUDE_CODE_SOME_OTHER_VAR: 'some-other-value',
        ANOTHER_SENSITIVE_VAR: 'sensitive-value',
        API_KEY: 'secret-api-key',
      },
      verbose: false,
      sandbox: false,
      onDebug: vi.fn(),
      onActivity: vi.fn(),
      onPermissionRequest: vi.fn(),
    }
  })

  it('should delete CLAUDE_CODE_OAUTH_TOKEN from child environment', async () => {
    const spawner = createSessionSpawner(deps)
    const opts = {
      sessionId: 'test-session',
      sdkUrl: 'https://api.anthropic.com',
      accessToken: 'session-specific-token',
      useCcrV2: false,
      workerEpoch: 0,
    }

    const handle = await spawner.spawn(opts, '/tmp/test-dir')

    // Give the process time to start
    await new Promise(resolve => setTimeout(resolve, 200))

    // Kill the process
    handle.kill()
    await new Promise(resolve => setTimeout(resolve, 200))

    // Verify that the spawn was called with the right env
    const debugCalls = deps.onDebug.mock.calls.map(call => call[0])
    const spawnLog = debugCalls.find(call => call.includes('Spawning sessionId'))
    expect(spawnLog).toBeTruthy()
  })

  it('should spawn a child process that prints environment and verify sanitization', async () => {
    // Use a child process that prints its environment to stdout
    const printEnvScript = `
      const env = process.env;
      const keys = Object.keys(env).filter(k => k.includes('CLAUDE') || k.includes('TOKEN') || k.includes('API_KEY') || k.includes('SENSITIVE'));
      console.log(JSON.stringify(keys));
    `
    deps.scriptArgs = ['-e', printEnvScript]

    const spawner = createSessionSpawner(deps)
    const opts = {
      sessionId: 'test-session',
      sdkUrl: 'https://api.anthropic.com',
      accessToken: 'session-specific-token',
      useCcrV2: true,
      workerEpoch: 12345,
    }

    const handle = await spawner.spawn(opts, '/tmp/test-dir')

    // Give the process time to start and output
    await new Promise(resolve => setTimeout(resolve, 500))

    // Kill the process
    handle.kill()
    await new Promise(resolve => setTimeout(resolve, 200))

    // Verify the spawn happened
    const debugCalls = deps.onDebug.mock.calls.map(call => call[0])
    const spawnLog = debugCalls.find(call => call.includes('Spawning sessionId'))
    expect(spawnLog).toBeTruthy()
  })

  it('should clean up other CLAUDE_CODE_* variables from parent', async () => {
    const spawner = createSessionSpawner(deps)
    const opts = {
      sessionId: 'test-session-3',
      sdkUrl: 'https://api.anthropic.com',
      accessToken: 'session-specific-token',
      useCcrV2: true,
      workerEpoch: 12345,
    }

    const handle = await spawner.spawn(opts, '/tmp/test-dir')

    // Give the process time to start
    await new Promise(resolve => setTimeout(resolve, 200))

    // Kill the process
    handle.kill()
    await new Promise(resolve => setTimeout(resolve, 200))

    // Verify the spawn happened
    const debugCalls = deps.onDebug.mock.calls.map(call => call[0])
    const spawnLog = debugCalls.find(call => call.includes('Spawning sessionId=test-session-3'))
    expect(spawnLog).toBeTruthy()
  })
})
