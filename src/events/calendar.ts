/**
 * Event & easter egg system — seasonal events, birthdays, milestones.
 * Triggers special animations and messages on matching dates.
 */
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'

export interface CalendarEvent {
  id: string
  name: string
  emoji: string
  message: string
  /** Month (1-12) */
  month: number
  /** Day (1-31) */
  day: number
  /** Optional: only trigger in this year range */
  yearStart?: number
  yearEnd?: number
}

const EVENTS: CalendarEvent[] = [
  { id: 'new_year', name: 'New Year', emoji: '🎆', message: 'Happy New Year! 🎆 May your code compile on the first try!', month: 1, day: 1 },
  { id: 'valentine', name: 'Valentine\'s Day', emoji: '💝', message: 'Happy Valentine\'s Day! 💝 Your companion sends you love!', month: 2, day: 14 },
  { id: 'pi_day', name: 'Pi Day', emoji: '🥧', message: 'Happy Pi Day! 3.14159... π is infinitely delicious!', month: 3, day: 14 },
  { id: 'april_fools', name: 'April Fools', emoji: '🎭', message: 'April Fools! Your code looks perfect today... just kidding! 🎭', month: 4, day: 1 },
  { id: 'earth_day', name: 'Earth Day', emoji: '🌍', message: 'Happy Earth Day! 🌍 Plant a tree, write green code.', month: 4, day: 22 },
  { id: 'star_wars', name: 'May the 4th', emoji: '🚀', message: 'May the 4th be with you! Use the Source, Luke! 🚀', month: 5, day: 4 },
  { id: 'summer_start', name: 'Summer Solstice', emoji: '☀️', message: 'Longest day of the year! ☀️ Time for some summer coding.', month: 6, day: 21 },
  { id: 'halloween', name: 'Halloween', emoji: '🎃', message: 'Trick or treat! 🎃 Your companion is wearing a tiny costume!', month: 10, day: 31 },
  { id: 'programmers_day', name: 'Programmer\'s Day', emoji: '💻', message: 'Happy Programmer\'s Day! (Day 256 of the year) 💻', month: 9, day: 13 },
  { id: 'thanksgiving', name: 'Thanksgiving', emoji: '🦃', message: 'Happy Thanksgiving! 🦃 Thankful for clean code and good compilers.', month: 11, day: 28 },
  { id: 'christmas', name: 'Christmas', emoji: '🎄', message: 'Merry Christmas! 🎄 Your buddy is waiting under the terminal tree!', month: 12, day: 25 },
  { id: 'new_year_eve', name: 'New Year\'s Eve', emoji: '🎉', message: 'Almost there! 🎉 One last commit before the new year!', month: 12, day: 31 },
  { id: 'bun_day', name: 'Bun Birthday', emoji: '🥟', message: 'Happy Bun Birthday! The fastest runtime deserves celebration!', month: 7, day: 13 },
  { id: 'retro_days', name: 'Retro Computing Day', emoji: '🖥️', message: 'Retro Computing Day! Remember when 64KB was plenty? 🖥️', month: 12, day: 3 },
]

export function getTodayEvent(): CalendarEvent | null {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()

  for (const event of EVENTS) {
    if (event.month === month && event.day === day) {
      // Check year range if specified
      if (event.yearStart && now.getFullYear() < event.yearStart) continue
      if (event.yearEnd && now.getFullYear() > event.yearEnd) continue
      return event
    }
  }

  return null
}

/** Easter egg: special messages for user milestones. */
export function getMilestoneEgg(type: 'first_hatch' | 'first_commit' | 'level_10' | 'level_50' | 'achievement_all'): string | null {
  const eggs: Record<string, string> = {
    first_hatch: '🥚 The egg cracks open... a tiny face peeks out at you! Welcome to the family!',
    first_commit: '📝 Your first AI-generated commit! History in the making. Your buddy applauds! 👏',
    level_10: '🌟 Your buddy radiates a warm glow! Something magical is happening...',
    level_50: '👑 MAX LEVEL! Your companion has reached its final form! A legendary bond!',
    achievement_all: '🏆 ALL ACHIEVEMENTS UNLOCKED! You are the ultimate myclaude master!',
  }

  const shown = new Set(getGlobalConfig().shownEasterEggs ?? [])
  if (shown.has(type)) return null

  saveGlobalConfig(cfg => ({
    ...cfg,
    shownEasterEggs: [...(cfg.shownEasterEggs ?? []), type],
  }))

  return eggs[type] ?? null
}

/**
 * Get a special companion reaction for today's event.
 */
export function getEventReaction(): string | null {
  const event = getTodayEvent()
  if (!event) return null
  return `${event.emoji} ${event.message}`
}
