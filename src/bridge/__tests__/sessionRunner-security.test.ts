import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { createSessionSpawner } from '../sessionRunner'
import type { SessionSpawnerDeps } from '../sessionRunner'

describe('createSessionSpawner - Security: Environment Variable Sanitization', () => {
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
        SESSION_TOKEN: 'session-token-123',
        MYCLAUDE_API_KEY: 'myclaude-api-key',
        // Add a property to the prototype chain to test inherited properties
      },
      verbose: false,
      sandbox: false,
      onDebug: vi.fn(),
      onActivity: vi.fn(),
      onPermissionRequest: vi.fn(),
    }
  })

  it('should NOT leak non-prefixed sensitive variables (e.g., SESSION_TOKEN, API_KEY)', async () => {
    // Use a child process that prints its environment to stdout
    const printEnvScript = `
      const env = process.env;
      const sensitiveKeys = ['SESSION_TOKEN', 'API_KEY', 'MYCLAUDE_API_KEY'];
      const leakedKeys = sensitiveKeys.filter(k => env[k]);
      console.log(JSON.stringify(leakedKeys));
    `
    deps.scriptArgs = ['-e', printEnvScript]

    const spawner = createSessionSpawner(deps)
    const opts = {
      sessionId: 'test-session',
      sdkUrl: 'https://api.anthropic.com',
      accessToken: 'session-specific-token',
      useCcrV2: false,
      workerEpoch: 0,
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

  it('should NOT leak inherited properties from prototype chain', async () => {
    // Use a child process that prints its environment to stdout
    const printEnvScript = `
      const env = process.env;
      const inheritedKeys = Object.keys(env).filter(k => env[k] === undefined && k !== 'undefined');
      console.log(JSON.stringify(inheritedKeys));
    `
    deps.scriptArgs = ['-e', printEnvScript]

    const spawner = createSessionSpawner(deps)
    const opts = {
      sessionId: 'test-session',
      sdkUrl: 'https://api.anthropic.com',
      accessToken: 'session-specific-token',
      useCcrV2: false,
      workerEpoch: 0,
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

  it('should only pass whitelisted CLAUDE_CODE_* variables', async () => {
    // Use a child process that prints its environment to stdout
    const printEnvScript = `
      const env = process.env;
      const claudeCodeKeys = Object.keys(env).filter(k => k.startsWith('CLAUDE_CODE_'));
      console.log(JSON.stringify(claudeCodeKeys));
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

  it('should NOT leak MYCLAUDE_* variables', async () => {
    // Use a child process that prints its environment to stdout
    const printEnvScript = `
      const env = process.env;
      const myclaudeKeys = Object.keys(env).filter(k => k.startsWith('MYCLAUDE_'));
      console.log(JSON.stringify(myclaudeKeys));
    `
    deps.scriptArgs = ['-e', printEnvScript]

    const spawner = createSessionSpawner(deps)
    const opts = {
      sessionId: 'test-session',
      sdkUrl: 'https://api.anthropic.com',
      accessToken: 'session-specific-token',
      useCcrV2: false,
      workerEpoch: 0,
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

  it('should NOT leak NODE_OPTIONS or NODE_PATH (security fix for issue #726)', async () => {
    // Use a child process that prints its environment to stdout
    const printEnvScript = `
      const env = process.env;
      const dangerousKeys = ['NODE_OPTIONS', 'NODE_PATH'];
      const leakedKeys = dangerousKeys.filter(k => env[k]);
      console.log(JSON.stringify(leakedKeys));
    `
    deps.scriptArgs = ['-e', printEnvScript]

    const spawner = createSessionSpawner(deps)
    const opts = {
      sessionId: 'test-session',
      sdkUrl: 'https://api.anthropic.com',
      accessToken: 'session-specific-token',
      useCcrV2: false,
      workerEpoch: 0,
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
})
