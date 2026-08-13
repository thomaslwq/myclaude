import { join } from 'path'
import {
  getCurrentProjectConfig,
  saveCurrentProjectConfig,
} from './utils/config.js'
import { getCwd } from './utils/cwd.js'
import { isDirEmptySync } from './utils/file.js'
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

// All cache state is stored in a single object so that updates are atomic.
// A concurrent call that reads the cache mid-update will either see the old
// complete object or the new complete object — never a partially-updated one.
let cache: {
  steps: Step[]
  timestamp: number
  claudeMdMtime: number | null
  isWorkspaceDirEmpty: boolean
} | null = null

/** Clear the steps cache (called after /init so the new CLAUDE.md is picked up). */
export function clearCachedSteps(): void {
  cache = null
}

/**
 * Check if the cached steps are still valid.
 *
 * Uses a time-based cache (TTL) to avoid filesystem I/O on every prompt,
 * plus a cheap CLAUDE.md mtime comparison so the user manually creating or
 * editing CLAUDE.md is picked up immediately. The cache is considered valid
 * if it exists, is less than CACHE_TTL_MS old, and CLAUDE.md's mtime has not
 * changed since it was cached.
 */
function isCacheValid(cached: NonNullable<typeof cache>): boolean {
  // Check if the cache has expired (older than CACHE_TTL_MS)
  // Use performance.now() for a monotonic clock that is not affected by
  // system clock adjustments (e.g. NTP sync, daylight saving time).
  const now = performance.now()
  if (now - cached.timestamp > CACHE_TTL_MS) {
    return false
  }

  // Check if CLAUDE.md mtime has changed (manual creation/editing)
  const cwd = getCwd()
  const fs = getFsImplementation()
  const hasClaudeMd = fs.existsSync(join(cwd, 'CLAUDE.md'))
  if (hasClaudeMd) {
    try {
      const currentMtime = fs.statSync(join(cwd, 'CLAUDE.md'))?.mtimeMs ?? null
      if (currentMtime !== cached.claudeMdMtime) {
        return false
      }
    } catch {
      // If we can't stat CLAUDE.md, treat it as if it doesn't exist
      return false
    }
  } else if (cached.claudeMdMtime !== null) {
    // CLAUDE.md was deleted
    return false
  }

  // Check if directory emptiness has changed (files added/removed)
  let currentIsWorkspaceDirEmpty: boolean
  try {
    currentIsWorkspaceDirEmpty = isDirEmptySync(cwd)
  } catch {
    // If we can't check directory emptiness, treat workspace as not empty
    // to avoid incorrectly marking onboarding as complete
    currentIsWorkspaceDirEmpty = false
  }
  if (currentIsWorkspaceDirEmpty !== cached.isWorkspaceDirEmpty) {
    return false
  }

  return true
}

export function getSteps(): Step[] {
  // Fast path: return the cached steps if they're still valid.
  if (cache && isCacheValid(cache)) {
    return cache.steps
  }

  // Cache is invalid (or empty) — build a fresh cache.
  const cwd = getCwd()
  const fs = getFsImplementation()

  let hasClaudeMd: boolean
  let isWorkspaceDirEmpty: boolean
  let claudeMdMtime: number | null = null

  try {
    hasClaudeMd = fs.existsSync(join(cwd, 'CLAUDE.md'))
  } catch {
    // If we can't check for CLAUDE.md, treat it as not existing
    hasClaudeMd = false
  }

  try {
    isWorkspaceDirEmpty = isDirEmptySync(cwd)
  } catch {
    // If we can't check directory emptiness, treat workspace as not empty
    // to avoid incorrectly marking onboarding as complete
    isWorkspaceDirEmpty = false
  }

  if (hasClaudeMd) {
    try {
      claudeMdMtime = fs.statSync(join(cwd, 'CLAUDE.md'))?.mtimeMs ?? null
    } catch {
      // If we can't stat CLAUDE.md, treat it as if it doesn't exist
      hasClaudeMd = false
    }
  }

  const steps: Step[] = [
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

  // Build the complete cache object first, then assign it in one step.
  // This makes the cache update atomic — a concurrent reader will never
  // observe a partially-updated cache (e.g. new steps with old timestamps).
  const newCache = {
    steps,
    timestamp: performance.now(),
    claudeMdMtime,
    isWorkspaceDirEmpty,
  }
  cache = newCache

  return steps
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
