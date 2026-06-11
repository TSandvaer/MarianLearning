/**
 * Subitising scaffold trigger + fluency-fade gate (ticket 86c9ur1zr).
 *
 * Layered on top of the existing structural dot-card predicate in
 * `dotCard.ts` (`shouldShowDotCard(problem)` — "both addends ≤ 5 AND
 * op === '+'"). This module adds the spec §2 content-tier rules: the
 * scaffold fires only on the `add-to-10` focus node, and AFTER the
 * first-encounter window (3 sessions) it fades probabilistically as
 * Marian's EASY-band Leitner-mean rises.
 *
 * Spec: `design/math/subitising-scaffold-content.md` §2 (trigger),
 * §2.2 (first-encounter gate), §2.3 (fluency-fade), §4 (progression).
 *
 * Decision shape
 * --------------
 * Two pure entry points carry the entire contract:
 *
 *   1. `shouldScaffoldThisSession(easyBandLeitnerMeanBox, sessionsObserved, rng)`
 *      — Called ONCE at session-start (App.tsx). Resolves the per-session
 *      probabilistic decision into a single boolean. Per-session, NOT
 *      per-problem, to avoid the variable-ratio dark-pattern (spec §2.3
 *      "Determinism").
 *
 *   2. `shouldShowSubitisingScaffold(progress, problem, scaffoldActiveThisSession)`
 *      — Called per-render (Math.tsx). Combines C1 (focus node), C2 (addends
 *      ≤ 5 & op==='+'), and the frozen session-level decision into a boolean
 *      the screen consumes to gate the overlay mount.
 *
 * The RNG is seeded deterministically from `(sessionStartISO, focusNode)`
 * via `createSubitisingRng()` so a single session's decision is reproducible
 * across re-renders and resumes — same session means same decision.
 *
 * Why per-session and not per-problem
 * -----------------------------------
 * Per-problem randomness ("dots on P2, no dots on P5") feels arbitrary and
 * triggers the variable-ratio dark-pattern flavour that CLAUDE.md
 * non-negotiables ban. Per-session randomness reads as variety ("today is
 * a dots day or it isn't"). Spec §2.3 "Determinism" makes this load-
 * bearing — within a session the scaffold either fires on EVERY in-scope
 * problem OR on NONE.
 *
 * Why Leitner-mean after first 3 sessions, not session-count
 * ----------------------------------------------------------
 * Session count is a proxy for exposure; Leitner-mean is a direct mastery
 * signal. Spec §4.2 — "A child could run 20 sessions and still have low
 * Leitner-box averages." The session-count gate covers the noise window
 * (0-2 sessions) when Leitner has too few fact-samples to trust;
 * Leitner-mean takes over from session 4 onward.
 *
 * Why no hysteresis
 * -----------------
 * Spec §4.4 — if Marian's recall regresses (overlapping-waves model,
 * Siegler 1996), the scaffold should reappear. The fluency-fade is a
 * state-dependent rule, not a one-way ratchet. `mean` rising from 3.5
 * to 4.1 disables the scaffold; if it drops back to 3.8 next session,
 * the scaffold re-engages at P=0.33. No "once-faded, always-faded"
 * stickiness.
 *
 * Cap on `subitisingScaffoldSessionsObserved` at 4
 * ------------------------------------------------
 * We only care about the 1-2-3-fade boundary. Capping at 4 keeps the
 * counter bounded so the field's range is predictable for any future
 * read-path defaulter or migration; the value 4 is "past the first-
 * encounter window," which is the only signal anyone consumes.
 */

import type { MathProblem } from './sessionPlans'
import type { LeitnerBox, MathFact, Progress } from '../../lib/progress'
import { shouldShowDotCard, shouldShowSubMinuendCell } from './dotCard'

// ── Constants (LOCKED, spec §2.3 + §6.5) ────────────────────────────────

/**
 * Number of sessions during which the scaffold fires unconditionally
 * on every in-scope problem. Spec §2.2 — "Three sessions is the minimum
 * exposure window before any meaningful inference about Marian's
 * subitising fluency can be drawn."
 *
 * Marian is encountering the scaffold for the first time on the day this
 * PR merges — `subitisingScaffoldSessionsObserved` starts at 0 for her
 * even though she has run dozens of `add-to-10` sessions. The gate
 * measures exposure to the SCAFFOLD, not exposure to the tier.
 */
export const FIRST_ENCOUNTER_SESSIONS = 3 as const

