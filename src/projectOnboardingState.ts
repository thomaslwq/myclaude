import { join, resolve, basename } from 'path'
import {
  getCurrentProjectConfig,
  saveCurrentProjectConfig,
} from './utils/config.js'
import { getCwd } from './utils/cwd.js'
import { isDirEmpty, getFileModificationTime } from './utils/file.js'
import { getFsImplementation } from './utils/fsOperations.js'

/**
 * Compute a fingerprint of a directory's contents to detect changes
 * without relying on mtime (which may not update reliably on FUSE mounts,
 * network filesystems, or containers with coarse timestamp resolution).
 *
 * The fingerprint is a sorted, newline-joined list of all files and
 * subdirectories recursively. This reliably detects file additions,
 * removals, and renames at any depth. It does NOT detect content
 * changes within existing files (those are covered by the CLAUDE.md
 * mtime check).
 */
export function getDirectoryFingerprint(dirPath: string, visitedRealPaths?: Set<string>): string {
  const fs = getFsImplementation()
  
  // Track resolved real paths to detect symlink cycles
  if (!visitedRealPaths) {
    visitedRealPaths = new Set<string>()
  }
  
  // Get the real path of the current directory to detect cycles
  let currentRealPath: string
  try {
    currentRealPath = fs.realpathSync(dirPath)
  } catch {
    // If we can't resolve the real path, use the original path
    currentRealPath = dirPath
  }
  
  // If we've already visited this real path, we're in a cycle - skip it
  if (visitedRealPaths.has(currentRealPath)) {
    return ''
  }
  visitedRealPaths.add(currentRealPath)
  
  let entries: string[]
  try {
    entries = fs.readdirSync(dirPath).map((dirent) => dirent.name)
  } catch {
    // If we can't read the directory (permission error, etc.), return empty fingerprint
    visitedRealPaths.delete(currentRealPath)
    return ''
  }
  
  const sortedEntries = entries.sort()
  
  // Recursively include subdirectories in the fingerprint
  const fingerprintParts: string[] = []
  for (const entry of sortedEntries) {
    const fullPath = join(dirPath, entry)
    
    try {
      // Use lstatSync to detect symlinks without following them
      const lstat = fs.lstatSync(fullPath)
      
      if (lstat.isSymbolicLink()) {
        // Follow symbolic links to directories so their contents are tracked
        // This ensures changes in symlinked directories (e.g., shared folders, linked packages)
        // are reflected in the fingerprint and don't cause stale cache.
        try {
          const stat = fs.statSync(fullPath)
          if (stat.isDirectory()) {
            // Recurse into the symlink target directory, passing the visited set
            fingerprintParts.push(entry + '/')
            fingerprintParts.push(getDirectoryFingerprint(fullPath, visitedRealPaths))
          } else {
            // Symlink to a file: include the entry name
            fingerprintParts.push(entry)
          }
        } catch {
          // If we can't stat the target (broken symlink, permission error, etc.), skip it
          continue
        }
      } else if (lstat.isDirectory()) {
        // Skip common ignored directories to avoid performance issues
        // (node_modules, .git, dist, build, etc.)
        if (
          entry === 'node_modules' ||
          entry === '.git' ||
          entry === 'dist' ||
          entry === 'build' ||
          entry === '.next' ||
          entry === 'out' ||
          entry === 'coverage' ||
          entry === 'target' ||
          entry === 'vendor' ||
          entry === '__pycache__' ||
          entry === '.cache' ||
          entry === '.mypy_cache' ||
          entry === '.svn' ||
          entry === '.hg'
        ) {
          continue
        }
        
        // Include the directory name and recurse into it
        fingerprintParts.push(entry + '/')
        fingerprintParts.push(getDirectoryFingerprint(fullPath, visitedRealPaths))
      } else {
        fingerprintParts.push(entry)
      }
    } catch {
      // Skip entries that can't be accessed (permission errors, etc.)
      // This prevents the entire fingerprint computation from failing
      continue
    }
  }
  
  visitedRealPaths.delete(currentRealPath)
  return fingerprintParts.join('\n')
}

