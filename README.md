# @funnycode/myclaude

**myclaude** — An open-source AI coding assistant that runs in your terminal.  
This project is a fork/rebrand of Claude Code, committed to providing an independent, open AI coding experience.

![myclaude](docs/funnycode.png)

```bash
npx @funnycode/myclaude
```

---

## Features

- **AI Chat** — Write, refactor, debug, and explain code via natural language
- **80+ Slash Commands** — `/commit`, `/review`, `/plan`, `/test`, `/doctor` and more
- **File Operations** — Edit, write, create, and search files with AI guidance
- **Git Integration** — Automatic commit messages, branch management, PR creation
- **MCP Support** — Model Context Protocol for extensible tool integrations
- **Plugin System** — Install and manage plugins from marketplaces
- **Agent Mode** — Multi-step autonomous task execution
- **Skills System** — Extend capabilities with reusable skills
- **Terminal UI** — React Ink interface with syntax highlighting, themes, and Vim mode
- **Multi-Model Support** — Anthropic, AWS Bedrock, Google Vertex AI, Microsoft Foundry

---

## Quick Start

### Prerequisites

- **Node.js >= 18** (works with Bun too)
- **Git** (for some features)
- **Anthropic API key** or compatible provider

### Install & Run

```bash
npx @funnycode/myclaude
```

Or install globally:

```bash
npm install -g @funnycode/myclaude
myclaude
```

### Set API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# Or use the myclaude alias:
export MYCLAUDE_API_KEY=sk-ant-...
```

---

## Usage

```bash
npx @funnycode/myclaude                        # Start interactive REPL
npx @funnycode/myclaude -p "explain this project"  # Run with a prompt
npx @funnycode/myclaude --version              # Show version
npx @funnycode/myclaude --help                 # Show help
```

---

## Slash Commands

### Core
| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/clear` | Clear conversation |
| `/exit` | Exit |
| `/resume` | Resume a previous session |
| `/rewind` | Rewind conversation |
| `/rename` | Rename current session |
| `/config` | Configure settings |
| `/doctor` | Diagnose and verify installation |

### Code & Git
| Command | Description |
|---------|-------------|
| `/commit` | Generate a git commit message |
| `/diff` | Show git diff |
| `/branch` | Switch/create branches |
| `/plan` | Create an implementation plan |
| `/review` | Review code |

### AI & Model
| Command | Description |
|---------|-------------|
| `/model` | Change AI model |
| `/effort` | Set effort level |
| `/fast` | Toggle fast mode |
| `/brief` | Toggle brief mode |
| `/output-style` | Set output style |

### Files & Context
| Command | Description |
|---------|-------------|
| `/add-dir` | Add directory to context |
| `/context` | Show current context |
| `/files` | File operations |
| `/copy` | Copy content |

### MCP & Plugins
| Command | Description |
|---------|-------------|
| `/mcp` | Manage MCP servers |
| `/plugin` | Manage plugins and marketplaces |
| `/reload-plugins` | Reload all plugins |
| `/hooks` | Manage hooks |

### System
| Command | Description |
|---------|-------------|
| `/status` | Show authentication and session status |
| `/stats` | Show usage statistics |
| `/cost` | Show cost information |
| `/color` | Set color theme |
| `/theme` | Set UI theme |
| `/keybindings` | Configure keybindings |
| `/vim` | Toggle Vim mode |
| `/terminal-setup` | Terminal setup |
| `/memory` | Manage AI memory |
| `/skills` | Manage skills |
| `/sandbox` | Toggle sandbox mode |
| `/session` | Session management |
| `/tag` | Tag current session |
| `/export` | Export session |
| `/upgrade` | Check for updates |
| `/feedback` | Submit feedback |
| `/summary` | Generate session summary |
| `/thinkback` | Think-back review |

---

## Verified Working Features

The following features have been tested and confirmed working:

- ✅ Interactive REPL (chat with AI)
- ✅ Print mode (`-p` flag)
- ✅ Model switching (`/model`)
- ✅ Most slash commands
- ✅ MCP server add/remove/list
- ✅ Plugin installation
- ✅ Git commit generation
- ✅ File editing and creation
- ✅ Skills system
- ✅ Vim mode
- ✅ Config management
- ✅ Doctor diagnostics
- ✅ Dark/light themes
- ✅ Keybinding customization
- ✅ API key authentication (with any Anthropic-compatible provider)
- ✅ Multi-model providers (Bedrock / Vertex / Foundry)

---

## Environment Variables

Supports both `MYCLAUDE_*` and `CLAUDE_CODE_*` names.  
`CLAUDE_CODE_*` takes priority if both are set.

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` / `MYCLAUDE_API_KEY` | API key (required) |
| `ANTHROPIC_BASE_URL` / `MYCLAUDE_BASE_URL` | Custom API base URL |
| `MYCLAUDE_MODEL` | Model override |
| `MYCLAUDE_SIMPLE` | Simple mode (no TUI) |
| `MYCLAUDE_BRIEF` | Brief mode |
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

## Development

```bash
git clone https://gitee.com/thomaslwq/myclaude.git
cd myclaude
bun install
bun run dev        # Development mode
bun run build      # Build to dist/myclaude.js
bun run version    # Verify CLI boots
```

### Build Output

The build script bundles `src/entrypoints/cli.tsx` into a single file `dist/myclaude.js`, injecting compile-time constants such as version number.

### Directory Structure

```
src/
├── commands/     # Slash command implementations
├── components/   # React Ink UI components
├── services/     # Backend services (API, MCP, analytics)
├── tools/        # Tool implementations
├── utils/        # Shared utilities
├── entrypoints/  # CLI entry points
└── main.tsx      # TUI main entry
```

---

## Contributing

Pull requests are welcome!

### Guidelines

- Fork the repo and create a feature branch
- Keep changes focused and minimal
- Test your changes before submitting
- Open a PR against the `main` branch

---

## Links

- **Gitee**: [https://gitee.com/thomaslwq/myclaude](https://gitee.com/thomaslwq/myclaude)
- **GitHub**: [https://github.com/thomaslwq/myclaude](https://github.com/thomaslwq/myclaude)
- **npm**: [https://www.npmjs.com/package/@funnycode/myclaude](https://www.npmjs.com/package/@funnycode/myclaude)

---

## License

MIT
