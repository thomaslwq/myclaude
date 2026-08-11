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
    if (nameToMigration.has(m.name)) {
      throw new Error(
        `Duplicate migration name '${m.name}'. Migration names must be unique.`,
      )
    }
    nameToMigration.set(m.name, m)
  }

  // Check for self-dependency
  for (const m of migrations) {
    if (m.dependsOn?.includes(m.name)) {
      throw new Error(
        `Self-dependency detected in migration '${m.name}'. ` +
        `A migration cannot depend on itself.`,
      )
    }
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

  // Build a set of all available migration names (including completed ones)
  const allMigrationNames = new Set(migrations.map(m => m.name))

  // Identify migrations that have missing dependencies (deps not in migration list and not completed)
  // and handle them gracefully: mark them as failed, but keep them in the migration list
  // so that topologicalSort doesn't throw and dependents can see them as failed.
  const missingDepMigrations: { migration: Migration; missingDeps: string[] }[] = []
  const missingDepNames = new Set<string>()

  for (const m of migrations) {
    const missingDeps: string[] = []
    if (m.dependsOn) {
      for (const dep of m.dependsOn) {
        if (!allMigrationNames.has(dep) && !completedSet.has(dep)) {
          missingDeps.push(dep)
        }
      }
    }
    if (missingDeps.length > 0) {
      missingDepMigrations.push({ migration: m, missingDeps })
      missingDepNames.add(m.name)
    }
  }

  // Build a migration list that is safe for topologicalSort:
  // - Keep all migrations (including those with missing deps) so dependency chains are intact
  // - For each migration, filter out:
  //   1. Missing dependencies (not in migration list, not completed)
  //   2. Already completed dependencies
  // This ensures topologicalSort won't throw on missing deps, and completed deps are ignored
  const sanitizedMigrations: Migration[] = migrations.map(m => {
    const sanitizedDeps = m.dependsOn?.filter(
      dep => allMigrationNames.has(dep) && !completedSet.has(dep)
    )
    return {
      ...m,
      dependsOn: sanitizedDeps && sanitizedDeps.length > 0 ? sanitizedDeps : undefined,
    }
  })

  // Topologically sort sanitized migrations
  let sortedMigrations: Migration[]
  try {
    sortedMigrations = topologicalSort(sanitizedMigrations)
  } catch (error) {
    // If sorting fails (circular dependency), mark all remaining migrations as failed
    const errorMessage = error instanceof Error ? error.message : String(error)
    const results: MigrationResult[] = migrations.map(m => {
      // Check if this migration was already handled as missing dependency
      const missingDep = missingDepMigrations.find(md => md.migration.name === m.name)
      if (missingDep) {
        return {
          success: false,
          error: `Missing dependency${missingDep.missingDeps.length > 1 ? 'ies' : ''}: ${missingDep.missingDeps.join(', ')}. ` +
            `Dependency must be included in the migration list or already completed.`,
          migrationName: m.name,
        }
      }
      return {
        success: false,
        error: errorMessage,
        migrationName: m.name,
      }
    })
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
  // Track which migrations have failed (including missing dependencies) so dependents can be skipped
  const failedMigrationNames = new Set<string>()

  // Handle migrations with missing dependencies first - they are marked as failed
  // and their name is added to the failed set so dependents can be skipped
  for (const { migration: m, missingDeps } of missingDepMigrations) {
    const errorMessage = `Missing dependency${missingDeps.length > 1 ? 'ies' : ''}: ${missingDeps.join(', ')}. ` +
      `Dependency must be included in the migration list or already completed.`
    results.push({
      success: false,
      error: errorMessage,
      migrationName: m.name,
    })
    failed++
    // Add to succeededSet? No - we want dependents to know this failed.
    // We track failed migrations separately so dependents can be skipped.
    failedMigrationNames.add(m.name)
  }

  for (const { name, migration, dependsOn } of sortedMigrations) {
    // Skip migrations already handled as missing dependency
    if (missingDepNames.has(name)) {
      continue
    }

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
    // Note: dependsOn may contain duplicates, but the check is idempotent (Set.has is O(1))
    let dependencyFailed = false
    let dependencyError = ''
    if (dependsOn) {
      for (const dep of dependsOn) {
        if (!succeededSet.has(dep) || failedMigrationNames.has(dep)) {
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
