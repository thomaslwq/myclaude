# Technical Debt Tracking

This document tracks unresolved TODO comments from the codebase. Each TODO should be converted to a GitHub issue or resolved. This file serves as a centralized tracking document.

## onKeyDown-migration

These TODOs are backward-compat bridges that use `useInput` as a fallback until consumers wire `handleKeyDown` to `<Box onKeyDown>`.

- [ ] `src/hooks/useVoiceIntegration.tsx:652` — remove once REPL passes handleKeyDown.
- [ ] `src/hooks/useVoiceIntegration.tsx:670` — temporary shim so existing JSX callers keep compiling.
- [ ] `src/hooks/useTypeahead.tsx:1367` — remove once PromptInput passes handleKeyDown.
- [ ] `src/hooks/useSearchInput.ts:355` — remove once all consumers pass handleKeyDown.
- [ ] `src/hooks/useHistorySearch.ts:273` — remove once PromptInput passes handleKeyDown.
- [ ] `src/hooks/useBackgroundTaskNavigation.ts:245` — remove once REPL passes handleKeyDown.

## useDiffInIDE improvements

- [ ] `src/hooks/useDiffInIDE.ts:212` — Time out after 5 mins of inactivity?
- [ ] `src/hooks/useDiffInIDE.ts:213` — Update auto-approval UI when IDE exits
- [ ] `src/hooks/useDiffInIDE.ts:214` — Close the IDE tab when the approval prompt is unmounted

## Code cleanup

- [ ] `src/hooks/useReplBridge.tsx:310` — avoid the cast
- [ ] `src/utils/generators.ts:62` — Clean this up
- [ ] `src/utils/processUserInput/processUserInput.ts:200` — Make this an attachment message
- [ ] `src/utils/processUserInput/processUserInput.ts:242` — Clean this up
- [ ] `src/utils/processUserInput/processBashCommand.tsx:48` — Clean up this hack

## Plugin system

- [ ] `src/utils/hooks/hooksSettings.ts:179` — Get the actual plugin hook file paths instead of using glob pattern
- [ ] `src/utils/plugins/pluginLoader.ts:3242` — Clear installed plugins cache when installedPluginsManager is implemented
- [ ] `src/utils/plugins/schemas.ts:432` — allow globs? (future work)
- [ ] `src/utils/plugins/schemas.ts:463` — allow globs? (future work)
- [ ] `src/utils/plugins/schemas.ts:1158` — gist (future work)
- [ ] `src/utils/plugins/schemas.ts:1159` — single file? (future work)
- [ ] `src/utils/plugins/marketplaceManager.ts:1619` — Implement npm package support
- [ ] `src/utils/plugins/pluginOptionsStorage.ts:156` — getSettings_DEPRECATED returns MERGED settings across all scopes.

## Auth/Security

- [ ] `src/utils/auth.ts:1054` — migrate to SecureStorage
- [ ] `src/utils/auth.ts:1106` — migrate to SecureStorage
- [ ] `src/services/mcp/auth.ts:1743` — add cross-process lockfile before GA
- [ ] `src/services/mcp/xaa.ts:229` — consult `token_endpoint_auth_methods_supported` from IdP

## MCP/LSP services

- [ ] `src/services/mcp/utils.ts:357` — This fails an e2e test if the `?.` is not present
- [ ] `src/services/mcp/useManageMCPConnections.ts:342` — check appstate as the source of truth
- [ ] `src/services/mcp/client.ts:589` — memoization complexity
- [ ] `src/services/mcp/client.ts:681` — Use the auth token provided in the lockfile
- [ ] `src/services/mcp/MCPConnectionManager.tsx:37` — get rid of this context
- [ ] `src/services/lsp/LSPServerManager.ts:374` — Integrate with compact - call closeFile() when compact

## Other

- [ ] `src/utils/swarm/backends/ITermBackend.ts:233` — Consider batching these or making them async/fire-and-forget
- [ ] `src/utils/thinking.ts:88` — add support for probing unknown models via API error detection
- [ ] `src/utils/filePersistence/filePersistence.ts:244` — Read file_id from xattr on output files
- [ ] `src/utils/messages.ts:2674` — This needs patching as recursive fields can still be stringified
- [ ] `src/utils/sessionRestore.ts:22` — import of TODO_WRITE_TOOL_NAME
- [ ] `src/cli/print.ts:2920` — use readonly types to avoid cast
- [ ] `src/skills/bundled/scheduleRemoteAgents.ts:31` — Before shipping publicly
- [ ] `src/query.ts:545` — no need to set toolUseContext.messages during set-up
- [ ] `src/services/mcp/xaa.ts:133` — validation (mix-up protection — TODO: upstream to SDK)
- [ ] `src/services/mcp/xaa.ts:176` — issuer-mismatch validation (mix-up protection — TODO: upstream to SDK)
