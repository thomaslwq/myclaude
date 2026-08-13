import { describe, it, expect } from 'bun:test'
import { topologicalSort, type Migration } from '../migrationRunner'

// Helper to create a simple migration
const createMigration = (name: string, dependsOn?: string[]): Migration => ({
  name,
  migration: () => {},
  dependsOn,
})

describe('topologicalSort', () => {
  it('should throw on self-dependency', () => {
    const migrations: Migration[] = [
      createMigration('A', ['A']),
    ]

    expect(() => topologicalSort(migrations)).toThrow()
  })

  it('should throw with clear error message for self-dependency', () => {
    const migrations: Migration[] = [
      createMigration('A', ['A']),
    ]

    expect(() => topologicalSort(migrations)).toThrow(/self-dependency/i)
  })

  it('should throw on indirect self-dependency through a cycle', () => {
    const migrations: Migration[] = [
      createMigration('A', ['B']),
      createMigration('B', ['A']),
    ]

    expect(() => topologicalSort(migrations)).toThrow(/self-dependency/i)
  })

  it('should throw with clear error message for self-dependency in complex graph', () => {
    const migrations: Migration[] = [
      createMigration('A', ['B']),
      createMigration('B', ['A']),
      createMigration('C', ['A']),
      createMigration('D', ['C', 'D']), // D depends on itself
    ]

    expect(() => topologicalSort(migrations)).toThrow(/self-dependency/i)
  })
})
