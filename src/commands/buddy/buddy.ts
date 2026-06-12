import type { LocalCommandCall } from '../../types/command.js'
import { getCompanion, companionUserId, roll } from '../../buddy/companion.js'
import { RARITY_STARS, RARITY_COLORS, type Species, SPECIES } from '../../buddy/types.js'
import { renderFace, renderSprite } from '../../buddy/sprites.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { checkOnBuddyHatch, checkOnBuddyPet } from '../../achievements/checker.js'
import { addXp, getLevel, getXp, getXpForNextLevel, getEvolutionStage, getEvolvedSpecies, XP_REWARDS, incrementFeed, incrementPlay, getInteractionCounts } from '../../buddy/evolution/index.js'
import { trackBuddyInteraction } from '../../stats/usageStats.js'

const SPECIES_NAMES: Record<Species, string> = {
  duck: '🦆 Duck', goose: '🪿 Goose', blob: '🫧 Blob', cat: '🐱 Cat',
  dragon: '🐉 Dragon', octopus: '🐙 Octopus', owl: '🦉 Owl',
  penguin: '🐧 Penguin', turtle: '🐢 Turtle', snail: '🐌 Snail',
  ghost: '👻 Ghost', axolotl: '🦎 Axolotl', capybara: '🦫 Capybara',
  cactus: '🌵 Cactus', robot: '🤖 Robot', rabbit: '🐰 Rabbit',
  mushroom: '🍄 Mushroom', chonk: '🐈 Chonk',
}

const HELP_TEXT = `Usage: /buddy <subcommand>

Subcommands:
  hatch              Hatch a new companion
  pet                Pet your companion (+5 XP)
  feed               Feed your companion (+15 XP)
  play               Play with your companion (+20 XP)
  card               Show companion card with stats and level
  mute               Mute companion
  unmute             Unmute companion

XP is earned through interactions. Level up to evolve your companion!`

export const call: LocalCommandCall = async (args: string) => {
  const [subcommand] = args.trim().toLowerCase().split(/\s+/)

  switch (subcommand) {
    case 'hatch': return handleHatch()
    case 'pet': return handlePet()
    case 'feed': return handleFeed()
    case 'play': return handlePlay()
    case 'card': return handleCard()
    case 'mute': return handleMute()
    case 'unmute': return handleUnmute()
    default: return { type: 'text', value: HELP_TEXT }
  }
}

