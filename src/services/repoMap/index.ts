import { getCwd } from '../../utils/cwd.js'
import { buildRepoMap, type RepoMapResult } from './extractor.js'
import {
  clearRecentFiles,
  getRecentFiles,
  getRecentlyEditedFiles,
  recordRecentFile,
  type RecentFileEntry,
  type RecentFileKind,
} from './recentFiles.js'

/**
 * Public API for the implicit context / repo map feature (issue #974).
 *
 * Two pieces:
 *  1. A lightweight repo map (Aider-style) that gives the LLM a compressed,
 *     hierarchical overview of the workspace's function/class signatures.
 *  2. A session-scoped tracker of recently edited/read files (Cursor-style)
 *     that surfaces what the user has been working on.
 *
 * Both are injected into the system prompt via `systemPromptSection` in
 * `src/constants/prompts.ts`. The repo map is cached (it doesn't change
 * within a session), while the recent-files section is uncached (it changes
 * every turn).
 */

export { buildRepoMap, extractSignatures, DEFAULT_IGNORE_DIRS, DEFAULT_IGNORE_FILES }
export type { RepoMapOptions, RepoMapResult } from './extractor.js'
export {
  clearRecentFiles,
  getRecentFiles,
  getRecentlyEditedFiles,
  recordRecentFile,
}
export type { RecentFileEntry, RecentFileKind } from './recentFiles.js'

/**
 * Default character budget for the repo map. ~2000 tokens at 4 chars/token.
 * Override with MYCLAUDE_REPO_MAP_BUDGET_CHARS.
 */
export const DEFAULT_REPO_MAP_BUDGET_CHARS = 8000

/**
 * Whether the repo map feature is enabled. Off by default for non-Ant users
 * until we measure quality impact; on for Ants.
 */
export function isRepoMapEnabled(): boolean {
  if (process.env.MYCLAUDE_REPO_MAP === '0' || process.env.MYCLAUDE_REPO_MAP === 'false') {
    return false
  }
  if (process.env.MYCLAUDE_REPO_MAP === '1' || process.env.MYCLAUDE_REPO_MAP === 'true') {
    return true
  }
  return process.env.USER_TYPE === 'ant'
}

/**
 * Build the repo map section for the system prompt.
 * Returns null if the feature is disabled or the workspace is empty.
 */
export async function getRepoMapSection(): Promise<string | null> {
  if (!isRepoMapEnabled()) return null

  const root = getCwd()
  const budgetChars = Number(process.env.MYCLAUDE_REPO_MAP_BUDGET_CHARS) || DEFAULT_REPO_MAP_BUDGET_CHARS

  let result: RepoMapResult
  try {
    result = await buildRepoMap({ root, budgetChars })
  } catch {
    return null
  }

  if (result.filesIncluded === 0 || result.map.length === 0) return null

  return [
    '# Repository Map',
    '',
    'A compressed overview of the workspace. Use it to locate files and symbols without manual @ mentions.',
    '',
    result.map,
  ].join('\n')
}

/**
 * Build the recently-edited files section for the system prompt.
 * Returns null if there are no recent files.
 */
export function getRecentFilesSection(limit = 10): string | null {
  const files = getRecentlyEditedFiles(limit)
  if (files.length === 0) return null

  const lines = files.map(f => {
    const tag = f.kind === 'write' ? '[written]' : '[edited]'
    return `- ${f.path} ${tag}`
  })

  return [
    '# Recently Edited Files',
    '',
    'Files the user has been working on in this session. Prioritize these when the user refers to "the code" or "this file" without a path.',
    '',
    ...lines,
  ].join('\n')
}

/**
 * Convenience wrapper for tool implementations: record that a file was
 * touched. Call this from FileReadTool / FileEditTool / FileWriteTool /
 * NotebookEditTool after a successful operation.
 */
export function touchFile(path: string, kind: RecentFileKind = 'read'): void {
  recordRecentFile(path, kind)
}

/**
 * Return a summary of the current implicit context for /repo-map display.
 */
export async function getImplicitContextSummary(): Promise<{
  repoMap: RepoMapResult | null
  recentFiles: RecentFileEntry[]
}> {
  const root = getCwd()
  const budgetChars = Number(process.env.MYCLAUDE_REPO_MAP_BUDGET_CHARS) || DEFAULT_REPO_MAP_BUDGET_CHARS
  let repoMap: RepoMapResult | null = null
  try {
    repoMap = await buildRepoMap({ root, budgetChars })
  } catch {
    repoMap = null
  }
  return {
    repoMap,
    recentFiles: getRecentFiles(20),
  }
}
