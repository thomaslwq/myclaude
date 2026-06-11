# Contributing to myclaude

## Getting Started

```bash
git clone https://gitee.com/thomaslwq/myclaude.git
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

## License

MIT - see [LICENSE](LICENSE)
