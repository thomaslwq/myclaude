# 🎭 myclaude

> **Your AI coding sidekick in the terminal — write smarter, ship faster.**

```bash
npx @funnycode/myclaude
```

[![npm](https://img.shields.io/npm/v/@funnycode/myclaude)](https://www.npmjs.com/package/@funnycode/myclaude)
[![License](https://img.shields.io/npm/l/@funnycode/myclaude)](LICENSE)

---

## ✨ What Makes MyClaude Different?

| | Feature | Why You'll Love It |
|---|---------|-------------------|
| 🐾 | **BUDDY Pet** | A virtual pet grows as you code — hatch it, feed it, play with it. 18 species, legendary rarity, shiny variants. |
| 🏆 | **Achievements** | Unlock 20+ achievements. Streaks, milestones, discoveries — your coding journey gamified. |
| 🎯 | **Frontend TDD** | `/frontend-tdd` — Red-Green-Refactor workflow for frontend testing, built right in. |
| 🌊 | **Git Flow** | `/new-feature`, `/finish-release`, `/new-hotfix` — full Git Flow workflow as slash commands. |
| 🤖 | **ECC Built-in** | 76+ commands and 246+ skills loaded at startup — zero setup. |
| 🧠 | **AI Chat** | Write, refactor, debug, and explain code. Multi-model (Anthropic, Bedrock, Vertex, Foundry). |
| 🎨 | **Beautiful TUI** | React Ink terminal UI with themes, Vim mode, syntax highlighting. |
| 🔌 | **Plugins & MCP** | Extend with plugins, MCP servers, custom skills. |

---

## 🚀 Start in 10 Seconds

```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Run instantly (no install needed)
npx @funnycode/myclaude

# Or install globally
npm install -g @funnycode/myclaude
myclaude
```

**Prerequisites:** Bun ≥ 1.3.5 (or Node.js ≥ 22.17) · Git

---

## 🎮 Slash Commands at a Glance

### 📍 Essential
| Command | What it does |
|---------|-------------|
| `/help` | Show help |
| `/config` | Configure settings |
| `/doctor` | Diagnose & verify installation |
| `/model` | Switch AI model |
| `/effort` | Set effort level |

### 🧪 Testing & Quality
| Command | What it does |
|---------|-------------|
| **`/frontend-tdd <description>`** | **TDD Red-Green-Refactor cycle for frontend features** |
| `/review` | Review a pull request |
| `/plan` | Create an implementation plan |

### 🌊 Git Flow
| Command | What it does |
|---------|-------------|
| `/new-feature <name> [from]` | Create feature branch from `main` |
| `/finish-feature [target]` | Merge feature to `main` |
| `/new-release <version> [from]` | Create release branch |
| `/finish-release` | Merge release to `main` & `develop` |
| `/new-hotfix <name> [from]` | Create hotfix branch |
| `/finish-hotfix` | Merge hotfix to `main` & `develop` |
| `/commit` | Generate a git commit |

### 🐾 BUDDY & Achievements
| Command | What it does |
|---------|-------------|
| `/buddy hatch` | Hatch a new companion |
| `/buddy pet` | Pet your buddy (+5 XP ❤️) |
| `/buddy feed` | Feed your buddy (+15 XP) |
| `/buddy play` | Play with your buddy (+20 XP) |
| `/buddy card` | View stats & milestones |
| `/achievements` | Track your unlocks |

### 🔌 Integrations
| Command | What it does |
|---------|-------------|
| `/mcp` | Manage MCP servers |
| `/plugin` | Install & manage plugins |
| `/hooks` | Manage hooks |
| `/skills` | List available skills |

### ⚙️ System
| Command | What it does |
|---------|-------------|
| `/status` | Session & auth status |
| `/vim` | Toggle Vim mode |
| `/theme` | Change UI theme |
| `/keybindings` | Customize shortcuts |
| `/memory` | Manage AI memory |
| `/feedback` | Submit feedback |

---

## 🐾 BUDDY — Your Terminal Pet

myclaude has a virtual pet that **lives in your terminal**. It's generated from your user ID — **yours is unique, no two alike**.

### 18 Species

🦆 Duck · 🪿 Goose · 🫧 Blob · 🐱 Cat · 🐉 Dragon · 🐙 Octopus · 🦉 Owl
🐧 Penguin · 🐢 Turtle · 🐌 Snail · 👻 Ghost · 🦎 Axolotl · 🦫 Capybara
🌵 Cactus · 🤖 Robot · 🐰 Rabbit · 🍄 Mushroom · 🐈 Chonk

### Rarity & Stats

| Rarity | Odds | Stars |
|--------|------|-------|
| Common | 60% | ★ |
| Uncommon | 25% | ★★ |
| Rare | 10% | ★★★ |
| Epic | 4% | ★★★★ |
| Legendary | **1%** | ★★★★★ |
| ✨ Shiny | **1%** (independent) | Sparkles! |

Each companion has 5 stats: `DEBUGGING`, `PATIENCE`, `CHAOS`, `WISDOM`, `SNARK`. Gain XP, level up (max 50), and **evolve** into new forms.

---

## 🎯 Frontend TDD

```bash
/frontend-tdd Create a user login form with email validation
```

This command guides the AI through the **Red-Green-Refactor** cycle:

🔴 **Red** → Write a failing test first  
🟢 **Green** → Minimum code to pass  
🔵 **Refactor** → Clean up, keep the test green

It includes frontend-specific testing best practices: Testing Library behavior queries, `user-event` over `fireEvent`, async handling with `waitFor`/`findBy*`, MSW for API mocking, and accessibility-first selectors.

---

## 🌊 Git Flow Workflow

```bash
/new-feature user-auth                  # feature/user-auth from main
/new-feature api-rate-limit develop      # feature/api-rate-limit from develop
/finish-feature                          # merge to main
/finish-feature develop                  # merge to develop instead
/new-release 1.2.0                       # release/1.2.0 from main
/new-hotfix security-patch               # hotfix/security-patch from main
/finish-hotfix                           # merge to main & develop
```

All commands default to `main` and accept an optional `[from]` or `[target]` argument.

---

## 🔌 Built-in Integrations

### CodeGraph — Semantic Code Intelligence
Auto-detects `codegraph` CLI and enables it as a built-in plugin for surgical code context.

```bash
npm i -g @colbymchenry/codegraph
cd your-project
codegraph init
/plugin enable codegraph
```

### ECC — Agent Operating System
**76+ commands and 246+ skills** are loaded at startup — no install, no config. Just start typing `/`.

---

## ⚙️ Environment Variables

Use `MYCLAUDE_*` or `CLAUDE_CODE_*` (the latter takes priority).

| Key Variables | What it does |
|--------------|-------------|
| `ANTHROPIC_API_KEY` / `MYCLAUDE_API_KEY` | API key (required) |
| `ANTHROPIC_BASE_URL` | Custom API endpoint |
| `MYCLAUDE_MODEL` | Override model |
| `MYCLAUDE_SIMPLE` | Non-TUI mode |
| `MYCLAUDE_DISABLE_THINKING` | Skip extended thinking |
| `MYCLAUDE_USE_BEDROCK` | AWS Bedrock provider |
| `MYCLAUDE_USE_VERTEX` | Google Vertex AI provider |
| `MYCLAUDE_USE_FOUNDRY` | Microsoft Foundry provider |
| `MYCLAUDE_SYNTAX_HIGHLIGHT` | Highlight theme |
| `MYCLAUDE_IDLE_THRESHOLD_MINUTES` | Idle timeout (default: 75) |
| `MYCLAUDE_EFFORT_LEVEL` | Effort level |

---

## 🔧 Custom Models

myclaude supports third-party models (any provider compatible with the Anthropic API format) and local models.

### Basic Configuration

| Env Variable | What it does | Example |
|--------------|-------------|---------|
| `ANTHROPIC_BASE_URL` | Custom API endpoint | `https://your-api.example.com` |
| `MYCLAUDE_MODEL` / `CLAUDE_CODE_MODEL` | Specify model name | `claude-sonnet-4-20250514`, `gemini-2.5-pro` |

> Supports both `MYCLAUDE_*` and `CLAUDE_CODE_*` prefixes — the latter takes priority, fully compatible with Claude Code environment variable naming.

### Common Scenarios

**Using a proxy / relay API:**
```bash
export ANTHROPIC_BASE_URL=https://your-proxy.com/v1
export ANTHROPIC_API_KEY=your-proxy-key
export MYCLAUDE_MODEL=claude-sonnet-4-20250514
npx @funnycode/myclaude
```

**Using Ollama local models (via compatibility layer):**
```bash
# First, start Ollama and pull a model
# ollama pull llama3.2

# Use tools like llm-cluster or litellm to provide an Anthropic-compatible endpoint
export ANTHROPIC_BASE_URL=http://localhost:8000/v1
export ANTHROPIC_API_KEY=sk-local
export MYCLAUDE_MODEL=llama3.2
npx @funnycode/myclaude
```

**Using Google Vertex AI:**
```bash
export MYCLAUDE_USE_VERTEX=true
export CLOUD_ML_REGION=us-central1
gcloud auth application-default login
npx @funnycode/myclaude
```

**Using AWS Bedrock:**
```bash
export MYCLAUDE_USE_BEDROCK=true
export AWS_REGION=us-east-1
# AWS credentials via env vars or ~/.aws/credentials
npx @funnycode/myclaude
```

**Using Microsoft Foundry:**
```bash
export MYCLAUDE_USE_FOUNDRY=true
export AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
export AZURE_OPENAI_API_KEY=your-azure-key
npx @funnycode/myclaude
```

> 💘 At runtime, you can also use the `/model` command to quickly switch between supported models.

---

## 🛠 Dev

```bash
git clone https://github.com/thomaslwq/myclaude.git
cd myclaude
bun install
bun run dev          # Dev mode
bun run build        # Bundle to dist/myclaude.mjs
bun run version      # Verify CLI boots
```

### Structure

```
src/
├── achievements/    # Achievement system
├── buddy/           # BUDDY companion (sprites, evolution)
├── commands/        # All slash commands
├── components/      # React Ink UI
├── events/          # Calendar & seasonal easter eggs
├── services/        # API, MCP, analytics
├── tools/           # Tool implementations
├── utils/           # Shared utilities
├── entrypoints/     # CLI entry points
└── main.tsx         # TUI main entry
```

---

## 🤝 Contributing

PRs welcome! Fork → branch → small focused changes → test → PR.

---

## 📎 Links

- **GitHub**: [github.com/thomaslwq/myclaude](https://github.com/thomaslwq/myclaude)
- **Gitee**: [gitee.com/thomaslwq/myclaude](https://gitee.com/thomaslwq/myclaude)
- **npm**: [npmjs.com/package/@funnycode/myclaude](https://www.npmjs.com/package/@funnycode/myclaude)

---

## 📄 License

MIT
