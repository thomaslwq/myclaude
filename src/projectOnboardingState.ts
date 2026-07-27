import { join } from 'path'
import {
  getCurrentProjectConfig,
  saveCurrentProjectConfig,
} from './utils/config.js'
import { getCwd } from './utils/cwd.js'
import { isDirEmpty, getFileModificationTime } from './utils/file.js'
import { getFsImplementation } from './utils/fsOperations.js'

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
// contents (e.g., by cloning a repo), we also track the mtime of CLAUDE.md and the
// directory itself. If either mtime changes, the cache is invalidated.
let cachedSteps: Step[] | null = null
let cachedClaudeMdMtime: number | null = null
let cachedDirMtime: number | null = null

/**
 * Timestamp (ms) when the cache was last populated. Used as a fallback
 * for filesystems where mtime may not change reliably (e.g., network mounts,
 * FUSE, containers with coarse timestamp resolution).
 */
let cachedAt: number | null = null

/** Maximum age of the cache in milliseconds before forcing a re-check. */
const CACHE_MAX_AGE_MS = 30_000

/** Clear the steps cache (called after /init so the new CLAUDE.md is picked up). */
export function clearCachedSteps(): void {
  cachedSteps = null
  cachedClaudeMdMtime = null
  cachedDirMtime = null
  cachedAt = null
}

/**
 * Check if the cached steps are still valid.
 *
 * Primary: compare file mtimes. If mtime has changed, the cache is stale.
 * Fallback: if mtimes are unchanged but the cache is older than CACHE_MAX_AGE_MS,
 * re-read the actual file/directory state. This handles filesystems where mtime
 * may not change reliably (e.g., network mounts, FUSE, containers).
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

  // Check directory mtime (changes when files are added/removed)
  try {
    const currentDirMtime = getFileModificationTime(cwd) ?? -1
    if (currentDirMtime !== cachedDirMtime) return false
  } catch {
    return false
  }

  // Fallback: if the cache is older than the max age, force a re-check
  // to handle filesystems where mtime may not change reliably.
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
    cachedDirMtime = getFileModificationTime(cwd)
  } catch {
    cachedDirMtime = -1
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
