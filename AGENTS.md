# Repository Guidelines

## Project
This is the **myclaude** open-source project — a fork/rebrand of Claude Code.
The long-term goal is to make it available as a standalone npm package (`myclaude`).

## Project Structure & Module Organization
Core source lives in `src/`. Entry points and CLI wiring are under files such as `src/dev-entry.ts`, `src/main.tsx`, and `src/commands.ts`. Feature code is grouped by area in folders like `src/commands/`, `src/services/`, `src/components/`, `src/tools/`, and `src/utils/`. Compatibility code appears in `vendor/` and local package shims in `shims/`.
