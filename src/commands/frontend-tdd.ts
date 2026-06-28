import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { Command } from '../commands.js'

function getPrompt(args: string): string {
  const featureDesc = args.trim() || '(no description provided)'

  return `You are practicing **Frontend TDD (Test-Driven Development)**.

## User's Request

${featureDesc}

## TDD Workflow

Follow the **Red-Green-Refactor** cycle strictly:

### 🔴 Red — Write the Failing Test First
1. Understand the requirement and identify the expected behavior
2. Write a test that captures the requirement — this test MUST fail initially
3. The test should cover:
   - Normal expected behavior (happy path)
   - Edge cases (empty state, error state, boundary values)
   - User interactions (click, input, submit, navigation)
   - Accessibility (ARIA labels, keyboard navigation, focus management)
4. Use the project's existing test framework and conventions (Vitest, Jest, Playwright, Testing Library, etc.)
5. Verify the test fails before proceeding

### 🟢 Green — Minimum Code to Pass
1. Write ONLY the code needed to make the failing test pass
2. No speculative features, no future-proofing, no "while I'm here" additions
3. If the test passes, you're done with this cycle

### 🔵 Refactor — Clean Up Safely
1. Once the test is green, refactor for clarity and maintainability
2. The test MUST stay green after every refactor step
3. If the test turns red during refactor, the refactor broke something — revert

## Frontend Testing Guidelines

- **Component tests**: Use Testing Library — test behavior, not implementation details
- **User interactions**: Use \`@testing-library/user-event\` over \`fireEvent\`
- **Accessibility**: Prefer queries by role (\`getByRole\`) over test IDs
- **Async**: Use \`waitFor\` or \`findBy*\` queries for async operations
- **Mocking**: Mock external APIs at the network level (MSW) or module level (vi.mock)
- **Style**: Test visual outcomes (is the element visible/disabled?), not CSS class names
- **Snapshots**: Use sparingly — prefer assertion-based tests

## Project Context

- Check \`package.json\` for test framework and scripts
- Check existing test files in \`__tests__/\`, \`*.test.tsx\`, \`*.spec.tsx\` for conventions
- Run \`!package.json test\` script to verify tests pass before starting

## Important Rules

- NEVER skip the Red phase — a passing test without implementation is a buggy test
- NEVER modify a test to make it pass — fix the implementation instead
- Run the test suite after each cycle to ensure nothing is broken
- If multiple test files exist, run only the relevant test file during development`
}

const frontendTdd: Command = {
  type: 'prompt',
  name: 'frontend-tdd',
  description: 'TDD (Test-Driven Development) for frontend features — Red, Green, Refactor',
  argumentHint: '<feature description>',
  progressMessage: 'running frontend TDD cycle',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    return [{ type: 'text', text: getPrompt(args) }]
  },
}

export default frontendTdd
