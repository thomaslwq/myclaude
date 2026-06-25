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

// ── Individual call handlers ──

/** /new-feature <name> */
const newFeature: LocalCommandCall = async (args) => {
  const name = args.trim()
  if (!name) {
    return { type: 'text', value: 'Usage: /new-feature <feature-name>\nExample: /new-feature user-auth' }
  }

  // Check develop branch exists
  const { code: developExists } = await execFileNoThrow(gitExe(), ['rev-parse', '--verify', 'develop'], { preserveOutputOnError: false })
  if (developExists !== 0) {
    return { type: 'text', value: 'Error: No "develop" branch found. Git Flow requires a "develop" branch.\nCreate one with: git branch develop main' }
  }

  const branchName = `feature/${name}`
  const { code, stderr } = await runGit(['checkout', '-b', branchName, 'develop'])
  if (code !== 0) {
    return { type: 'text', value: `Error creating feature branch: ${stderr}` }
  }
  return { type: 'text', value: `✅ Created and switched to feature branch: ${branchName}\n\nRun /finish-feature when done to merge back to develop.` }
}

/** /finish-feature */
const finishFeature: LocalCommandCall = async () => {
  const current = await getCurrentBranch()
  if (!current.startsWith('feature/')) {
    return { type: 'text', value: `Error: Current branch "${current}" is not a feature branch.\nSwitch to a feature/ branch first.` }
  }

  // Check for uncommitted changes
  const { stdout: status } = await runGit(['status', '--porcelain'])
  if (status) {
    return { type: 'text', value: `You have uncommitted changes on "${current}". Please commit or stash them first.\n\n${status}` }
  }

  // Merge back to develop
  const { code: checkoutCode, stderr: checkoutErr } = await runGit(['checkout', 'develop'])
  if (checkoutCode !== 0) return { type: 'text', value: `Error switching to develop: ${checkoutErr}` }

  const { code: mergeCode, stderr: mergeErr } = await runGit(['merge', '--no-ff', current])
  if (mergeCode !== 0) {
    // Try to abort and go back
    await runGit(['checkout', current]).catch(() => {})
    return { type: 'text', value: `Merge conflict! Resolve manually:\n  git merge --abort\n  git checkout ${current}\n\nError: ${mergeErr}` }
  }

  const { stdout: branchDeleted } = await runGit(['branch', '-d', current])
  return {
    type: 'text',
    value: `✅ Feature "${current}" merged into develop and deleted.\n${branchDeleted}`,
  }
}

/** /new-release <version> */
const newRelease: LocalCommandCall = async (args) => {
  const version = args.trim()
  if (!version) {
    return { type: 'text', value: 'Usage: /new-release <version>\nExample: /new-release 1.2.0' }
  }

  const branchName = `release/${version}`
  const { code, stderr } = await runGit(['checkout', '-b', branchName, 'develop'])
  if (code !== 0) {
    return { type: 'text', value: `Error creating release branch: ${stderr}` }
  }
  return { type: 'text', value: `✅ Created and switched to release branch: ${branchName}\n\nRun /finish-release when ready to merge to main and develop.` }
}

/** /finish-release */
const finishRelease: LocalCommandCall = async () => {
  const current = await getCurrentBranch()
  if (!current.startsWith('release/')) {
    return { type: 'text', value: `Error: Current branch "${current}" is not a release branch.\nSwitch to a release/ branch first.` }
  }

  const { stdout: status } = await runGit(['status', '--porcelain'])
  if (status) {
    return { type: 'text', value: `You have uncommitted changes on "${current}". Please commit or stash them first.\n\n${status}` }
  }

  // Merge to main
  let mergeMainOk = true
  let mergeDevelopOk = true
  let output = ''

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

/** /new-hotfix <name> */
const newHotfix: LocalCommandCall = async (args) => {
  const name = args.trim()
  if (!name) {
    return { type: 'text', value: 'Usage: /new-hotfix <hotfix-name>\nExample: /new-hotfix security-patch-oauth' }
  }

  const branchName = `hotfix/${name}`
  const { code, stderr } = await runGit(['checkout', '-b', branchName, 'main'])
  if (code !== 0) {
    return { type: 'text', value: `Error creating hotfix branch: ${stderr}` }
  }
  return { type: 'text', value: `✅ Created and switched to hotfix branch: ${branchName}\n\nRun /finish-hotfix when done to merge back to main and develop.` }
}

/** /finish-hotfix */
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
  description: 'Start a new feature branch from develop',
  argumentHint: '<feature-name>',
  supportsNonInteractive: true,
  load: async () => ({ call: newFeature }),
}

const finishFeatureCmd: Command = {
  type: 'local',
  name: 'finish-feature',
  description: 'Merge current feature branch back to develop',
  supportsNonInteractive: true,
  load: async () => ({ call: finishFeature }),
}

const newReleaseCmd: Command = {
  type: 'local',
  name: 'new-release',
  description: 'Start a new release branch from develop',
  argumentHint: '<version>',
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
  description: 'Start a new hotfix branch from main',
  argumentHint: '<hotfix-name>',
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
