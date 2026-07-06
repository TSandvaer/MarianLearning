/**
 * Cloud-sync browser helpers (ticket 86c9pkfyu).
 *
 * Pure helpers around `/api/progress`. Owned by the Progress module
 * because the wire shape carries the on-disk Progress blob — keeping
 * the network layer next to the data layer makes the storage path
 * (`storage.ts`) and the cloud path (this module) read together.
 *
 * Three public callables:
 *
 * 1. `pushProgressToCloud(deviceId, progress, opts?)`
 *    Fire-and-forget POST. Resolves to `'sent' | 'failed' | 'skipped'`
 *    so callers that want to log can. NEVER throws — that's the
 *    contract progressHistory.ts depends on (mid-session-end is not the
 *    moment to surface a network error to Marian).
 *
 * 2. `fetchProgressFromCloud(deviceId, opts?)`
 *    GET with a 3 s timeout. Returns `{ kind: 'found', blob, lastModifiedISO }`
 *    on 200, `{ kind: 'not-found' }` on 404 (first-launch / no record),
 *    or `{ kind: 'error', reason }` on any failure (network, auth,
 *    timeout, malformed response). NEVER throws.
 *
 * 3. `reconcileWithCloud(deviceId, currentProgress, opts?)`
 *    Boot-time reconcile. Compares the cloud's `lastModifiedISO` to
 *    `currentProgress.profile.lastPlayedISO`. If cloud is newer, runs
 *    the cloud blob through `withDefaultedSkillLevels` (T1) + the
 *    strict guard, installs to localStorage, and returns the new
 *    progress. If local is newer, pushes local to cloud. Returns a
 *    structured result so App.tsx can re-render with the freshest
 *    state.
 *
 * Source-of-truth invariant
 * -------------------------
 * localStorage is authoritative. Cloud is a backup. A failed cloud op
 * NEVER blocks Marian — every error path either logs a warn and
 * returns, or returns a structured result that App.tsx surfaces as
 * "no-op proceed-with-local."
 *
 * Auth
 * ----
 * `VITE_PROGRESS_API_SECRET` ships in the bundle. Read at module
 * scope so a missing value is caught early. If the value is empty, ALL
 * cloud ops short-circuit to the no-op success path so the app
 * continues to function locally with no network noise.
 */

import { LETTER_SOUNDS_VOWELS } from './defaults'
import { isProgressV1 } from './guards'
import { inferLifetimeFirstEncountersFromProgress } from './lifetimeFirstEncounters'
import { saveProgress, withDefaultedSkillLevels } from './storage'
import type {
  LetterSoundsVowel,
  Progress,
  SessionHistoryEntry,
  VowelSubMasteryState,
} from './types'

// ---------------------------------------------------------------------------
// Configuration knobs
// ---------------------------------------------------------------------------

/** Endpoint the helpers POST/GET against. Same-origin by default; the
 *  override is only useful for unusual local dev setups. */
const CLOUD_ENDPOINT = '/api/progress'

/** GET timeout — boot reconcile MUST proceed even if KV is slow. */
const FETCH_TIMEOUT_MS = 3000

// ---------------------------------------------------------------------------
// Auth header
// ---------------------------------------------------------------------------

function readAuthSecret(): string | null {
  // Read at call-time, not module-load. Vite injects `import.meta.env`
  // at build; module-load reads it once which is fine for production
  // but breaks unit tests that need to flip it per case.
  const secret = (import.meta.env as Record<string, unknown>)
    .VITE_PROGRESS_API_SECRET
  if (typeof secret !== 'string' || secret.length === 0) return null
  return secret
}

function authHeaders(): Record<string, string> {
  const secret = readAuthSecret()
  if (secret === null) return {}
  return { Authorization: `Bearer ${secret}` }
}

// ---------------------------------------------------------------------------
// Error reasons surfaced to the caller for observability. None are
// currently rendered as UI; the caller logs to console.warn.
// ---------------------------------------------------------------------------

