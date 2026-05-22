// Pre-baked session-canon read API.
//
// Ticket 86c9kwhbc (D — pre-baked session canon). The cold-start latency
// of /api/claude session-start was 10–12s on prod (Anthropic Haiku call
// + 40-59 Azure TTS renders). To bring that under 500ms we pre-bake every
// active (track, level, focusNode) combo at build time as a static
// JSON blob containing the full SessionStartResponse — including base64
// MP3 bytes — and ship those blobs inside the function bundle. The HTTP
// handler then reads from canon first and only falls through to the live
// Haiku + TTS pipeline on a miss.
//
// Source-of-truth
// ---------------
// Canon is regenerable from the prompt + voice config. The blobs are
// build artifacts, not source — they live under `public/canon/` (same
// place static PWA assets land) and are git-ignored. The generator
// script that writes them is `scripts/generateSessionCanon.ts`.
//
// Why public/canon/
// -----------------
// Vercel includes `public/` in the function bundle by default for the
// Node runtime. We don't expose the canon over HTTP at /canon/* — the
// browser doesn't read it directly. Reusing `public/` is purely about
// making sure the files reach the function's filesystem at runtime
// without us hand-rolling a new bundling rule. (If a child were to
// curl `/canon/math/level-1/add-to-10.json`, they'd get the same
// JSON the function returns. That's neither sensitive nor a leak —
// the audio is for the kid, the prompt is in this repo.)
//
// Why synchronous readFileSync
// ----------------------------
// Each canon entry is ~1.2MB JSON + base64 audio. On a Vercel Node
// function instance, `readFileSync` for a file that size completes in
// single-digit milliseconds (cold) and microseconds when the OS page
// cache is warm. Using async fs.promises.readFile here would buy us
// nothing — there's nothing else for the request to do while it waits.
// The simpler synchronous shape also keeps the call site in
// `/api/claude` cleaner: no need for a try/await dance around the
// canon lookup.
//
// In-memory cache
// ---------------
// Within a single function instance, the module-singleton `cache`
// avoids re-parsing the same JSON on every warm hit. Cold-start of a
// new instance pays the readFileSync once; every subsequent hit is a
// Map lookup. Cache eviction is intentionally absent — the canon is
// bounded (10 math + 1 word-song = 11 entries, ~13MB total parsed),
// well within a function instance's memory budget. If we ever push
// the canon past 50MB we'll add an LRU; today the simplest thing
// works.
//
// Childname handling
// ------------------
// Per ticket 86c9kwhbc AC #3, "Marian" is baked directly into canon at
// generation time (Option A — single-child build). Multi-child support
// is out of scope; if it's added later, the natural shape is either
// (a) one canon per child, generated on first sign-in, or
// (b) a `__CHILD_NAME__` placeholder substitution at read time.
// For now this module does no substitution — it just hands the parsed
// JSON to the caller as-is.

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { PlannerTrack } from './_planner.js'
import type { SessionStartResponse } from './_types.js'
import { isSessionStartResponse } from './_types.js'

/**
 * Lookup key for a canon entry. Mirrors what the canon generator writes
 * out as the file path: `<track>/level-<n>/<focusNode>.json`.
 */
export interface CanonKey {
  track: PlannerTrack
  level: number
  focusNode: string
}

/**
 * Locate the directory the canon blobs are stored in. Resolved at
 * module-load time so a) we pay the cost once per cold start, and b)
 * tests can override via the `canonRoot` arg on `getCanonEntry`.
 *
 * On Vercel the function runs from `/var/task/api/`, and the build
 * step copies `public/canon/` to `/var/task/public/canon/`. So the
 * relative path from this file's location is `../public/canon`.
 *
 * In dev (`vite dev` + Vercel CLI) the same relative path resolves
 * correctly because the function source lives at `<repo>/api/`.
 *
 * In tests, callers pass `canonRoot` explicitly to a temp directory
 * (see `_canon.test.ts`).
 */
const DEFAULT_CANON_ROOT = (() => {
  // import.meta.url works in both ESM source and the compiled @vercel/node
  // output. The leading `file://` URL is converted via fileURLToPath.
  const here = dirname(fileURLToPath(import.meta.url))
  return join(here, '..', 'public', 'canon')
})()

/**
 * In-memory parsed-canon cache, keyed by the same string the file path
 * is built from. `null` value means "we tried this key and it's a real
 * miss" — distinct from "we haven't tried it yet" (absent map entry).
 * Negative caching avoids hammering `existsSync` on the cold path for
 * keys we know aren't in the canon (e.g. `mult-6-9` if the generator
 * hasn't run yet).
 */
type CacheValue = SessionStartResponse | null

const cache = new Map<string, CacheValue>()

/**
 * Build the cache/path key for a CanonKey. Mirrors the on-disk shape:
 *   `<track>/level-<n>/<focusNode>`
 * Extension is appended at file-read time, not here, so the cache key
 * stays format-agnostic.
 */
