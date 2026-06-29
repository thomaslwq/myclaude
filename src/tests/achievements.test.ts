/**
 * Tests for achievements storage and checker — Issue #14 (/achievements not working).
 *
 * TDD Red phase: these tests should reveal the bugs:
 * 1. checkOnDailyUse uses process.env (not persisted) instead of globalConfig
 * 2. Achievement checkers are never called from the app lifecycle
 */
import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'
import { join } from 'path'
import { mkdir, writeFile, unlink, rmdir } from 'fs/promises'
import { existsSync } from 'fs'

// ── Mock config ────────────────────────────────────────────────────
const testConfigDir = join(import.meta.dir, '..', '..', '.test-tmp', 'config')

// In-memory config store for testing
let configStore: Record<string, any> = {
  unlockedAchievements: [],
  achievementCounters: {},
}

// Mock the config module
mock.module(join(import.meta.dir, '../utils/config.js'), () => ({
  getGlobalConfig: () => ({ ...configStore }),
  saveGlobalConfig: (updater: any) => {
    if (typeof updater === 'function') {
      configStore = updater(configStore)
    } else {
      configStore = { ...configStore, ...updater }
    }
  },
}))

// ── Mock process.env to simulate a fresh session ───────────────────
const originalEnv = { ...process.env }

function resetEnv() {
  delete process.env.__ACHIEVEMENT_LAST_SEEN__
  delete process.env.__ACHIEVEMENT_PENDING__
}

beforeEach(() => {
  resetEnv()
  configStore = {
    unlockedAchievements: [],
    achievementCounters: {},
  }
})

afterEach(() => {
  resetEnv()
  configStore = {
    unlockedAchievements: [],
    achievementCounters: {},
  }
})

const STORAGE_PATH = join(import.meta.dir, '../achievements/storage.js')
const CHECKER_PATH = join(import.meta.dir, '../achievements/checker.js')

describe('achievements storage', () => {
  test('starts with no unlocked achievements', async () => {
    const { getUnlockedAchievements } = await import(STORAGE_PATH)
    const unlocked = getUnlockedAchievements()
    expect(unlocked.size).toBe(0)
  })

  test('unlockAchievement adds achievement and returns true', async () => {
    const { unlockAchievement, getUnlockedAchievements } = await import(STORAGE_PATH)
    const result = unlockAchievement('first_commit' as any)
    expect(result).toBe(true)

    const unlocked = getUnlockedAchievements()
    expect(unlocked.has('first_commit' as any)).toBe(true)
  })

  test('unlockAchievement returns false for already unlocked', async () => {
    const { unlockAchievement } = await import(STORAGE_PATH)
    unlockAchievement('first_commit' as any)
    const result = unlockAchievement('first_commit' as any)
    expect(result).toBe(false)
  })

  test('incrementCounter increases counter and returns new value', async () => {
    const { incrementCounter } = await import(STORAGE_PATH)
    const val1 = incrementCounter('test_counter')
    expect(val1).toBe(1)

    const val2 = incrementCounter('test_counter')
    expect(val2).toBe(2)
  })

  test('hasAchievement returns correct state', async () => {
    const { unlockAchievement, hasAchievement } = await import(STORAGE_PATH)
    expect(hasAchievement('first_commit' as any)).toBe(false)
    unlockAchievement('first_commit' as any)
    expect(hasAchievement('first_commit' as any)).toBe(true)
  })
})

describe('achievements checker — checkOnDailyUse', () => {
  test('increments daily streak on first call in fresh session', async () => {
    const { checkOnDailyUse } = await import(CHECKER_PATH)
    const { getCounter } = await import(STORAGE_PATH)

    // Fresh session — process.env has no __ACHIEVEMENT_LAST_SEEN__
    checkOnDailyUse()

    const streak = getCounter('daily_streak')
    expect(streak).toBeGreaterThanOrEqual(1)
  })

  test('lastSeenDate is now persisted in config, not process.env', async () => {
    // After the fix: clearing process.env should NOT reset the streak
    // because lastSeenDate lives in globalConfig now
    const { checkOnDailyUse } = await import(CHECKER_PATH)
    const { getCounter } = await import(STORAGE_PATH)

    // First "session"
    checkOnDailyUse()
    const streakAfterFirst = getCounter('daily_streak')

    // Simulate a new session — process.env is cleared, but config persists
    delete process.env.__ACHIEVEMENT_LAST_SEEN__

    // Same day, second "session" — should NOT increment because
    // lastSeenDate is persisted in globalConfig with today's date
    checkOnDailyUse()
    const streakAfterSecond = getCounter('daily_streak')

    // After the fix: streak should NOT have incremented
    expect(streakAfterSecond).toBe(streakAfterFirst)
  })
})

describe('achievements checker — wiring into app lifecycle', () => {
  test('checkOnCommit should be callable and unlock first_commit', async () => {
    const { checkOnCommit } = await import(CHECKER_PATH)
    const { getUnlockedAchievements } = await import(STORAGE_PATH)

    checkOnCommit()

    const unlocked = getUnlockedAchievements()
    expect(unlocked.has('first_commit' as any)).toBe(true)
  })

  test('checkOnReview should unlock first_review', async () => {
    const { checkOnReview } = await import(CHECKER_PATH)
    const { getUnlockedAchievements } = await import(STORAGE_PATH)

    checkOnReview()

    const unlocked = getUnlockedAchievements()
    expect(unlocked.has('first_review' as any)).toBe(true)
  })

  test('checkOnPluginInstall should unlock first_plugin', async () => {
    const { checkOnPluginInstall } = await import(CHECKER_PATH)
    const { getUnlockedAchievements } = await import(STORAGE_PATH)

    checkOnPluginInstall()

    const unlocked = getUnlockedAchievements()
    expect(unlocked.has('first_plugin' as any)).toBe(true)
  })

  test('checkOnSkillUse should unlock first_skill', async () => {
    const { checkOnSkillUse } = await import(CHECKER_PATH)
    const { getUnlockedAchievements } = await import(STORAGE_PATH)

    checkOnSkillUse()

    const unlocked = getUnlockedAchievements()
    expect(unlocked.has('first_skill' as any)).toBe(true)
  })

  test('checkOnMcpAdd should unlock mcp_added', async () => {
    const { checkOnMcpAdd } = await import(CHECKER_PATH)
    const { getUnlockedAchievements } = await import(STORAGE_PATH)

    checkOnMcpAdd()

    const unlocked = getUnlockedAchievements()
    expect(unlocked.has('mcp_added' as any)).toBe(true)
  })

  test('checkOnModelSwitch should unlock model_switched', async () => {
    const { checkOnModelSwitch } = await import(CHECKER_PATH)
    const { getUnlockedAchievements } = await import(STORAGE_PATH)

    checkOnModelSwitch()

    const unlocked = getUnlockedAchievements()
    expect(unlocked.has('model_switched' as any)).toBe(true)
  })

  test('checkOnConfigChange should unlock config_changed', async () => {
    const { checkOnConfigChange } = await import(CHECKER_PATH)
    const { getUnlockedAchievements } = await import(STORAGE_PATH)

    checkOnConfigChange()

    const unlocked = getUnlockedAchievements()
    expect(unlocked.has('config_changed' as any)).toBe(true)
  })
})
