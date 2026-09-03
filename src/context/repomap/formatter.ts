import type { FileSymbols, RankedSymbol, RepoMap, RepoMapOptions } from './types.js'
import { rankSymbols } from './ranker.js'

const KIND_ICONS: Record<string, string> = {
  function: 'ƒ',
  class: 'C',
  interface: 'I',
  type: 'T',
  enum: 'E',
  const: 'c',
  method: 'm',
}

/**
 * Format a repo map into a compact, human-readable string suitable for
 * inclusion in the system prompt.
 */
export function formatRepoMap(
  repoMap: RepoMap,
  options: RepoMapOptions = {},
): string {
  const maxLines = options.maxLines ?? 300
  const maxSymbols = options.maxSymbols ?? 200
  const query = options.query

  let lines: string[] = []
  lines.push('# Repository Map')
  lines.push(`Generated: ${new Date(repoMap.generatedAt).toISOString()}`)
  lines.push(`Files: ${repoMap.files.length} | Symbols: ${repoMap.totalSymbols}`)
  if (query) {
    lines.push(`Query: ${query}`)
  }
  lines.push('')

  // Group symbols by file
  const fileOrder = repoMap.files.map(f => f.file)
  const symbolsByFile = new Map<string, RankedSymbol[]>()

  // If we have a query, rank and filter
  if (query || maxSymbols) {
    const ranked = rankSymbols(repoMap.files, query)
    const filtered = ranked.slice(0, maxSymbols)
    for (const item of filtered) {
      if (!symbolsByFile.has(item.file)) {
        symbolsByFile.set(item.file, [])
      }
      symbolsByFile.get(item.file)!.push(item)
    }
  } else {
    for (const file of repoMap.files) {
      symbolsByFile.set(file.file, file.symbols.map(s => ({ symbol: s, score: 0, file: s.file })))
    }
  }

  // Format each file
  for (const file of fileOrder) {
    const items = symbolsByFile.get(file)
    if (!items || items.length === 0) continue

    lines.push(`## ${file}`)
    for (const item of items) {
      const icon = KIND_ICONS[item.symbol.kind] || '?'
      const sig = item.symbol.signature
      const lineRef = item.symbol.line
      lines.push(`  ${icon} ${sig} (line ${lineRef})`)
      if (lines.length > maxLines) break
    }
    lines.push('')
    if (lines.length > maxLines) break
  }

  return lines.join('\n')
}

/**
 * Format a compact version of the repo map for display in the TUI.
 */
export function formatCompactRepoMap(
  repoMap: RepoMap,
  options: RepoMapOptions = {},
): string {
  const maxLines = options.maxLines ?? 100
  let lines: string[] = []
  lines.push(`📊 Repo Map: ${repoMap.files.length} files, ${repoMap.totalSymbols} symbols`)
  lines.push('')

  for (const file of repoMap.files) {
    if (lines.length > maxLines) break
    const symbolCount = file.symbols.length
    const kinds = file.symbols.map(s => KIND_ICONS[s.kind] || '?')
    lines.push(`  ${file.file} (${symbolCount} symbols: ${kinds.join(' ')})`)
  }

  return lines.join('\n')
}