/** Below this Leitner-mean, scaffold fires on every in-scope problem (P=1.0). */
export const FADE_THRESHOLD_FULL = 2.0 as const

/** Bottom of the medium-fluency band. `[2.0, 3.0)` → P=0.66. */
export const FADE_THRESHOLD_MEDIUM = 3.0 as const

/**
 * At or above this Leitner-mean, scaffold NEVER fires (P=0.0).
 * Spec §2.3 — "EASY band is at automaticity; scaffold has done its work."
 */
export const FADE_THRESHOLD_OFF = 4.0 as const

/** Probability of firing in the `[2.0, 3.0)` band — spec §2.3. */
export const FADE_PROB_MEDIUM = 0.66 as const

/** Probability of firing in the `[3.0, 4.0)` band — spec §2.3. */
export const FADE_PROB_LOW = 0.33 as const

/**
 * Counter ceiling for `profile.subitisingScaffoldSessionsObserved`. We
 * only care about the boundary at 3; capping at 4 keeps the persisted
 * value bounded for any future migration / read-path defaulter.
 */
export const SCAFFOLD_SESSIONS_OBSERVED_CAP = 4 as const

/**
 * The focus node the scaffold targets. Spec §2.1 C1 — "Only tier where
 * subitising-on-small-quantities is pedagogically targeted." Locking
 * this as a constant rather than inlining the string keeps the §8.1 /
 * §8.2 follow-up work (extending to `sub-to-10` / multiplication) a
 * single-edit change here when those tiers ship.
 */
export const SCAFFOLD_FOCUS_NODE = 'add-to-10' as const

/**
 * The set of EASY-band facts (sum 3-5) for `add-to-10`. Spec §2.1 C3
 * cross-check + §2.3 `easyBandLeitnerMeanBox` denominator. 9 facts
 * total. Pinned as a frozen list so a future planner pool drift can't
 * silently change the denominator of the fluency-fade signal — a
 * change here is a deliberate edit that drift-guards in the test suite
 * would catch.
 *
 * The shape mirrors the `MathFact` key — `{ a, b, op: '+' }`. Order is
 * canonical (sum-ascending, then `a`-ascending) so the test fixtures
 * stay readable. The `mathFactKey` used by the Leitner box is
 * `${a}${op}${b}` (see `progressHistory.ts`), so we key-match against
 * that same shape.
 */
export const EASY_BAND_FACTS: readonly Readonly<MathFact>[] = [
  { a: 1, b: 2, op: '+' },
  { a: 2, b: 1, op: '+' },
  { a: 1, b: 3, op: '+' },
  { a: 3, b: 1, op: '+' },
  { a: 2, b: 2, op: '+' },
  { a: 1, b: 4, op: '+' },
  { a: 4, b: 1, op: '+' },
  { a: 2, b: 3, op: '+' },
  { a: 3, b: 2, op: '+' },
]

// ── sub-to-10 scaffold constants (LOCKED, spec §13.4 / §13.5) ────────────

/**
 * The focus node the sub-to-10 minuend scaffold targets. Spec §13.5 #2 /
 * §13.4.2 — sibling to `SCAFFOLD_FOCUS_NODE = 'add-to-10'`. Locking this
 * as a constant (rather than inlining the string) keeps the §13.8 /
 * §8.2 cross-tier-aggregation follow-up a single-edit change here.
 */
export const SUB_SCAFFOLD_FOCUS_NODE = 'sub-to-10' as const

/**
 * The 8 EASY-band facts for `sub-to-10` — the denominator set for the
 * sub-to-10 fluency-fade signal (`easyBandSubLeitnerMeanBox`). Spec
 * §13.4.2 / §13.5 #3. These are exactly the `easy` band (#1–8) from
 * `sub-to-10-content.md` §1.1 (minuends 5,8,7,9,10,8,6,9 — all in
 * `[5,10]`), keyed `{ a, b, op: '-' }` to match the Leitner
 * `mathFactKey = ${a}${op}${b}`.
 *
 * **Only `op === '-'` facts** — NEVER add facts. Addition and subtraction
 * automaticity develop via distinct pathways (Dave's W10.1 research
 * § Source 5), so the sub-to-10 fade must source SUBTRACTION evidence
 * only; an add-facts mean would put the sub scaffold in late-fade on day
 * 1 of the rollout (§13.4). Pinned as a frozen list so a future planner
 * pool drift can't silently change the fade-signal denominator — a change
 * here is a deliberate edit a drift-guard test catches.
 *
 * Order is canonical (the §1.1 easy-band order — subtract-self, then
 * subtract-zero, then doubles-halving, then subtract-one) so the test
 * fixtures stay readable.
 */