export type CloudErrorReason =
  | 'auth-not-configured'
  | 'timeout'
  | 'network-error'
  | 'auth-failed' /* 401 */
  | 'rate-limited' /* 429 */
  | 'server-error' /* 5xx */
  | 'malformed-response'
  | 'invalid-deviceId'

// ---------------------------------------------------------------------------
// Push (fire-and-forget POST)
// ---------------------------------------------------------------------------

export type PushResult = 'sent' | 'failed' | 'skipped'

export interface PushOptions {
  /** Override for the network call. Tests inject a stub. */
  fetchImpl?: typeof fetch
  /** Override for the auth secret. Tests use this to simulate misconfig. */
  authSecret?: string | null
  /** Endpoint override (test seam). */
  endpoint?: string
  /** ISO timestamp to send. Defaults to `progress.profile.lastPlayedISO`
   *  when set, else now(). Caller can override for test reproducibility. */
  lastModifiedISO?: string
  /** Now() override for tests. */
  now?: () => number
}

/**
 * Push the local Progress blob to /api/progress. Fire-and-forget — the
 * promise resolves to a structured result but NEVER rejects. Callers
 * (most notably `recordProgressOnSessionEnd`) discard the result.
 *
 * `lastModifiedISO`: prefer `progress.profile.lastPlayedISO` if it's set
 * (the session-end caller stamps it BEFORE this push). Falls back to
 * `now()` for the rare case the blob has no last-played timestamp yet.
 */
