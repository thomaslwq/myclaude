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
    // B should come before C and D
    expect(bIndex).toBeLessThan(cIndex)
    expect(bIndex).toBeLessThan(dIndex)
  })

  it('should improve error message for circular dependency', () => {
    const migrations: Migration[] = [
      createMigration('A', ['B']),
      createMigration('B', ['C']),
      createMigration('C', ['A']),
    ]

    try {
      topologicalSort(migrations)
      expect.fail('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      const message = error.message
      // Error message should mention the involved migrations
      expect(message).toContain('A')
      expect(message).toContain('B')
      expect(message).toContain('C')
      // Error message should mention 'Circular dependency detected'
      expect(message).toContain('Circular dependency detected')
    }
  })

  it('should improve error message for circular dependency with more migrations', () => {
    const migrations: Migration[] = [
      createMigration('A', ['B']),
      createMigration('B', ['C']),
      createMigration('C', ['D']),
      createMigration('D', ['A']),
    ]

    try {
      topologicalSort(migrations)
      expect.fail('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      const message = error.message
      expect(message).toContain('A')
      expect(message).toContain('B')
      expect(message).toContain('C')
      expect(message).toContain('D')
    }
  })

  it('should handle complex dependency graph', () => {
    const migrations: Migration[] = [
      createMigration('E', ['C', 'D']),
      createMigration('D', ['B']),
      createMigration('C', ['A']),
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
    expect(names).toContain('E')
    expect(names).toHaveLength(5)
    expect(new Set(names)).toHaveLength(5)
    // A should come before B and C
    const aIndex = names.indexOf('A')
    const bIndex = names.indexOf('B')
    const cIndex = names.indexOf('C')
    const dIndex = names.indexOf('D')
    const eIndex = names.indexOf('E')
    expect(aIndex).toBeLessThan(bIndex)
    expect(aIndex).toBeLessThan(cIndex)
    // B should come before D
    expect(bIndex).toBeLessThan(dIndex)
    // C should come before E
    expect(cIndex).toBeLessThan(eIndex)
    // D should come before E
    expect(dIndex).toBeLessThan(eIndex)
  })

  it('should handle multiple independent chains', () => {
    const migrations: Migration[] = [
      createMigration('D', ['B']),
      createMigration('C', ['A']),
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
    expect(names).toHaveLength(4)
    expect(new Set(names)).toHaveLength(4)
    // A should come before B and C
    const aIndex = names.indexOf('A')
    const bIndex = names.indexOf('B')
    const cIndex = names.indexOf('C')
    const dIndex = names.indexOf('D')
    expect(aIndex).toBeLessThan(bIndex)
    expect(aIndex).toBeLessThan(cIndex)
    // B should come before D
    expect(bIndex).toBeLessThan(dIndex)
  })
})
