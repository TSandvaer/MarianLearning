// Lifetime-first-encounter rewrite of `session.end.opener` (ticket
// 86c9q9ben). Server-side render-time gate per Dave's PR #173 §4
// recommendation: gate at the NODE level, not the WORD level.
//
// What this does
// --------------
// Each tier-specific canon for a word-song focus node MAY ship a
// scaffolding-line variant of `session.end.opener` (e.g. the short-u
// /u/ vs /ʌ/ contrast line baked into
// `public/canon/word-song/level-1/cvc-words-short-u.json`). When the
// browser tells us the child has already encountered the tier
// (`progress.lifetimeFirstEncounters` contains the focus node), we
// rewrite that opener to the vanilla "You did it!" by sourcing both
// text AND audio from a sibling canon (`cvc-words.json`, the short-a
// canon, which has the vanilla shape).
//
// Why a sibling-canon source rather than re-baking
// ------------------------------------------------
// The dispatch contract for ticket 86c9q9ben explicitly says "Don't
// bake new canon for this fix — `session.end.opener` content
// unchanged; only the consume path changes." Sourcing from
// `cvc-words.json` adds zero new artifacts and keeps the
// "consume-side filter" posture: the canon ships with the contrast
// line as-is; this module is the post-canon-lookup rewrite the
// dispatch asks for.
//
// Vanilla audio is the same vanilla SSML across canons (Azure
// renders aren't byte-identical across calls, but the audible
// content is "You did it!" in every canon — Marian doesn't notice).
//
// Future: short-o `box`/`fox` /ks/ first-encounter
// ------------------------------------------------
// The same gate applies. When a future PR re-bakes
// `cvc-words-short-o.json` to carry a box/fox first-encounter
// opener variant, this module's gate fires for it too — no new
// code needed beyond extending the FIRST_ENCOUNTER_GATED_NODES
// list below. Today only `cvc-words-short-u` ships a tier-
// specific opener; `cvc-words-short-o` is on the gated-list as
// infrastructure-ready (gate is a no-op for a canon that already
// has vanilla "You did it!", since the rewrite would substitute
// "You did it!" with itself — but the cost is one extra disk read,
// which we still skip via the FIRST_ENCOUNTER_GATED_NODES check).
//
// Defensive: the gate is also a no-op when:
//  - the response doesn't carry a `session.end.opener` utterance
//    (legacy stub paths);
//  - the sibling canon file isn't present on disk (the rewrite
//    would have nothing to splice in — pass through verbatim);
//  - the rewrite source itself doesn't carry a vanilla opener.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { SessionStartResponse, Utterance } from './_types.js'

/**
 * Word-song focus nodes whose canon MAY carry a tier-specific
 * `session.end.opener` variant. The gate runs only when the focus
 * node is in this set — saves a disk read on tracks / nodes that
 * have a vanilla opener anyway.
 *
 * Add a node here when its canon ships a non-vanilla opener variant.
 * Removing a node is safe (the gate becomes a no-op, no rewrite
 * fires) — the canon's variant just no longer gets gated, which
 * means it fires every session. Don't remove without re-baking the
 * canon to vanilla.
 */
const FIRST_ENCOUNTER_GATED_NODES: ReadonlySet<string> = new Set([
  // Ticket 86c9q9ben (infrastructure-ready) — short-o box/fox /ks/
  // opener. Canon currently has VANILLA "You did it!"; the gate is
  // a no-op until a future canon re-bake adds the box/fox variant.
  // Listed here so the same mechanism handles it without code
  // changes when the canon ships.
  'cvc-words-short-o',
  // NOTE: cvc-words-short-u was here (ticket 86c9q9ben) but its
  // scaffolding opener produced Azure gibberish across three fix
  // iterations (PR #174, #192, #194). The opener was stripped in
  // ticket 86c9qkf3v (2026-05-11) — canon re-baked to plain
  // "You did it!". The gate entry is intentionally removed so the
  // code is self-documenting. Dave ticket 86c9qkbvk designs the
  // replacement teaching mechanism.
])

/**
 * Path to the vanilla-opener source canon. Same resolution shape as
 * `_canon.ts:DEFAULT_CANON_ROOT`. The cvc-words (short-a) canon is
 * the stable vanilla "You did it!" source — short-a is the v1
 * tier and its opener will always be vanilla.
 */
const VANILLA_OPENER_SOURCE_REL = 'word-song/level-1/cvc-words.json'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_CANON_ROOT = join(__dirname, '..', 'public', 'canon')

