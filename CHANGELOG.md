# Changelog

## [0.1.22] - 2026-06-17

### Added
- `/feedback` command now submits issues to the myclaude GitHub repo (fixes #8)
  - GitHub Issues URL redirected from `anthropics/claude-code` to `thomaslwq/myclaude`
- Claude Code config compatibility: myclaude now explicitly supports reading Claude Code's global configuration (`~/.claude/settings.json`, skills, MCPs, plugins) — both tools share the same config directory (fixes #7)
- Added `node-domexception` shim package to suppress npm deprecation warning during install (fixes #5)

### Fixed
- Git Bash fork issue on Windows — semaphore-based spawn concurrency limit prevents MSYS2 pty pool exhaustion (#6, already deployed in v0.1.21)
- npm `node-domexception@1.0.0` deprecated warning eliminated via local shim override

## [0.1.21] - 2026-06-17

### Fixed
- Fixed `/achievements` command not working — missing `type` and `supportsNonInteractive` fields in command registration (fixes #3)
- Fixed `/mystats` command same missing fields issue for consistency
- Fixed Git Bash "Could not fork child process: There are no available terminals(-1)" error on Windows (fixes #2)
  - Added MSYS2 environment variables (`MSYS2_ARG_CONV_EXCL`, `CHERE_INVOKING`) to reduce pty consumption per fork
  - Added spawn concurrency semaphore limiting to 24 concurrent Git Bash processes to prevent pty pool exhaustion
  - Propagated `MSYSTEM` environment to child processes

## [0.1.20] - 2026-06-15

### Added
- Created CLAUDE.md project instructions for AI assistant context (fixes #1)
- Added performance-optimized project settings in .claude/settings.json (fixes #4)

## [0.1.8] - 2026-06-12

### Changed
- Updated package.json readme field with full English content for npm display

## [0.1.7] - 2026-06-12

### Fixed
- Force npm registry to refresh README display (added explicit readme field)

## [0.1.6] - 2026-06-12

### Fixed
- Fixed README.md content: changed from Chinese to English as the default document

## [0.1.5] - 2026-06-12

### Changed
- Updated README.md and README.zh-CN.md to reflect actual project state
- Added multi-model provider support documentation
- Added missing commands (review, feedback, summary, thinkback)
- Updated repository links and build instructions

## [0.1.0] - 2025-03-01

### Added
- Initial open-source release based on Claude Code source reconstruction
- MIT License
- Renamed to myclaude