export const SUB_EASY_BAND_FACTS: readonly Readonly<MathFact>[] = [
  { a: 5, b: 5, op: '-' }, // 5−5=0  subtract-self
  { a: 8, b: 8, op: '-' }, // 8−8=0  subtract-self
  { a: 7, b: 0, op: '-' }, // 7−0=7  subtract-zero
  { a: 9, b: 0, op: '-' }, // 9−0=9  subtract-zero
  { a: 10, b: 5, op: '-' }, // 10−5=5 doubles-halving
  { a: 8, b: 4, op: '-' }, // 8−4=4  doubles-halving
  { a: 6, b: 3, op: '-' }, // 6−3=3  doubles-halving
  { a: 9, b: 1, op: '-' }, // 9−1=8  subtract-one
]

// ── Per-session decision (called once at session-start) ──────────────────

/**
 * Per-session fluency-fade decision (spec §2.3). Returns `true` iff the
 * scaffold should fire on EVERY in-scope problem of the upcoming session;
 * returns `false` iff it should fire on NONE. Per-session resolution is
 * load-bearing for anti-dark-pattern compliance (spec §2.3
 * "Determinism").
 *
 * Probability schedule (LOCKED):
 *   sessionsObserved < FIRST_ENCOUNTER_SESSIONS (i.e. 0, 1, 2)
 *     → always TRUE (first-encounter gate, spec §2.2)
 *   mean < FADE_THRESHOLD_FULL (i.e. < 2.0)
 *     → always TRUE
 *   FADE_THRESHOLD_FULL <= mean < FADE_THRESHOLD_MEDIUM (i.e. [2.0, 3.0))
 *     → rng() < FADE_PROB_MEDIUM (i.e. < 0.66)
 *   FADE_THRESHOLD_MEDIUM <= mean < FADE_THRESHOLD_OFF (i.e. [3.0, 4.0))
 *     → rng() < FADE_PROB_LOW (i.e. < 0.33)
 *   mean >= FADE_THRESHOLD_OFF (i.e. >= 4.0)
 *     → always FALSE
 *
 * The RNG is supplied by the caller (production passes
 * `createSubitisingRng(sessionStartISO, focusNode)` for determinism;
 * tests pass `() => 0.5` or a step function over a known sequence).
 */
export function shouldScaffoldThisSession(
  easyBandLeitnerMeanBox: number,
  sessionsObserved: number,
  rng: () => number,
): boolean {
  // First-encounter gate (spec §2.2) — three sessions unconditional.
  // Read at the top so the Leitner-mean signal can't accidentally
  // suppress a first-encounter session even if the mean is somehow
  // already high (e.g. QA seed that populates the box before the
  // counter increments).
  if (sessionsObserved < FIRST_ENCOUNTER_SESSIONS) return true

  // Defensive: NaN slips through inequalities in unintuitive ways
  // (NaN < anything === false, NaN >= anything === false). A NaN mean
  // would land in the `[FADE_THRESHOLD_MEDIUM, FADE_THRESHOLD_OFF)`
  // branch by default below — definitely not what we want. Treat a
  // non-finite mean as "no signal" → conservative TRUE so Marian
  // doesn't lose the scaffold to a transient progress-read bug.
  if (!Number.isFinite(easyBandLeitnerMeanBox)) return true

  if (easyBandLeitnerMeanBox < FADE_THRESHOLD_FULL) return true
  if (easyBandLeitnerMeanBox >= FADE_THRESHOLD_OFF) return false
  if (easyBandLeitnerMeanBox < FADE_THRESHOLD_MEDIUM) {
    return rng() < FADE_PROB_MEDIUM
  }
  // mean in [FADE_THRESHOLD_MEDIUM, FADE_THRESHOLD_OFF) — i.e. [3.0, 4.0)
  return rng() < FADE_PROB_LOW
}

// ── Per-render predicate (called per-problem inside Math.tsx) ────────────

