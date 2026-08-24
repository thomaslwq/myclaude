import { describe, test, expect } from 'bun:test'
import { sanitizeCommand } from '../executor.js'
import { getAllFlows } from '../definitions.js'

/**
 * Regression tests for issue #924: DEFAULT_FLOWS contained `npm install`
 * commands, but npm was removed from the executor's ALLOWED_COMMANDS
 * allowlist (issues #886/#889/#890). Every flow step with a `command`
 * must pass sanitizeCommand — a built-in flow that can never execute is
 * a guaranteed runtime failure.
 */
describe('default flows are executable under the allowlist (issue #924)', () => {
  test('every DEFAULT_FLOWS step command passes sanitizeCommand', () => {
    const flows = getAllFlows()
    expect(flows.length).toBeGreaterThan(0)

    let commandSteps = 0
    for (const flow of flows) {
      for (const step of flow.steps) {
        if (!step.command) continue
        commandSteps += 1
        expect(
          () => sanitizeCommand(step.command),
          `flow "${flow.name}" step "${step.id}" command is rejected: ${step.command}`,
        ).not.toThrow()
      }
    }
    // Guard: the test must actually exercise at least one command step.
    expect(commandSteps).toBeGreaterThan(0)
  })

  test('no DEFAULT_FLOWS command uses a banned interpreter (npm/npx/node/bun/yarn/pnpm)', () => {
    const banned = ['npm', 'npx', 'node', 'bun', 'yarn', 'pnpm']
    const flows = getAllFlows()
    for (const flow of flows) {
      for (const step of flow.steps) {
        if (!step.command) continue
        const program = step.command.trim().split(/\s+/)[0]
        expect(banned, `flow "${flow.name}" uses banned program ${program}`).not.toContain(program)
      }
    }
  })
})