export type Step = {
  key: string
  text: string
  isComplete: boolean
  isCompletable: boolean
  isEnabled: boolean
}

// Cache the filesystem-heavy checks so they aren't recomputed on every prompt submit.
// The workspace state (directory emptiness, CLAUDE.md existence) is stable within a
// session — the cwd doesn't change and CLAUDE.md isn't created/deleted mid-session by
// the user. The cache is cleared when the user explicitly runs /init.
//
// To handle the case where the user manually creates CLAUDE.md or changes workspace
// contents (e.g., by cloning a repo), we use a two-tier invalidation strategy:
// 1. Lightweight mtime check on the root directory (fast, single stat, no recursion)
// 2. Only if the root mtime has changed, recompute the expensive fingerprint
//
// This avoids the synchronous recursive directory walk on every prompt submit,
// which was blocking the event loop for large workspaces.

let cachedSteps: Step[] | null = null
let cachedClaudeMdMtime: number = -1
let cachedDirFingerprint: string = ''
let cachedRootMtime: number = -1

/**
 * Timestamp (ms) when the cache was last populated. Used as a fallback
 * for filesystems where mtime may not change reliably (e.g., network mounts,
 * FUSE, containers with coarse timestamp resolution).
 */
let cachedAt: number | null = null

/**
 * Maximum age of the cache in milliseconds before forcing a re-check.
 * This is a fallback for filesystems where mtime may not change reliably.
 * 5 minutes is plenty of time for normal filesystems where fingerprint
 * and mtime checks are reliable, while still being short enough to
 * recover from edge cases on unreliable filesystems.
 */
const CACHE_MAX_AGE_MS = 300_000

/** Clear the steps cache (called after /init so the new CLAUDE.md is picked up). */
export function clearCachedSteps(): void {
  cachedSteps = null
  cachedClaudeMdMtime = -1
  cachedDirFingerprint = ''
  cachedRootMtime = -1
  cachedAt = null
}

/**
 * Check if the cached steps are still valid.
 *
 * Primary: compare CLAUDE.md mtime and root directory mtime. If either has changed,
 * the cache is stale. The root directory mtime check is a lightweight single statSync
 * call that avoids the expensive recursive directory walk (getDirectoryFingerprint).
 * Fallback: if the cache is older than CACHE_MAX_AGE_MS, re-read the actual
 * file/directory state. This handles filesystems where mtime may not change
 * reliably (e.g., ext4, FUSE, network mounts).
 */
function isCacheValid(): boolean {
  if (!cachedSteps) return false

  const cwd = getCwd()
  const claudeMdPath = join(cwd, 'CLAUDE.md')

  // Check CLAUDE.md mtime if it exists
  const fs = getFsImplementation()
  try {
    const currentClaudeMdMtime = fs.existsSync(claudeMdPath)
      ? getFileModificationTime(claudeMdPath) ?? -1
      : -1
    if (currentClaudeMdMtime !== cachedClaudeMdMtime) return false
  } catch {
    // If we can't stat it, invalidate to be safe
    return false
  }

  // Lightweight root mtime check: if the root directory's mtime hasn't changed,
  // the workspace contents are likely unchanged. This is a single statSync call
  // instead of a full recursive directory walk, which was blocking the event loop.
  // The mtime of a directory changes when files are added, removed, or renamed
  // inside it on most filesystems.
  // If the mtime has changed, we compute the fingerprint to confirm the cache is
  // stale (since mtime may change spuriously on some filesystems). If the mtime
  // matches, we skip the expensive fingerprint computation entirely.
  let rootMtimeChanged = false
  try {
    const currentRootMtime = fs.statSync(cwd).mtimeMs
    // Compare with tolerance to handle sub-millisecond precision
    rootMtimeChanged = Math.abs(currentRootMtime - cachedRootMtime) > 0.5
  } catch {
    // If we can't stat the root, invalidate to be safe
    return false
  }

  if (rootMtimeChanged) {
    // Fingerprint check: compare the cached directory fingerprint with the current one.
    // This reliably detects file additions, removals, and renames at any depth,
    // even when mtime doesn't change (e.g., on FUSE mounts, network filesystems,
    // or containers with coarse timestamp resolution).
    // Only computed when the mtime has changed, as the mtime check is a lightweight
    // single statSync call that avoids the expensive recursive directory walk.
    const currentDirFingerprint = getDirectoryFingerprint(cwd)
    if (currentDirFingerprint !== cachedDirFingerprint) {
      return false
    }
  }

  // Fallback: if the cache is older than the max age, force a re-check
  // to handle filesystems where mtime may not change reliably
  // (e.g., ext4, FUSE, network mounts).
  if (cachedAt !== null && Date.now() - cachedAt > CACHE_MAX_AGE_MS) {
    return false
  }

  return true
}

