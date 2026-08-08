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
  it('should return success when migration runs without error', () => {
    const migration = () => {
      // No-op migration
    }

    const result = runMigrationSafe('testMigration', migration)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result.migrationName).toBe('testMigration')
    expect(mockLogError).not.toHaveBeenCalled()
    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it('should return failure and log error when migration throws', () => {
    const errorMessage = 'Test error'
    const migration = () => {
      throw new Error(errorMessage)
    }

    const result = runMigrationSafe('testMigration', migration)

    expect(result.success).toBe(false)
    expect(result.error).toBe(errorMessage)
    expect(result.migrationName).toBe('testMigration')
    expect(mockLogError).toHaveBeenCalled()
    expect(mockLogEvent).toHaveBeenCalledWith('tengu_migration_failed', {
      migration: 'testMigration',
      error: errorMessage,
    })
  })

  it('should handle non-Error throws', () => {
    const errorMessage = 'Test error'
    const migration = () => {
      throw errorMessage
    }

    const result = runMigrationSafe('testMigration', migration)

    expect(result.success).toBe(false)
    expect(result.error).toBe(errorMessage)
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
    expect(mockLogError).toHaveBeenCalledTimes(2)
    expect(mockLogEvent).toHaveBeenCalledTimes(2)
  })

  it('should continue running migrations after a failure', async () => {
    let callCount = 0
    const migrations: Migration[] = [
      { name: 'migration1', migration: () => {
        callCount++
        throw new Error('Failed')
      } },
      { name: 'migration2', migration: () => {
        callCount++
      } },
      { name: 'migration3', migration: () => {
        callCount++
      } },
    ]

    const result = await runMigrationsSafe(migrations, [])

    expect(callCount).toBe(3)
    expect(result.successful).toBe(2)
    expect(result.failed).toBe(1)
  })

  it('should skip already completed migrations', async () => {
    const completedMigrations = ['migration1', 'migration3']
    const runOrder: string[] = []
    const migrations: Migration[] = [
      { name: 'migration1', migration: () => { runOrder.push('migration1') } },
      { name: 'migration2', migration: () => { runOrder.push('migration2') } },
      { name: 'migration3', migration: () => { runOrder.push('migration3') } },
    ]

    const result = await runMigrationsSafe(migrations, completedMigrations)

    expect(runOrder).toEqual(['migration2'])
    expect(result.total).toBe(3)
    expect(result.successful).toBe(1)
    expect(result.skipped).toBe(2)
    expect(result.results[0].skipped).toBe(true)
    expect(result.results[1].success).toBe(true)
    expect(result.results[2].skipped).toBe(true)
  })

  it('should run migrations in dependency order', async () => {
    const runOrder: string[] = []
    const migrations: Migration[] = [
      { name: 'migration3', migration: () => { runOrder.push('migration3') }, dependsOn: ['migration1', 'migration2'] },
      { name: 'migration1', migration: () => { runOrder.push('migration1') } },
      { name: 'migration2', migration: () => { runOrder.push('migration2') }, dependsOn: ['migration1'] },
    ]

    const result = await runMigrationsSafe(migrations, [])

    expect(runOrder).toEqual(['migration1', 'migration2', 'migration3'])
    expect(result.successful).toBe(3)
  })

  it('should fail with circular dependency error', async () => {
    const migrations: Migration[] = [
      { name: 'migration1', migration: () => {}, dependsOn: ['migration2'] },
      { name: 'migration2', migration: () => {}, dependsOn: ['migration1'] },
    ]

    const result = await runMigrationsSafe(migrations, [])

    expect(result.failed).toBe(2)
    expect(result.results[0].success).toBe(false)
    expect(result.results[0].error).toContain('Circular dependency')
  })

  it('should fail with missing dependency error', async () => {
    const migrations: Migration[] = [
      { name: 'migration1', migration: () => {}, dependsOn: ['nonexistent'] },
    ]

    const result = await runMigrationsSafe(migrations, [])

    expect(result.failed).toBe(1)
    expect(result.results[0].success).toBe(false)
    expect(result.results[0].error).toContain('Unknown dependency')
  })

  it('should not re-run migrations that have already completed', async () => {
    const runOrder: string[] = []
    const completedMigrations = ['migration1']
    const migrations: Migration[] = [
      { name: 'migration1', migration: () => { runOrder.push('migration1') } },
      { name: 'migration2', migration: () => { runOrder.push('migration2') }, dependsOn: ['migration1'] },
    ]

    const result = await runMigrationsSafe(migrations, completedMigrations)

    expect(runOrder).toEqual(['migration2'])
    expect(result.successful).toBe(1)
    expect(result.skipped).toBe(1)
  })

  it('should not run a migration if its dependency failed', async () => {
    const runOrder: string[] = []
    const migrations: Migration[] = [
      { name: 'migration1', migration: () => { throw new Error('Failed') } },
      { name: 'migration2', migration: () => { runOrder.push('migration2') }, dependsOn: ['migration1'] },
    ]

    const result = await runMigrationsSafe(migrations, [])

    expect(runOrder).toEqual([])
    expect(result.results[0].success).toBe(false)
    expect(result.results[1].success).toBe(false)
    expect(result.results[1].error).toContain('Dependency migration1 failed')
  })

  it('should report newly completed migrations', async () => {
    const migrations: Migration[] = [
      { name: 'migration1', migration: () => {} },
      { name: 'migration2', migration: () => {} },
    ]

    const result = await runMigrationsSafe(migrations, [])

    expect(result.newlyCompleted).toEqual(['migration1', 'migration2'])
  })

  it('should not include skipped or failed migrations in newlyCompleted', async () => {
    const migrations: Migration[] = [
      { name: 'migration1', migration: () => {} },
      { name: 'migration2', migration: () => { throw new Error('Failed') } },
    ]

    const result = await runMigrationsSafe(migrations, [])

    expect(result.newlyCompleted).toEqual(['migration1'])
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
