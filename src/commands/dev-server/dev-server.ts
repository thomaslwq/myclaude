import type { LocalCommandCall } from '../../types/command.js'
import { execFileNoThrow } from '../../utils/execFileNoThrow.js'

const DEFAULT_PORTS = [3000, 5173, 4321, 8080, 8000, 12718, 9000, 3001]

async function detectDevServerCommand(): Promise<string | null> {
  const { stdout } = await execFileNoThrow('cat', ['package.json'])
  if (!stdout) return null

  try {
    const pkg = JSON.parse(stdout)
    const scripts = pkg.scripts || {}

    // Priority order for dev server detection
    const devScriptKeys = [
      'dev',
      'dev:server',
      'devserver',
      'start:dev',
      'start',
      'preview',
      'serve',
    ]

    for (const key of devScriptKeys) {
      if (scripts[key]) {
        return scripts[key]
      }
    }
  } catch {
    // Not a valid package.json
  }

  return null
}

async function waitForPort(
  port: number,
  timeoutMs: number = 30000,
): Promise<boolean> {
  const startTime = Date.now()
  const checkInterval = 500

  while (Date.now() - startTime < timeoutMs) {
    try {
      const socket = await fetch(`http://localhost:${port}/`, {
        method: 'HEAD',
      }).catch(() => null)
      if (socket) return true
    } catch {
      // Port not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, checkInterval))
  }

  return false
}

async function detectPortFromScript(script: string): Promise<number | null> {
  const portMatch = script.match(/--port[= ]+(\d+)/)
  if (portMatch) return parseInt(portMatch[1], 10)

  const portMatch2 = script.match(/PORT[= ]*(\d+)/i)
  if (portMatch2) return parseInt(portMatch2[1], 10)

  // Try to detect from framework
  if (/vite/.test(script)) return 5173
  if (/next/.test(script)) return 3000
  if (/nuxt/.test(script)) return 3000
  if (/astro/.test(script)) return 4321
  if (/remix/.test(script)) return 3000
  if (/sveltekit/.test(script) || /kit/.test(script)) return 5173
  if (/docusaurus/.test(script)) return 3000
  if (/storybook/.test(script)) return 6006

  return null
}

export const call: LocalCommandCall = async (args, context) => {
  const arg = args.trim()

  // Handle stop command
  if (arg === 'stop' || arg === 'kill') {
    return {
      type: 'text',
      value:
        'Dev server stopped. (Note: myclaude does not track running dev servers. ' +
        'Use your terminal to stop the process.)',
    }
  }

  // Handle status command
  if (arg === 'status' || arg === 'status') {
    const detectedPort = await detectPortFromScript(
      (await detectDevServerCommand()) || '',
    )
    if (detectedPort) {
      const isRunning = await waitForPort(detectedPort, 2000)
      return {
        type: 'text',
        value: isRunning
          ? `Dev server appears to be running on http://localhost:${detectedPort}`
          : `No dev server detected on port ${detectedPort}. Run /dev-server to start one.`,
      }
    }
    return {
      type: 'text',
      value: 'Could not detect dev server status. Run /dev-server to start one.',
    }
  }

  // Detect and start dev server
  const devScript = await detectDevServerCommand()
  if (!devScript) {
    return {
      type: 'text',
      value:
        'Could not detect a dev server script in package.json.\n' +
        'Expected one of: dev, dev:server, devserver, start:dev, start, preview, serve\n' +
        'Please add a dev script to your package.json or run the dev server manually.',
    }
  }

  const detectedPort = await detectPortFromScript(devScript)
  const port = parseInt(arg, 10) || detectedPort || 3000

  const portUrl = `http://localhost:${port}`

  return {
    type: 'text',
    value:
      `Starting dev server...\n` +
      `Detected script: \`${devScript}\`\n` +
      `Expected port: ${port}\n\n` +
      `Run the following in your terminal:\n` +
      `\`\`\`bash\n` +
      `bun run dev\n` +
      `\`\`\`\n\n` +
      `Once the server is running, use the browser automation tool to navigate to:\n` +
      `\`${portUrl}\`\n\n` +
      `Or use the browser tool directly:\n` +
      `- browser_navigate(${portUrl}) - navigate to the page\n` +
      `- browser_screenshot() - capture a screenshot\n` +
      `- browser_audit() - run accessibility audit`,
  }
}
