/**
 * BUDDY experience points and evolution system.
 *
 * XP is earned through interactions and usage.
 * At certain levels, companions can evolve into new forms.
 */
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { getCompanion } from '../companion.js'
import type { Species } from '../types.js'

// ── XP / Level ────────────────────────────────────────────────────

const XP_PER_LEVEL = 100
const MAX_LEVEL = 50

export type BuddyState = {
  xp: number
  level: number
  evolutionStage: number // 0 = base, 1 = evolved, 2 = max evolved
  feedCount: number
  playCount: number
}

const DEFAULT_STATE: BuddyState = {
  xp: 0,
  level: 1,
  evolutionStage: 0,
  feedCount: 0,
  playCount: 0,
}

function getBuddyState(): BuddyState {
  return getGlobalConfig().buddyState ?? DEFAULT_STATE
}

function saveBuddyState(update: Partial<BuddyState>): BuddyState {
  const current = getBuddyState()
  const next = { ...current, ...update }
  saveGlobalConfig(cfg => ({ ...cfg, buddyState: next }))
  return next
}

export function getLevel(): number {
  return getBuddyState().level
}

export function getXp(): number {
  return getBuddyState().xp
}

export function getXpForNextLevel(): number {
  const state = getBuddyState()
  return state.level * XP_PER_LEVEL
}

export function getEvolutionStage(): number {
  return getBuddyState().evolutionStage
}

/**
 * Add XP and handle level-ups.
 * Returns array of events: 'level_up' | 'evolution' | null
 */
export function addXp(amount: number): Array<{ type: 'level_up' | 'evolution'; level?: number; stage?: number }> {
  const events: Array<{ type: 'level_up' | 'evolution'; level?: number; stage?: number }> = []
  let state = getBuddyState()
  let newXp = state.xp + amount

  while (newXp >= state.level * XP_PER_LEVEL && state.level < MAX_LEVEL) {
    newXp -= state.level * XP_PER_LEVEL
    state.level++
    events.push({ type: 'level_up', level: state.level })

    // Check evolution
    const newStage = getEvolutionForLevel(state.level, state.evolutionStage)
    if (newStage > state.evolutionStage) {
      state.evolutionStage = newStage
      events.push({ type: 'evolution', stage: newStage })
    }
  }

  state.xp = Math.min(newXp, MAX_LEVEL * XP_PER_LEVEL)
  state = saveBuddyState(state)
  return events
}

// ── Evolution Rules ────────────────────────────────────────────────

/**
 * Which species can evolve and at what levels.
 * Each entry: [baseSpecies, evolvedSpecies, maxEvolvedSpecies, levelRequired, maxLevelRequired]
 */
const EVOLUTIONS: Array<{
  base: Species
  evolved: Species
  maxEvolved: Species
  level: number
  maxLevel: number
}> = [
  // Duck → Goose → Phoenix-adjacent (stays goose as max)
  { base: 'duck' as Species, evolved: 'goose' as Species, maxEvolved: 'goose' as Species, level: 10, maxLevel: 25 },
  // Blob → Ghost → ? 
  { base: 'blob' as Species, evolved: 'ghost' as Species, maxEvolved: 'ghost' as Species, level: 10, maxLevel: 25 },
  // Cat → Chonk → ?
  { base: 'cat' as Species, evolved: 'chonk' as Species, maxEvolved: 'chonk' as Species, level: 12, maxLevel: 28 },
  // Dragon stays dragon (already peak)
  // Octopus → ? (stays octopus)
  // Turtle → Snail → ?
  { base: 'turtle' as Species, evolved: 'snail' as Species, maxEvolved: 'snail' as Species, level: 15, maxLevel: 30 },
  // Mushroom → ? (stays mushroom)
  // Rabbit stays rabbit
  // Owl stays owl
  // Penguin stays penguin
  // Cactus → ? (stays cactus)
  // Robot stays robot
  // Axolotl stays axolotl
  // Capybara stays capybara
]

export function getEvolutionForLevel(level: number, currentStage: number): number {
  const companion = getCompanion()
  if (!companion) return 0

  const rule = EVOLUTIONS.find(e => e.base === companion.species)
  if (!rule) return 0

  if (currentStage < 1 && level >= rule.level) return 1
  if (currentStage < 2 && level >= rule.maxLevel) return 2
  return currentStage
}

export function getEvolvedSpecies(species: Species, stage: number): Species {
  if (stage === 0) return species
  const rule = EVOLUTIONS.find(e => e.base === species)
  if (!rule) return species
  return stage >= 2 ? rule.maxEvolved : rule.evolved
}

// ── XP Sources ─────────────────────────────────────────────────────

/** XP awarded for various actions */
export const XP_REWARDS = {
  BUDDY_HATCH: 50,
  BUDDY_PET: 5,
  BUDDY_FEED: 15,
  BUDDY_PLAY: 20,
  COMMIT: 10,
  REVIEW: 25,
  PLUGIN_INSTALL: 30,
  SKILL_USE: 5,
  DAILY_LOGIN: 20,
  ACHIEVEMENT_UNLOCK: 100,
} as const

// ── Interaction counters ───────────────────────────────────────────

export function incrementFeed(): number {
  const state = getBuddyState()
  const count = state.feedCount + 1
  saveBuddyState({ feedCount: count })
  return count
}

export function incrementPlay(): number {
  const state = getBuddyState()
  const count = state.playCount + 1
  saveBuddyState({ playCount: count })
  return count
}

export function getInteractionCounts() {
  const state = getBuddyState()
  return { feed: state.feedCount, play: state.playCount }
}
