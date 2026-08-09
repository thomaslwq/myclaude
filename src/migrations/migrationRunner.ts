import { logError } from '../utils/log.js'
import { logEvent } from '../services/analytics/index.js'

/**
 * Result of a migration run.
 */
export interface MigrationResult {
  /** Whether the migration was successful */
  success: boolean
  /** Error message if the migration failed */
  error?: string
  /** Name of the migration that failed */
  migrationName?: string
  /** Whether the migration was skipped (already completed or dependency failed) */
  skipped?: boolean
}

/**
 * Type for migration functions.
 * Migrations should be idempotent and safe to run multiple times.
 */
export type MigrationFunction = () => void | Promise<void>

/**
 * A migration with optional dependency declarations.
 *
 * `dependsOn` lists the names of migrations that must run (and succeed)
 * before this migration. The runner will topologically sort migrations
 * so that dependencies execute first.
 */
export interface Migration {
  name: string
  migration: MigrationFunction
  /** Names of migrations that must complete successfully before this one runs */
  dependsOn?: string[]
}

/**
 * Topologically sort migrations based on their dependency declarations.
 * Throws if a circular dependency is detected.
 */
export function topologicalSort(migrations: Migration[]): Migration[] {
  const nameToMigration = new Map<string, Migration>()
  for (const m of migrations) {
    nameToMigration.set(m.name, m)
  }

  // Validate all dependencies exist and deduplicate them
  const dependsOnMap = new Map<string, Set<string>>()
  for (const m of migrations) {
    if (m.dependsOn) {
      const deps = new Set<string>()
      for (const dep of m.dependsOn) {
        if (!nameToMigration.has(dep)) {
          throw new Error(
            `Unknown dependency '${dep}' in migration '${m.name}'. ` +
            `Dependency must be included in the migration list.`,
          )
        }
        deps.add(dep)
      }
      dependsOnMap.set(m.name, deps)
    }
  }

  // Kahn's algorithm for topological sort
  // Build adjacency and in-degree maps
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const m of migrations) {
    inDegree.set(m.name, 0)
    adjacency.set(m.name, [])
  }

  for (const m of migrations) {
    const deps = dependsOnMap.get(m.name)
    if (deps) {
      for (const dep of deps) {
        // dep must run before m
        adjacency.get(dep)!.push(m.name)
        inDegree.set(m.name, (inDegree.get(m.name) || 0) + 1)
      }
    }
  }

  // Start with migrations that have no dependencies
  const queue: string[] = []
  for (const m of migrations) {
    if (inDegree.get(m.name) === 0) {
      queue.push(m.name)
    }
  }

  const sorted: Migration[] = []
  let queueIndex = 0
  while (queueIndex < queue.length) {
    const name = queue[queueIndex]!
    queueIndex++
    const migration = nameToMigration.get(name)!
    sorted.push(migration)

    for (const neighbour of adjacency.get(name) || []) {
      const newDegree = (inDegree.get(neighbour) || 1) - 1
      inDegree.set(neighbour, newDegree)
      if (newDegree === 0) {
        queue.push(neighbour)
      }
    }
  }

  if (sorted.length !== migrations.length) {
    // Find the migrations involved in the cycle
    const unsorted = new Set(migrations.map(m => m.name))
    for (const name of sorted) {
      unsorted.delete(name)
    }
    const cycleNames = Array.from(unsorted).join(', ')
    throw new Error(
      `Circular dependency detected in migrations: ${cycleNames}. ` +
      `Each migration must have a valid dependency chain.`,
    )
  }

  return sorted
}

/**
 * Runs multiple migrations in sequence with dependency ordering and idempotency.
 *
 * - Already completed migrations (listed in `completedMigrationNames`) are skipped.
 * - Migrations are topologically sorted based on their `dependsOn` declarations.
 * - If a dependency fails, dependent migrations are skipped with an error message.
 * - Failed migrations are logged but do not prevent subsequent independent migrations.
 * - The result includes `newlyCompleted` - the list of migrations that finished
 *   successfully in this run, which callers can persist to track progress.
 */
export async function runMigrationsSafe(
  migrations: Migration[],
  completedMigrationNames: string[],
): Promise<{
  total: number
  successful: number
  failed: number
  skipped: number
  results: MigrationResult[]
  newlyCompleted: string[]
}> {
  const completedSet = new Set(completedMigrationNames)

  // Topologically sort migrations
  let sortedMigrations: Migration[]
  try {
    sortedMigrations = topologicalSort(migrations)
  } catch (error) {
    // If sorting fails (circular dep or missing dep), mark all migrations as failed
    const errorMessage = error instanceof Error ? error.message : String(error)
    const results: MigrationResult[] = migrations.map(m => ({
      success: false,
      error: errorMessage,
      migrationName: m.name,
    }))
    return {
      total: migrations.length,
      successful: 0,
      failed: migrations.length,
      skipped: 0,
      results,
      newlyCompleted: [],
    }
  }

  const results: MigrationResult[] = []
  let successful = 0
  let failed = 0
  let skipped = 0
  const newlyCompleted: string[] = []

  // Track which dependencies have succeeded (subset of completedSet + newly completed)
  const succeededSet = new Set(completedSet)

  for (const { name, migration, dependsOn } of sortedMigrations) {
    // Check if already completed
    if (completedSet.has(name)) {
      results.push({
        success: true,
        migrationName: name,
        skipped: true,
      })
      skipped++
      continue
    }

    // Check if dependencies are satisfied
    let dependencyFailed = false
    let dependencyError = ''
    if (dependsOn) {
      for (const dep of dependsOn) {
        if (!succeededSet.has(dep)) {
          dependencyFailed = true
          dependencyError = `Dependency ${dep} failed or was skipped`
          break
        }
      }
    }

    if (dependencyFailed) {
      results.push({
        success: false,
        error: dependencyError,
        migrationName: name,
      })
      failed++
      continue
    }

    // Run the migration
    try {
      const result = migration()
      await Promise.resolve(result)
      results.push({ success: true, migrationName: name })
      successful++
      newlyCompleted.push(name)
      succeededSet.add(name)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logError(new Error(`Migration '${name}' failed: ${errorMessage}`))
      logEvent('tengu_migration_failed', { migration: name, error: errorMessage })
      results.push({
        success: false,
        error: errorMessage,
        migrationName: name,
      })
      failed++
    }
  }

  return {
    total: migrations.length,
    successful,
    failed,
    skipped,
    results,
    newlyCompleted,
  }
}
