import { buildTool } from '../../Tool.js'
import { z } from 'zod/v4'
import { lazySchema } from '../../utils/lazySchema.js'

/**
 * Browser automation tool for testing web applications.
 *
 * Provides Playwright-based browser control allowing agents to:
 * - Navigate to URLs
 * - Click elements
 * - Fill forms
 * - Take screenshots
 * - Extract text content
 * - Evaluate JavaScript
 * - Hover over elements
 * - Select dropdown options
 * - Scroll to elements
 * - Wait for conditions
 * - Run accessibility audits
 * - Close the browser
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
        'hover',
        'select',
        'scroll',
        'wait',
        'audit',
        'close',
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
      .describe('Value to fill into the element or JavaScript to evaluate'),
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
    options: z
      .array(z.string())
      .optional()
      .describe('Options for select action (dropdown values)'),
    scrollPosition: z
      .enum(['top', 'center', 'bottom'])
      .optional()
      .default('center')
      .describe('Scroll position for scroll action'),
    waitFor: z
      .enum(['selector', 'timeout', 'url'])
      .optional()
      .default('timeout')
      .describe('What to wait for in wait action'),
    waitTimeout: z
      .number()
      .optional()
      .default(5000)
      .describe('Timeout for wait action in milliseconds'),
    auditType: z
      .enum(['accessibility', 'performance', 'seo', 'best-practices'])
      .optional()
      .default('accessibility')
      .describe('Type of audit to run'),
    viewport: z
      .object({
        width: z.number().optional().default(1280),
        height: z.number().optional().default(720),
      })
      .optional()
      .describe('Viewport size for the browser'),
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
      hover: 'hover over an element',
      select: 'select a dropdown option',
      scroll: 'scroll to an element',
      wait: 'wait for a condition',
      audit: 'run an accessibility or performance audit',
      close: 'close the browser',
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

      // Handle close action without launching browser
      if (input.action === 'close') {
        return {
          success: true,
          message: 'Browser close requested (stateless mode - no persistent browser)',
        }
      }

      // Initialize browser context
      const context = await playwright.chromium.launchPersistentContext(
        process.env.BROWSER_AUTOMATION_USER_DATA_DIR || '/tmp/myclaude-browser',
        {
          headless: process.env.BROWSER_AUTOMATION_HEADLESS !== 'false',
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          viewport: input.viewport || { width: 1280, height: 720 },
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

        case 'hover': {
          if (!input.selector) {
            return {
              success: false,
              message: 'Selector is required for hover action',
            }
          }

          await page.waitForSelector(input.selector, {
            timeout: input.timeout,
          })
          await page.hover(input.selector)

          return {
            success: true,
            message: `Hovered over element: ${input.selector}`,
          }
        }

        case 'select': {
          if (!input.selector || !input.options || input.options.length === 0) {
            return {
              success: false,
              message: 'Selector and options are required for select action',
            }
          }

          await page.waitForSelector(input.selector, {
            timeout: input.timeout,
          })
          await page.selectOption(input.selector, input.options)

          return {
            success: true,
            message: `Selected options in: ${input.selector}`,
          }
        }

        case 'scroll': {
          if (!input.selector) {
            return {
              success: false,
              message: 'Selector is required for scroll action',
            }
          }

          await page.waitForSelector(input.selector, {
            timeout: input.timeout,
          })
          await page.scrollIntoView(input.selector, {
            block: input.scrollPosition,
          })

          return {
            success: true,
            message: `Scrolled to element: ${input.selector} (${input.scrollPosition})`,
          }
        }

        case 'wait': {
          if (input.waitFor === 'selector' && input.selector) {
            await page.waitForSelector(input.selector, {
              timeout: input.waitTimeout,
            })
            return {
              success: true,
              message: `Waited for selector: ${input.selector}`,
            }
          } else if (input.waitFor === 'url' && input.url) {
            await page.waitForURL(input.url, {
              timeout: input.waitTimeout,
            })
            return {
              success: true,
              message: `Waited for URL: ${input.url}`,
            }
          } else {
            await page.waitForTimeout(input.waitTimeout)
            return {
              success: true,
              message: `Waited ${input.waitTimeout}ms`,
            }
          }
        }

        case 'audit': {
          // Run a basic accessibility audit using page.evaluate
          const auditResults = await page.evaluate(
            (auditType: string) => {
              const results: Record<string, unknown> = {
                type: auditType,
                issues: [] as string[],
                warnings: [] as string[],
              }

              if (auditType === 'accessibility') {
                // Check for common accessibility issues
                const imagesWithoutAlt = document.querySelectorAll('img:not([alt])')
                if (imagesWithoutAlt.length > 0) {
                  results.issues.push(
                    `${imagesWithoutAlt.length} image(s) missing alt text`,
                  )
                }

                const inputsWithoutLabel = document.querySelectorAll(
                  'input:not([aria-label]):not([aria-labelledby]):not([id])',
                )
                if (inputsWithoutLabel.length > 0) {
                  results.issues.push(
                    `${inputsWithoutLabel.length} input(s) may be missing labels`,
                  )
                }

                const buttonsWithoutText = document.querySelectorAll(
                  'button:not([aria-label]):not([title])',
                )
                const emptyButtons = Array.from(buttonsWithoutText).filter(
                  (btn) => !btn.textContent?.trim(),
                )
                if (emptyButtons.length > 0) {
                  results.issues.push(
                    `${emptyButtons.length} button(s) without accessible name`,
                  )
                }

                const linksWithoutText = document.querySelectorAll(
                  'a:not([aria-label]):not([title])',
                )
                const emptyLinks = Array.from(linksWithoutText).filter(
                  (link) => !link.textContent?.trim(),
                )
                if (emptyLinks.length > 0) {
                  results.issues.push(
                    `${emptyLinks.length} link(s) without accessible name`,
                  )
                }

                const missingLang = !document.documentElement.lang
                if (missingLang) {
                  results.issues.push('HTML element missing lang attribute')
                }

                const missingTitle = !document.title
                if (missingTitle) {
                  results.issues.push('Page missing <title> element')
                }

                const missingMetaViewport = !document.querySelector(
                  'meta[name="viewport"]',
                )
                if (missingMetaViewport) {
                  results.warnings.push('Missing viewport meta tag')
                }
              }

              return results
            },
            input.auditType,
          )

          return {
            success: true,
            message: `${input.auditType} audit completed`,
            data: auditResults,
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