function getXpBar(current: number, needed: number): string {
  const filled = Math.floor((current / needed) * 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

function formatXpEvents(events: Array<{ type: string; level?: number; stage?: number }>): string[] {
  const msgs: string[] = []
  for (const e of events) {
    if (e.type === 'level_up') {
      msgs.push(`\n  ⬆️ Level up! You are now level ${e.level}!`)
    }
    if (e.type === 'evolution') {
      msgs.push(`\n  ✨ Your companion evolved to stage ${e.stage}!`)
    }
  }
  return msgs
}

function handleHatch() {
  const existing = getGlobalConfig().companion
  if (existing && getCompanion()) {
    return { type: 'text', value: 'You already have a companion! Use /buddy card to see details.' }
  }

  const userId = companionUserId()
  const { bones, inspirationSeed } = roll(userId)
  const face = renderFace(bones)
  const rarityStars = RARITY_STARS[bones.rarity]
  const shiny = bones.shiny ? ' ✨ SHINY' : ''
  const speciesName = SPECIES_NAMES[bones.species] || bones.species

  saveGlobalConfig(current => ({
    ...current,
    companion: { name: speciesName, personality: 'curious', hatchedAt: Date.now() },
  }))

  // Award hatch XP
  const events = addXp(XP_REWARDS.BUDDY_HATCH)
  trackBuddyInteraction()

  const xpMsgs = formatXpEvents(events)
  checkOnBuddyHatch()

  const result = [
    `🎉 A new companion has appeared!`,
    ``,
    `${face}`,
    ``,
    `Rarity: ${rarityStars} (${bones.rarity})${shiny}`,
    `Species: ${speciesName}`,
    `Eye: ${bones.eye}  Hat: ${bones.hat}`,
    `+${XP_REWARDS.BUDDY_HATCH} XP for hatching!`,
    ...xpMsgs,
    ``,
    `You can interact with it using:`,
    `  /buddy pet     — pet (+5 XP)`,
    `  /buddy feed    — feed (+15 XP)`,
    `  /buddy play    — play (+20 XP)`,
    `  /buddy card    — view stats & level`,
    `  /buddy mute    — hide companion`,
  ].join('\n')

  return { type: 'text', value: result }
}

function handlePet() {
  const companion = getCompanion()
  if (!companion) return { type: 'text', value: `You don't have a companion yet! Use /buddy hatch to get one.` }

  const events = addXp(XP_REWARDS.BUDDY_PET)
  trackBuddyInteraction()
  checkOnBuddyPet()

  const xpMsgs = formatXpEvents(events)
  const reaction = getPetReaction(companion.species)

  return {
    type: 'text',
    value: [
      `You pet ${companion.name}! ${companion.name} seems happy. ${reaction}`,
      `+${XP_REWARDS.BUDDY_PET} XP`,
      ...xpMsgs,
    ].join('\n'),
  }
}

function handleFeed() {
  const companion = getCompanion()
  if (!companion) return { type: 'text', value: `You don't have a companion yet! Use /buddy hatch to get one.` }

  const count = incrementFeed()
  const events = addXp(XP_REWARDS.BUDDY_FEED)
  trackBuddyInteraction()

  const xpMsgs = formatXpEvents(events)
  const foods = ['a juicy berry 🫐', 'a tiny cookie 🍪', 'some fresh grass 🌿', 'a glowing snack ✨', 'a warm bowl of soup 🥣']
  const food = foods[count % foods.length]

  return {
    type: 'text',
    value: [
      `You feed ${companion.name} ${food}. Yum!`,
      `+${XP_REWARDS.BUDDY_FEED} XP`,
      ...xpMsgs,
    ].join('\n'),
  }
}

function handlePlay() {
  const companion = getCompanion()
  if (!companion) return { type: 'text', value: `You don't have a companion yet! Use /buddy hatch to get one.` }

  const count = incrementPlay()
  const events = addXp(XP_REWARDS.BUDDY_PLAY)
  trackBuddyInteraction()

  const xpMsgs = formatXpEvents(events)
  const games = ['hide and seek 🙈', 'tag 🏃', 'puzzle 🧩', 'fetch 🎾', 'a dance-off 💃']
  const game = games[count % games.length]

  return {
    type: 'text',
    value: [
      `You play ${game} with ${companion.name}! So much fun!`,
      `+${XP_REWARDS.BUDDY_PLAY} XP`,
      ...xpMsgs,
    ].join('\n'),
  }
}

function handleCard() {
  const companion = getCompanion()
  if (!companion) return { type: 'text', value: `You don't have a companion yet! Use /buddy hatch to get one.` }

  const face = renderFace(companion)
  const rarityStars = RARITY_STARS[companion.rarity]
  const shiny = companion.shiny ? ' ✨' : ''
  const speciesName = SPECIES_NAMES[companion.species] || companion.species
  const level = getLevel()
  const xp = getXp()
  const xpNext = getXpForNextLevel()
  const stage = getEvolutionStage()
  const evolvedSpecies = stage > 0 ? getEvolvedSpecies(companion.species, stage) : null
  const xpBar = getXpBar(xp, xpNext)

  const stats = Object.entries(companion.stats)
    .map(([name, value]) =>
      `  ${name.padEnd(12)} ${'█'.repeat(Math.floor(value / 10))}${'░'.repeat(10 - Math.floor(value / 10))} ${value}`
    )
    .join('\n')

  const result = [
    `╔══════════════════════════╗`,
    `║     Companion Card       ║`,
    `╚══════════════════════════╝`,
    ``,
    `${face}`,
    ``,
    `${companion.name}`,
    `${rarityStars} ${companion.rarity}${shiny}`,
    evolvedSpecies ? `Evolved: ${speciesName} → ${evolvedSpecies}` : speciesName,
    `Eye: ${companion.eye}  Hat: ${companion.hat}`,
    ``,
    `Level ${level}  ${xpBar}  ${xp}/${xpNext} XP`,
    ``,
    `Stats:`,
    stats,
    ``,
    `Personality: ${companion.personality}`,
  ].join('\n')

  return { type: 'text', value: result }
}

function handleMute() {
  saveGlobalConfig(current => ({ ...current, companionMuted: true }))
  return { type: 'text', value: 'Companion muted. Use /buddy unmute to show again.' }
}

function handleUnmute() {
  saveGlobalConfig(current => ({ ...current, companionMuted: false }))
  return { type: 'text', value: 'Companion unmuted! Your buddy is back.' }
}

function getPetReaction(species: string): string {
  const reactions: Record<string, string[]> = {
    duck: ['Quack! 🦆', 'Happy waddling!'],
    cat: ['Purr... 🐱', 'Content meowing.'],
    dragon: ['A tiny puff of smoke! 🐉'],
    octopus: ['Tentacles wiggle happily! 🐙'],
    robot: ['Beep boop! 🤖'],
    ghost: ['A warm flicker... 👻'],
    goose: ['Honk! 🪿', 'Proud hiss.'],
    penguin: ['Happy waddle! 🐧'],
    axolotl: ['Gills flutter! 🦎'],
    capybara: ['Chill nod. 🦫'],
    rabbit: ['Nose twitches! 🐰'],
    turtle: ['Slow blink. 🐢'],
  }
  const pool = reactions[species] || ['Seems happy!']
  return pool[Math.floor(Math.random() * pool.length)]
}
