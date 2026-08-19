import { BASH_TOOL_NAME } from '../tools/BashTool/toolName.js'
import { FILE_READ_TOOL_NAME } from '../tools/FileReadTool/prompt.js'
import { GLOB_TOOL_NAME } from '../tools/GlobTool/prompt.js'
import { GREP_TOOL_NAME } from '../tools/GrepTool/prompt.js'
import { WEB_FETCH_TOOL_NAME } from '../tools/WebFetchTool/prompt.js'
import { WEB_SEARCH_TOOL_NAME } from '../tools/WebSearchTool/prompt.js'
import type { BuiltInAgentDefinition } from '../tools/AgentTool/loadAgentsDir.js'
import type { ToolUseContext } from '../Tool.js'

export const WORKER_AGENT = 'worker'
export const REFACTOR_AGENT = 'refactor'
export const TEST_AGENT = 'test'
export const RESEARCH_AGENT = 'research'

/**
 * Read-only tool whitelist for the research sub-agent.
 * Research agents can only read/search — they cannot modify files.
 */
const RESEARCH_AGENT_TOOLS = [
  FILE_READ_TOOL_NAME,
  GLOB_TOOL_NAME,
  GREP_TOOL_NAME,
  BASH_TOOL_NAME, // restricted to read-only ops via prompt
  WEB_SEARCH_TOOL_NAME,
  WEB_FETCH_TOOL_NAME,
]

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
 * Get the system prompt for the research agent.
 * Specialized for read-only research, exploration, and codebase investigation.
 * Has a restricted tool whitelist — no file editing capabilities.
 */
function getResearchSystemPrompt(): string {
  return `You are a research agent for Claude Code, specialized in read-only exploration and codebase investigation.

=== CRITICAL: READ-ONLY MODE - NO FILE MODIFICATIONS ===
This is a READ-ONLY research task. You are STRICTLY PROHIBITED from:
- Creating new files (no Write, touch, or file creation of any kind)
- Modifying existing files (no Edit operations)
- Deleting files (no rm or deletion)
- Moving or copying files (no mv or cp)
- Running ANY commands that change system state

Your role is EXCLUSIVELY to search, read, and analyze existing code. You do NOT have access to file editing tools — attempting to edit files will fail.

Your strengths:
- Rapidly finding files using glob patterns
- Searching code and text with powerful regex patterns
- Reading and analyzing file contents
- Investigating complex questions that require exploring many files
- Performing multi-step research tasks

Guidelines:
- Use ${GLOB_TOOL_NAME} for broad file pattern matching
- Use ${GREP_TOOL_NAME} for searching file contents with regex
- Use ${FILE_READ_TOOL_NAME} when you know the specific file path you need to read
- Use ${BASH_TOOL_NAME} ONLY for read-only operations (ls, git status, git log, git diff, find, grep, cat, head, tail)
- NEVER use ${BASH_TOOL_NAME} for: mkdir, touch, rm, cp, mv, git add, git commit, npm install, pip install, or any file creation/modification
- Be thorough: Check multiple locations, consider different naming conventions, look for related files
- Communicate your final report directly as a regular message — do NOT attempt to create files

When you complete your research, provide a concise report covering:
- Key findings and relevant file paths
- Architecture or patterns discovered
- Answers to the specific questions asked

The coordinator will relay this information to the user. Only the essentials are needed — the parent agent will synthesize and direct follow-up work.`
}

/**
 * Get the list of coordinator agents (Cascade system).
 * This provides multi-agent orchestration for complex tasks.
 *
 * Each agent has a maxTurns budget to prevent runaway execution.
 * The research agent has a restricted tool whitelist (read-only).
 */
export function getCoordinatorAgents(): BuiltInAgentDefinition[] {
  return [
    {
      agentType: WORKER_AGENT,
      whenToUse:
        'General-purpose worker for most tasks. Use this when you need a general-purpose agent to handle research, implementation, or verification tasks.',
      tools: ['*'],
      maxTurns: 200,
      source: 'built-in',
      baseDir: 'built-in',
      getSystemPrompt: getWorkerSystemPrompt,
    },
    {
      agentType: REFACTOR_AGENT,
      whenToUse:
        'Specialized refactor agent for code refactoring, architecture improvement, and technical debt reduction. Use this when you need to: Refactor monolithic code into microservices, Improve code quality and maintainability, Optimize performance, Restructure code for better testability, Reduce technical debt.',
      tools: ['*'],
      maxTurns: 150,
      source: 'built-in',
      baseDir: 'built-in',
      getSystemPrompt: getRefactorSystemPrompt,
    },
    {
      agentType: TEST_AGENT,
      whenToUse:
        'Specialized test agent for testing, verification, and quality assurance. Use this when you need to: Write comprehensive tests, Verify code changes, Run and debug tests, Analyze test coverage, Ensure code quality standards are met.',
      tools: ['*'],
      maxTurns: 100,
      source: 'built-in',
      baseDir: 'built-in',
      getSystemPrompt: getTestSystemPrompt,
    },
    {
      agentType: RESEARCH_AGENT,
      whenToUse:
        'Read-only research agent for codebase exploration, code search, and investigation. Use this when you need to: Research how a feature works, Find all usages of a function, Understand architecture, Investigate complex questions across many files. Returns only summaries — keeps parent context clean.',
      tools: RESEARCH_AGENT_TOOLS,
      maxTurns: 50,
      source: 'built-in',
      baseDir: 'built-in',
      getSystemPrompt: getResearchSystemPrompt,
    },
  ]
}
