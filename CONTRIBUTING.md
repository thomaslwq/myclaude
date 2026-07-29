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

## Platform Compatibility & Shims

myclaude uses several shim modules to replace native Node.js modules with JavaScript implementations, primarily for compatibility with Bun and cross-platform support.

### Current Shims

| Shim | Original Module | Performance Impact | Notes |
|------|----------------|-------------------|-------|
| `shims/color-diff-napi` | Native Rust `color-diff` (syntect + similar) | **High** — Pure TypeScript port using highlight.js + diff npm package. Syntax highlighting is 10-100× slower than native Rust. The lazy-loading pattern (deferred `require('highlight.js')`) avoids the 100-200ms module-eval cost at startup. | The TS port was necessary to support Bun, which cannot load native `.node` modules. The API is identical; output differences are documented in the source. |
| `shims/modifiers-napi` | Native macOS `modifiers-napi` | **Low** — Tries to load native `.node` binary; falls back gracefully on non-macOS platforms. The shim itself is a zero-cost re-export. | Only functional on macOS with the native binary present. The shim is needed to avoid a hard dependency on the platform-specific binary. |
| `shims/url-handler-napi` | Native macOS `url-handler-napi` | **Low** — Same pattern as modifiers-napi. Zero-cost re-export shim. | Only functional on macOS. Used for deep link handling. |
| `shims/ant-claude-for-chrome-mcp` | MCP Server for Chrome | **None** — Empty stub (no-op implementation). | The original module is macOS-only and was replaced with a no-op stub for cross-platform builds. |
| `shims/ant-computer-use-mcp` | Computer Use MCP Server | **None** — Empty stub returning empty arrays/error responses. | Platform-specific feature stubbed out for cross-platform compatibility. |
| `shims/ant-computer-use-input` | Native macOS input handling | **None** — JavaScript stub with no-op implementations. | Platform-specific (macOS only) feature replaced with a no-op stub. |
| `shims/node-domexception` | `node-domexception` npm package | **None** — Simple polyfill returning `globalThis.DOMException`. | Required for Node 18 compatibility; not needed in Bun or Node 20+. |

### Performance Considerations

- **color-diff-napi** is the most performance-critical shim. If you are working on features that render large diffs or syntax-highlighted files, be aware that the JS implementation is significantly slower than the native Rust version. Future improvements could include:
  - Using a WebAssembly port of syntect
  - Caching parsed results
  - Implementing a streaming parser
- **modifiers-napi** and **url-handler-napi** load native binaries only on macOS. On other platforms (including Bun on Linux/Windows), they gracefully return null/empty results. The dynamic import pattern ensures no startup cost on unsupported platforms.
- The other shims (`ant-*`) are no-op stubs with negligible performance impact.

### Removing or Improving Shims

If a native module becomes available for your platform, you can restore it by:
1. Updating the corresponding shim to import from the native package instead of the JS port
2. Updating `package.json` to include the native dependency
3. Adding platform-specific build logic in `scripts/build.ts`

When adding a new shim, please:
- Document the performance impact in this table
- Use dynamic imports (`require()` or `await import()`) to avoid startup cost on unsupported platforms
- Add a graceful fallback that returns null/empty results

## License

MIT - see [LICENSE](LICENSE)
