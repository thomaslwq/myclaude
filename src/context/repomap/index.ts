import { getCwd } from '../../utils/cwd.js'
import { extractSymbolsFromFile, walkDir } from './extractor.js'
import { formatCompactRepoMap, formatRepoMap } from './formatter.js'
import { rankSymbols } from './ranker.js'
import type { FileSymbols, RankedSymbol, RepoMap, RepoMapOptions } from './types.js'

/**
 * Build a repo map by scanning the workspace and extracting symbols.
 */
export async function buildRepoMap(
  root: string = getCwd(),
  options: RepoMapOptions = {},
): Promise<RepoMap> {
  const extensions = options.extensions
    ? new Set(options.extensions)
    : undefined
  const excludeDirs = options.excludeDirs
    ? new Set(options.excludeDirs)
    : undefined
  const maxFiles = options.maxFiles ?? 500

  const files = walkDir(root, excludeDirs, extensions, maxFiles)
  const fileSymbols: FileSymbols[] = []

  for (const file of files) {
    try {
      const symbols = extractSymbolsFromFile(file, root)
      if (symbols.symbols.length > 0) {
        fileSymbols.push(symbols)
      }
    } catch {
      // Skip files that can't be parsed
    }
  }

  const totalSymbols = fileSymbols.reduce(
    (sum, f) => sum + f.symbols.length,
    0,
  )

  return {
    files: fileSymbols,
    totalSymbols,
    generatedAt: Date.now(),
  }
}

/**
 * Get the repo map as a formatted string for the system prompt.
 */
export async function getRepoMapPrompt(
  root: string = getCwd(),
  options: RepoMapOptions = {},
): Promise<string> {
  const repoMap = await buildRepoMap(root, options)
  return formatRepoMap(repoMap, options)
}

/**
 * Get the repo map as a compact string for TUI display.
 */
export async function getRepoMapDisplay(
  root: string = getCwd(),
  options: RepoMapOptions = {},
): Promise<string> {
  const repoMap = await buildRepoMap(root, options)
  return formatCompactRepoMap(repoMap, options)
}

/**
 * Get ranked symbols for a given query.
 */
export async function getRankedSymbols(
  root: string = getCwd(),
  query: string = '',
  options: RepoMapOptions = {},
): Promise<RankedSymbol[]> {
  const repoMap = await buildRepoMap(root, options)
  return rankSymbols(repoMap.files, query)
}

export type { FileSymbols, RankedSymbol, RepoMap, RepoMapOptions, SymbolInfo, SymbolKind } from './types.js'
export { extractSymbolsFromFile, walkDir } from './extractor.js'
export { formatCompactRepoMap, formatRepoMap } from './formatter.js'
export { rankSymbols } from './ranker.js'
