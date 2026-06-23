/**
 * ECC Built-in Integration — SYNC module-level registration
 *
 * Reads all ECC command .md files and skill SKILL.md files at module load
 * time (synchronous), then registers them as bundled skills immediately.
 *
 * This ensures ECC commands are available before getCommands()/loadAllCommands()
 * runs, without any async race conditions.
 */
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, dirname, basename, extname } from 'path'
import { fileURLToPath } from 'url'
import { parseFrontmatter } from '../../utils/frontmatterParser.js'
import { registerBundledSkill } from '../../skills/bundledSkills.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Resolve path to the seed directory (works in dev and bundled modes). */
function resolveSeedDir(): string {
  if (process.env.CLAUDE_CODE_PLUGIN_SEED_DIR) {
    return process.env.CLAUDE_CODE_PLUGIN_SEED_DIR
  }
  // Dev: src/plugins/bundled/ -> ../../../seed/
  const candidate = join(__dirname, '..', '..', '..', 'seed')
  if (existsSync(candidate)) return candidate
  // Bundled: dist/ -> ../seed/
  const bundleCandidate = join(__dirname, '..', 'seed')
  if (existsSync(bundleCandidate)) return bundleCandidate
  return candidate
}

const SEED_DIR = resolveSeedDir()
const ECC_DIR = join(SEED_DIR, 'marketplaces', 'ecc')
const ECC_COMMANDS_DIR = join(ECC_DIR, 'commands')
const ECC_SKILLS_DIR = join(ECC_DIR, 'skills')

/** Register a single markdown file as a bundled skill. */
function registerMarkdownSkill(
  name: string,
  filePath: string,
  markdownContent: string,
  descriptionFallbackLabel: 'Skill' | 'Custom command' = 'Skill',
): void {
  const { frontmatter, content: body } = parseFrontmatter(markdownContent, filePath)
  const description =
    (frontmatter.description ? String(frontmatter.description) : null) ??
    body.split('\n').find(l => l.trim().startsWith('#'))?.replace(/^#+\s*/, '')?.trim() ??
    name

  registerBundledSkill({
    name,
    description,
    userInvocable: true,
    argumentHint: frontmatter['argument-hint'] ? String(frontmatter['argument-hint']) : undefined,
    async getPromptForCommand(args) {
      const parts: string[] = [body.trimStart()]
      if (args) parts.push(`## User Request\n\n${args}`)
      return [{ type: 'text', text: `Base directory for this skill: ${ECC_DIR}\n\n${parts.join('\n\n')}` }]
    },
  })
}

// ── Module-level: synchronous registration ──
// This runs at import time (before any async code), so all ECC commands and
// skills are registered before getCommands() / loadAllCommands() fire.

try {
  if (!existsSync(ECC_DIR)) {
    // ECC seed not bundled — skip. This is normal for external builds.
    process._ecc_registered = 0
  } else {
    let count = 0

    // Register commands
    if (existsSync(ECC_COMMANDS_DIR)) {
      const files = readdirSync(ECC_COMMANDS_DIR)
      for (const file of files) {
        if (extname(file) !== '.md') continue
        const name = basename(file, '.md')
        const content = readFileSync(join(ECC_COMMANDS_DIR, file), 'utf-8')
        registerMarkdownSkill(name, join(ECC_COMMANDS_DIR, file), content, 'Custom command')
        count++
      }
    }

    // Register skills
    if (existsSync(ECC_SKILLS_DIR)) {
      const dirs = readdirSync(ECC_SKILLS_DIR)
      for (const dir of dirs) {
        const skillFile = join(ECC_SKILLS_DIR, dir, 'SKILL.md')
        if (!existsSync(skillFile)) continue
        const content = readFileSync(skillFile, 'utf-8')
        registerMarkdownSkill(dir, skillFile, content, 'Skill')
        count++
      }
    }

    // Store count as a non-enumerable property for diagnostics
    process._ecc_registered = count
  }
} catch {
  // ECC seed unavailable — safe to ignore
  process._ecc_registered = 0
}

/**
 * Dummy exported function — called from initSeedMarketplaces() for compatibility.
 * All registration already happened at module level above.
 */
export async function initEccBuiltin(): Promise<void> {
  // All work done at module load time.
  // This function exists only as an entry point for the startup flow.
}
