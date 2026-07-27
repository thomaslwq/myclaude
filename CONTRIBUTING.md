# Contributing to myclaude

## Getting Started

```bash
git clone https://github.com/thomaslwq/myclaude.git
cd myclaude
bun install
bun run dev
```

## Development

- `bun run dev` - Start the CLI in development mode
- `bun run version` - Verify the CLI boots
- `bun run build` - Build for distribution

## Architecture

myclaude is a TypeScript + React Ink terminal application. Key directories:

- `src/entrypoints/` - CLI entry points
- `src/commands/` - Slash commands (`/command`)
- `src/components/` - React Ink UI components
- `src/services/` - Backend services (API, MCP, analytics)
- `src/tools/` - Tool implementations
- `src/utils/` - Shared utilities

## Environment Variables

myclaude supports both `MYCLAUDE_*` and `CLAUDE_CODE_*` environment variables.
The `MYCLAUDE_*` variants are aliases that map to `CLAUDE_CODE_*` internally.

## Pull Requests

1. Use short, imperative commit subjects
2. Explain user-visible impact in PR description
3. Include validation steps

## Managing Technical Debt (TODO Comments)

To prevent accumulation of dead code and unresolved TODOs:

1. **Track TODOs**: All TODO comments should be tracked in [TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md) with a checkbox item.
2. **Convert to Issues**: Before adding a new TODO, consider filing a GitHub issue instead.
3. **Reference Issues**: When a TODO is associated with a specific issue, include the issue number: `// TODO(#1234): description`.
4. **Clean Up**: When resolving a TODO, remove the comment and mark the item in TECHNICAL_DEBT.md as complete.
5. **Review**: During code review, flag new TODOs that should be tracked or converted to issues.

## License

MIT - see [LICENSE](LICENSE)