/**
 * Per-render gate — combines the static trigger rules (C1 focus node,
 * C2 addends ≤ 5 / op === '+') with the per-session decision frozen
 * upstream. Math.tsx calls this every render to decide whether the
 * dot-card overlay should mount for the current problem.
 *
 * Inputs are explicit (not derived from a hook) so the call is pure +
 * testable. The `scaffoldActiveThisSession` boolean is the frozen
 * per-session result that App.tsx computed once at math-fetch time and
 * piped through the Math screen prop.
 *
 * Returns FALSE if any of the following hold:
 *   - The focus node is not `add-to-10` (C1 fails).
 *   - The problem's addends / op don't qualify (C2 / C3 fail via
 *     `shouldShowDotCard`).
 *   - The per-session decision was negative.
 *
 * Spec §2.1 C4 (first-encounter gate OR fluency-fade) is collapsed into
 * the `scaffoldActiveThisSession` boolean — both branches resolve to
 * a single yes/no at session-start. Spec §2.1 C5 (parent-settings
 * opt-out) is DEFERRED to v2 per ticket scope.
 */
export function shouldShowSubitisingScaffold(
  focusNode: string,
  problem: MathProblem,
  scaffoldActiveThisSession: boolean,
): boolean {
  if (focusNode !== SCAFFOLD_FOCUS_NODE) return false
  if (!scaffoldActiveThisSession) return false
  return shouldShowDotCard(problem)
}

/**
 * Per-render gate for the SUB-TO-10 minuend scaffold (spec §13.3 / §13.5
 * #5). Sibling to `shouldShowSubitisingScaffold` but for subtraction:
 * combines S1 (focus node `sub-to-10`), the frozen per-session decision
 * (S5), and the structural minuend rule (S2 op `'-'` + S3 minuend
 * `addendA ∈ [5,10]`).
 *
 * The structural rule is `shouldShowSubMinuendCell` (in `dotCard.ts`) —
 * which gates on the MINUEND only, NOT "both operands ≤ 5". This is the
 * load-bearing structural difference from the add path: the subitised
 * quantity is the start-number; the subtrahend is irrelevant to the
 * visual (§13.3 S4).
 *
 * Returns FALSE if any of:
 *   - The focus node is not `sub-to-10` (S1 fails).
 *   - The per-session decision was negative (S5 — fluency-fade /
 *     first-encounter resolved once at session-start).
 *   - The problem's op / minuend don't qualify (S2 / S3 via
 *     `shouldShowSubMinuendCell`).
 */
export function shouldShowSubitisingSubScaffold(
  focusNode: string,
  problem: MathProblem,
  scaffoldActiveThisSession: boolean,
): boolean {
  if (focusNode !== SUB_SCAFFOLD_FOCUS_NODE) return false
  if (!scaffoldActiveThisSession) return false
  return shouldShowSubMinuendCell(problem)
}

// ── Leitner-mean signal (spec §2.3 formula) ──────────────────────────────

/**
 * Compute the per-band Leitner-mean signal that drives the §2.3 fade
 * schedule.
 *
 * Spec §2.3 formula:
 *   easyBandLeitnerMeanBox =
 *     mean({ leitnerBoxOf(fact) | fact ∈ EASY_BAND_FACTS_SEEN })
 *
 * Where `EASY_BAND_FACTS_SEEN` is the subset of the 9 EASY-band facts
 * Marian has actually encountered (un-seen facts are excluded so a
 * partially-explored band doesn't deflate the mean — spec §2.3).
 *
 * Edge cases:
 *   - Empty seen-set (no EASY-band fact has been recorded yet) → returns
 *     a sentinel below FADE_THRESHOLD_FULL so `shouldScaffoldThisSession`
 *     takes the "always TRUE" branch. The first session would have hit
 *     the first-encounter gate anyway; this is the gate for "first
 *     encounter window passed but Marian hasn't yet seen any EASY-band
 *     facts" — pathological, but the conservative behaviour is to keep
 *     the scaffold on rather than fade it on no evidence.
 *   - Single-fact band (1 EASY-band fact seen) → returns that fact's
 *     box index. The single observation is the entire signal; no
 *     denominator-of-zero risk.
 *   - Partially-explored band (e.g. 3 of 9 EASY-band facts seen) →
 *     returns the mean over the 3 seen facts. Unseen facts are
 *     deliberately excluded; including them at a synthetic box-1
 *     would deflate the mean and delay the fade past Marian's actual
 *     fluency.
 *
 * The Leitner box uses `mathFactKey = ${a}${op}${b}` (see
 * `progressHistory.ts`); we key-match against that same shape so the
 * lookup is structural (no reference-equality dependency).
 */
