import picomatch from 'picomatch'
import { getCwd } from './cwd.js'
import { getInitialSettings } from './settings/settings.js'

export type InstructionProfile = {
  name: string
  content: string
  condition?: string
}

/**
 * Reads the `instructionProfiles` setting and returns the profiles whose
 * condition matches the current working directory (issue #58).
 *
 * A profile without a `condition` always applies. With a `condition`, the
 * profile applies only when the normalized cwd matches the glob pattern
 * (picomatch, same engine used for CLAUDE.md path filtering).
 *
 * Profiles are returned in declaration order so callers can join them into
 * a stable, cache-friendly system prompt fragment.
 */
export function getMatchedInstructionProfiles(): InstructionProfile[] {
  const profiles = getInitialSettings().instructionProfiles
  if (!profiles || profiles.length === 0) {
    return []
  }

  const cwd = getCwd().replace(/\\/g, '/')
  const matched: InstructionProfile[] = []

  for (const profile of profiles) {
    const condition = profile.condition?.trim()
    if (!condition) {
      matched.push(profile)
      continue
    }
    try {
      if (picomatch.isMatch(cwd, condition)) {
        matched.push(profile)
      }
    } catch {
      // Invalid glob: treat as non-matching rather than crashing startup.
      // Matches claudemd.ts's tolerant pattern-expansion behavior.
    }
  }
  return matched
}

/**
 * Builds the system-prompt fragment for all matched profiles, or null when
 * none matched. Returns null (not empty string) so callers can skip the
 * injection entirely and keep the cache key stable.
 */
export function buildInstructionProfilesPrompt(): string | null {
  const matched = getMatchedInstructionProfiles()
  if (matched.length === 0) {
    return null
  }
  const sections = matched
    .map(profile => `## Instruction Profile: ${profile.name}\n\n${profile.content}`)
    .join('\n\n')
  return `The user has enabled the following custom instruction profiles:\n\n${sections}`
}