export function canonCacheKey(key: CanonKey): string {
  return `${key.track}/level-${key.level}/${canonFileTierFor(key.focusNode)}`
}

/**
 * Map a runtime `SkillNode` wire literal (from `Progress.skillLevels` /
 * `pickFocusNode` / the `/api/claude` payload `progress.focusNode` field)
 * onto the corresponding on-disk canon-file tier identifier.
 *
 * The dual-identifier surface (Wave 5 PR B — ticket 86c9y1p99). Most
 * SkillNode literals pass through unchanged: `'add-to-10'` reads canon
 * file `add-to-10.json`. The one rebind today (post-PR-#308):
 *
 *   `'two-digit-addsub-no-regroup'`  → disk tier `'two-digit-addsub'`
 *   `'two-digit-addsub-with-regroup'` → disk tier `'two-digit-addsub-with-regroup'`
 *
 * Rationale: PR #308 split the legacy `'two-digit-addsub'` SkillNode into
 * two adjacent sibling literals (`-no-regroup` + `-with-regroup`). The
 * `-no-regroup` tier inherits the existing canon content + disk file
 * — so the disk identifier stays `'two-digit-addsub'` while the wire
 * literal changes. The `-with-regroup` tier is a brand-new sibling with
 * its own disk file. See `.claude/docs/skill-trees-and-content.md`
 * § "Canon-file-name vs SkillNode-literal — dual identifier surface".
 *
 * This is the ONLY public mapping function for the wire→disk translation;
 * the bake script imports it from here so generator + reader can't
 * disagree.
 */
export function canonFileTierFor(focusNode: string): string {
  if (focusNode === 'two-digit-addsub-no-regroup') return 'two-digit-addsub'
  return focusNode
}

/**
 * Build the absolute on-disk path for a CanonKey under `root`.
 *
 * Exported for the canon-generator script — it writes to the same
 * convention this reader walks, so sharing the path-builder ensures
 * generator and reader can never disagree on naming.
 *
 * Wire `focusNode` is translated to the canon-file tier via
 * `canonFileTierFor` so the disk file naming stays stable across
 * SkillNode union widenings.
 */
export function canonFilePath(root: string, key: CanonKey): string {
  return join(
    root,
    key.track,
    `level-${key.level}`,
    `${canonFileTierFor(key.focusNode)}.json`,
  )
}

/**
 * Look up a canon entry. Returns the parsed `SessionStartResponse` on
 * hit, or `null` on miss / corrupted file.
 *
 * Failure modes (all return null, never throw):
 *   - File does not exist                → miss
 *   - File exists but JSON.parse throws  → miss + structured warn log
 *   - File exists but shape doesn't match SessionStartResponse → miss + warn
 *   - readFileSync throws (permission, etc.)                   → miss + warn
 *
 * The caller (`/api/claude`) treats every null as "fall through to the
 * live planner". A canon hit short-circuits the live pipeline; a miss
 * is invisible to the user beyond the latency cost of a live call.
 *
 * @param key Lookup tuple: track + level + focusNode.
 * @param canonRoot Override the canon root directory. Defaults to the
 *   compiled-relative `../public/canon`. Tests pass a temp dir.
 */
export function getCanonEntry(
  key: CanonKey,
  canonRoot: string = DEFAULT_CANON_ROOT,
): SessionStartResponse | null {
  const cacheKey = canonCacheKey(key)
  const cached = cache.get(cacheKey)
  if (cached !== undefined) {
    // null = negative cache hit (real miss already verified).
    return cached
  }

  const path = canonFilePath(canonRoot, key)

  // existsSync is cheap (single stat) — we use it before readFileSync to
  // distinguish "file is missing" (silent miss, expected) from "file is
  // there but unreadable" (worth a warn).
  if (!existsSync(path)) {
    cache.set(cacheKey, null)
    return null
  }

  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (err) {
    // Permission / disk error. Log so a future cold-start regression
    // (e.g. wrong bundle layout on Vercel) surfaces, but don't escalate
    // — the live planner is the safety net.
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[api/_canon] read-failed', {
        path,
        message: err instanceof Error ? err.message : String(err),
      })
    }
    cache.set(cacheKey, null)
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[api/_canon] parse-failed', {
        path,
        message: err instanceof Error ? err.message : String(err),
      })
    }
    cache.set(cacheKey, null)
    return null
  }

  if (!isSessionStartResponse(parsed)) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[api/_canon] shape-mismatch', { path })
    }
    cache.set(cacheKey, null)
    return null
  }

  cache.set(cacheKey, parsed)
  return parsed
}

/**
 * Reset the in-memory canon cache. Tests use this to keep
 * cross-test state out of one another's hair; production code never
 * calls this (the cache lives for the lifetime of the function instance).
 */
export function _resetCanonCacheForTesting(): void {
  cache.clear()
}
