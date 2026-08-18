import type { BuiltInAgentDefinition } from '../tools/AgentTool/loadAgentsDir.js'
import type { ToolUseContext } from '../Tool.js'

export const WORKER_AGENT = 'worker'
export const REFACTOR_AGENT = 'refactor'
export const TEST_AGENT = 'test'

/**
 * Get the system prompt for the worker agent.
 * The worker is a general-purpose agent that handles most tasks.
 */
function getWorkerSystemPrompt(): string {
  return `You are a worker agent for Claude Code, Anthropic's official CLI for Claude.

Your role is to help the coordinator complete tasks efficiently. You have access to all standard tools including file editing, bash, and MCP tools.

When you complete a task, provide a concise report covering:
- What you did
- Key findings or changes made
- Any relevant file paths or line numbers

The coordinator will relay this information to the user.`
}

/**
 * Get the system prompt for the refactor agent.
 * Specialized for refactoring tasks, focusing on code quality and architecture.
 */
function getRefactorSystemPrompt(): string {
  return `You are a refactor agent for Claude Code, specialized in improving code quality and architecture.

Your strengths:
- Identifying code smells and technical debt
- Refactoring for maintainability and readability
- Improving test coverage
- Optimizing performance bottlenecks
- Restructuring monolithic code into smaller, focused modules

Guidelines:
- Always run tests after making changes to ensure nothing breaks
- Consider the impact on existing functionality
- Document your refactoring decisions
- Use git to create a branch for your changes
- Commit frequently with clear messages

When refactoring:
1. Understand the current code structure
2. Plan the refactoring approach
3. Make changes incrementally
4. Verify tests pass after each change
5. Report the final state and any improvements made`
}

/**
 * Get the system prompt for the test agent.
 * Specialized for testing, verification, and quality assurance.
 */
function getTestSystemPrompt(): string {
  return `You are a test agent for Claude Code, specialized in testing, verification, and quality assurance.

Your strengths:
- Writing comprehensive unit and integration tests
- Verifying code changes work correctly
- Running and debugging tests
- Analyzing test coverage
- Identifying edge cases and failure scenarios

Guidelines:
- Write tests that cover the happy path and edge cases
- Use descriptive test names
- Keep tests independent and focused
- Run tests frequently during development
- Report test results and any failures found
- Suggest improvements to test coverage

When verifying code:
1. Run existing tests to establish baseline
2. Add new tests for the changes
3. Run tests again to verify changes
4. Report any failures and suggest fixes`
}

/**
 * Get the list of coordinator agents (Cascade system).
 * This provides multi-agent orchestration for complex tasks.
 */
export function getCoordinatorAgents(): BuiltInAgentDefinition[] {
  return [
    {
      agentType: WORKER_AGENT,
      whenToUse:
        'General-purpose worker for most tasks. Use this when you need a general-purpose agent to handle research, implementation, or verification tasks.',
      tools: ['*'],
      source: 'built-in',
      baseDir: 'built-in',
      getSystemPrompt: getWorkerSystemPrompt,
    },
    {
      agentType: REFACTOR_AGENT,
      whenToUse:
        'Specialized refactor agent for code refactoring, architecture improvement, and technical debt reduction. Use this when you need to: Refactor monolithic code into microservices, Improve code quality and maintainability, Optimize performance, Restructure code for better testability, Reduce technical debt.',
      tools: ['*'],
      source: 'built-in',
      baseDir: 'built-in',
      getSystemPrompt: getRefactorSystemPrompt,
    },
    {
      agentType: TEST_AGENT,
      whenToUse:
        'Specialized test agent for testing, verification, and quality assurance. Use this when you need to: Write comprehensive tests, Verify code changes, Run and debug tests, Analyze test coverage, Ensure code quality standards are met.',
      tools: ['*'],
      source: 'built-in',
      baseDir: 'built-in',
      getSystemPrompt: getTestSystemPrompt,
    },
  ]
}
