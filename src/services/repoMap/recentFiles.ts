import { LRUCache } from 'lru-cache'
import { normalize } from 'path'

/**
 * Session-scoped tracker of recently edited/read files (issue #974).
 *
 * Cursor-style implicit context: the LLM should know which files the user
 * has been working on without being told. We record every file touched by
 * the Read/Write/Edit/NotebookEdit tools and expose the most recent ones
 * for injection into the system prompt.
 *
 * The tracker is a module-level singleton so it survives across turns
 * within a session. Call `clearRecentFiles()` on /clear or /compact.
 */

export type RecentFileKind = 'read' | 'edit' | 'write'

export interface RecentFileEntry {
  path: string
  kind: RecentFileKind
  timestamp: number
}

const DEFAULT_MAX = 20

let cache: LRUCache<string, RecentFileEntry> = new LRUCache<string, RecentFileEntry>({
  max: DEFAULT_MAX,
})

/**
 * Record that a file was read/edited/written. Higher-priority kinds
 * (write > edit > read) bump the entry to the front of the LRU.
 */
export function recordRecentFile(
  path: string,
  kind: RecentFileKind = 'read',
  timestamp: number = Date.now(),
): void {
  const key = normalize(path)
  const existing = cache.get(key)
  // If we already have a higher-priority entry, don't downgrade it.
  if (existing) {
    const priority = { read: 0, edit: 1, write: 2 }
    if (priority[kind] < priority[existing.kind]) {
      // Still refresh the timestamp so it stays recent.
      cache.set(key, { ...existing, timestamp })
      return
    }
  }
  cache.set(key, { path: key, kind, timestamp })
}

/**
 * Return the most recently touched files, newest first.
 */
export function getRecentFiles(limit = 10): RecentFileEntry[] {
  const out: RecentFileEntry[] = []
  // LRUCache.values() yields most-recently-used first.
  for (const entry of cache.values()) {
    if (out.length >= limit) break
    out.push(entry)
  }
  return out
}

/**
 * Return only files that were edited or written (not just read).
 */
export function getRecentlyEditedFiles(limit = 10): RecentFileEntry[] {
  return getRecentFiles(limit).filter(e => e.kind === 'edit' || e.kind === 'write')
}

/**
 * Clear the tracker. Called on /clear and /compact.
 */
export function clearRecentFiles(): void {
  cache = new LRUCache<string, RecentFileEntry>({ max: DEFAULT_MAX })
}

/**
 * Test-only: replace the internal cache with a fresh one of a given size.
 */
export function _resetForTest(max = DEFAULT_MAX): void {
  cache = new LRUCache<string, RecentFileEntry>({ max })
}

export function _sizeForTest(): number {
  return cache.size
}
