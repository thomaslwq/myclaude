import type { FileSymbols, RankedSymbol, SymbolInfo } from './types.js'

/**
 * Rank symbols by importance using a simplified PageRank-like algorithm.
 * Symbols that are called by many other files get higher scores.
 */
export function rankSymbols(
  files: FileSymbols[],
  query?: string,
): RankedSymbol[] {
  // Build a map of symbol name -> list of symbols with that name
  const symbolMap = new Map<string, SymbolInfo[]>()
  for (const file of files) {
    for (const symbol of file.symbols) {
      const key = symbol.name
      if (!symbolMap.has(key)) {
        symbolMap.set(key, [])
      }
      symbolMap.get(key)!.push(symbol)
    }
  }

  // Count how many times each symbol is called across all files
  const callCounts = new Map<string, number>()
  for (const file of files) {
    for (const call of file.calls) {
      callCounts.set(call, (callCounts.get(call) || 0) + 1)
    }
  }

  // Count how many files import each module
  const importCounts = new Map<string, number>()
  for (const file of files) {
    for (const imp of file.imports) {
      importCounts.set(imp, (importCounts.get(imp) || 0) + 1)
    }
  }

  // Score each symbol
  const ranked: RankedSymbol[] = []
  for (const file of files) {
    for (const symbol of file.symbols) {
      let score = 0

      // Base score by kind
      switch (symbol.kind) {
        case 'class':
          score += 3
          break
        case 'function':
          score += 2
          break
        case 'method':
          score += 1.5
          break
        case 'interface':
          score += 2
          break
        case 'type':
          score += 1.5
          break
        case 'enum':
          score += 2
          break
        case 'const':
          score += 0.5
          break
      }

      // Boost by call count (how many times this symbol is called)
      const calls = callCounts.get(symbol.name) || 0
      score += Math.log2(calls + 1) * 2

      // Boost by import count of the file
      const fileImports = importCounts.get(file.file) || 0
      score += Math.log2(fileImports + 1) * 1.5

      // Boost if symbol name matches query
      if (query) {
        const q = query.toLowerCase()
        if (symbol.name.toLowerCase().includes(q)) {
          score += 10
        }
        if (file.file.toLowerCase().includes(q)) {
          score += 5
        }
      }

      ranked.push({ symbol, score, file: file.file })
    }
  }

  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score)

  return ranked
}
