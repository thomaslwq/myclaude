import { describe, it, expect, beforeEach, vi } from 'bun:test'
import { runMigrationsSafe, type Migration, type MigrationFunction } from '../migrationRunner'

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

function resultByName(results: any[], name: string) {
  return results.find(r => r.migrationName === name)
}

describe('runMigrationsSafe - missing dependency handling', () => {
  it('should skip migration with missing dependency and allow others to proceed', async () => {
    const migrations: Migration[] = [
      { name: 'migration1', migration: () => {} },
      { name: 'migration2', dependsOn: ['nonExistentMigration'], migration: () => {} },
      { name: 'migration3', migration: () => {} },
      { name: 'migration4', dependsOn: ['migration1'], migration: () => {} },
    ]

    const result = await runMigrationsSafe(migrations, [])

    expect(result.total).toBe(4)
    // migration1, migration3, migration4 succeed; migration2 fails on missing dep
    expect(result.successful).toBe(3)
    expect(result.failed).toBe(1)
    expect(result.results).toHaveLength(4)
    expect(resultByName(result.results, 'migration1').success).toBe(true)
    expect(resultByName(result.results, 'migration2').success).toBe(false)
    expect(resultByName(result.results, 'migration2').error).toContain('nonExistentMigration')
    expect(resultByName(result.results, 'migration3').success).toBe(true)
    expect(resultByName(result.results, 'migration4').success).toBe(true)
  })

  it('should mark dependent migrations as failed when their dependency is missing', async () => {
    const migrations: Migration[] = [
      { name: 'migration1', migration: () => {} },
      { name: 'migration2', dependsOn: ['nonExistent'], migration: () => {} },
      { name: 'migration3', dependsOn: ['migration2'], migration: () => {} },
    ]

    const result = await runMigrationsSafe(migrations, [])

    expect(result.total).toBe(3)
    expect(result.successful).toBe(1) // migration1
    expect(result.failed).toBe(2) // migration2 (missing dep), migration3 (dep failed)
    expect(resultByName(result.results, 'migration1').success).toBe(true)
    expect(resultByName(result.results, 'migration2').success).toBe(false)
    expect(resultByName(result.results, 'migration3').success).toBe(false)
    expect(resultByName(result.results, 'migration3').error).toContain('Dependency migration2 failed or was skipped')
  })

  it('should handle missing dependency when it is already completed', async () => {
    const migrations: Migration[] = [
      { name: 'migration1', migration: () => {} },
      { name: 'migration2', dependsOn: ['removedMigration'], migration: () => {} },
      { name: 'migration3', dependsOn: ['migration1'], migration: () => {} },
    ]

    // 'removedMigration' is in completedMigrationNames, so it should be treated as satisfied
    const result = await runMigrationsSafe(migrations, ['removedMigration'])

    expect(result.total).toBe(3)
    expect(result.successful).toBe(3) // all succeed because removedMigration is completed
    expect(result.failed).toBe(0)
    expect(result.results[0].success).toBe(true)
    expect(result.results[1].success).toBe(true)
    expect(result.results[2].success).toBe(true)
  })

  it('should allow migrations to proceed independently when one has a missing dependency', async () => {
    const runOrder: string[] = []
    const migrations: Migration[] = [
      { name: 'migration1', migration: () => { runOrder.push('migration1') } },
      { name: 'migration2', dependsOn: ['nonExistent'], migration: () => { runOrder.push('migration2') } },
      { name: 'migration3', migration: () => { runOrder.push('migration3') } },
    ]

    const result = await runMigrationsSafe(migrations, [])

    expect(result.total).toBe(3)
    expect(result.successful).toBe(2) // migration1, migration3
    expect(result.failed).toBe(1) // migration2
    expect(runOrder).toContain('migration1')
    expect(runOrder).toContain('migration3')
    expect(runOrder).not.toContain('migration2')
  })

  it('should not fail all migrations when a missing dependency exists', async () => {
    const migrations: Migration[] = [
      { name: 'migration1', dependsOn: ['missingOne'], migration: () => {} },
      { name: 'migration2', migration: () => {} },
      { name: 'migration3', migration: () => {} },
    ]

    const result = await runMigrationsSafe(migrations, [])

    expect(result.total).toBe(3)
    expect(result.successful).toBe(2) // migration2, migration3
    expect(result.failed).toBe(1) // migration1
  })
})