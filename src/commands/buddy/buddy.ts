import type { LocalCommandCall } from '../../types/command.js'
import { getCompanion, companionUserId, roll } from '../../buddy/companion.js'
import { RARITY_STARS, RARITY_COLORS, type Species, SPECIES } from '../../buddy/types.js'
import { renderFace, renderSprite } from '../../buddy/sprites.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { getSettingSourceName } from '../../utils/settings/constants.js'

const SPECIES_NAMES: Record<Species, string> = {
  duck: '🦆 鸭子',
  goose: '🪿 鹅',
  blob: '🫧 果冻',
  cat: '🐱 猫',
  dragon: '🐉 龙',
  octopus: '🐙 章鱼',
  owl: '🦉 猫头鹰',
  penguin: '🐧 企鹅',
  turtle: '🐢 乌龟',
  snail: '🐌 蜗牛',
  ghost: '👻 幽灵',
  axolotl: '🦎 六角恐龙',
  capybara: '🦫 水豚',
  cactus: '🌵 仙人掌',
  robot: '🤖 机器人',
  rabbit: '🐰 兔子',
  mushroom: '🍄 蘑菇',
  chonk: '🐈 胖猫',
}

const HELP_TEXT = `Usage: /buddy <subcommand>

Subcommands:
  hatch              Hatch a new companion (AI generates name & personality)
  pet                Pet your companion (hearts animation)
  card               Show companion card with stats
  mute               Mute companion (hide from terminal)
  unmute             Unmute companion (show in terminal)

Examples:
  /buddy hatch       Hatch a new companion
  /buddy pet         Pet your companion
  /buddy card        View companion card
`

export const call: LocalCommandCall = async (args: string) => {
  const [subcommand] = args.trim().toLowerCase().split(/\s+/)

  switch (subcommand) {
    case 'hatch':
      return handleHatch()
    case 'pet':
      return handlePet()
    case 'card':
      return handleCard()
    case 'mute':
      return handleMute()
    case 'unmute':
      return handleUnmute()
    default:
      return { type: 'text', value: HELP_TEXT }
  }
}

function handleHatch(): { type: 'text'; value: string } {
  const existing = getGlobalConfig().companion
  if (existing) {
    const companion = getCompanion()
    if (companion) {
      return {
        type: 'text',
        value: `You already have a companion! ${companion.name} the ${companion.species} is already with you. Use /buddy card to see details.`,
      }
    }
  }

  // Generate initial companion data
  const userId = companionUserId()
  const { bones, inspirationSeed } = roll(userId)
  const speciesName = SPECIES_NAMES[bones.species] || bones.species
  const face = renderFace(bones)
  const rarityStars = RARITY_STARS[bones.rarity]
  const rarityColor = RARITY_COLORS[bones.rarity]
  const shiny = bones.shiny ? ' ✨ SHINY' : ''

  // Save minimal companion data to config
  saveGlobalConfig(current => ({
    ...current,
    companion: {
      name: speciesName,
      personality: 'curious',
      hatchedAt: Date.now(),
    },
  }))

  const result = [
    `🎉 A new companion has appeared!`,
    ``,
    `${face}`,
    ``,
    `Rarity: ${rarityStars} (${bones.rarity})${shiny}`,
    `Species: ${speciesName}`,
    `Eye: ${bones.eye}`,
    `Hat: ${bones.hat}`,
    ``,
    `You can interact with it using:`,
    `  /buddy pet     — pet your companion`,
    `  /buddy card    — view full stats`,
    `  /buddy mute    — hide companion`,
  ].join('\n')

  return { type: 'text', value: result }
}

function handlePet(): { type: 'text'; value: string } {
  const companion = getCompanion()
  if (!companion) {
    return {
      type: 'text',
      value: `You don't have a companion yet! Use /buddy hatch to get one.`,
    }
  }

  return {
    type: 'text',
    value: `You pet ${companion.name}! ${companion.name} seems happy. ${getPetReaction(companion.species)}`,
  }
}

function handleCard(): { type: 'text'; value: string } {
  const companion = getCompanion()
  if (!companion) {
    return {
      type: 'text',
      value: `You don't have a companion yet! Use /buddy hatch to get one.`,
    }
  }

  const face = renderFace(companion)
  const rarityStars = RARITY_STARS[companion.rarity]
  const rarityColor = RARITY_COLORS[companion.rarity]
  const shiny = companion.shiny ? ' ✨' : ''
  const speciesName = SPECIES_NAMES[companion.species] || companion.species

  const stats = Object.entries(companion.stats)
    .map(([name, value]) => `  ${name.padEnd(12)} ${'█'.repeat(Math.floor(value / 10))}${'░'.repeat(10 - Math.floor(value / 10))} ${value}`)
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
    speciesName,
    `Eye: ${companion.eye}  Hat: ${companion.hat}`,
    ``,
    `Stats:`,
    stats,
    ``,
    `Personality: ${companion.personality}`,
  ].join('\n')

  return { type: 'text', value: result }
}

function handleMute(): { type: 'text'; value: string } {
  saveGlobalConfig(current => ({
    ...current,
    companionMuted: true,
  }))
  return { type: 'text', value: 'Companion muted. Use /buddy unmute to show again.' }
}

function handleUnmute(): { type: 'text'; value: string } {
  saveGlobalConfig(current => ({
    ...current,
    companionMuted: false,
  }))
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
  }
  const pool = reactions[species] || ['Seems happy!']
  return pool[Math.floor(Math.random() * pool.length)]
}
