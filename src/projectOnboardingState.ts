import { join } from 'path'
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
 * The fingerprint is a sorted, newline-joined list of the immediate children
 * (filenames only). This reliably detects file additions, removals, and
 * renames. It does NOT detect content changes within existing files
 * (those are covered by the CLAUDE.md mtime check).
 */
function getDirectoryFingerprint(dirPath: string): string {
  const fs = getFsImplementation()
  const entries = fs.readdirStringSync(dirPath)
  return entries.sort().join('\n')
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
// contents (e.g., by cloning a repo), we track the mtime of both CLAUDE.md and the
// workspace directory. If either mtime changes, the cache is invalidated. A short
// time-based fallback ensures the cache is refreshed quickly even on filesystems
// where mtime may not change reliably.
let cachedSteps: Step[] | null = null
let cachedClaudeMdMtime: number = -1
let cachedDirFingerprint: string = ''

/**
 * Timestamp (ms) when the cache was last populated. Used as a fallback
 * for filesystems where mtime may not change reliably (e.g., network mounts,
 * FUSE, containers with coarse timestamp resolution).
 */
let cachedAt: number | null = null

/**
 * Maximum age of the cache in milliseconds before forcing a re-check.
 * This is a fallback for filesystems where mtime may not change reliably.
 * 30 seconds is long enough to make the cache useful across prompt submits
 * while still being short enough to recover from edge cases.
 */
const CACHE_MAX_AGE_MS = 30_000

/** Clear the steps cache (called after /init so the new CLAUDE.md is picked up). */
export function clearCachedSteps(): void {
  cachedSteps = null
  cachedClaudeMdMtime = -1
  cachedDirFingerprint = ''
  cachedAt = null
}

/**
 * Check if the cached steps are still valid.
 *
 * Primary: compare CLAUDE.md mtime and directory mtime. If either has changed,
 * the cache is stale.
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

  // Check the directory fingerprint to detect content changes (files added/removed)
  // that don't modify CLAUDE.md itself. This is more reliable than mtime,
  // which may not update on FUSE mounts, network filesystems, or containers
  // with coarse timestamp resolution.
  try {
    const currentFingerprint = getDirectoryFingerprint(cwd)
    if (currentFingerprint !== cachedDirFingerprint) return false
  } catch {
    // If we can't read the directory, invalidate to be safe
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
