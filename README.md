# myclaude

> An open-source AI coding assistant in your terminal — powered by Claude, fork of Claude Code

<p align="center">
  <img src="preview.png?raw=true" alt="myclaude CLI" width="700">
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#usage">Usage</a> •
  <a href="#environment-variables">Environment Variables</a> •
  <a href="#building">Building</a> •
  <a href="#license">License</a>
</p>

<p align="center">
  <a href="README.zh-CN.md">中文文档</a>
</p>

---

**myclaude** is an open-source AI coding assistant that lives in your terminal. Based on the restored TypeScript source code of Claude Code (Anthropic's official CLI tool), myclaude brings advanced AI-powered coding workflows to your command line.

> **Note:** This is an independent open-source project based on publicly available source maps from the `@anthropic-ai/claude-code` npm package. The original code is copyright © Anthropic. See the [License](#license) section for details.

---

## Features

- **AI-Powered Terminal** — Natural language coding: write, refactor, debug, and explain code
- **Slash Commands** — 80+ built-in commands: `/commit`, `/review`, `/test`, `/doc`, and more
- **File Operations** — Edit, write, and create files with AI guidance
- **Git Integration** — Automatic commit messages, PR creation, branch management
- **MCP Support** — Model Context Protocol for extensible tool integrations
- **Plugin System** — Extend with community plugins and custom tools
- **Agent Mode** — Multi-step autonomous task execution
- **Terminal UI** — Beautiful React Ink-based TUI with syntax highlighting

---

## Quick Start

### Install via npm (once published)

```bash
npm install -g myclaude
myclaude
```

### Or run from source

```bash
# Prerequisites: Bun >= 1.3.5, Node.js >= 18
git clone https://gitee.com/thomaslwq/myclaude.git
cd myclaude
bun install
bun run dev
```

### Set your API key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# Or use the myclaude alias:
export MYCLAUDE_API_KEY=sk-ant-...
myclaude
```

---

## Usage

```bash
# Start interactive REPL
myclaude

# Run with a prompt (non-interactive)
myclaude -p "Explain this project's architecture"

# Show version
myclaude --version

# Show help
myclaude --help
```

### Slash Commands

| Command | Description |
|---------|-------------|
| `/commit` | Generate a git commit message |
| `/review` | Review code changes |
| `/test` | Generate and run tests |
| `/doc` | Generate documentation |
| `/config` | Configure myclaude settings |
| `/doctor` | Diagnose and verify installation |
| `/plugin` | Manage plugins and marketplaces |
| `/model` | Change the AI model |
| `/clear` | Clear conversation history |
| `/cost` | Show usage statistics |
| `/compact` | Compact conversation |

---

## Environment Variables

myclaude supports both `MYCLAUDE_*` and `CLAUDE_CODE_*` naming conventions.
If both are set, `CLAUDE_CODE_*` takes priority.

<details>
<summary>Click to expand full environment variable list</summary>

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` / `MYCLAUDE_API_KEY` | Anthropic API key |
| `ANTHROPIC_BASE_URL` / `MYCLAUDE_BASE_URL` | Custom API base URL |
| `MYCLAUDE_MODEL` / `CLAUDE_CODE_MODEL` | Model override |
| `MYCLAUDE_MAX_OUTPUT_TOKENS` / `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Max output tokens |
| `MYCLAUDE_DISABLE_THINKING` / `CLAUDE_CODE_DISABLE_THINKING` | Disable thinking |
| `MYCLAUDE_SIMPLE` / `CLAUDE_CODE_SIMPLE` | Simple mode (no TUI) |
| `MYCLAUDE_BRIEF` / `CLAUDE_CODE_BRIEF` | Brief mode (shorter output) |
| `MYCLAUDE_PROACTIVE` / `CLAUDE_CODE_PROACTIVE` | Proactive mode |
| `MYCLAUDE_USE_BEDROCK` / `CLAUDE_CODE_USE_BEDROCK` | Use AWS Bedrock |
| `MYCLAUDE_USE_VERTEX` / `CLAUDE_CODE_USE_VERTEX` | Use Google Vertex AI |
| `MYCLAUDE_USE_FOUNDRY` / `CLAUDE_CODE_USE_FOUNDRY` | Use Microsoft Foundry |
| `MYCLAUDE_DISABLE_AUTO_MEMORY` / `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | Disable auto memory |
| `MYCLAUDE_SYNTAX_HIGHLIGHT` / `CLAUDE_CODE_SYNTAX_HIGHLIGHT` | Syntax highlight theme |
| `MYCLAUDE_IDLE_THRESHOLD_MINUTES` / `CLAUDE_CODE_IDLE_THRESHOLD_MINUTES` | Idle timeout |
| `MYCLAUDE_EFFORT_LEVEL` / `CLAUDE_CODE_EFFORT_LEVEL` | Effort level |

</details>

---

## Building

```bash
bun run build    # Build to dist/myclaude.js
bun run dev      # Development mode
bun run version  # Verify version
```

The build bundles 3796+ modules into a single Bun-compatible executable.

---

## Project Structure

```
myclaude/
├── src/                    # Core TypeScript source (~1987 files)
│   ├── entrypoints/        # CLI entry points
│   ├── commands/           # 80+ slash commands
│   ├── services/           # API, MCP, analytics
│   ├── components/         # React Ink UI components
│   ├── tools/              # Tool implementations
│   ├── hooks/              # Custom React hooks
│   ├── buddy/              # AI pet companion system
│   ├── assistant/          # KAIROS assistant mode
│   ├── coordinator/        # Multi-agent coordinator
│   ├── bridge/             # Remote control bridge
│   ├── proactive/          # Proactive mode
│   └── vim/                # Vim mode engine
├── shims/                  # Native module shims
├── vendor/                 # Native bindings source
├── scripts/                # Build and utility scripts
│   └── build.ts            # Bun build script
└── dist/                   # Build output
    └── myclaude.js         # Bundled executable
```

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT License. See [LICENSE](LICENSE) for details.

This project is based on publicly available source code from the `@anthropic-ai/claude-code` npm package, reconstructed from source maps. The original code is copyright © Anthropic. This project is not affiliated with or endorsed by Anthropic.
