// Cloud-sync KV wrapper for /api/progress (ticket 86c9pkfyu).
//
// Why this module exists
// ----------------------
// /api/progress reads + writes a single JSON blob per device, keyed by
// `progress:<uuid>`. The actual KV client is `@upstash/redis` — Vercel KV
// is being deprecated under the Marketplace migration, and Upstash is the
// canonical replacement that the new Vercel "Storage" tab provisions.
// Both surface the same KV_REST_API_URL / KV_REST_API_TOKEN env-var pair,
// so `Redis.fromEnv()` works against either backing.
//
// Single-purpose, small surface
// -----------------------------
// `getProgress` and `setProgress` are the entire wire. The blob shape is
// { blob, lastModifiedISO } — the inner `blob` is opaque from this
// module's perspective (the browser hands us a JSON-serialisable
// `Progress` document; we round-trip it as-is). Validation that it's
// actually a Progress document lives at install-time on the browser side
// where `withDefaultedSkillLevels` + `isProgressV1` already run.
//
// Errors
// ------
// Any thrown failure (network, KV outage, invalid client config) is
// surfaced as a thrown error to the caller — `/api/progress.ts` maps
// that to a 502 response so the browser can fall back to local-only
// behaviour. Missing-key on read is NOT an error: returns `null`.
//
// .js extension on the import: required for Vercel's Node ESM runtime
// (see api/claude.ts HISTORY round 3 for the full rationale).

import { Redis } from '@upstash/redis'

/** The cloud envelope. Browser sends + receives this exact shape. */
export interface ProgressCloudRecord {
  /** Opaque progress JSON. The browser is responsible for validating it
   *  before installing locally (via `withDefaultedSkillLevels` +
   *  `isProgressV1` from the T1 read-path). */
  blob: unknown
  /** ISO 8601 wall-clock timestamp the browser stamped on the write.
   *  Used by the boot reconcile to pick the newer side. */
  lastModifiedISO: string
}

/** Build the canonical Redis key for a device's progress blob. */
export function buildProgressKey(deviceId: string): string {
  return `progress:${deviceId}`
}

/** Narrowed view of the Upstash client we actually use. Lets tests
 *  inject a stub without depending on the real SDK. */
export interface KvClient {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<unknown>
}

let cachedDefaultClient: Redis | null = null

/**
 * Resolve the default Upstash Redis client.
 *
 * `Redis.fromEnv()` reads `KV_REST_API_URL` + `KV_REST_API_TOKEN` (the
 * canonical Vercel-KV / Upstash names) at construction time. We cache
 * the instance at module scope so warm-container reuse doesn't pay
 * the construction cost on every request.
 *
 * Throws if env vars are missing — the caller (api/progress.ts) maps
 * that to a 500 `config-missing`.
 */
function defaultClient(): Redis {
  if (cachedDefaultClient !== null) return cachedDefaultClient
  cachedDefaultClient = Redis.fromEnv()
  return cachedDefaultClient
}

/**
 * Read a device's progress blob.
 *
 * Returns `null` if the device has never synced (no key in KV) — that's
 * the normal first-launch case for a fresh iPad.
 *
 * The Upstash REST SDK auto-deserialises JSON-shaped values it stored
 * via `set`, so a successful read returns the original
 * `ProgressCloudRecord` object directly. Defensive runtime shape check
 * still guards against shape drift (e.g. a value written by a future
 * schema and read by an older deploy).
 */
export async function getProgress(
  deviceId: string,
  client: KvClient = defaultClient(),
): Promise<ProgressCloudRecord | null> {
  const raw = await client.get(buildProgressKey(deviceId))
  if (raw === null || raw === undefined) return null
  if (!isProgressCloudRecord(raw)) {
    // Shape drift / corrupt entry. We treat it as "no record" and let
    // the next write overwrite — better than 500-ing the GET path.
    return null
  }
  return raw
}

/**
 * Write a device's progress blob. Last-write-wins: no compare-and-swap
 * (see Non-obvious findings — the cloud is the BACKUP, localStorage is
 * the source-of-truth, so concurrent writes can never produce a
 * worse-than-localStorage outcome).
 */
export async function setProgress(
  deviceId: string,
  record: ProgressCloudRecord,
  client: KvClient = defaultClient(),
): Promise<void> {
  await client.set(buildProgressKey(deviceId), record)
}

function isProgressCloudRecord(v: unknown): v is ProgressCloudRecord {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  if (typeof obj.lastModifiedISO !== 'string') return false
  if (obj.lastModifiedISO.length === 0) return false
  // `blob` is intentionally opaque — we don't validate its inner shape
  // here. The browser revalidates via `isProgressV1` post-fetch.
  if (!('blob' in obj)) return false
  return true
}

/**
 * Test-only — drop the cached client so a subsequent `defaultClient()`
 * re-reads env vars. Used by tests that mutate process.env between
 * cases.
 */
export function _resetDefaultClientForTests(): void {
  cachedDefaultClient = null
}