interface VanillaOpenerCache {
  source: string
  utterance: Utterance | null
}

let cached: VanillaOpenerCache | null = null

/**
 * Read the vanilla `session.end.opener` utterance from the source
 * canon. Module-singleton cache so we don't re-parse the JSON on
 * every gated request. Returns null if the source canon is missing,
 * malformed, or doesn't carry a `session.end.opener` utterance.
 *
 * Test seam: pass `canonRoot` to override the default lookup
 * directory.
 */
export function readVanillaOpener(
  canonRoot: string = DEFAULT_CANON_ROOT,
): Utterance | null {
  const source = join(canonRoot, VANILLA_OPENER_SOURCE_REL)
  if (cached !== null && cached.source === source) {
    return cached.utterance
  }
  let utterance: Utterance | null = null
  try {
    if (existsSync(source)) {
      const raw = readFileSync(source, 'utf8')
      const parsed = JSON.parse(raw) as { utterances?: unknown }
      if (Array.isArray(parsed.utterances)) {
        for (const u of parsed.utterances) {
          if (
            typeof u === 'object' &&
            u !== null &&
            (u as { id?: unknown }).id === 'session.end.opener'
          ) {
            utterance = u as Utterance
            break
          }
        }
      }
    }
  } catch {
    // Defensive: any read / parse error → no rewrite, pass-through.
    utterance = null
  }
  cached = { source, utterance }
  return utterance
}

/** Test-only: clear the singleton cache so a test can swap the
 *  canon root mid-suite. */
export function _resetVanillaOpenerCacheForTests(): void {
  cached = null
}

export interface FirstEncounterGateInput {
  /** Effective focus node for this request — already resolved by the
   *  caller (via `effectiveFocusNode` for word-song). */
  focusNode: string
  /**
   * `Progress.lifetimeFirstEncounters` shipped by the browser. May
   * be undefined for legacy clients. The gate treats undefined as
   * "first encounter for everything" (greenfield posture) — same
   * as an empty list — because the read-path defaulter on the
   * browser side ensures real Marians always have at least `[]`
   * once they've hit the storage adapter. A truly-undefined
   * field here means "we don't know" and the safest interpretation
   * is "fire the scaffolding."
   */
  lifetimeFirstEncounters?: readonly string[]
}

/**
 * Apply the lifetime-first-encounter gate to a session-start
 * response. When the focus node is gated AND the child has already
 * encountered it, replace the response's `session.end.opener`
 * utterance with the vanilla source utterance.
 *
 * Returns the input verbatim (same reference) when:
 *  - the focus node is not in `FIRST_ENCOUNTER_GATED_NODES`, OR
 *  - the focus node is NOT in `lifetimeFirstEncounters` (first
 *    encounter — keep the canon's variant), OR
 *  - the response has no `session.end.opener` utterance (defensive),
 *    OR
 *  - the vanilla source canon is unavailable (defensive).
 *
 * Side-effect-free: never mutates the input. When a rewrite fires,
 * returns a fresh response object with a fresh `utterances` array.
 */
export function applyFirstEncounterGate(
  response: SessionStartResponse,
  input: FirstEncounterGateInput,
  canonRoot?: string,
): SessionStartResponse {
  if (!FIRST_ENCOUNTER_GATED_NODES.has(input.focusNode)) {
    return response
  }
  // Note: undefined `lifetimeFirstEncounters` falls through to "fire
  // scaffolding" by way of the .includes() returning false. That's
  // the greenfield posture documented above.
  const list = input.lifetimeFirstEncounters
  const alreadyEncountered =
    list !== undefined && list.includes(input.focusNode)
  if (!alreadyEncountered) {
    return response
  }
  const vanilla = readVanillaOpener(canonRoot)
  if (vanilla === null) {
    return response
  }
  if (!response.utterances.some((u) => u.id === 'session.end.opener')) {
    // No opener to rewrite. Stub responses / partial renders fall
    // here; pass through.
    return response
  }
  return {
    ...response,
    utterances: response.utterances.map((u) =>
      u.id === 'session.end.opener'
        ? { id: 'session.end.opener', text: vanilla.text, audio: vanilla.audio }
        : u,
    ),
  }
}

/** Test-introspection helper: list the gated nodes. Used by unit
 *  tests to pin the contract that `cvc-words-short-u` and
 *  `cvc-words-short-o` are both included. */
export function getFirstEncounterGatedNodes(): readonly string[] {
  return Array.from(FIRST_ENCOUNTER_GATED_NODES).sort()
}
