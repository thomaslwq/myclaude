import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { runMigrationSafe, runMigrationsSafe, type Migration, type MigrationFunction } from '../migrationRunner'

// Mock dependencies
const mockLogError = vi.fn()
const mockLogEvent = vi.fn()

vi.mock('../../utils/log.js', () => ({
  logError: (...args: any[]) => mockLogError(...args),
}))

vi.mock('../../services/analytics/index.js', () => ({
  logEvent: (...args: any[]) => mockLogEvent(...args),
}))

beforeEach(() => {
  mockLogError.mockClear()
  mockLogEvent.mockClear()
})

describe('runMigrationSafe', () => {
  it('should return success when migration runs without error', async () => {
    const migration = () => {
      // No-op migration
    }

    const result = await runMigrationSafe('testMigration', migration)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result.migrationName).toBe('testMigration')
    expect(mockLogError).not.toHaveBeenCalled()
    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it('should return failure and log error when migration throws', async () => {
    const errorMessage = 'Test error'
    const migration = () => {
      throw new Error(errorMessage)
    }

    const result = await runMigrationSafe('testMigration', migration)

    expect(result.success).toBe(false)
    expect(result.error).toBe(errorMessage)
    expect(result.migrationName).toBe('testMigration')
    expect(mockLogError).toHaveBeenCalled()
    expect(mockLogEvent).toHaveBeenCalledWith('tengu_migration_failed', {
      migration: 'testMigration',
      error: errorMessage,
    })
  })

  it('should handle non-Error throws', async () => {
    const errorMessage = 'Test error'
    const migration = () => {
      throw errorMessage
    }

    const result = await runMigrationSafe('testMigration', migration)

    expect(result.success).toBe(false)
    expect(result.error).toBe(errorMessage)
  })

  it('should handle async migrations', async () => {
    const runOrder: string[] = []
    const migration = async () => {
      runOrder.push('testMigration')
    }

    const result = await runMigrationSafe('testMigration', migration)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result.migrationName).toBe('testMigration')
    expect(runOrder).toEqual(['testMigration'])
    expect(mockLogError).not.toHaveBeenCalled()
    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it('should handle async migrations that throw', async () => {
    const errorMessage = 'Async error'
    const migration = async () => {
      throw new Error(errorMessage)
    }

    const result = await runMigrationSafe('testMigration', migration)

    expect(result.success).toBe(false)
    expect(result.error).toBe(errorMessage)
    expect(result.migrationName).toBe('testMigration')
    expect(mockLogError).toHaveBeenCalled()
    expect(mockLogEvent).toHaveBeenCalledWith('tengu_migration_failed', {
      migration: 'testMigration',
      error: errorMessage,
    })
  })
})

describe('runMigrationsSafe', () => {
  it('should run all migrations and return success for all', async () => {
    const migrations: Migration[] = [
      { name: 'migration1', migration: () => {} },
      { name: 'migration2', migration: () => {} },
      { name: 'migration3', migration: () => {} },
    ]

    const result = await runMigrationsSafe(migrations, [])

    expect(result.total).toBe(3)
    expect(result.successful).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.results).toHaveLength(3)
    result.results.forEach((r, i) => {
      expect(r.success).toBe(true)
      expect(r.migrationName).toBe(`migration${i + 1}`)
    })
  })

  it('should run all migrations and return failure for some', async () => {
    const migrations: Migration[] = [
      { name: 'migration1', migration: () => {} },
      { name: 'migration2', migration: () => {
        throw new Error('Failed')
      } },
      { name: 'migration3', migration: () => {} },
      { name: 'migration4', migration: () => {
        throw new Error('Another failure')
      } },
    ]

    const result = await runMigrationsSafe(migrations, [])

    expect(result.total).toBe(4)
    expect(result.successful).toBe(2)
    expect(result.failed).toBe(2)
    expect(result.results).toHaveLength(4)
    expect(result.results[0].success).toBe(true)
    expect(result.results[1].success).toBe(false)
    expect(result.results[2].success).toBe(true)
    expect(result.results[3].success).toBe(false)
  })

  it('should skip already completed migrations', async () => {
    const migrations: Migration[] = [
      { name: 'migration1', migration: () => {} },
      { name: 'migration2', migration: () => {} },
      { name: 'migration3', migration: () => {} },
    ]

    const result = await runMigrationsSafe(migrations, ['migration1'])

    expect(result.total).toBe(3)
    expect(result.successful).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.newlyCompleted).toEqual(['migration2', 'migration3'])
  })

  it('should handle async migrations', async () => {
    const runOrder: string[] = []
    const migrations: Migration[] = [
      { name: 'migration1', migration: () => { runOrder.push('migration1') } },
      { name: 'migration2', migration: async () => { runOrder.push('migration2') } },
    ]

    const result = await runMigrationsSafe(migrations, [])

    expect(runOrder).toEqual(['migration1', 'migration2'])
    expect(result.newlyCompleted).toEqual(['migration1', 'migration2'])
  })
})
