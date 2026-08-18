import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { Command } from '../commands.js'

function getComposerPrompt(args: string): string {
  const featureDesc = args.trim() || '(no description provided)'

  return `You are in **Composer Mode** — a multi-file editing workflow inspired by Cursor's Composer.

## User's Request

${featureDesc}

## Your Task

You will implement this feature across multiple files in a single turn. Follow this workflow:

### 1. Analyze & Plan
- Understand the feature request and identify all files that need to be created or modified
- Create a plan listing every file that will be touched, with a brief description of changes for each
- Consider dependencies between files (imports, types, shared utilities)
- Identify test files that need to be created or updated

### 2. Execute Multi-File Edits
- Edit all necessary files to implement the feature
- Work through files in dependency order (shared types/utils first, then consumers)
- Ensure imports and exports are consistent across all files
- Keep changes focused — only modify what's needed for this feature

### 3. Verify
- Run the test suite to verify the implementation works
- Run the build to ensure no type or compile errors
- If tests fail, fix the issues and re-verify

## Multi-File Editing Guidelines

- **Coordinate changes**: When editing a shared type or utility, update all consumers in the same turn
- **Consistent naming**: Follow existing project conventions for file names, exports, and patterns
- **Minimal diffs**: Make surgical edits — avoid rewriting entire files when small changes suffice
- **Test coverage**: Add or update tests for all new functionality
- **Error handling**: Add appropriate error handling for new code paths

## Important Rules

- Edit all files needed to complete the feature in a single turn
- Do not ask for confirmation between file edits — proceed autonomously
- After all edits are complete, run tests and build to verify
- If verification fails, fix issues and re-run until green
- Report a summary of all files changed at the end`
}

const composer: Command = {
  type: 'prompt',
  name: 'composer',
  description: 'Composer mode — edit multiple files simultaneously to implement a feature across the codebase',
  argumentHint: '<feature description>',
  progressMessage: 'composer mode executing',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    return [{ type: 'text', text: getComposerPrompt(args) }]
  },
}

export default composer