export function easyBandLeitnerMeanBox(
  mathFactsLeitner: LeitnerBox<MathFact>,
): number {
  // Build a lookup of `key -> box` for O(N) scan.
  const seen = new Map<string, number>()
  for (const entry of mathFactsLeitner.items) {
    seen.set(mathFactKey(entry.item), entry.box)
  }

  let sum = 0
  let count = 0
  for (const fact of EASY_BAND_FACTS) {
    const box = seen.get(mathFactKey(fact))
    if (box === undefined) continue
    sum += box
    count += 1
  }

  if (count === 0) {
    // Empty seen-set — return a sentinel below FADE_THRESHOLD_FULL so
    // the per-session decision takes the "always TRUE" branch. 0 is the
    // chosen sentinel because (a) it's clearly below 1, the minimum
    // possible real Leitner box, so any future debug surface displaying
    // this value reads as "no data" not "box 0," and (b) it's strictly
    // < FADE_THRESHOLD_FULL so the conservative branch fires.
    return 0
  }
  return sum / count
}

/**
 * Sub-to-10 sibling of `easyBandLeitnerMeanBox` (spec §13.4.2 / §13.5
 * #4). Computes the EASY-band Leitner mean over **subtraction facts
 * only** (`SUB_EASY_BAND_FACTS`) — the fade signal that drives the §13.4.3
 * schedule for the sub-to-10 minuend scaffold.
 *
 * Identical mechanics to the add helper — partial-band rule (unseen
 * facts excluded from the mean), `0` sentinel on an empty seen-set
 * (keeps the scaffold ON) — the ONLY difference is the denominator set
 * (`SUB_EASY_BAND_FACTS`, all `op === '-'`). This op-asymmetry is the
 * whole point: the sub scaffold must NOT fade on Marian's ADDITION
 * fluency (Dave's W10.1 research § Source 5 — distinct add/sub pathways).
 *
 * NB: kept as a separate function rather than collapsing
 * `easyBandLeitnerMeanBox(box, facts)` to avoid touching the live
 * add-to-10 helper signature this wave (AC4 — no add-path refactor). The
 * op-parameterised de-dup is tracked as the §13.8c low-priority cleanup
 * for when a 3rd subitising tier makes the duplication costly.
 */
export function easyBandSubLeitnerMeanBox(
  mathFactsLeitner: LeitnerBox<MathFact>,
): number {
  const seen = new Map<string, number>()
  for (const entry of mathFactsLeitner.items) {
    seen.set(mathFactKey(entry.item), entry.box)
  }

  let sum = 0
  let count = 0
  for (const fact of SUB_EASY_BAND_FACTS) {
    const box = seen.get(mathFactKey(fact))
    if (box === undefined) continue
    sum += box
    count += 1
  }

  if (count === 0) return 0
  return sum / count
}

// ── Deterministic seeded RNG ─────────────────────────────────────────────

/**
 * Mulberry32 — small, fast, deterministic PRNG. 32-bit state, returns
 * a float in `[0, 1)`. Chosen over `Math.random()` because we need
 * `(sessionStartISO, focusNode)` to produce the SAME stream every time
 * the session starts — Marian's session must be reproducible across
 * re-renders, PWA backgrounding, and the App-mounting `useState`
 * initialiser running once.
 *
 * Mulberry32 is the conventional choice for "deterministic, no
 * cryptographic guarantees needed, want it tiny" — ~10 lines, no
 * external dep. The implementation here matches the canonical
 * `tmrw-design/mulberry32` formulation.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 32-bit FNV-1a string hash. Cheap, dependency-free, well-distributed
 * enough for the seeding job here. Returns a 32-bit unsigned int.
 *
 * Why not just sum char codes / use `JSON.stringify().length`: those
 * collide trivially (`'add-to-10'` and `'10-add-to'` would seed the
 * same), and the seed feeds Mulberry32 which is sensitive to the low
 * bits. FNV-1a's avalanche behaviour spreads inputs across the 32-bit
 * range without any external dep — Marian's PWA bundle budget bans
 * cryptographic hash libs for this kind of small job.
 */
