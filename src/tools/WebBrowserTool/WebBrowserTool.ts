import { buildTool } from '../../Tool.js'
import { z } from 'zod/v4'
import { lazySchema } from '../../utils/lazySchema.js'
import { openBrowser, validateUrl } from '../../utils/browser.js'

/**
 * Browser automation tool (issue #695).
 *
 * Wraps the platform browser opener (src/utils/browser.ts) behind a typed
 * tool so the agent can open http(s) URLs in the user's default browser.
 * validateUrl rejects non-http(s) protocols (e.g. file://, javascript://)
 * before anything is launched.
 */

const inputSchema = lazySchema(() =>
  z.strictObject({
    url: z
      .string()
      .min(1)
      .describe('The http(s) URL to open in the default browser'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    opened: z.boolean().describe('Whether the browser was launched'),
    url: z.string().describe('The URL that was opened'),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

export const WebBrowserTool = buildTool({
  name: 'web_browser_open',
  searchHint: 'open a URL in the default browser',
  maxResultSizeChars: 4_000,
  shouldDefer: true,
  async description(input) {
    return `Claude wants to open: ${input.url}`
  },
  userFacingName() {
    return 'Web Browser'
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  async call({ input }) {
    // validateUrl throws on non-http(s) protocols; openBrowser returns false
    // if the platform opener failed (e.g. headless env).
    validateUrl(input.url)
    const opened = await openBrowser(input.url)
    return { opened, url: input.url }
  },
})