export function getSteps(): Step[] {
  if (isCacheValid()) {
    return cachedSteps!
  }

  const cwd = getCwd()
  const fs = getFsImplementation()
  const hasClaudeMd = fs.existsSync(join(cwd, 'CLAUDE.md'))
  const isWorkspaceDirEmpty = isDirEmpty(cwd)

  // Track mtimes for cache invalidation
  const claudeMdPath = join(cwd, 'CLAUDE.md')
  try {
    cachedClaudeMdMtime = hasClaudeMd ? getFileModificationTime(claudeMdPath) : -1
  } catch {
    cachedClaudeMdMtime = -1
  }
  try {
    cachedRootMtime = fs.statSync(cwd).mtimeMs
  } catch {
    cachedRootMtime = -1
  }
  try {
    cachedDirFingerprint = getDirectoryFingerprint(cwd)
  } catch {
    cachedDirFingerprint = ''
  }
  cachedAt = Date.now()

  cachedSteps = [
    {
      key: 'workspace',
      text: 'Ask Claude to create a new app or clone a repository',
      isComplete: false,
      isCompletable: true,
      isEnabled: isWorkspaceDirEmpty,
    },
    {
      key: 'claudemd',
      text: 'Run /init to create a CLAUDE.md file with instructions for Claude',
      isComplete: hasClaudeMd,
      isCompletable: true,
      isEnabled: !isWorkspaceDirEmpty,
    },
  ]

  return cachedSteps
}

export function isProjectOnboardingComplete(): boolean {
  return getSteps()
    .filter(({ isCompletable, isEnabled }) => isCompletable && isEnabled)
    .every(({ isComplete }) => isComplete)
}

export function maybeMarkProjectOnboardingComplete(): void {
  // Short-circuit on cached config — isProjectOnboardingComplete() hits
  // the filesystem, and REPL.tsx calls this on every prompt submit.
  if (getCurrentProjectConfig().hasCompletedProjectOnboarding) {
    return
  }
  if (isProjectOnboardingComplete()) {
    saveCurrentProjectConfig(current => ({
      ...current,
      hasCompletedProjectOnboarding: true,
    }))
  }
}

export function shouldShowProjectOnboarding(): boolean {
  const projectConfig = getCurrentProjectConfig()
  // Short-circuit on cached config before isProjectOnboardingComplete()
  // hits the filesystem — this runs during first render.
  if (
    projectConfig.hasCompletedProjectOnboarding ||
    projectConfig.projectOnboardingSeenCount >= 4 ||
    process.env.IS_DEMO
  ) {
    return false
  }

  return !isProjectOnboardingComplete()
}

export function incrementProjectOnboardingSeenCount(): void {
  saveCurrentProjectConfig(current => ({
    ...current,
    projectOnboardingSeenCount: current.projectOnboardingSeenCount + 1,
  }))
}