export async function pushProgressToCloud(
  deviceId: string,
  progress: Progress,
  opts: PushOptions = {},
): Promise<PushResult> {
  const secret =
    opts.authSecret !== undefined ? opts.authSecret : readAuthSecret()
  if (secret === null || secret.length === 0) return 'skipped'

  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') return 'skipped'

  const lastModifiedISO =
    opts.lastModifiedISO ??
    progress.profile.lastPlayedISO ??
    new Date(opts.now ? opts.now() : Date.now()).toISOString()

  const body = {
    deviceId,
    blob: progress,
    lastModifiedISO,
  }

  try {
    const res = await fetchImpl(opts.endpoint ?? CLOUD_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
    })
    if (res.ok) return 'sent'
    console.warn(
      `[cloudSync] push failed status=${res.status} — local progress unchanged`,
    )
    return 'failed'
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[cloudSync] push threw — ${message}`)
    return 'failed'
  }
}

// ---------------------------------------------------------------------------
// Fetch (GET with timeout)
// ---------------------------------------------------------------------------

export type FetchResult =
  | { kind: 'found'; blob: unknown; lastModifiedISO: string }
  | { kind: 'not-found' }
  | { kind: 'error'; reason: CloudErrorReason }

export interface FetchOptions {
  fetchImpl?: typeof fetch
  authSecret?: string | null
  endpoint?: string
  /** Timeout in ms. Default `FETCH_TIMEOUT_MS`. */
  timeoutMs?: number
  /** AbortController hook for tests. Defaults to a fresh controller. */
  abortController?: AbortController
}

/**
 * GET /api/progress?deviceId=<uuid>. Returns a structured result —
 * NEVER throws. 404 is the normal first-launch case; the caller treats
 * it as "no cloud record yet, push on next save."
 */
export async function fetchProgressFromCloud(
  deviceId: string,
  opts: FetchOptions = {},
): Promise<FetchResult> {
  const secret =
    opts.authSecret !== undefined ? opts.authSecret : readAuthSecret()
  if (secret === null || secret.length === 0) {
    return { kind: 'error', reason: 'auth-not-configured' }
  }

  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    return { kind: 'error', reason: 'network-error' }
  }

  const controller = opts.abortController ?? new AbortController()
  const timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS
  const timeoutHandle = setTimeout(() => {
    try {
      controller.abort()
    } catch {
      // ignore — abort always succeeds modulo platform quirks
    }
  }, timeoutMs)

  try {
    const url = `${opts.endpoint ?? CLOUD_ENDPOINT}?deviceId=${encodeURIComponent(deviceId)}`
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      signal: controller.signal,
    })

    if (res.status === 404) return { kind: 'not-found' }
    if (res.status === 401) return { kind: 'error', reason: 'auth-failed' }
    if (res.status === 429) return { kind: 'error', reason: 'rate-limited' }
    if (res.status >= 500) return { kind: 'error', reason: 'server-error' }
    if (!res.ok) {
      // Other 4xx (400 invalid-deviceId mostly).
      return { kind: 'error', reason: 'invalid-deviceId' }
    }

    let parsed: unknown
    try {
      parsed = await res.json()
    } catch {
      return { kind: 'error', reason: 'malformed-response' }
    }
    if (!isCloudGetResponse(parsed)) {
      return { kind: 'error', reason: 'malformed-response' }
    }
    return {
      kind: 'found',
      blob: parsed.blob,
      lastModifiedISO: parsed.lastModifiedISO,
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { kind: 'error', reason: 'timeout' }
    }
    return { kind: 'error', reason: 'network-error' }
  } finally {
    clearTimeout(timeoutHandle)
  }
}

interface CloudGetResponseShape {
  ok: true
  blob: unknown
  lastModifiedISO: string
}

function isCloudGetResponse(v: unknown): v is CloudGetResponseShape {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  if (obj.ok !== true) return false
  if (typeof obj.lastModifiedISO !== 'string') return false
  if (!('blob' in obj)) return false
  return true
}

// ---------------------------------------------------------------------------
// Reconcile (boot-time)
// ---------------------------------------------------------------------------

export type ReconcileOutcome =
  /** Cloud was newer — local was overwritten with the cloud blob. */
  | { kind: 'installed-from-cloud'; progress: Progress }
  /** Local was newer — local was pushed to the cloud. */
  | { kind: 'pushed-to-cloud' }
  /** Either side missing / equal — no-op. The next saveProgress will
   *  push naturally if local is newer. */
  | { kind: 'noop'; reason: 'no-cloud-record' | 'no-local-blob' | 'equal' }
  /** Cloud read failed — proceed with local. */
  | { kind: 'cloud-error'; reason: CloudErrorReason }
  /** Cloud blob was newer but failed validation — local kept. */
  | { kind: 'cloud-blob-rejected' }

export interface ReconcileOptions {
  fetchImpl?: typeof fetch
  authSecret?: string | null
  endpoint?: string
  timeoutMs?: number
  /** Override the install path (defaults to `saveProgress` from
   *  `./storage`). Tests inject a stub to avoid touching localStorage. */
  installLocally?: (p: Progress) => void
  /** Override the push path (test seam — defaults to
   *  `pushProgressToCloud`). */
  pushImpl?: (
    deviceId: string,
    progress: Progress,
    opts?: PushOptions,
  ) => Promise<PushResult>
}

/**
 * Run boot-time reconcile against the cloud.
 *
 * Decision tree:
 * 1. cloud GET errors / times out → log warn, return cloud-error
 * 2. cloud says 404 → push local if we have one, else noop
 * 3. cloud has a blob:
 *    - local has no lastPlayedISO → cloud wins (install)
 *    - cloud's lastModifiedISO > local.lastPlayedISO → cloud wins
 *    - local's lastPlayedISO > cloud's lastModifiedISO → local wins (push)
 *    - equal → noop
 * 4. on cloud-wins: run blob through `withDefaultedSkillLevels` then
 *    `isProgressV1`. If valid, install via `saveProgress`. If invalid,
 *    return `cloud-blob-rejected` and keep local.
 */
export async function reconcileWithCloud(
  deviceId: string,
  currentLocal: Progress | null,
  opts: ReconcileOptions = {},
): Promise<ReconcileOutcome> {
  const installLocally = opts.installLocally ?? saveProgress
  const pushImpl = opts.pushImpl ?? pushProgressToCloud

  const fetched = await fetchProgressFromCloud(deviceId, {
    fetchImpl: opts.fetchImpl,
    authSecret: opts.authSecret,
    endpoint: opts.endpoint,
    timeoutMs: opts.timeoutMs,
  })

  if (fetched.kind === 'error') {
    console.warn(`[cloudSync] reconcile read failed — ${fetched.reason}`)
    return { kind: 'cloud-error', reason: fetched.reason }
  }

  if (fetched.kind === 'not-found') {
    // First-launch case for this device. Push local if we have one so
    // the next reconcile finds it.
    if (currentLocal === null) {
      return { kind: 'noop', reason: 'no-local-blob' }
    }
    await pushImpl(deviceId, currentLocal, {
      fetchImpl: opts.fetchImpl,
      authSecret: opts.authSecret,
      endpoint: opts.endpoint,
    })
    return { kind: 'pushed-to-cloud' }
  }

  // Cloud has a record. Decide which side wins.
  const cloudTimeMs = Date.parse(fetched.lastModifiedISO)
  const localTimeMs = currentLocal?.profile.lastPlayedISO
    ? Date.parse(currentLocal.profile.lastPlayedISO)
    : Number.NEGATIVE_INFINITY

  if (Number.isNaN(cloudTimeMs)) {
    // Server stored a malformed timestamp somehow — treat as malformed.
    return { kind: 'cloud-blob-rejected' }
  }

  // Cloud strictly newer — install. The cloud blob wins last-write-wins
  // on EVERY field EXCEPT `progress.history`, which is union-merged with
  // the local history so genuinely-novel sessions on the losing (slower-
  // clock) device are never clobbered (ticket 86c9qa6na — P1 data-loss
  // fix). `currentLocal?.history` is threaded in so the merge can run;
  // when there's no local blob it's a plain cloud install.
  if (cloudTimeMs > localTimeMs) {
    const validated = installCloudBlob(fetched.blob, currentLocal?.history)
    if (validated === null) {
      return { kind: 'cloud-blob-rejected' }
    }
    installLocally(validated)
    return { kind: 'installed-from-cloud', progress: validated }
  }

  // Local strictly newer — push to cloud.
  if (localTimeMs > cloudTimeMs && currentLocal !== null) {
    await pushImpl(deviceId, currentLocal, {
      fetchImpl: opts.fetchImpl,
      authSecret: opts.authSecret,
      endpoint: opts.endpoint,
      lastModifiedISO: currentLocal.profile.lastPlayedISO ?? undefined,
    })
    return { kind: 'pushed-to-cloud' }
  }

  // Equal (or local is null + cloud time === -Infinity which is impossible
  // because cloudTimeMs is a number; only equality remains).
  return { kind: 'noop', reason: 'equal' }
}

/**
 * Validate the cloud blob and shape it into a strict `Progress` if
 * possible. Runs the T1 read-path defenders (`withDefaultedSkillLevels`)
 * before the strict guard so older-schema cloud blobs (e.g. blob written
 * by a device that didn't yet know about `cvc-words-short-o` or
 * `cvc-words-short-u`) are healed at install time.
 *
 * Returns null when the blob can't be repaired into a valid v1 Progress.
 *
 * `withDefaultedSkillLevels` is imported directly from `./storage`
 * (P0-6, 2026-07-06) — NOT re-implemented here. The former private mirror
 * lacked the dead-letter remaps (`digraphs → digraphs-sh`,
 * `two-digit-addsub → two-digit-addsub-no-regroup`) the storage version
 * carries, so a cloud blob holding a legacy key installed with the level
 * silently dropped (the new sibling floor-filled to `'locked'`) while a
 * local load preserved it — the exact parity hazard the old "matches 1:1"
 * comment claimed was impossible. Sharing the one function makes drift
 * structurally impossible; the `withDefaultedSkillLevels parity` tests in
 * `cloudSync.test.ts` pin the legacy-key round-trip.
 */
function installCloudBlob(
  blob: unknown,
  localHistory?: SessionHistoryEntry[],
): Progress | null {
  // Pre-guard defaulters, in the SAME order as storage.ts:loadProgress —
  // skill-level floor first, then the W9.2 per-vowel letter-sounds
  // defaulter (ticket 86c9ya3gd), then the strict guard.
  const defaulted = withDefaultedLetterSoundsVowelStates(
    withDefaultedSkillLevels(blob),
  )
  if (!isProgressV1(defaulted)) return null

  // History merge (ticket 86c9qa6na — P1 data-loss fix). The cloud blob
  // wins last-write-wins on every field EXCEPT `history`. Under plain
  // last-write-wins the slower-clock device's `history` array was
  // clobbered wholesale, silently dropping any session Marian played on
  // the losing device that the cloud blob doesn't carry. We union-merge
  // instead: concat local + cloud, dedupe by stable key, sort ascending.
  // `localHistory` is undefined when there's no local blob (genuine
  // first-launch install) — nothing to merge, the cloud history stands.
  const merged: Progress =
    localHistory === undefined
      ? defaulted
      : {
          ...defaulted,
          history: mergeSessionHistories(localHistory, defaulted.history),
        }

  // Mirror of `storage.ts:withDefaultedLifetimeFirstEncounters`. A
  // cloud blob written by an older device that doesn't know about
  // `lifetimeFirstEncounters` (ticket 86c9q9ben) gets the field
  // inferred at install time so the downstream planner-gate doesn't
  // see a missing list. Same shape + rule as the storage adapter's
  // post-guard defaulter; if either drifts, the cloud-installed
  // blob and the locally-loaded blob would default different lists,
  // which is exactly the parity hazard the cloudSync.test.ts tests
  // pin against.
  const withFirstEncounters: Progress =
    merged.lifetimeFirstEncounters === undefined
      ? {
          ...merged,
          lifetimeFirstEncounters:
            inferLifetimeFirstEncountersFromProgress(merged),
        }
      : merged

  // Mirror of `storage.ts:withDefaultedCvcGraduationSessionFired` (ticket
  // 86c9qa6n3). A cloud blob written by a device predating the CVC review
  // mode carries no `cvcGraduationSessionFired`; normalise missing →
  // `false` at install time so the cloud-installed blob and the
  // locally-loaded blob default the field identically (parity hazard the
  // cloudSync.test.ts `cvcGraduationSessionFired parity` test pins). The
  // picker tolerates `undefined` as `false` either way, but keeping the
  // two read paths byte-identical avoids future drift.
  if (withFirstEncounters.cvcGraduationSessionFired === undefined) {
    return { ...withFirstEncounters, cvcGraduationSessionFired: false }
  }
  return withFirstEncounters
}

/**
 * Stable dedupe key for a `SessionHistoryEntry` (ticket 86c9qa6na).
 *
 * The ticket's suggested key (`startedAtISO + skillFocus + problemCount`)
 * references fields that DO NOT exist on `SessionHistoryEntry` — see the
 * type at `types.ts:227`. The real always-present identity fields are
 * `dateISO`, `skillFocus`, and `successRate`; the key is built from those.
 *
 * Collision analysis: `dateISO` is the session START timestamp at
 * millisecond precision. Two genuinely-distinct sessions cannot share a
 * millisecond-precise start on a single device's clock; combined with
 * `skillFocus` (the focus-node set) and the exact `successRate`, a
 * false-merge would require two real sessions identical on all three —
 * vanishingly unlikely, and benign if it ever happened (the surviving
 * entry is byte-identical to the one dropped, since the two devices that
 * synced the SAME session carry the SAME entry bytes).
 *
 * No `SessionHistoryEntry` schema field is added — the additive-field
 * cost (a v1 read-path defaulter + a cloudSync parity mirror + every
 * fixture) is not justified when the existing fields already key uniquely.
 */
function historyEntryKey(entry: SessionHistoryEntry): string {
  return `${entry.dateISO}|${entry.skillFocus.join(',')}|${entry.successRate}`
}

/**
 * Union-merge two `SessionHistory` arrays for cloud-sync conflict
 * resolution (ticket 86c9qa6na — P1 data-loss fix).
 *
 * Semantics:
 *  - Concatenate `local` then `cloud`.
 *  - Dedupe by `historyEntryKey` — FIRST occurrence wins, so a session
 *    present on BOTH devices keeps the LOCAL copy's bytes (the two are
 *    expected to be identical; "first wins" is a stable, deterministic
 *    tiebreak rather than a semantic preference).
 *  - Sort ascending by `dateISO` (lexicographic compare is correct for
 *    ISO-8601 Zulu strings; equal timestamps preserve insertion order
 *    via a stable sort, which V8's `Array.prototype.sort` guarantees).
 *
 * No `successRate`-based "last-write-wins per entry" is applied — entries
 * are dedicated session records, not mutable per-key state. Two entries
 * with the same key are the same session; there is no per-entry conflict
 * to resolve.
 *
 * Pure: returns a fresh array, mutates neither input. Exported for direct
 * unit coverage (count-based assertions on the merged array).
 */
export function mergeSessionHistories(
  local: readonly SessionHistoryEntry[],
  cloud: readonly SessionHistoryEntry[],
): SessionHistoryEntry[] {
  const seen = new Set<string>()
  const deduped: SessionHistoryEntry[] = []
  for (const entry of [...local, ...cloud]) {
    const key = historyEntryKey(entry)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(entry)
  }
  return deduped.sort((a, b) =>
    a.dateISO < b.dateISO ? -1 : a.dateISO > b.dateISO ? 1 : 0,
  )
}

/**
 * Mirror of `storage.ts:withDefaultedLetterSoundsVowelStates` (Wave 9
 * W9.2 — ticket 86c9ya3gd). See the lengthy comment in that file for the
 * three-shape healing rationale; the contract is preserved here verbatim.
 * If the storage version changes, this MUST change in the same PR.
 *
 * The `cloudSync.test.ts` "letterSoundsVowelStates parity" test pins the
 * two implementations together — a cloud blob written by a pre-W9.2
 * device must heal identically to a locally-loaded one.
 */
function withDefaultedLetterSoundsVowelStates(parsed: unknown): unknown {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return parsed
  }
  const obj = parsed as Record<string, unknown>

  const literacyRaw = obj.literacy
  if (
    literacyRaw !== undefined &&
    (typeof literacyRaw !== 'object' ||
      literacyRaw === null ||
      Array.isArray(literacyRaw))
  ) {
    return parsed
  }

  const literacy = (literacyRaw ?? {}) as Record<string, unknown>
  const statesRaw = literacy.letterSoundsVowelStates
  if (
    statesRaw !== undefined &&
    (typeof statesRaw !== 'object' ||
      statesRaw === null ||
      Array.isArray(statesRaw))
  ) {
    return parsed
  }

  const present = (statesRaw ?? {}) as Record<string, unknown>
  let mutated = literacyRaw === undefined || statesRaw === undefined
  const filled: Record<string, unknown> = { ...present }
  for (const vowel of LETTER_SOUNDS_VOWELS) {
    if (vowel in present && present[vowel] !== undefined) continue
    filled[vowel] = 'intro' satisfies VowelSubMasteryState
    mutated = true
  }

  if (!mutated) return parsed

  return {
    ...obj,
    literacy: {
      ...literacy,
      letterSoundsVowelStates: filled as Record<
        LetterSoundsVowel,
        VowelSubMasteryState
      >,
    },
  }
}

// ---------------------------------------------------------------------------
// Re-exports for tests
// ---------------------------------------------------------------------------

export { authHeaders as _authHeadersForTests }
