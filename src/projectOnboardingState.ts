import { join, resolve, basename, sep as pathSep } from 'path'
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
export function getDirectoryFingerprint(dirPath: string, recursionStack?: string[], rootRealPath?: string, maxDepth: number = 100): string {
  const fs = getFsImplementation()
  
  // Track resolved real paths in the current recursion chain to detect symlink cycles
  // Using a stack instead of a global set allows the same directory to be visited
  // via multiple paths (e.g., directly and via a symlink) while still detecting
  // genuine cycles (e.g., a symlink pointing to an ancestor).
  if (!recursionStack) {
    recursionStack = []
  }
  
  // Get the real path of the current directory to detect cycles
  let currentRealPath: string
  try {
    currentRealPath = fs.realpathSync(dirPath)
  } catch (err) {
    // If we can't resolve the real path, try to resolve the symlink manually
    // to detect cycles even when realpathSync fails (e.g., permission errors)
    console.warn(`[getDirectoryFingerprint] Failed to resolve real path for '${dirPath}', using original path: ${err}`)
    try {
      // Use readlinkSync directly without prior lstatSync check to avoid TOCTOU race condition.
      // readlinkSync is a single system call that atomically reads the symlink target.
      // If the path is not a symlink, it will throw an error which we catch.
      const linkTarget = fs.readlinkSync(dirPath)
      const resolvedTarget = resolve(dirPath, linkTarget)
      currentRealPath = resolvedTarget
    } catch {
      // If readlinkSync fails (not a symlink, permission error, etc.), use the original path
      currentRealPath = dirPath
    }
  }
  
  // If we've already visited this real path in the current recursion chain,
  // we're in a cycle - skip it to prevent infinite recursion
  // Also check the original dirPath in case realpathSync failed and the
  // resolved path doesn't match what's in the stack (e.g., symlink cycle)
  if (recursionStack.includes(currentRealPath) || recursionStack.includes(dirPath)) {
    return ''
  }
  recursionStack.push(currentRealPath)
  
  // Check depth limit to prevent stack overflow from deeply nested directories
  // The recursionStack length is used as depth proxy since each push corresponds to one level
  if (recursionStack.length > maxDepth) {
    console.warn(`[getDirectoryFingerprint] Maximum recursion depth (${maxDepth}) exceeded for '${dirPath}'`)
    recursionStack.pop()
    return ''
  }

  // Store the root real path on first call to enforce symlink boundary
  if (rootRealPath === undefined) {
    rootRealPath = currentRealPath
  }
  
  let entries: string[]
  try {
    entries = fs.readdirSync(dirPath).map((dirent) => dirent.name)
  } catch (err) {
    // If we can't read the directory (permission error, etc.), return empty fingerprint
    console.warn(`[getDirectoryFingerprint] Failed to read directory '${dirPath}': ${err}`)
    recursionStack.pop()
    return ''
  }
  
  const sortedEntries = entries.sort()
  
  // Recursively include subdirectories in the fingerprint
  const fingerprintParts: string[] = []
  try {
    for (const entry of sortedEntries) {
      const fullPath = join(dirPath, entry)
      
      try {
        // Use readlinkSync directly to check if the path is a symlink.
        // readlinkSync is a single system call that atomically reads the symlink target,
        // eliminating the TOCTOU race condition that would exist if we first checked
        // with lstatSync and then called readlinkSync in a separate syscall.
        // If the path is not a symlink, readlinkSync will throw an error which we catch.
        let isSymlink = false
        try {
          const linkTarget = fs.readlinkSync(fullPath)
          isSymlink = true
          // Symlink — resolve and process it
          const resolvedTarget = resolve(dirPath, linkTarget)
          // Check if the resolved target is inside the root directory
          let targetRealPath: string
          try {
            targetRealPath = fs.realpathSync(resolvedTarget)
          } catch (err) {
            console.warn(`[getDirectoryFingerprint] Failed to resolve target real path for symlink '${fullPath}': ${err}`)
            targetRealPath = resolvedTarget
          }
          // Only recurse into the symlink target if it's within the root directory
          // Use lowercased comparisons to handle case-insensitive filesystems
          // (e.g., macOS APFS, Windows NTFS). On these filesystems, paths that
          // differ only in case resolve to the same location, so a case-sensitive
          // startsWith() check could be bypassed.
          const targetLower = targetRealPath.toLowerCase()
          const rootLower = rootRealPath.toLowerCase()
          if (targetLower === rootLower || targetLower.startsWith(rootLower + pathSep)) {
            // Check if the target is a directory
            const stat = fs.statSync(resolvedTarget)
            if (stat.isDirectory()) {
              // Skip common ignored directories to avoid performance issues
              // (node_modules, .git, dist, build, etc.)
              const targetBasename = basename(resolvedTarget)
              if (
                targetBasename === 'node_modules' ||
                targetBasename === '.git' ||
                targetBasename === 'dist' ||
                targetBasename === 'build' ||
                targetBasename === '.next' ||
                targetBasename === 'out' ||
                targetBasename === 'coverage' ||
                targetBasename === 'target' ||
                targetBasename === 'vendor' ||
                targetBasename === '__pycache__' ||
                targetBasename === '.cache' ||
                targetBasename === '.mypy_cache' ||
                targetBasename === '.svn' ||
                targetBasename === '.hg' ||
                targetBasename === 'venv' ||
                targetBasename === '.venv' ||
                targetBasename === 'env'
              ) {
                // Skip this directory to avoid performance issues
                fingerprintParts.push(entry + '/')
                continue
              }
              fingerprintParts.push(entry + '/')
              fingerprintParts.push(getDirectoryFingerprint(resolvedTarget, recursionStack, rootRealPath, maxDepth))
            } else {
              // Symlink to a file: include the entry name
              fingerprintParts.push(entry)
            }
          } else {
            // Symlink points outside the root - include the entry name with trailing slash
            // to maintain consistency with symlinked directories inside the root
            fingerprintParts.push(entry + '/')
          }
        } catch {
          // If readlinkSync throws, it's not a symlink (or there's a permission error).
          // Fall back to lstatSync to determine if it's a directory or regular file.
          if (!isSymlink) {
            const lstat = fs.lstatSync(fullPath)
            if (lstat.isDirectory()) {
              // Skip common ignored directories to avoid performance issues
              // (node_modules, .git, dist, build, etc.)
              const targetBasename = basename(fullPath)
              if (
                targetBasename === 'node_modules' ||
                targetBasename === '.git' ||
                targetBasename === 'dist' ||
                targetBasename === 'build' ||
                targetBasename === '.next' ||
                targetBasename === 'out' ||
                targetBasename === 'coverage' ||
                targetBasename === 'target' ||
                targetBasename === 'vendor' ||
                targetBasename === '__pycache__' ||
                targetBasename === '.cache' ||
                targetBasename === '.mypy_cache' ||
                targetBasename === '.svn' ||
                targetBasename === '.hg' ||
                targetBasename === 'venv' ||
                targetBasename === '.venv' ||
                targetBasename === 'env'
              ) {
                // Skip this directory to avoid performance issues
                fingerprintParts.push(entry + '/')
                continue
              }
              fingerprintParts.push(entry + '/')
              fingerprintParts.push(getDirectoryFingerprint(fullPath, recursionStack, rootRealPath, maxDepth))
            } else {
              // Regular file: include the entry name
              fingerprintParts.push(entry)
            }
          }
        }
      } catch (err) {
        // Skip entries that can't be accessed (permission errors, etc.)
        // This prevents the entire fingerprint computation from failing
        console.warn(`[getDirectoryFingerprint] Failed to access entry '${fullPath}': ${err}`)
        continue
      }
    }
  } finally {
    // Ensure cleanup happens even if an exception is thrown
    recursionStack.pop()
  }
  
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
 * 1 minute is a reasonable balance: long enough to avoid frequent
 * re-computation on normal filesystems where fingerprint and mtime
 * checks are reliable, while being short enough to detect changes
 * on unreliable filesystems (FUSE mounts, network filesystems,
 * containers with coarse timestamp resolution) without requiring
 * the user to manually run /init.
 */
const CACHE_MAX_AGE_MS = 60_000

/** Clear the steps cache (called after /init so the new CLAUDE.md is picked up). */
export function clearCachedSteps(): void {
  cachedSteps = null
  cachedClaudeMdMtime = -1
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

  // Root mtime check: if the root directory's mtime has changed, the workspace
  // contents likely changed (files added/removed/renamed). This is a single
  // statSync call — cheap. We intentionally do NOT run a recursive directory
  // fingerprint walk here: it blocks the event loop on large workspaces, and
  // onboarding only needs root-level state (workspace emptiness, CLAUDE.md
  // existence) which the mtime check covers.
  try {
    const currentRootMtime = fs.statSync(cwd).mtimeMs
    // Compare with tolerance to handle sub-millisecond precision
    if (Math.abs(currentRootMtime - cachedRootMtime) > 0.5) return false
  } catch {
    // If we can't stat the root, invalidate to be safe
    return false
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
  // Guard against TOCTOU races: the file/dir may be deleted between
  // existsSync and subsequent stat calls (or while isDirEmpty runs).
  // Treat any failure as cache invalidation instead of crashing the REPL
  // (issue #581).
  let hasClaudeMd = false
  let isWorkspaceDirEmpty = true
  try {
    hasClaudeMd = fs.existsSync(join(cwd, 'CLAUDE.md'))
  } catch {
    hasClaudeMd = false
  }
  try {
    isWorkspaceDirEmpty = isDirEmpty(cwd)
  } catch {
    isWorkspaceDirEmpty = true
  }

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
