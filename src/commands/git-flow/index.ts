import { execFileNoThrow } from '../../utils/execFileNoThrow.js'
import { gitExe } from '../../utils/git.js'
import type { Command } from '../../commands.js'
import type {
  LocalCommandCall,
  LocalCommandResult,
} from '../../types/command.js'

/**
 * Run a git command and return the result.
 */
async function runGit(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  const result = await execFileNoThrow(gitExe(), args, { preserveOutputOnError: false })
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim(), code: result.code }
}

/**
 * Get the current branch name.
 */
async function getCurrentBranch(): Promise<string> {
  const { stdout } = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'])
  return stdout
}

/**
 * Parse args in format "<name> [from-branch]".
 * Returns [name, fromBranch] where fromBranch defaults to 'main'.
 */
function parseNameAndFrom(
  args: string,
  defaultBranch: string,
): { name: string; from: string } {
  const parts = args.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return { name: '', from: defaultBranch }
  return { name: parts[0], from: parts[1] || defaultBranch }
}

// ── Individual call handlers ──

/** /new-feature <name> [from-branch] — default from main */
const newFeature: LocalCommandCall = async (args) => {
  const { name, from } = parseNameAndFrom(args, 'main')
  if (!name) {
    return { type: 'text', value: 'Usage: /new-feature <feature-name> [from-branch]\nExample: /new-feature user-auth' }
  }

  const branchName = `feature/${name}`
  const { code, stderr } = await runGit(['checkout', '-b', branchName, from])
  if (code !== 0) {
    return { type: 'text', value: `Error creating feature branch: ${stderr}` }
  }
  return { type: 'text', value: `✅ Created and switched to feature branch: ${branchName} (from ${from})\n\nRun /finish-feature when done to merge back.` }
}

/** /finish-feature [target-branch] — default merge to main */
const finishFeature: LocalCommandCall = async (args) => {
  const target = args.trim() || 'main'
  const current = await getCurrentBranch()
  if (!current.startsWith('feature/')) {
    return { type: 'text', value: `Error: Current branch "${current}" is not a feature branch.\nSwitch to a feature/ branch first.` }
  }

  const { stdout: status } = await runGit(['status', '--porcelain'])
  if (status) {
    return { type: 'text', value: `You have uncommitted changes on "${current}". Please commit or stash them first.\n\n${status}` }
  }

  const { code: checkoutCode, stderr: checkoutErr } = await runGit(['checkout', target])
  if (checkoutCode !== 0) return { type: 'text', value: `Error switching to ${target}: ${checkoutErr}` }

  const { code: mergeCode, stderr: mergeErr } = await runGit(['merge', '--no-ff', current])
  if (mergeCode !== 0) {
    await runGit(['checkout', current]).catch(() => {})
    return { type: 'text', value: `Merge conflict on ${target}! Resolve manually:\n  git merge --abort\n  git checkout ${current}\n\nError: ${mergeErr}` }
  }

  const { stdout: branchDeleted } = await runGit(['branch', '-d', current])
  return {
    type: 'text',
    value: `✅ Feature "${current}" merged into ${target} and deleted.\n${branchDeleted}`,
  }
}

/** /new-release <version> [from-branch] — default from main */
const newRelease: LocalCommandCall = async (args) => {
  const { name: version, from } = parseNameAndFrom(args, 'main')
  if (!version) {
    return { type: 'text', value: 'Usage: /new-release <version> [from-branch]\nExample: /new-release 1.2.0' }
  }

  const branchName = `release/${version}`
  const { code, stderr } = await runGit(['checkout', '-b', branchName, from])
  if (code !== 0) {
    return { type: 'text', value: `Error creating release branch: ${stderr}` }
  }
  return { type: 'text', value: `✅ Created and switched to release branch: ${branchName} (from ${from})\n\nRun /finish-release when ready to merge.` }
}

/** /finish-release — merges to main and develop, deletes branch */
const finishRelease: LocalCommandCall = async () => {
  const current = await getCurrentBranch()
  if (!current.startsWith('release/')) {
    return { type: 'text', value: `Error: Current branch "${current}" is not a release branch.\nSwitch to a release/ branch first.` }
  }

  const { stdout: status } = await runGit(['status', '--porcelain'])
  if (status) {
    return { type: 'text', value: `You have uncommitted changes on "${current}". Please commit or stash them first.\n\n${status}` }
  }

  let mergeMainOk = true
  let mergeDevelopOk = true
  let output = ''

  // Merge to main
  const { code: cm, stderr: cmErr } = await runGit(['checkout', 'main'])
  if (cm !== 0) return { type: 'text', value: `Error switching to main: ${cmErr}` }

  const { code: mm, stderr: mmErr } = await runGit(['merge', '--no-ff', current])
  if (mm !== 0) {
    mergeMainOk = false
    output += `❌ Merge conflict on main!\n${mmErr}\n`
    await runGit(['merge', '--abort']).catch(() => {})
  } else {
    output += '✅ Release merged into main.\n'
  }

  // Merge to develop
  const { code: cd, stderr: cdErr } = await runGit(['checkout', 'develop'])
  if (cd !== 0) return { type: 'text', value: `Error switching to develop: ${cdErr}` }

  const { code: md, stderr: mdErr } = await runGit(['merge', '--no-ff', current])
  if (md !== 0) {
    mergeDevelopOk = false
    output += `❌ Merge conflict on develop!\n${mdErr}\n`
    await runGit(['merge', '--abort']).catch(() => {})
  } else {
    output += '✅ Release merged into develop.\n'
  }

  if (mergeMainOk && mergeDevelopOk) {
    const { stdout: branchDeleted } = await runGit(['branch', '-d', current])
    output += `✅ Release branch "${current}" deleted.\n${branchDeleted}`
  } else {
    output += `\n⚠️  Resolve conflicts manually, then delete the branch:\n  git branch -d ${current}`
  }

  return { type: 'text', value: output }
}

