/**
 * Types for the repo map module.
 */

export type SymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'const'
  | 'method'

export interface SymbolInfo {
  name: string
  kind: SymbolKind
  file: string
  line: number
  signature: string
  docstring?: string
}

export interface FileSymbols {
  file: string
  symbols: SymbolInfo[]
  imports: string[]
  calls: string[]
}

export interface RepoMap {
  files: FileSymbols[]
  totalSymbols: number
  generatedAt: number
}

export interface RankedSymbol {
  symbol: SymbolInfo
  score: number
  file: string
}

export interface RepoMapOptions {
  maxFiles?: number
  maxSymbols?: number
  maxLines?: number
  query?: string
  extensions?: string[]
  excludeDirs?: string[]
}
