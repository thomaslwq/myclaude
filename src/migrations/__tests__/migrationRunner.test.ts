import { describe, it, expect, vi } from 'bun:test'
import { runMigrationSafe, runMigrationsSafe, type MigrationFunction } from '../migrationRunner'

// Mock dependencies
const mockLogError = vi.fn()
const mockLogEvent = vi.fn()

vi.mock('../../utils/log.js', () => ({
  logError: (...args: any[]) => mockLogError(...args),
}))

vi.mock('../../services/analytics/index.js', () => ({
  logEvent: (...args: any[]) => mockLogEvent(...args),
}))

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
  it('should run all migrations and return success for all', () => {
    const migrations: Array<{ name: string; migration: MigrationFunction }> = [
      { name: 'migration1', migration: () => {} },
      { name: 'migration2', migration: () => {} },
      { name: 'migration3', migration: () => {} },
    ]

    const result = runMigrationsSafe(migrations)

    expect(result.total).toBe(3)
    expect(result.successful).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.results).toHaveLength(3)
    result.results.forEach((r, i) => {
      expect(r.success).toBe(true)
      expect(r.migrationName).toBe(`migration${i + 1}`)
    })
  })

  it('should run all migrations and return failure for some', () => {
    const migrations: Array<{ name: string; migration: MigrationFunction }> = [
      { name: 'migration1', migration: () => {} },
      { name: 'migration2', migration: () => {
        throw new Error('Failed')
      } },
      { name: 'migration3', migration: () => {} },
      { name: 'migration4', migration: () => {
        throw new Error('Another failure')
      } },
    ]

    const result = runMigrationsSafe(migrations)

    expect(result.total).toBe(4)
    expect(result.successful).toBe(2)
    expect(result.failed).toBe(2)
    expect(result.results).toHaveLength(4)
    expect(result.results[0].success).toBe(true)
    expect(result.results[1].success).toBe(false)
    expect(result.results[1].error).toBe('Failed')
    expect(result.results[2].success).toBe(true)
    expect(result.results[3].success).toBe(false)
    expect(result.results[3].error).toBe('Another failure')
  })

  it('should continue running migrations after a failure', () => {
    let callCount = 0
    const migrations: Array<{ name: string; migration: MigrationFunction }> = [
      { name: 'migration1', migration: () => {
        callCount++
        throw new Error('Failed')
      } },
      { name: 'migration2', migration: () => {
        callCount++
        // Should still run
      } },
      { name: 'migration3', migration: () => {
        callCount++
        // Should still run
      } },
    ]

    const result = runMigrationsSafe(migrations)

    expect(callCount).toBe(3) // All migrations should be called
    expect(result.successful).toBe(2)
    expect(result.failed).toBe(1)
  })
})