/** /new-hotfix <name> [from-branch] — default from main */
const newHotfix: LocalCommandCall = async (args) => {
  const { name, from } = parseNameAndFrom(args, 'main')
  if (!name) {
    return { type: 'text', value: 'Usage: /new-hotfix <hotfix-name> [from-branch]\nExample: /new-hotfix security-patch-oauth' }
  }

  const branchName = `hotfix/${name}`
  const { code, stderr } = await runGit(['checkout', '-b', branchName, from])
  if (code !== 0) {
    return { type: 'text', value: `Error creating hotfix branch: ${stderr}` }
  }
  return { type: 'text', value: `✅ Created and switched to hotfix branch: ${branchName} (from ${from})\n\nRun /finish-hotfix when done.` }
}

/** /finish-hotfix — merges to main and develop (if exists), deletes branch */
const finishHotfix: LocalCommandCall = async () => {
  const current = await getCurrentBranch()
  if (!current.startsWith('hotfix/')) {
    return { type: 'text', value: `Error: Current branch "${current}" is not a hotfix branch.\nSwitch to a hotfix/ branch first.` }
  }

  const { stdout: status } = await runGit(['status', '--porcelain'])
  if (status) {
    return { type: 'text', value: `You have uncommitted changes on "${current}". Please commit or stash them first.\n\n${status}` }
  }

  let mergeMainOk = true
  let mergeDevelopOk = true
  let output = ''

  // Merge to main
  const { code: cm, stderr: cmErr } = await runGit(['checkout', 'main'])
  if (cm !== 0) return { type: 'text', value: `Error switching to main: ${cmErr}` }

  const { code: mm, stderr: mmErr } = await runGit(['merge', '--no-ff', current])
  if (mm !== 0) {
    mergeMainOk = false
    output += `❌ Merge conflict on main!\n${mmErr}\n`
    await runGit(['merge', '--abort']).catch(() => {})
  } else {
    output += '✅ Hotfix merged into main.\n'
  }

  // Try merging to develop
  const { code: cd } = await runGit(['checkout', 'develop'])
  if (cd === 0) {
    const { code: md, stderr: mdErr } = await runGit(['merge', '--no-ff', current])
    if (md !== 0) {
      mergeDevelopOk = false
      output += `❌ Merge conflict on develop!\n${mdErr}\n`
      await runGit(['merge', '--abort']).catch(() => {})
    } else {
      output += '✅ Hotfix merged into develop.\n'
    }
  } else {
    output += '⚠️  No "develop" branch found, skipping develop merge.\n'
    mergeDevelopOk = true
  }

  if (mergeMainOk && mergeDevelopOk) {
    const { stdout: branchDeleted } = await runGit(['branch', '-d', current])
    output += `✅ Hotfix branch "${current}" deleted.\n${branchDeleted}`
  } else {
    output += `\n⚠️  Resolve conflicts manually, then delete the branch:\n  git branch -d ${current}`
  }

  return { type: 'text', value: output }
}

// ── Command exports ──

const newFeatureCmd: Command = {
  type: 'local',
  name: 'new-feature',
  description: 'Create a feature branch from main (or specify a base)',
  argumentHint: '<feature-name> [from-branch]',
  supportsNonInteractive: true,
  load: async () => ({ call: newFeature }),
}

const finishFeatureCmd: Command = {
  type: 'local',
  name: 'finish-feature',
  description: 'Merge current feature branch back to main (or specify target)',
  argumentHint: '[target-branch]',
  supportsNonInteractive: true,
  load: async () => ({ call: finishFeature }),
}

const newReleaseCmd: Command = {
  type: 'local',
  name: 'new-release',
  description: 'Create a release branch from main (or specify a base)',
  argumentHint: '<version> [from-branch]',
  supportsNonInteractive: true,
  load: async () => ({ call: newRelease }),
}

const finishReleaseCmd: Command = {
  type: 'local',
  name: 'finish-release',
  description: 'Merge current release branch to main and develop',
  supportsNonInteractive: true,
  load: async () => ({ call: finishRelease }),
}

const newHotfixCmd: Command = {
  type: 'local',
  name: 'new-hotfix',
  description: 'Create a hotfix branch from main (or specify a base)',
  argumentHint: '<hotfix-name> [from-branch]',
  supportsNonInteractive: true,
  load: async () => ({ call: newHotfix }),
}

const finishHotfixCmd: Command = {
  type: 'local',
  name: 'finish-hotfix',
  description: 'Merge current hotfix branch to main and develop',
  supportsNonInteractive: true,
  load: async () => ({ call: finishHotfix }),
}

export {
  newFeatureCmd,
  finishFeatureCmd,
  newReleaseCmd,
  finishReleaseCmd,
  newHotfixCmd,
  finishHotfixCmd,
}
