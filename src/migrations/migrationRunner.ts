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
}

/**
 * Type for migration functions.
 * Migrations should be idempotent and safe to run multiple times.
 */
export type MigrationFunction = () => void

/**
 * Runs a migration with error handling.
 * Logs errors but does not throw, allowing subsequent migrations to run.
 */
export function runMigrationSafe(
  name: string,
  migration: MigrationFunction,
): MigrationResult {
  try {
    migration()
    return { success: true, migrationName: name }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logError(new Error(`Migration '${name}' failed: ${errorMessage}`))
    logEvent('tengu_migration_failed', { migration: name, error: errorMessage })
    return {
      success: false,
      error: errorMessage,
      migrationName: name,
    }
  }
}

/**
 * Runs multiple migrations in sequence with error handling.
 * Failed migrations are logged but do not prevent subsequent migrations from running.
 */
export function runMigrationsSafe(
  migrations: Array<{ name: string; migration: MigrationFunction }>,
): {
  total: number
  successful: number
  failed: number
  results: MigrationResult[]
} {
  const results: MigrationResult[] = []
  let successful = 0
  let failed = 0

  for (const { name, migration } of migrations) {
    const result = runMigrationSafe(name, migration)
    results.push(result)
    if (result.success) {
      successful++
    } else {
      failed++
    }
  }

  return {
    total: migrations.length,
    successful,
    failed,
    results,
  }
}
