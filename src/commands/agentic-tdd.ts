import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { Command } from '../commands.js'

function getPrompt(args: string): string {
  const featureDesc = args.trim() || '(no description provided)'

  return `You are practicing **Agentic TDD (Test-Driven Development) with automated test-fix-rerun loop**.

## User's Request

${featureDesc}

## Agentic TDD Workflow

You are in full autonomous mode. Follow the **Red-Green-Refactor** cycle strictly, and execute tests automatically after each change.

### Phase 1: Baseline
1. First, run the existing test suite to establish a baseline: \`bun test\`
2. Note which tests pass and fail before you start

### Phase 2: 🔴 Red — Write the Failing Test First
1. Understand the requirement and identify the expected behavior
2. Write a test that captures the requirement — this test MUST fail initially
3. The test should cover:
   - Normal expected behavior (happy path)
   - Edge cases (empty state, error state, boundary values)
   - User interactions (click, input, submit, navigation)
   - Accessibility (ARIA labels, keyboard navigation, focus management)
4. Use the project's existing test framework and conventions (Bun test, Vitest, Jest, etc.)
5. Run the test to verify it fails: \`bun test\`
6. If the test passes unexpectedly, it's a buggy test — fix the test

### Phase 3: 🟢 Green — Minimum Code to Pass
1. Write ONLY the code needed to make the failing test pass
2. No speculative features, no future-proofing, no "while I'm here" additions
3. After writing code, run the tests: \`bun test\`
4. If tests fail, analyze the error output and iterate:
   - Read the error message and stack trace
   - Identify what's broken
   - Fix the implementation
   - Re-run tests
   - Repeat until all tests pass (up to 5 iterations)

### Phase 4: 🔵 Refactor — Clean Up Safely
1. Once the test is green, refactor for clarity and maintainability
2. Run tests after each refactor step: \`bun test\`
3. The test MUST stay green after every refactor step
4. If the test turns red during refactor, the refactor broke something — revert

### Phase 5: Final Verification
1. Run the full test suite one final time: \`bun test\`
2. Report the results to the user

## Automated Test-Fix-Rerun Loop Rules

- After EVERY code change, run \`bun test\` immediately
- If tests fail, parse the error output and fix the code
- Do NOT modify tests to make them pass — fix the implementation instead
- Maximum 5 fix iterations per Red or Green phase
- If after 5 iterations the tests still fail, report the failure to the user with the error details

## Testing Guidelines

- **Component tests**: Test behavior, not implementation details
- **User interactions**: Use \`@testing-library/user-event\` over \`fireEvent\`
- **Accessibility**: Prefer queries by role (\`getByRole\`) over test IDs
- **Async**: Use \`waitFor\` or \`findBy*\` queries for async operations
- **Mocking**: Mock external APIs at the network level (MSW) or module level (vi.mock)
- **Style**: Test visual outcomes (is the element visible/disabled?), not CSS class names
- **Snapshots**: Use sparingly — prefer assertion-based tests

## Project Context

- Test framework: Bun test (\`bun test\`)
- Check \`package.json\` for test framework and scripts
- Check existing test files in \`__tests__/\`, \`*.test.tsx\`, \`*.spec.tsx\` for conventions

## Important Rules

- NEVER skip the Red phase — a passing test without implementation is a buggy test
- NEVER modify a test to make it pass — fix the implementation instead
- Run the test suite after each change to ensure nothing is broken
- If multiple test files exist, run only the relevant test file during development for speed, but run the full suite for final verification
- Report each phase completion to the user`
}

const agenticTdd: Command = {
  type: 'prompt',
  name: 'agentic-tdd',
  description: 'Agentic TDD with automated test-fix-rerun loop — write tests, run, fix, repeat autonomously',
  argumentHint: '<feature description or bug fix description>',
  progressMessage: 'running agentic TDD loop',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    return [{ type: 'text', text: getPrompt(args) }]
  },
}

export default agenticTdd
