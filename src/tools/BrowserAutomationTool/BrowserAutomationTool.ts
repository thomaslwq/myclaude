import { buildTool } from '../../Tool.js'
import { z } from 'zod/v4'
import { lazySchema } from '../../utils/lazySchema.js'
import { execFileNoThrow } from '../../utils/execFileNoThrow.js'

/**
 * Browser automation tool for testing web applications.
 *
 * Provides Playwright-based browser control allowing agents to:
 * - Navigate to URLs
 * - Click elements
 * - Fill forms
 * - Take screenshots
 * - Extract text content
 *
 * This tool enables myclaude to interact with web UIs for testing
 * and automation tasks, similar to OpenHands capabilities.
 */

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z
      .enum([
        'navigate',
        'click',
        'fill',
        'screenshot',
        'text',
        'evaluate',
      ])
      .describe('The action to perform'),
    url: z
      .string()
      .url()
      .optional()
      .describe('The URL to navigate to (required for navigate action)'),
    selector: z
      .string()
      .optional()
      .describe('CSS selector for the element to interact with'),
    value: z
      .string()
      .optional()
      .describe('Value to fill into the element'),
    waitUntil: z
      .enum(['load', 'domcontentloaded', 'networkidle'])
      .optional()
      .default('load')
      .describe('Wait condition for navigation'),
    timeout: z
      .number()
      .optional()
      .default(30000)
      .describe('Timeout in milliseconds'),
  }),
)

type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    success: z.boolean().describe('Whether the action succeeded'),
    message: z.string().describe('Result message'),
    data: z.any().optional().describe('Additional result data'),
  }),
)

type OutputSchema = ReturnType<typeof outputSchema>

export const BrowserAutomationTool = buildTool({
  name: 'browser_automation',
  searchHint: 'interact with web pages using Playwright',
  maxResultSizeChars: 10_000,
  shouldDefer: true,
  async description(input) {
    const actions = {
      navigate: 'navigate to a URL',
      click: 'click on an element',
      fill: 'fill in a form field',
      screenshot: 'take a screenshot of the page',
      text: 'extract text from the page',
      evaluate: 'execute JavaScript on the page',
    }
    return `Perform browser automation action: ${actions[input.action] || input.action}`
  },
  userFacingName() {
    return 'Browser Automation'
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
    return false
  },
  async call({ input }) {
    try {
      // Check if Playwright is available
      const playwright = await import('playwright')

      // Initialize browser context
      const context = await playwright.chromium.launchPersistentContext(
        process.env.BROWSER_AUTOMATION_USER_DATA_DIR || '/tmp/myclaude-browser',
        {
          headless: process.env.BROWSER_AUTOMATION_HEADLESS !== 'false',
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      )

      const page = await context.newPage()

      switch (input.action) {
        case 'navigate': {
          if (!input.url) {
            return {
              success: false,
              message: 'URL is required for navigate action',
            }
          }

          await page.goto(input.url, {
            waitUntil: input.waitUntil,
            timeout: input.timeout,
          })

          const title = await page.title()
          const url = page.url()

          return {
            success: true,
            message: `Navigated to ${url}`,
            data: { title, url },
          }
        }

        case 'click': {
          if (!input.selector) {
            return {
              success: false,
              message: 'Selector is required for click action',
            }
          }

          await page.waitForSelector(input.selector, {
            timeout: input.timeout,
          })
          await page.click(input.selector)

          return {
            success: true,
            message: `Clicked element: ${input.selector}`,
          }
        }

        case 'fill': {
          if (!input.selector || !input.value) {
            return {
              success: false,
              message: 'Selector and value are required for fill action',
            }
          }

          await page.waitForSelector(input.selector, {
            timeout: input.timeout,
          })
          await page.fill(input.selector, input.value)

          return {
            success: true,
            message: `Filled element: ${input.selector} with value`,
          }
        }

        case 'screenshot': {
          const screenshot = await page.screenshot({
            type: 'png',
            fullPage: true,
          })

          // Convert to base64 for output
          const base64 = screenshot.toString('base64')

          return {
            success: true,
            message: 'Screenshot captured',
            data: {
              format: 'png',
              size: base64.length,
              base64: base64,
            },
          }
        }

        case 'text': {
          const text = await page.textContent('body')

          return {
            success: true,
            message: 'Text extracted from page',
            data: {
              text: text || '',
              length: text?.length || 0,
            },
          }
        }

        case 'evaluate': {
          if (!input.value) {
            return {
              success: false,
              message: 'JavaScript code is required for evaluate action',
            }
          }

          const result = await page.evaluate(input.value)

          return {
            success: true,
            message: 'JavaScript executed successfully',
            data: result,
          }
        }

        default: {
          return {
            success: false,
            message: `Unknown action: ${input.action}`,
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        message: `Browser automation failed: ${errorMessage}`,
      }
    }
  },
})
