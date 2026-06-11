# myclaude

An open-source AI coding assistant in your terminal — powered by Claude.

```bash
npm install -g @thomaslwq/myclaude
myclaude
```

---

## Features

- **Natural Language Coding** — Write, refactor, debug, and explain code by chatting with AI
- **Slash Commands** — 80+ built-in commands: `/commit`, `/review`, `/test`, `/doc`, and more
- **Git Integration** — Automatic commit messages, PR creation, branch management
- **MCP Support** — Extensible tool integrations via Model Context Protocol
- **Plugin System** — Extend with community plugins
- **Terminal UI** — Beautiful React Ink-based interface with syntax highlighting

---

## Quick Start

### 1. Install

```bash
npm install -g @thomaslwq/myclaude
```

### 2. Set your API key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# Or use the myclaude alias:
export MYCLAUDE_API_KEY=sk-ant-...
```

### 3. Run

```bash
myclaude
```

---

## Usage

```bash
myclaude                      # Start interactive REPL
myclaude -p "explain this project"  # Run with a prompt
myclaude --version            # Show version
myclaude --help               # Show help
```

### Common Commands

| Command | Description |
|---------|-------------|
| `/commit` | Generate a git commit message |
| `/review` | Review code changes |
| `/test` | Generate and run tests |
| `/doc` | Generate documentation |
| `/config` | Configure settings |
| `/doctor` | Diagnose installation |
| `/model` | Change AI model |
| `/clear` | Clear conversation |
| `/cost` | Show usage statistics |

---

## Environment Variables

You can use either `MYCLAUDE_*` or `CLAUDE_CODE_*` names.  
`CLAUDE_CODE_*` takes priority if both are set.

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` / `MYCLAUDE_API_KEY` | API key (required) |
| `ANTHROPIC_BASE_URL` / `MYCLAUDE_BASE_URL` | Custom API base URL |
| `MYCLAUDE_MODEL` | Model override |
| `MYCLAUDE_SIMPLE` | Simple mode (no TUI) |
| `MYCLAUDE_BRIEF` | Brief mode (shorter output) |
| `MYCLAUDE_DISABLE_THINKING` | Disable thinking |
| `MYCLAUDE_PROACTIVE` | Proactive mode |
| `MYCLAUDE_USE_BEDROCK` | Use AWS Bedrock |
| `MYCLAUDE_USE_VERTEX` | Use Google Vertex AI |
| `MYCLAUDE_USE_FOUNDRY` | Use Microsoft Foundry |
| `MYCLAUDE_DISABLE_AUTO_MEMORY` | Disable auto memory |
| `MYCLAUDE_SYNTAX_HIGHLIGHT` | Syntax highlight theme |
| `MYCLAUDE_IDLE_THRESHOLD_MINUTES` | Idle timeout (default: 75) |
| `MYCLAUDE_EFFORT_LEVEL` | Effort level |

---

## License

MIT
