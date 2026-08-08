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

let cachedSteps: Step[] | null = null
let cachedClaudeMdMtime: number = -1
let cachedIsDirEmpty: boolean | null = null

/** Clear the steps cache (called after /init so the new CLAUDE.md is picked up). */
export function clearCachedSteps(): void {
  cachedSteps = null
  cachedClaudeMdMtime = -1
  cachedIsDirEmpty = null
}

/**
 * Check if the cached steps are still valid.
 *
 * Compare CLAUDE.md mtime and root directory emptiness against the cached values.
 * If either has changed, the cache is stale. Directory emptiness is checked with
 * isDirEmptySync — a single call on just the root directory, not a recursive
 * walk — so it stays cheap. This is more reliable than directory mtime, which is
 * not guaranteed to update on all filesystems when files are added or removed.
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

  // Check if the root directory emptiness changed. This is a single
  // isDirEmptySync call on just the root directory — not a recursive walk
  // — so it stays cheap. This is more reliable than checking directory mtime,
  // which is not guaranteed to update on all filesystems when files are added
  // or removed (e.g., some Linux configurations).
  if (cachedIsDirEmpty !== null && cachedIsDirEmpty !== isDirEmptySync(cwd)) {
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
