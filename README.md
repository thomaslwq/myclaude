# @funnycode/myclaude

**myclaude** — An open-source AI coding assistant that runs in your terminal, built on Anthropic's Claude Code with extended features including a virtual companion, achievements, and more.

![myclaude](https://raw.githubusercontent.com/thomaslwq/myclaude/main/docs/funnycode.png)

```bash
npx @funnycode/myclaude
```

---

## Features

- **AI Chat** — Write, refactor, debug, and explain code via natural language
- **BUDDY Companion** — A terminal pet that grows with you. Hatch, pet, feed, play, and evolve your ASCII companion. 18 species, 5 rarity tiers, shiny variants, XP & evolution system.
- **Achievements** — Unlock 20+ achievements as you code: streaks, milestones, discoveries.
- **Milestones** — Companion memory system that remembers your journey.
- **Event Calendar** — Seasonal easter eggs and special reactions for holidays.
- **80+ Slash Commands** — `/commit`, `/review`, `/plan`, `/doctor`, `/buddy`, `/achievements` and more
- **File Operations** — Edit, write, create, and search files with AI guidance
- **Git Integration** — Automatic commit messages, branch management, diff, review
- **MCP Support** — Model Context Protocol for extensible tool integrations
- **Plugin System** — Install and manage plugins from marketplaces (including ECC ecosystem)
- **Agent Mode** — Multi-step autonomous task execution
- **Skills System** — Extend capabilities with reusable skills
- **Terminal UI** — React Ink interface with syntax highlighting, themes, and Vim mode
- **Multi-Model Support** — Anthropic, AWS Bedrock, Google Vertex AI, Microsoft Foundry
- **Claude Code Compatible** — Reads `~/.claude/settings.json`, skills, MCPs, plugins, and hooks shared with Claude Code

---

## Quick Start

### Prerequisites

- **Bun >= 1.3.5** (Node.js >= 22.17 also works)
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
| `/branch` | Create a conversation branch (fork) |
| `/plan` | Create an implementation plan |
| `/review` | Review code |

### AI & Model
| Command | Description |
|---------|-------------|
| `/model` | Change AI model |
| `/effort` | Set effort level |

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

### Companion & Achievements
| Command | Description |
|---------|-------------|
| `/buddy` | Manage your terminal companion (hatch, pet, feed, play, card, mute, unmute) |
| `/achievements` | View unlocked achievements and progress |

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
| `/tag` | Tag current session |
| `/export` | Export session |
| `/feedback` | Submit feedback (opens GitHub Issues) |

---

## BUDDY — Your Terminal Companion

myclaude comes with a built-in virtual pet that lives in your terminal. Each pet is **deterministically generated** from your user ID — what you get is uniquely yours and cannot be cheated.

### Species (18 total)

🦆 Duck &nbsp; 🪿 Goose &nbsp; 🫧 Blob &nbsp; 🐱 Cat &nbsp; 🐉 Dragon
🐙 Octopus &nbsp; 🦉 Owl &nbsp; 🐧 Penguin &nbsp; 🐢 Turtle &nbsp; 🐌 Snail
👻 Ghost &nbsp; 🦎 Axolotl &nbsp; 🦫 Capybara &nbsp; 🌵 Cactus &nbsp; 🤖 Robot
🐰 Rabbit &nbsp; 🍄 Mushroom &nbsp; 🐈 Chonk

### Rarity System

| Rarity | Chance | Stars |
|--------|--------|-------|
| Common | 60% | ★ |
| Uncommon | 25% | ★★ |
| Rare | 10% | ★★★ |
| Epic | 4% | ★★★★ |
| Legendary | 1% | ★★★★★ |

There's also a **1% shiny chance** independent of rarity — shiny companions sparkle ✨

### Stats & Evolution

Each companion has 5 attributes: `DEBUGGING`, `PATIENCE`, `CHAOS`, `WISDOM`, `SNARK` — with one peak stat and one dump stat.

Companions gain XP through interaction and level up (max level 50). At certain levels, they evolve into new forms. Each species has multiple evolution stages with unique appearances.

### Commands

| Command | Description |
|---------|-------------|
| `/buddy hatch` | Hatch a new companion |
| `/buddy pet` | Pet your companion (+5 XP, hearts animation) |
| `/buddy feed` | Feed your companion (+15 XP) |
| `/buddy play` | Play with your companion (+20 XP) |
| `/buddy card` | View companion card with stats, level, and milestones |
| `/buddy mute` | Hide companion from terminal |
| `/buddy unmute` | Show companion again |

The companion reacts to your conversation and occasionally comments via speech bubbles. Each species has custom animations and pet reactions. Special events and holidays trigger unique messages and reactions.

### Milestones

Your companion remembers your journey together — milestones are tracked and displayed on the companion card:

🥚 First companion hatched &nbsp; 📝 First AI commit &nbsp; 🔍 First code review
⭐ Buddy reached level 5 &nbsp; 👑 Buddy reached level 50 &nbsp; 🔥 7/30 day streaks

---

## Achievements

Unlock achievements as you use myclaude. Track your progress with `/achievements`.

### Categories

| Category | Description |
|----------|-------------|
| 🌟 Getting Started | First hatch, first commit, first review, first plugin, first skill |
| 📊 Usage | 10/100 commits, 100/1000 messages, model switching, config changes |
| 🔥 Streaks | 3/7/30 consecutive days of use |
| 🐾 Buddy | Hatch, pet 10/100 times, legendary or shiny companion |
| ⚡ Power | Add an MCP server |

```bash
/achievements        # Show unlocked achievements summary
/achievements list   # Show all achievements with progress
```

---

## Built-in Integrations

### CodeGraph — Semantic Code Intelligence

[CodeGraph](https://github.com/colbymchenry/codegraph) provides surgical code context for faster, more accurate edits. myclaude auto-detects the `codegraph` CLI and enables it as a built-in plugin when available.

**Setup:**
```bash
# 1. Install CodeGraph CLI (one-time)
npm i -g @colbymchenry/codegraph

# 2. Initialize in your project
cd your-project
codegraph init

# 3. Enable the plugin in myclaude
/plugin enable codegraph
```

Once enabled, CodeGraph's MCP server starts automatically and provides semantic code intelligence in every session.

### ECC — Agent Operating System

[ECC](https://github.com/affaan-m/ECC) is **built-in** to myclaude. It provides a cross-harness agent ecosystem with 76+ commands and 246+ skills, all automatically registered as bundled skills at startup — no installation, no marketplace setup, no configuration needed. Just start using `/` commands immediately.

ECC skills and commands are loaded synchronously from `seed/marketplaces/ecc/` at module load time and available before the CLI finishes booting.

```bash
/help                  # ECC commands appear in the command list
/skills list           # See available ECC skills
```

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
| `MYCLAUDE_DISABLE_THINKING` | Disable extended thinking |
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
git clone https://github.com/thomaslwq/myclaude.git
cd myclaude
bun install
bun run dev        # Development mode
bun run build      # Build to dist/myclaude.mjs
bun run version    # Verify CLI boots
```

### Build Output

The build script bundles `src/entrypoints/cli.tsx` into a single file `dist/myclaude.mjs`, injecting compile-time constants such as version number.

### Directory Structure

```
src/
├── achievements/  # Achievement system (types, storage, checker)
├── buddy/         # BUDDY companion (sprites, animations, evolution, types)
├── commands/      # Slash command implementations
├── components/    # React Ink UI components
├── events/        # Event calendar (seasonal easter eggs)
├── services/      # Backend services (API, MCP, analytics)
├── tools/         # Tool implementations
├── utils/         # Shared utilities (envCompat, config, etc.)
├── entrypoints/   # CLI entry points
└── main.tsx       # TUI main entry
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

- **GitHub**: [https://github.com/thomaslwq/myclaude](https://github.com/thomaslwq/myclaude)
- **Gitee**: [https://gitee.com/thomaslwq/myclaude](https://gitee.com/thomaslwq/myclaude) (mirror)
- **npm**: [https://www.npmjs.com/package/@funnycode/myclaude](https://www.npmjs.com/package/@funnycode/myclaude)

---

## License

MIT
