# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **myclaude** — an open-source fork/rebrand of Claude Code. It is an AI coding assistant that runs in your terminal.

- Package: `@funnycode/myclaude` (npm)
- Binary: `myclaude`
- Entry: `src/main.tsx` (CLI bootstrapped via `src/entrypoints/cli.tsx`)
- Build: `bun run scripts/build.ts`
- Package manager: `bun` (v1.3.5+)

## Architecture

Core source lives in `src/`. Key areas:
- `src/entrypoints/` — CLI, SDK, MCP entry points
- `src/commands/` — Slash commands (`/effort`, `/init`, etc.)
- `src/services/` — API, analytics, OTel, MCP services
- `src/components/` — Inc UI components (Ink/React-based TUI)
- `src/tools/` — Tool implementations (Bash, Edit, Search, etc.)
- `src/utils/` — Shared utilities (settings, model config, git, etc.)
- `vendor/` — Vendored third-party code
- `shims/` — Platform-specific shims for native packages

## Key Commands

- `bun run dev` — Run in development mode
- `bun run build` — Build production bundle to `dist/myclaude.mjs`
- `bun run start` — Same as `dev`
- `bun run prepublishOnly` — Build before publish

## Environment Variables

This fork supports both `CLAUDE_CODE_*` and `MYCLAUDE_*` env var prefixes.
`MYCLAUDE_*` vars are aliased to the `CLAUDE_CODE_*` equivalents via `src/utils/envCompat.ts`.

Key perf env vars:
- `MYCLAUDE_DISABLE_THINKING=1` — Skip extended thinking for faster responses
- `MYCLAUDE_EFFORT_LEVEL=low` — Lower effort = faster but less thorough

## Configuration

- `.claude/settings.json` — Project-level settings (committed, team-shared)
- `.claude/settings.local.json` — Local settings (gitignored, personal)
- `~/.claude/settings.json` — User-global settings
- `CLAUDE.md` / `.claude/CLAUDE.md` — Project instructions
- `CLAUDE.local.md` — Personal instructions (gitignored)

## Effort Levels

- `low` — Quick, straightforward implementation
- `medium` — Balanced approach with standard testing
- `high` — Comprehensive implementation with extensive testing
- `max` — Maximum capability with deepest reasoning
- `auto` — Use the default effort level for your model