function fnv1a32(str: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    // 32-bit FNV prime multiplication via Math.imul to avoid overflow.
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * Build a deterministic RNG keyed on `(sessionStartISO, focusNode)`.
 * Two sessions started at the same ISO timestamp on the same focus
 * node will produce the same stream — exactly what we want for "today
 * is a dots day or it isn't." Across days (or focus nodes), the
 * timestamp / node string changes and the stream changes.
 *
 * Seed derivation: `fnv1a32(sessionStartISO + ':' + focusNode)`. The
 * ':' separator prevents prefix-collision (`'a:b'` vs `'ab:'`
 * disambiguate). Mulberry32 takes the 32-bit unsigned seed and emits
 * the float stream.
 */
export function createSubitisingRng(
  sessionStartISO: string,
  focusNode: string,
): () => number {
  const seed = fnv1a32(`${sessionStartISO}:${focusNode}`)
  return mulberry32(seed)
}

// ── Counter increment helper (called from progressHistory.ts) ────────────

/**
 * Bump `profile.subitisingScaffoldSessionsObserved` by 1, capped at
 * `SCAFFOLD_SESSIONS_OBSERVED_CAP`. Returns the new value.
 *
 * Pure — takes the current value (or undefined / non-finite, defaulting
 * to 0) and returns the next. Called from `recordProgressOnSessionEnd`
 * when the just-completed session is a math session on the
 * `SCAFFOLD_FOCUS_NODE` AND the scaffold actually rendered (i.e. the
 * session result's `subitisingScaffoldRendered` flag is true).
 *
 * "Actually rendered" matters: a session where the scaffold was
 * `scaffoldActiveThisSession=true` BUT no in-scope problem appeared
 * (e.g. 8 problems all with addends > 5 — unlikely under the current
 * planner, but defensible) should NOT increment. The counter measures
 * exposure to the scaffold, not exposure to "the session was eligible."
 * Spec §2.2: "Increments once per session where the scaffold actually
 * rendered."
 */
export function bumpSubitisingScaffoldSessionsObserved(
  current: number | undefined,
): number {
  // Tolerate non-integer / negative / NaN inputs defensively — a
  // corrupted blob shouldn't crash the session-end write path.
  const start =
    typeof current === 'number' && Number.isFinite(current) && current >= 0
      ? Math.floor(current)
      : 0
  return Math.min(start + 1, SCAFFOLD_SESSIONS_OBSERVED_CAP)
}

/**
 * Sub-to-10 sibling of `bumpSubitisingScaffoldSessionsObserved` (spec
 * §13.5 #8). Bumps `profile.subitisingScaffoldSubSessionsObserved` by 1,
 * capped at the shared `SCAFFOLD_SESSIONS_OBSERVED_CAP` (4). Returns the
 * new value.
 *
 * Pure — same defensive defaulting as the add helper. Called from
 * `recordProgressOnSessionEnd` when the just-completed session is a math
 * session on the `SUB_SCAFFOLD_FOCUS_NODE` AND the sub-to-10 minuend
 * scaffold actually rendered. "Actually rendered" matters: the counter
 * measures EXPOSURE to the scaffold, not eligibility (§13.4.1).
 */
export function bumpSubitisingScaffoldSubSessionsObserved(
  current: number | undefined,
): number {
  const start =
    typeof current === 'number' && Number.isFinite(current) && current >= 0
      ? Math.floor(current)
      : 0
  return Math.min(start + 1, SCAFFOLD_SESSIONS_OBSERVED_CAP)
}

// ── internals ────────────────────────────────────────────────────────────

/** Stable string key for a math fact — matches `progressHistory.ts`. */
function mathFactKey(fact: MathFact): string {
  return `${fact.a}${fact.op}${fact.b}`
}

/**
 * Convenience read — clamps any persisted value to the legal
 * `[0, SCAFFOLD_SESSIONS_OBSERVED_CAP]` range, defaulting to 0 on
 * absent / malformed input. Useful at the read site
 * (App.tsx session-start) so the rest of the pipeline doesn't have to
 * re-implement the defaulting.
 */
export function readSubitisingScaffoldSessionsObserved(
  progress: Progress,
): number {
  const raw = progress.profile.subitisingScaffoldSessionsObserved
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return 0
  return Math.min(Math.floor(raw), SCAFFOLD_SESSIONS_OBSERVED_CAP)
}

/**
 * Sub-to-10 sibling of `readSubitisingScaffoldSessionsObserved` (spec
 * §13.4.1). Clamps any persisted `subitisingScaffoldSubSessionsObserved`
 * value to the legal `[0, SCAFFOLD_SESSIONS_OBSERVED_CAP]` range,
 * defaulting to 0 on absent / malformed input. The read-path defaulter
 * for the sub counter (no storage-side `withDefaulted*` pass needed —
 * same precedent as the add field, which defaults at this consumer-read
 * site rather than in `storage.ts`).
 */
export function readSubitisingScaffoldSubSessionsObserved(
  progress: Progress,
): number {
  const raw = progress.profile.subitisingScaffoldSubSessionsObserved
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return 0
  return Math.min(Math.floor(raw), SCAFFOLD_SESSIONS_OBSERVED_CAP)
}
