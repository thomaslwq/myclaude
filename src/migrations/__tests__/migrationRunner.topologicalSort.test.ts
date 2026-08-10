import { describe, it, expect } from 'bun:test'
import { topologicalSort, type Migration } from '../migrationRunner'

// Helper to create a simple migration
const createMigration = (name: string, dependsOn?: string[]): Migration => ({
  name,
  migration: () => {},
  dependsOn,
})

describe('topologicalSort', () => {
  it('should sort migrations with simple dependencies', () => {
    const migrations: Migration[] = [
      createMigration('C', ['A', 'B']),
      createMigration('B', ['A']),
      createMigration('A'),
    ]

    const sorted = topologicalSort(migrations)
    const names = sorted.map(m => m.name)
    expect(names).toEqual(['A', 'B', 'C'])
  })

  it('should handle migrations with no dependencies', () => {
    const migrations: Migration[] = [
      createMigration('B'),
      createMigration('A'),
      createMigration('C'),
    ]

    const sorted = topologicalSort(migrations)
    const names = sorted.map(m => m.name)
    // Order should be deterministic but all should be present
    expect(names).toContain('A')
    expect(names).toContain('B')
    expect(names).toContain('C')
    // All should be present and no duplicates
    expect(names).toHaveLength(3)
    expect(new Set(names)).toHaveLength(3)
  })

  it('should throw on circular dependency', () => {
    const migrations: Migration[] = [
      createMigration('A', ['B']),
      createMigration('B', ['A']),
    ]

    expect(() => topologicalSort(migrations)).toThrow()
  })

  it('should throw on unknown dependency', () => {
    const migrations: Migration[] = [
      createMigration('A', ['B']),
    ]

    expect(() => topologicalSort(migrations)).toThrow()
  })

  it('should throw on duplicate migration names', () => {
    const migrations: Migration[] = [
      createMigration('A'),
      createMigration('A'),
    ]

    expect(() => topologicalSort(migrations)).toThrow(/duplicate/i)
  })

  it('should handle duplicate dependencies in dependsOn', () => {
    // This is the bug we're fixing
    const migrations: Migration[] = [
      createMigration('C', ['A', 'A']),
      createMigration('B', ['A']),
      createMigration('A'),
    ]

    const sorted = topologicalSort(migrations)
    const names = sorted.map(m => m.name)
    // All migrations should be present
    expect(names).toContain('A')
    expect(names).toContain('B')
    expect(names).toContain('C')
    // All should be present with no duplicates
    expect(names).toHaveLength(3)
    expect(new Set(names)).toHaveLength(3)
    // A should come before B and C (A has no deps, B and C both depend on A)
    const aIndex = names.indexOf('A')
    const bIndex = names.indexOf('B')
    const cIndex = names.indexOf('C')
    expect(aIndex).toBeLessThan(bIndex)
    expect(aIndex).toBeLessThan(cIndex)
  })

  it('should handle multiple duplicate dependencies', () => {
    const migrations: Migration[] = [
      createMigration('D', ['A', 'A', 'B', 'B']),
      createMigration('C', ['A', 'B']),
      createMigration('B', ['A']),
      createMigration('A'),
    ]

    const sorted = topologicalSort(migrations)
    const names = sorted.map(m => m.name)
    // All migrations should be present
    expect(names).toContain('A')
    expect(names).toContain('B')
    expect(names).toContain('C')
    expect(names).toContain('D')
    // All should be present with no duplicates
    expect(names).toHaveLength(4)
    expect(new Set(names)).toHaveLength(4)
    // A should come before B, C, D
    const aIndex = names.indexOf('A')
    const bIndex = names.indexOf('B')
    const cIndex = names.indexOf('C')
    const dIndex = names.indexOf('D')
    expect(aIndex).toBeLessThan(bIndex)
    expect(aIndex).toBeLessThan(cIndex)
    expect(aIndex).toBeLessThan(dIndex)
    // B should come before C and D (both depend on B)
    expect(bIndex).toBeLessThan(cIndex)
    expect(bIndex).toBeLessThan(dIndex)
  })

  it('should improve error message for unknown dependency', () => {
    const migrations: Migration[] = [
      createMigration('A', ['B']),
    ]

    expect(() => topologicalSort(migrations)).toThrow(
      /Unknown dependency 'B' in migration 'A'.*Dependency must be included in the migration list./
    )
  })

  it('should improve error message for circular dependency', () => {
    const migrations: Migration[] = [
      createMigration('A', ['B']),
      createMigration('B', ['A']),
    ]

    expect(() => topologicalSort(migrations)).toThrow(
      /Circular dependency detected.*/i
    )
  })

  it('should improve error message for duplicate names', () => {
    const migrations: Migration[] = [
      createMigration('A'),
      createMigration('A'),
    ]

    expect(() => topologicalSort(migrations)).toThrow(
      /Duplicate migration name 'A'.*Migration names must be unique./
    )
  })
})
