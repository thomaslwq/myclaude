import { join } from 'path'
import {
  getCurrentProjectConfig,
  saveCurrentProjectConfig,
} from './utils/config.js'
import { getCwd } from './utils/cwd.js'
import { isDirEmptySync, getFileModificationTime } from './utils/file.js'
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
// contents (e.g., by cloning a repo), we check CLAUDE.md mtime and directory
// emptiness. These are cheap, reliable checks — unlike directory mtime, which is
// not guaranteed to update on all filesystems when files are added or removed.
//
// We also use a time-based cache (TTL) to avoid filesystem I/O on every prompt.
// The workspace state is stable within a session, so we only need to revalidate
// periodically (e.g., every 5 seconds). This prevents unnecessary I/O while
// still detecting changes when they occur.

const CACHE_TTL_MS = 5000 // 5 seconds
let cachedSteps: Step[] | null = null
let cachedClaudeMdMtime: number = -1
let cachedIsDirEmpty: boolean | null = null
let cachedStepsTimestamp: number = 0

/** Clear the steps cache (called after /init so the new CLAUDE.md is picked up). */
export function clearCachedSteps(): void {
  cachedSteps = null
  cachedClaudeMdMtime = -1
  cachedIsDirEmpty = null
  cachedStepsTimestamp = 0
}

/**
 * Check if the cached steps are still valid.
 *
 * Uses a time-based cache (TTL) to avoid filesystem I/O on every prompt.
 * The cache is considered valid if it exists and is less than CACHE_TTL_MS
 * old. This prevents unnecessary I/O while still detecting changes when
 * they occur (e.g., user manually creates CLAUDE.md or changes workspace
 * contents).
 */
function isCacheValid(): boolean {
  if (!cachedSteps) return false

  // Check if the cache has expired (older than CACHE_TTL_MS)
  const now = Date.now()
  if (now - cachedStepsTimestamp > CACHE_TTL_MS) {
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
  const isWorkspaceDirEmpty = isDirEmptySync(cwd)

  // Track state for cache invalidation
  const claudeMdPath = join(cwd, 'CLAUDE.md')
  try {
    cachedClaudeMdMtime = hasClaudeMd ? getFileModificationTime(claudeMdPath) : -1
  } catch {
    cachedClaudeMdMtime = -1
  }
  cachedIsDirEmpty = isWorkspaceDirEmpty

  cachedStepsTimestamp = Date.now()

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
    projectConfig.hasDismissedProjectOnboarding
  ) {
    return false
  }
  return !isProjectOnboardingComplete()
}
