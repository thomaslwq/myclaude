import { readFileSync, statSync } from 'fs'
import { dirname, extname, join, relative } from 'path'
import type { FileSymbols, SymbolInfo, SymbolKind } from './types.js'

const DEFAULT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.cpp',
  '.c',
  '.h',
  '.hpp',
  '.rb',
  '.php',
  '.swift',
  '.kt',
  '.scala',
])

const DEFAULT_EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
  'env',
  '.env',
  'vendor',
  'target',
  'out',
  '.DS_Store',
  '.idea',
  '.vscode',
])

const MAX_FILE_SIZE = 256 * 1024 // 256KB per file

/**
 * Recursively walk a directory and return file paths.
 */
export function walkDir(
  root: string,
  excludeDirs: Set<string> = DEFAULT_EXCLUDE_DIRS,
  extensions: Set<string> = DEFAULT_EXTENSIONS,
  maxFiles: number = 500,
): string[] {
  const files: string[] = []
  function walk(dir: string): void {
    if (files.length >= maxFiles) return
    try {
      const entries = Bun.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!excludeDirs.has(entry.name)) {
            walk(join(dir, entry.name))
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name)
          if (extensions.has(ext)) {
            const fullPath = join(dir, entry.name)
            try {
              const st = statSync(fullPath)
              if (st.size <= MAX_FILE_SIZE) {
                files.push(fullPath)
              }
            } catch {
              // skip unreadable files
            }
          }
        }
      }
    } catch {
      // skip unreadable directories
    }
  }
  walk(root)
  return files
}

/**
 * Extract symbols from a single file using regex-based parsing.
 * This is a lightweight alternative to tree-sitter that works without
 * native dependencies.
 */
export function extractSymbolsFromFile(
  filePath: string,
  cwd: string,
): FileSymbols {
  const relPath = relative(cwd, filePath)
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const symbols: SymbolInfo[] = []
  const imports: string[] = []
  const calls: string[] = []

  // Extract imports
  const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1])
  }

  // Extract function declarations
  const funcRegex = /\b(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g
  while ((match = funcRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length
    symbols.push({
      name: match[1],
      kind: 'function',
      file: relPath,
      line: lineNum,
      signature: `function ${match[1]}(${match[2]})`,
    })
  }

  // Extract arrow function assignments (const x = (...) => ...)
  const arrowRegex = /\b(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g
  while ((match = arrowRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length
    symbols.push({
      name: match[1],
      kind: 'function',
      file: relPath,
      line: lineNum,
      signature: `${match[1]}(${match[2]}) => ...`,
    })
  }

  // Extract class declarations
  const classRegex = /\b(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*{/g
  while ((match = classRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length
    const extendsClause = match[2] ? ` extends ${match[2]}` : ''
    const implementsClause = match[3] ? ` implements ${match[3].trim()}` : ''
    symbols.push({
      name: match[1],
      kind: 'class',
      file: relPath,
      line: lineNum,
      signature: `class ${match[1]}${extendsClause}${implementsClause}`,
    })
  }

  // Extract interface declarations
  const interfaceRegex = /\b(?:export\s+)?interface\s+(\w+)\s*{/g
  while ((match = interfaceRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length
    symbols.push({
      name: match[1],
      kind: 'interface',
      file: relPath,
      line: lineNum,
      signature: `interface ${match[1]}`,
    })
  }

  // Extract type aliases
  const typeRegex = /\b(?:export\s+)?type\s+(\w+)\s*=/g
  while ((match = typeRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length
    symbols.push({
      name: match[1],
      kind: 'type',
      file: relPath,
      line: lineNum,
      signature: `type ${match[1]}`,
    })
  }

  // Extract enum declarations
  const enumRegex = /\b(?:export\s+)?enum\s+(\w+)\s*{/g
  while ((match = enumRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length
    symbols.push({
      name: match[1],
      kind: 'enum',
      file: relPath,
      line: lineNum,
      signature: `enum ${match[1]}`,
    })
  }

  // Extract const declarations (module-level)
  const constRegex = /\b(?:export\s+)?const\s+(\w+)\s*=/g
  while ((match = constRegex.exec(content)) !== null) {
    // Skip if already captured by arrow regex
    const existing = symbols.find(s => s.name === match[1] && s.kind === 'function')
    if (existing) continue
    const lineNum = content.substring(0, match.index).split('\n').length
    symbols.push({
      name: match[1],
      kind: 'const',
      file: relPath,
      line: lineNum,
      signature: `const ${match[1]}`,
    })
  }

  // Extract method declarations inside classes
  const methodRegex = /\b(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*[:{]/g
  const classLines = lines.map((line, i) => ({ line, idx: i }))
  let inClass = false
  let braceDepth = 0
  for (const { line, idx } of classLines) {
    if (/\bclass\s+\w+/.test(line)) {
      inClass = true
      braceDepth = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
      continue
    }
    if (inClass) {
      braceDepth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
      if (braceDepth <= 0) {
        inClass = false
        continue
      }
      const m = line.match(/\b(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*[:{]/)
      if (m && !['if', 'for', 'while', 'switch', 'catch'].includes(m[1])) {
        symbols.push({
          name: m[1],
          kind: 'method',
          file: relPath,
          line: idx + 1,
          signature: `${m[1]}(${m[2]})`,
        })
      }
    }
  }

  // Extract function calls (simple heuristic)
  const callRegex = /\b(\w+)\s*\(/g
  while ((match = callRegex.exec(content)) !== null) {
    const keyword = match[1]
    if (
      !['if', 'for', 'while', 'switch', 'catch', 'return', 'throw', 'new', 'typeof', 'instanceof', 'delete', 'void', 'import', 'export', 'require', 'console', 'process'].includes(keyword)
    ) {
      calls.push(keyword)
    }
  }

  return {
    file: relPath,
    symbols,
    imports,
    calls,
  }
}

/**
 * Extract docstring for a symbol at a given line.
 */
export function extractDocstring(
  content: string,
  lineIndex: number,
): string | undefined {
  const lines = content.split('\n')
  let start = lineIndex - 1
  if (start < 0) return undefined

  // Look for JSDoc comment above the symbol
  if (lines[start].trim().startsWith('*')) {
    const docLines: string[] = []
    while (start >= 0) {
      const trimmed = lines[start].trim()
      if (trimmed.startsWith('/**')) {
        docLines.unshift(trimmed.replace('/**', '').trim())
        break
      } else if (trimmed.startsWith('*')) {
        docLines.unshift(trimmed.replace(/^\*\s*/, '').trim())
      } else {
        break
      }
      start--
    }
    if (docLines.length > 0) {
      return docLines.join(' ').trim()
    }
  }

  // Look for triple-slash or regular comment
  if (lines[start].trim().startsWith('//')) {
    const comments: string[] = []
    while (start >= 0 && lines[start].trim().startsWith('//')) {
      comments.unshift(lines[start].trim().replace('//', '').trim())
      start--
    }
    if (comments.length > 0) {
      return comments.join(' ').trim()
    }
  }

  return undefined
}

export { DEFAULT_EXTENSIONS, DEFAULT_EXCLUDE_DIRS, MAX_FILE_SIZE }
