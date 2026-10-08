/**
 * Schema migration framework.
 *
 * v1 is the current and only schema. `migrate` exists so that v2+ has a
 * place to land without rewriting the adapter. Each step takes the
 * previous shape (typed as `unknown`) and returns the next; failed
 * migrations return `null`, which the adapter treats as corrupt data.
 */

import { isProgressV1, readSchemaVersion } from './guards'
import type { Progress } from './types'
import { CURRENT_SCHEMA_VERSION } from './types'

/**
 * Step from version N to N+1. Return null on unrecoverable input.
 * Add new entries to `STEPS` in order when bumping the schema.
 */
type MigrationStep = (input: unknown) => unknown | null

const STEPS: Record<number, MigrationStep> = {
  // Example for the future:
  // 1: (input) => migrateV1ToV2(input),
}

/**
 * Run any required migrations, then validate against the current shape.
 * Returns `null` when input cannot be brought up to the current version.
 *
 * v1 = identity. The function shape is the contract; v2 plugs in here.
 */
export function migrate(oldData: unknown): Progress | null {
  let version = readSchemaVersion(oldData)
  if (version === null) return null

  let data: unknown = oldData

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = STEPS[version]
    if (!step) return null
    const next = step(data)
    if (next === null || next === undefined) return null
    data = next
    const nextVersion = readSchemaVersion(data)
    if (nextVersion === null || nextVersion <= version) return null
    version = nextVersion
  }

  // Future-version data: refuse rather than guess.
  if (version > CURRENT_SCHEMA_VERSION) return null

  return isProgressV1(data) ? data : null
}
