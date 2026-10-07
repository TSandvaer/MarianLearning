/**
 * Screen 5 -- Session End, with the guidance layer (Guidance G2, ClickUp
 * 123jpnbca4t; folds in the R4 clay reskin).
 *
 * Reference: `design/emmas-path/redesign/guidance-mockup.html` screens
 * b / e / f, team/DECISIONS.md "2026-10-06 — Guidance layer approved",
 * quality bars 9-14. Emma carries the child through one beat order:
 *
 *   1. effort praise ("Seven right! You worked hard!");
 *   2. on a good day the new flower appears and flies into its slot
 *      ("You got a flower!"), then "N of 3";
 *   3. what comes next and when: "It sleeps tonight. Come back tomorrow
 *      for one more." / "A new path opens. Look!" (All done then opens
 *      the map's unlock beat) / "You grew your whole garden!".
 *
 * A not-yet day (under 7 of 8) gets warm praise, an untouched tray and,
 * once a day per world, "Play again to get today's flower.", with Again
 * and Home buttons. A same-day replay after today's flower is praised
 * practice with no new flower. Never a negative beat, never a red X.
 *
 * Stars are in-session feedback only: no stardust total here and nothing
 * collects into the flower. The stardust data writes are unchanged.
 *
 * Audio: Emma's guidance lines (PR #512, `guidanceLines.ts`) play through
 * the map line player; each beat waits for its clip to end, with the real
 * clip length as the floor (`END_CLIP_SECONDS`). The celebration is
 * derived from the one session-end write, so it never replays.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { createSfx, type Sfx } from '../../lib/sfx'
import { cancelSessionAudio } from '../../lib/audio'
import type { PlaySessionUtteranceOptions } from '../../lib/audio'
import SleepSplash from './SleepSplash'
import { recordSessionEnd } from './sessionHistory'
import { localDateKey, now as progressNow } from '../../lib/progress/clock'
import { recordProgressOnSessionEnd } from './progressHistory'
import {
  sessionEndBeat,
  type SessionEndBeat,
} from '../../lib/progress/pathBeats'
import { createMapLinePlayer, type MapLinePlayer } from '../Map/playMapLine'
import { PathImg, SpeakerIcon } from '../Map/mapParts'
import {
  defaultProgress,
  isGraduationSessionPending,
  loadProgress,
  pickFocusNode,
  type Progress,
  type ProgressTrack,
  type SkillNode,
} from '../../lib/progress'
import type { FocusMode } from '../../lib/progress'
import { WORD_SONG_NOVEL_PROBE_WORDS } from '../../../api/_plannerWordList'
import type { GraduationSessionSplit, LeitnerOutcome } from './progressHistory'
import type { StorageAdapter } from '../Math/stardust'
import type { OfferedDistractorClass } from '../Math/Math'
import {
  WORDSONG_SESSION_END_BONUS,
  grantWordSongCompletionBonus,
} from '../_shared/wordSongCompletionBonus'
import {
  sessionEndGuidance,
  type EndBeat,
  type EndLine,
  type FlowerSlot,
  type SessionEndGuidance,
} from './sessionEndGuidance'
import { markNudgeSaid, nudgeSaidToday } from './notYetNudge'
import './sessionEndClay.css'
import type { CSSProperties, ReactElement } from 'react'

// ── Public types ------------------------------------------------------------

// ── Public types ------------------------------------------------------------

export type SessionEndSurface = 'math' | 'word-song'

export interface SessionEndPayload {
  totalCorrect: number
  totalStardust: number
  finalStreak: number
  earnedThisSession: number
  surface: SessionEndSurface
  /**
   * Per-problem clean-win outcome.
   *
   * Original use (ticket 86c9m3aec — word-song graduation): the screen
   * computes the canonical/novel pool split for graduation-session
   * accounting.
   *
   * Extended use (ticket 86c9pwgc8 — M4 Leitner wiring, math): the
   * screen forwards this into `recordProgressOnSessionEnd` so the
   * progress write path can promote / demote each session's facts in
   * `mathFactsLeitner`. Both surfaces emit the field now.
   */
  perProblemCorrect?: readonly boolean[]
  /**
   * Target word per problem (lowercase). Word-song only; undefined for
   * math. Cross-references against
   * `WORD_SONG_NOVEL_PROBE_WORDS` to determine the canonical/novel
   * split.
   */
  targetWords?: readonly string[]
  /**
   * Per-problem first-tap latency in milliseconds, indexed 0..N-1
   * (math only — ticket 86c9pwgc8 M4). Sentinel `-1` means the
   * problem was never tapped. Forwarded into the progress write path
   * for persistence on `SessionHistoryEntry.latencyMs`. Word-song
   * sessions don't ship this field today.
   */
  latencyMs?: readonly number[]
  /**
   * Per-problem math fact, indexed 0..N-1 (math only — ticket
   * 86c9pwgc8 M4). Each entry mirrors the corresponding
   * `MathProblem.{addendA, addendB, correct}` so SessionEnd can map
   * `perProblemCorrect[i]` to a Leitner-box fact key without re-
   * deriving from the audio plan. Word-song sessions don't ship this
   * field; literacy has no Leitner box in v1.
   */
  mathFacts?: readonly { a: number; b: number; op: '+' | '-' | '*' }[]
  /**
   * Whether the subitising scaffold (dot-card overlay) rendered for
   * at least one problem during the just-completed math session
   * (ticket 86c9ur1zr §2.2). Math-surface only; word-song doesn't
   * carry this field.
   *
   * SessionEnd forwards this into `recordProgressOnSessionEnd` so the
   * progress writer can bump
   * `profile.subitisingScaffoldSessionsObserved` once per actual-
   * exposure session. Absent / `false` on word-song surfaces and on
   * legacy math test fixtures that predate the scaffold plumbing.
   */
  subitisingScaffoldRendered?: boolean
  /**
   * Sub-to-10 sibling of `subitisingScaffoldRendered` (ticket 86ca7kdw8
   * / spec §13.4.1). Whether the sub-to-10 minuend scaffold rendered for
   * at least one in-scope problem during the just-completed math session.
   * Math-surface only.
   *
   * SessionEnd forwards this into `recordProgressOnSessionEnd` so the
   * progress writer can bump the SEPARATE
   * `profile.subitisingScaffoldSubSessionsObserved` counter once per
   * actual-exposure sub-to-10 session. Absent / `false` on word-song
   * surfaces and on legacy math test fixtures.
   */
  subitisingScaffoldSubRendered?: boolean
  /**
   * Per-problem first-tap chip value (math only — Kevin schema-first
   * PR pairing with Dave's PR #284 two-digit add/sub research). Each
   * entry is the literal numeric value Marian tapped on her FIRST
   * chip-tap for that problem, regardless of correctness; `null` when
   * no chip was tapped on that problem.
   *
   * Word-song uses the parallel `perProblemAnswerWord` field; the two
   * are mutually exclusive by surface.
   *
   * SessionEnd forwards this into `recordProgressOnSessionEnd` so the
   * progress writer persists the value on
   * `SessionHistoryEntry.perProblemAnswerValue`. Optional for back-
   * compat with hand-built test fixtures predating this PR.
   *
   * See `MathSessionResult.perProblemAnswerValue` for the design
   * rationale (literal value vs distractor-class label).
   */
  perProblemAnswerValue?: readonly (number | null)[]
  /**
   * Per-problem first-tap chip word (word-song only — Kevin schema-
   * first PR pairing with Dave's PR #284 two-digit add/sub research,
   * added for surface parity even though the immediate research case
   * is math). Each entry is the literal word string Marian tapped on
   * her FIRST chip-tap for that problem; `null` when no chip was
   * tapped on that problem.
   *
   * Math uses the parallel `perProblemAnswerValue` field; the two are
   * mutually exclusive by surface.
   *
   * No current consumer; plumbed for future word-song error-pattern
   * classification (e.g. mid-vowel substitution, onset substitution,
   * coda substitution). Optional for back-compat with hand-built test
   * fixtures predating this PR.
   */
  perProblemAnswerWord?: readonly (string | null)[]
  /**
   * Per-problem OFFERED distractor class (math only — Kevin Wave 5
   * PR B, ticket 86c9y1p99). Values: `null` for P1–P3 gentle ramp,
   * one of the `OfferedDistractorClass` union members for P4–P8
   * (`'off-by-one' | 'wrong-op' | 'decade-anchor' | 'forgotten-carry'
   * | 'smaller-from-larger' | 'borrow-no-decrement'`).
   *
   * SessionEnd forwards this into `recordProgressOnSessionEnd` so the
   * progress writer persists it on
   * `SessionHistoryEntry.perProblemDistractorClass`. Optional for
   * back-compat with hand-built test fixtures predating this PR.
   *
   * Type tightened from loose `string | null` to the strict union
   * `OfferedDistractorClass | null` (PR #309 NIT 3, ticket
   * `86c9y34xx`). The producer (`MathSessionResult.perProblemDistractorClass`
   * in `Math.tsx`) has been strict-typed since Wave 5 PR B; the
   * widening to `string` at this hop was a missed contract. Tightening
   * here propagates back through `App.tsx#handleMathComplete` so a
   * future writer can't drop an unknown class label into the in-app
   * forward chain. The persistence-boundary type
   * (`RecordProgressInput.perProblemDistractorClass` /
   * `SessionHistoryEntry.perProblemDistractorClass` in
   * `src/lib/progress/types.ts`) stays loose
   * (`readonly (string | null)[]`) by design — that boundary spans
   * localStorage and must tolerate future taxonomy widenings without
   * a schema bump, mirroring the same posture the type-guard in
   * `src/lib/progress/guards.ts` already documents.
   *
   * See `MathSessionResult.perProblemDistractorClass` for the
   * positional / tap-outcome-independent semantics.
   */
  perProblemDistractorClass?: readonly (OfferedDistractorClass | null)[]
  /**
   * Planner-derived letter-sounds current-target vowel, slash notation
   * (`'/o/'`, `'/u/'`, `'/i/'`, `'/e/'`) (Wave 9 W9.4 — ticket
   * 86c9ya3r9). Word-song letter-sounds surface only. App.tsx captures
   * this from the `/api/claude` response envelope at session-start
   * (`prepareWordSongPathA().currentTargetVowel`), freezes it for the
   * session lifetime, and forwards it here so SessionEnd stamps it onto
   * `RecordProgressInput.currentTargetVowel` — closing the W9.3
   * per-vowel mastery write loop WITHOUT re-deriving from progress.
   *
   * Absent when the server served canon / cache / fallback (greenfield
   * all-`'intro'` state) or when the tier is fully mastered; in those
   * cases the W9.3 mastery rule falls back to the Wave-7 composite-tier
   * 90/3 path. Math + non-letter-sounds word-song surfaces never carry
   * it.
   */
  currentTargetVowel?: '/o/' | '/u/' | '/i/' | '/e/'
  /**
   * The picked session focus IDENTITY — the `{ node, mode }` the session
   * actually ran under (ticket 86ca9atqh). Frozen at session-start
   * kick-time in App.tsx (the SAME `pickFocusNode(progress, track,
   * sessionCount)` call that drives the `/api/claude` request) and threaded
   * through here so SessionEnd records the ACTUAL focus instead of
   * re-deriving it.
   *
   * Why this field exists: SessionEnd's mount-effect previously re-derived
   * focus via `pickFocusNode(progress, track)` with `sessionCount` OMITTED
   * (→ 0). For ordinary forward progression and the one-shot CVC graduation
   * review that re-derivation agrees with the kick-effect (both are
   * sessionCount-independent). But the PERIODIC CVC-review branch
   * (`pickCvcReviewNode`) is gated on `sessionCount > 0 && sessionCount % 5
   * === 0`; a sessionCount-blind re-derivation falls through to the forward
   * walk and lands on the next non-mastered node (e.g. `digraphs-sh`). The
   * session, however, actually RAN as a cross-vowel review — so the
   * re-derived `skillFocus` mislabeled the forward node, and
   * `applyMasteryRule`'s `qualifies()` filter (`skillFocus.includes(node)`)
   * wrongly credited that tier's 90/3 counter (mastery contamination).
   *
   * Optional + additive — callers that don't ship it (hand-built test
   * fixtures predating this ticket) fall back to the sessionCount-blind
   * re-derivation, which stays correct for every branch EXCEPT the periodic
   * review. App.tsx ships it for both surfaces.
   */
  sessionFocus?: { node: SkillNode; mode: FocusMode }
}

/**
 * Signature for playing one pre-rendered session-end utterance by id.
 * Kept for App.tsx's `playUtteranceFn` wiring; the guidance layer plays
 * its own Lily lines (G2) and no longer uses the planner's
 * `session.end.*` bundle.
 */
export type PlayUtteranceFn = (
  utteranceId: string,
  opts?: PlaySessionUtteranceOptions,
) => Promise<void>

export interface SessionEndProps {
  /** Payload from the originating screen's `onSessionComplete`. */
  payload: SessionEndPayload | null
  /**
   * Fires when Marian taps "All done" (or "Home" on a not-yet day). App.tsx
   * routes to the map when an unlock is waiting, else to the Hub. When
   * `undefined` the legacy Sleep splash renders (unit tests).
   */
  onAllDone?: () => void
  /**
   * Not-yet day "Again": start another session in the same world. No
   * Again button renders when this is absent.
   */
  onAgain?: () => void
  /**
   * @deprecated Ignored since Guidance G2 (the planner's `session.end.*`
   * lines are not played any more). Still accepted so App.tsx's wiring
   * compiles unchanged.
   */
  playUtteranceFn?: PlayUtteranceFn
  /** Test seam: replace chime SFX (button tap). */
  chime?: Sfx
  /** Test seam: replace sparkle SFX (flower lands). */
  sparkle?: Sfx
  /** Test seam: replace localStorage adapter. */
  storage?: StorageAdapter
  /** Test seam: clock injection. */
  now?: () => Date
  /** Test seam: player for Emma's guidance lines. */
  createPathPlayer?: () => MapLinePlayer
}

// ── Sequence ----------------------------------------------------------------

type Phase =
  | 'pending' // before the first line
  | EndBeat // 'praise' | 'flower' | 'count' | 'next'
  | 'settled' // every line said, buttons up
  | 'sleep-splash' // legacy post-CTA path

type FlowerStage = 'hidden' | 'pop' | 'fly' | 'landed'

/** Pause between Emma's lines. */
const BEAT_GAP_MS = 300
/** A clip that never ends is given up on this long after its length. */
const LINE_SLACK_MS = 1500
/** The flower pops in, holds, then flies to its slot (lands ≈ the end of
 *  the 1.52 s "You got a flower!" clip). */
const FLOWER_FLY_AT_MS = 650
const FLOWER_LAND_AT_MS = 1450
/** Buttons appear at the latest this long after mount, whatever audio does. */
const FALLBACK_CTA_MS = 20_000

// ── Reduce-motion hook (copied from Greet pattern) --------------------------

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (ev: MediaQueryListEvent) => setReduced(ev.matches)
    if (mq.addEventListener) {
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
    return undefined
  }, [])

  return reduced
}

// ── Component ---------------------------------------------------------------

export default function SessionEnd({
  payload,
  onAllDone,
  onAgain,
  chime: chimeProp,
  sparkle: sparkleProp,
  storage,
  now,
  createPathPlayer = createMapLinePlayer,
}: SessionEndProps): ReactElement {
  const reducedMotion = usePrefersReducedMotion()

  // Normalise the payload per the backwards-compat shim (spec line 96-102)
  const p = useMemo(() => {
    if (!payload) {
      return {
        totalCorrect: 0,
        totalStardust: 0,
        finalStreak: 0,
        earnedThisSession: 0,
        surface: 'math' as const,
      }
    }
    return {
      ...payload,
      surface: payload.surface ?? ('math' as const),
    }
  }, [payload])

  /**
   * Word-song completion bonus (ticket 86c9kwvza): granted here at
   * session end. Nothing shows a stardust total any more (G2); the
   * data attributes below keep exposing it for QA and specs.
   */
  const wordSongCompletionGrant =
    p.surface === 'word-song' ? WORDSONG_SESSION_END_BONUS : 0
  const displayedTotalStardust = p.totalStardust + wordSongCompletionGrant
  const displayedEarnedThisSession =
    p.surface === 'word-song' ? wordSongCompletionGrant : p.earnedThisSession

  // ── SFX instances (lazy-init, one per mount) ----------------------------

  const [chimeInstance] = useState<Sfx>(
    () =>
      chimeProp ??
      createSfx({ src: '/assets/sfx-chime-soft.mp3', volume: 0.85 }),
  )
  const [sparkleInstance] = useState<Sfx>(
    () =>
      sparkleProp ?? createSfx({ src: '/assets/sfx-sparkle.mp3', volume: 0.7 }),
  )

  // ── State -----------------------------------------------------------------

  const [phase, setPhase] = useState<Phase>('pending')
  const [caption, setCaption] = useState('')
  const [showCta, setShowCta] = useState(false)
  const [ctaTapping, setCtaTapping] = useState(false)
  const [flower, setFlower] = useState<FlowerStage>('hidden')
  const [flyTo, setFlyTo] = useState<{ x: number; y: number } | null>(null)
  const [beatKind, setBeatKind] = useState<SessionEndBeat['kind'] | null>(null)

  // What this session earned, computed once from the session-end write.
  const beatRef = useRef<SessionEndBeat | null>(null)
  const guidanceRef = useRef<SessionEndGuidance | null>(null)
  const [guidance, setGuidance] = useState<SessionEndGuidance | null>(null)
  const pathPlayerRef = useRef<MapLinePlayer | null>(null)

  const panelRef = useRef<HTMLDivElement | null>(null)
  const flowerRef = useRef<HTMLDivElement | null>(null)

  // Refs for timer cleanup
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const addTimer = useCallback((cb: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id)
      cb()
    }, ms)
    timersRef.current.push(id)
    return id
  }, [])

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) clearTimeout(id)
    timersRef.current = []
  }, [])

  // ── Persist session history on mount (spec section "localStorage") ------
  //
  // Two writes land here, both gated to mount-once:
  //   1. `recordSessionEnd` -> `marian-tutor.session-history.v1`
  //   2. `recordProgressOnSessionEnd` -> `marian-tutor:progress:v1`
  // Both use the same wall-clock instant. The guidance model (which day
  // this was, the tray, Emma's lines) is derived from the before/after
  // docs of that one write, so it is computed once and never replays.

  useEffect(() => {
    // The progress clock honours the test-only `?debug=1&dayOffset=N`
    // (ticket 123jpnbca4v); `clock` feeds every write below so all three
    // payloads share one instant.
    const clock = now ?? progressNow
    const dateISO = clock().toISOString()
    // Word-song completion bonus (ticket 86c9kwvza). Persists FIRST so
    // `recordSessionEnd` (which reads stardust to compute Hub's
    // `cumulativeStardust` field) sees the post-bonus total — otherwise
    // Hub would understate cumulative stardust for word-song sessions.
    if (p.surface === 'word-song') {
      grantWordSongCompletionBonus(storage, clock)
    }
    recordSessionEnd(p.finalStreak, storage, clock)
    // P0.2 fix (audit follow-up to PR #120): derive the focus node the
    // just-completed session targeted, instead of writing a hardcoded
    // surface-keyed constant. Reads `loadProgress()` and runs the same
    // `pickFocusNode` selector App.tsx uses at session-start fetch time.
    // `skillLevels` cannot have shifted between session-start and now —
    // `applyMasteryRule()` only runs INSIDE `recordProgressOnSessionEnd`
    // (the very next call), so the value here is exactly what the
    // planner saw. Without this fix, M3 silently caps after one
    // promotion hop because new history entries keep claiming the old
    // focus node forever (audit:
    // `design/audits/2026-05-02-polish/jessica-qa-edge-cases.md` P0.2).
    const progressForFocus = loadProgress() ?? defaultProgress()
    const track = trackForSurface(p.surface)
    // ticket 86ca9atqh: prefer the THREADED session focus identity — the
    // `{ node, mode }` App.tsx froze at session-start kick-time from the
    // SAME `pickFocusNode(progress, track, sessionCount)` call that drove
    // the `/api/claude` request. This is the only sessionCount-aware source
    // available at session-end, so it is authoritative for the periodic
    // CVC-review branch (which the local re-derivation below cannot
    // reproduce — it omits `sessionCount`).
    //
    // BACK-COMPAT FALLBACK: when `sessionFocus` is absent (hand-built test
    // fixtures predating this ticket), fall back to the local re-derivation.
    // ticket 86c9qa6n3 widened the picker to `{ node, mode }`. The fallback
    // `mode` is re-derived (sessionCount omitted) to detect the one-shot CVC
    // graduation review — that branch IS sessionCount-independent and fires
    // whenever `cvcGraduationSessionFired` is still false at the session-end
    // write (which it is, until this very write sets it). The writer uses
    // `focusMode` to latch `cvcGraduationSessionFired = true` exactly once.
    // The fallback's `focusNode` keeps the existing P0.2 re-derivation
    // semantics for `skillFocus` / recap. The PERIODIC review branch is the
    // only one the fallback cannot reproduce — and it is exactly the branch
    // the threaded field exists to fix.
    const { node: focusNode, mode: focusMode } =
      p.sessionFocus ?? pickFocusNode(progressForFocus, track)
    // 86c9m3aec: graduation-session split computation. Lives at the
    // session-end persistence boundary because:
    //   1. We need to read `loadProgress()` at the same instant we
    //      record — same `progressForFocus` snapshot used for focus
    //      derivation.
    //   2. The `WordSongSessionResult.targetWords / perProblemCorrect`
    //      shipped from the screen carries the per-problem state
    //      needed to compute the split.
    //
    // Two-step verification: (a) the engine flagged the upcoming
    // session as graduation when the planner request was issued, AND
    // (b) the rendered plan actually contained novel-pool words. The
    // second check guards the fallback path — if the live planner
    // failed and the static `STATIC_WORD_SONG_PLANS` rotation served
    // the screen, no novel words were used and we must NOT compute a
    // split (would mis-classify a fallback session as failed graduation).
    const graduationSplit = computeGraduationSplit(
      progressForFocus,
      track,
      focusNode,
      p,
    )
    // M4 Leitner outcomes (ticket 86c9pwgc8). Math sessions ship
    // `mathFacts` + `perProblemCorrect`; SessionEnd zips them into
    // `LeitnerOutcome[]` so the progress writer can promote / demote
    // each fact. Word-song sessions never ship `mathFacts` (no
    // Leitner box on literacy in v1) so the field stays absent.
    let leitnerOutcomes: ReturnType<typeof buildLeitnerOutcomes> = undefined
    if (
      p.surface === 'math' &&
      p.mathFacts !== undefined &&
      p.perProblemCorrect !== undefined
    ) {
      leitnerOutcomes = buildLeitnerOutcomes(p.mathFacts, p.perProblemCorrect)
    }

    const savedProgress = recordProgressOnSessionEnd({
      surface: p.surface,
      totalCorrect: p.totalCorrect,
      dateISO,
      focusNode,
      // ticket 86c9qa6n3: thread the focus MODE so the writer can latch
      // `cvcGraduationSessionFired = true` once the CVC graduation review
      // has fired. `'cvc-review'` here (with the latch still false) means
      // this session WAS the graduation review.
      focusMode,
      ...(graduationSplit !== null ? { graduationSplit } : {}),
      ...(leitnerOutcomes !== undefined ? { leitnerOutcomes } : {}),
      // Latency persistence (ticket 86c9pwgc8 — M4). Math only;
      // word-song doesn't ship `latencyMs` today.
      ...(p.surface === 'math' && p.latencyMs !== undefined
        ? { latencyMs: p.latencyMs }
        : {}),
      // mathFacts persistence (M4.x slow-fact directive — follow-up
      // to 86c9pwgc8). Math only; word-song has no Leitner box on
      // literacy in v1. Persisted as a parallel array to `latencyMs`
      // so the slow-fact session-gen hint can join latency to a
      // concrete fact key without re-deriving from the audio plan.
      ...(p.surface === 'math' && p.mathFacts !== undefined
        ? { mathFacts: p.mathFacts }
        : {}),
      // Subitising scaffold exposure flag (ticket 86c9ur1zr §2.2).
      // Forwarded so the progress writer bumps
      // profile.subitisingScaffoldSessionsObserved once per actual-
      // exposure session. Math-surface only; word-song doesn't carry
      // the field — recordProgressOnSessionEnd defaults to `false` on
      // absence and the focus-node gate inside the writer skips the
      // bump for non-`add-to-10` sessions anyway.
      ...(p.surface === 'math' && p.subitisingScaffoldRendered === true
        ? { subitisingScaffoldRendered: true }
        : {}),
      // Sub-to-10 minuend-scaffold exposure flag (ticket 86ca7kdw8
      // §13.4.1). Forwarded so the writer bumps the SEPARATE
      // profile.subitisingScaffoldSubSessionsObserved counter once per
      // actual-exposure sub-to-10 session. Math-surface only; the
      // focus-node gate inside the writer skips the bump for
      // non-`sub-to-10` sessions.
      ...(p.surface === 'math' && p.subitisingScaffoldSubRendered === true
        ? { subitisingScaffoldSubRendered: true }
        : {}),
      // Per-problem first-tap chip value (Kevin schema-first PR,
      // 2026-05-21, pairing with Dave's PR #284 two-digit add/sub
      // research). Math only; persists on
      // `SessionHistoryEntry.perProblemAnswerValue` so a future tier-
      // ship PR can classify wrong-tap patterns post-hoc.
      ...(p.surface === 'math' && p.perProblemAnswerValue !== undefined
        ? { perProblemAnswerValue: p.perProblemAnswerValue }
        : {}),
      // Per-problem first-tap chip word (Kevin schema-first PR,
      // 2026-05-21). Word-song only; surface parity with math's
      // `perProblemAnswerValue`. No current consumer.
      ...(p.surface === 'word-song' && p.perProblemAnswerWord !== undefined
        ? { perProblemAnswerWord: p.perProblemAnswerWord }
        : {}),
      // Per-problem OFFERED distractor class (Kevin Wave 5 PR B,
      // 2026-05-22, ticket 86c9y1p99). Math only; persists on
      // `SessionHistoryEntry.perProblemDistractorClass`. Wave-1b
      // schema PR already authored the type-level field + guard
      // accept-path; this PR ships the population wiring at math
      // session-end.
      ...(p.surface === 'math' && p.perProblemDistractorClass !== undefined
        ? { perProblemDistractorClass: p.perProblemDistractorClass }
        : {}),
      // Letter-sounds current-target vowel (Wave 9 W9.4 — ticket
      // 86c9ya3r9). Forward the planner-derived vowel App.tsx captured
      // from the session-start response so the W9.3 per-vowel mastery
      // rule tags this history entry with the exact vowel the planner
      // targeted — no re-derivation. Gated on the re-derived focus node
      // being `letter-sounds` (the writer itself also gates on this, so
      // the guard is belt-and-braces). Absent → writer falls back to
      // the Wave-7 composite-tier mastery path.
      ...(p.surface === 'word-song' &&
      focusNode === 'letter-sounds' &&
      p.currentTargetVowel !== undefined
        ? { currentTargetVowel: p.currentTargetVowel }
        : {}),
    })
    // Emma's Path 9/10 + Guidance G2: before = the doc this session started
    // from, after = the doc just saved. `??=` keeps the first answer if the
    // effect runs twice (StrictMode dev re-run would see its own write as
    // `before`).
    beatRef.current ??= sessionEndBeat(
      progressForFocus,
      savedProgress,
      focusNode,
    )
    if (guidanceRef.current === null) {
      const today = localDateKey(clock())
      const world = trackForSurface(p.surface)
      const g = sessionEndGuidance({
        before: progressForFocus,
        after: savedProgress,
        node: focusNode,
        ...(p.currentTargetVowel !== undefined
          ? { vowel: p.currentTargetVowel }
          : {}),
        beat: beatRef.current,
        totalCorrect: p.totalCorrect,
        today,
        nudgeSaidToday: nudgeSaidToday(world, today, storage),
      })
      // "Play again to get today's flower" is said at most once a day:
      // marked as said the moment it is scheduled, so a reload or an
      // early Home tap never earns a second one.
      if (g.lines.some((l) => l.id === 'guide.end.not-yet.again')) {
        markNudgeSaid(world, today, storage)
      }
      guidanceRef.current = g
      setGuidance(g)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Speak one line: wait for the clip to end, never less than its length,
  //    never longer than its length + slack. --------------------------------

  const speak = useCallback(
    (line: EndLine): Promise<void> =>
      new Promise<void>((resolve) => {
        let audioDone = false
        let floorDone = false
        let finished = false
        const finish = () => {
          if (finished) return
          finished = true
          resolve()
        }
        const check = () => {
          if (audioDone && floorDone) finish()
        }
        addTimer(() => {
          floorDone = true
          check()
        }, line.seconds * 1000)
        addTimer(finish, line.seconds * 1000 + LINE_SLACK_MS)
        pathPlayerRef.current ??= createPathPlayer()
        void pathPlayerRef.current.play(line).then(() => {
          audioDone = true
          check()
        })
      }),
    [addTimer, createPathPlayer],
  )

  // ── Flower flight: measured from the floating flower to its hole ---------

  const measureFlight = useCallback(
    (slot: number): { x: number; y: number } | null => {
      const hole = panelRef.current?.querySelector<HTMLElement>(
        `[data-slot-index="${slot}"]`,
      )
      const fl = flowerRef.current
      if (!hole || !fl) return null
      const a = fl.getBoundingClientRect()
      const b = hole.getBoundingClientRect()
      return {
        x: b.left + b.width / 2 - (a.left + a.width / 2),
        y: b.top + b.height / 2 - (a.top + a.height / 2),
      }
    },
    [],
  )

  // ── Orchestrate the beats on mount ---------------------------------------

  useEffect(() => {
    let cancelled = false
    const fallback = addTimer(() => setShowCta(true), FALLBACK_CTA_MS)

    const run = async () => {
      const g = guidanceRef.current
      setBeatKind(beatRef.current?.kind ?? 'none')
      if (g === null) {
        setShowCta(true)
        return
      }
      for (let i = 0; i < g.lines.length; i++) {
        if (cancelled) return
        const line = g.lines[i]!
        if (i > 0) {
          await new Promise<void>((r) => addTimer(r, BEAT_GAP_MS))
          if (cancelled) return
        }
        setPhase(line.beat)
        setCaption(line.text)
        // Buttons come up with Emma's last line, so the explanation is
        // heard but never holds her on the screen.
        if (i === g.lines.length - 1) setShowCta(true)
        if (line.beat === 'flower' && g.newSlot !== null) {
          const slot = g.newSlot
          setFlower('pop')
          if (reducedMotion) {
            addTimer(() => setFlower('landed'), 300)
          } else {
            addTimer(() => {
              setFlyTo(measureFlight(slot) ?? { x: 0, y: 0 })
              setFlower('fly')
            }, FLOWER_FLY_AT_MS)
            addTimer(() => {
              setFlower('landed')
              sparkleInstance.play()
            }, FLOWER_LAND_AT_MS)
          }
        }
        await speak(line)
      }
      if (cancelled) return
      clearTimeout(fallback)
      setPhase('settled')
      setShowCta(true)
    }
    void run()

    return () => {
      cancelled = true
      clearTimers()
      pathPlayerRef.current?.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Cleanup on unmount ----------------------------------------------------

  useEffect(() => {
    return () => {
      chimeInstance.unload()
      sparkleInstance.unload()
      pathPlayerRef.current?.unload()
      pathPlayerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Button taps -------------------------------------------------------------

  const leave = useCallback(
    (to: (() => void) | undefined) => {
      if (phase === 'sleep-splash' || ctaTapping) return
      setCtaTapping(true)
      chimeInstance.play()
      cancelSessionAudio()
      pathPlayerRef.current?.cancel()
      if (to) {
        addTimer(to, 300)
        return
      }
      // Legacy path (no router wired): fade to the sleep splash.
      addTimer(() => setPhase('sleep-splash'), 300)
    },
    [phase, ctaTapping, chimeInstance, addTimer],
  )
  const handleCtaTap = useCallback(() => leave(onAllDone), [leave, onAllDone])
  const handleAgainTap = useCallback(() => leave(onAgain), [leave, onAgain])

  // ── Render ----------------------------------------------------------------

  const day = guidance?.day ?? 'practice'
  const flowerDay = guidance?.newSlot != null
  const landed = flower === 'landed'
  const slots: FlowerSlot[] =
    guidance === null
      ? []
      : landed || !flowerDay
        ? guidance.slotsAfter
        : guidance.slotsBefore
  const starCount = Math.max(0, Math.min(8, p.totalCorrect))
  const notYet = day === 'not-yet'

  return (
    <m.main
      data-testid="session-end"
      data-surface={p.surface}
      data-phase={phase}
      data-day={guidance?.day ?? 'pending'}
      data-total-stardust={displayedTotalStardust}
      data-earned={displayedEarnedThisSession}
      data-final-streak={p.finalStreak}
      data-completion-bonus={wordSongCompletionGrant}
      data-path-beat={beatKind ?? 'pending'}
      className="se-clay relative h-full w-full overflow-hidden font-clay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div aria-hidden className="se-garden" />

      <div className="se-stack">
        {/* Emma: cheering when a flower came, calm and warm otherwise. */}
        <div className="se-emma">
          <m.img
            key={flowerDay ? 'cheering' : 'idle'}
            data-testid="session-end-emma"
            src={
              flowerDay ? '/assets/emma-cheering.svg' : '/assets/emma-idle.svg'
            }
            alt={flowerDay ? 'Emma celebrating' : 'Emma smiling'}
            draggable={false}
            className="h-full w-auto select-none"
            initial={
              reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }
            }
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            transition={
              reducedMotion
                ? { duration: 0.3 }
                : { type: 'spring', stiffness: 180, damping: 20 }
            }
          />
        </div>

        {/* The clay panel: stars (feedback only), the step, its tray. */}
        <div
          ref={panelRef}
          data-testid="session-end-panel"
          className="se-panel"
        >
          <div className="se-stars" aria-hidden data-testid="session-end-stars">
            {Array.from({ length: starCount }, (_, i) => (
              <span
                key={i}
                className={reducedMotion ? 'se-star' : 'se-star se-twinkle'}
                style={
                  { '--d': `${(0.5 + i * 0.08).toFixed(2)}s` } as CSSProperties
                }
              >
                <StarIcon />
              </span>
            ))}
          </div>

          {guidance !== null && (
            <div className="se-row">
              <PathImg
                id={guidance.node}
                px={112}
                testId="session-end-step"
                style={{ filter: 'drop-shadow(0 5px 3px rgba(60,30,10,.25))' }}
              />
              <div
                data-testid="session-end-tray"
                data-world={guidance.world}
                data-state={landed || !flowerDay ? 'after' : 'before'}
                className={`se-tray ${guidance.world === 'math' ? 'se-tray-ng' : 'se-tray-ws'}`}
              >
                {slots.map((slot, i) => (
                  <Hole
                    key={i}
                    index={i}
                    slot={slot}
                    pop={landed && i === guidance.newSlot}
                    reducedMotion={reducedMotion}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="se-count-row">
            <AnimatePresence>
              {landed && guidance?.countText != null && (
                <m.div
                  key="count"
                  data-testid="session-end-count"
                  className="se-count"
                  initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={
                    reducedMotion
                      ? { duration: 0.2 }
                      : { type: 'spring', stiffness: 320, damping: 16 }
                  }
                >
                  {guidance.countText}
                </m.div>
              )}
            </AnimatePresence>
          </div>

          {/* Today's flower: pops in, then flies into its slot. */}
          {(flower === 'pop' || flower === 'fly') && (
            <m.div
              ref={flowerRef}
              data-testid="session-end-new-flower"
              data-stage={flower}
              className="se-newflower"
              initial={
                reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0 }
              }
              animate={
                flower === 'fly' && flyTo !== null
                  ? { opacity: 1, x: flyTo.x, y: flyTo.y, scale: 0.72 }
                  : { opacity: 1, scale: 1 }
              }
              transition={
                flower === 'fly'
                  ? { duration: 0.75, ease: [0.5, 0, 0.3, 1] }
                  : reducedMotion
                    ? { duration: 0.2 }
                    : { type: 'spring', stiffness: 300, damping: 14 }
              }
            >
              <PathImg id="ui-bud-open" px={120} />
            </m.div>
          )}
        </div>

        {/* Buttons. A not-yet day offers Again + Home; every other day one
            "All done" (it opens the map when an unlock is waiting). */}
        <div className="se-buttons">
          <AnimatePresence>
            {showCta && phase !== 'sleep-splash' && notYet && onAgain && (
              <m.button
                key="again"
                type="button"
                data-testid="session-end-again"
                aria-label="Again"
                onClick={handleAgainTap}
                className="se-btn se-btn-go"
                style={{ width: 330 }}
                initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <AgainIcon />
                <span>Again</span>
              </m.button>
            )}
            {showCta && phase !== 'sleep-splash' && (
              <m.button
                key={notYet ? 'home' : 'all-done'}
                type="button"
                data-testid="session-end-cta"
                aria-label={notYet ? 'Home' : 'All done!'}
                onClick={handleCtaTap}
                className={notYet ? 'se-btn se-btn-alt' : 'se-btn se-btn-go'}
                style={{ width: notYet ? (onAgain ? 220 : 300) : 360 }}
                initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {notYet ? <PathImg id="ui-house" px={56} /> : <CheckIcon />}
                <span>{notYet ? 'Home' : 'All done'}</span>
              </m.button>
            )}
          </AnimatePresence>
        </div>

        {/* Caption ribbon = Emma's spoken line. It sits in the layout under
            the buttons, in a slot that always holds room for two lines, so
            no line can cover a button. */}
        <div className="se-caption-slot">
          {caption.length > 0 && phase !== 'sleep-splash' && (
            <div
              data-testid="session-end-ribbon"
              role="status"
              aria-live="polite"
              className="se-caption"
            >
              <SpeakerIcon />
              <p data-testid="session-end-caption" className="m-0">
                {caption}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sleep splash overlay (legacy path, no router wired) */}
      <AnimatePresence>
        {phase === 'sleep-splash' && <SleepSplash key="sleep-splash" />}
      </AnimatePresence>
    </m.main>
  )
}

// ── Pieces ------------------------------------------------------------------

/** One clay hole of the flower tray. */
function Hole({
  index,
  slot,
  pop,
  reducedMotion,
}: {
  index: number
  slot: FlowerSlot
  pop: boolean
  reducedMotion: boolean
}): ReactElement {
  return (
    <span
      data-testid="session-end-slot"
      data-slot-index={index}
      data-slot={slot}
      className={slot === 'sleeping' ? 'se-hole se-sleep' : 'se-hole'}
    >
      {slot !== 'empty' && (
        <m.span
          className="se-hole-flower"
          initial={
            pop ? (reducedMotion ? { opacity: 0 } : { scale: 0.7 }) : false
          }
          animate={
            pop ? (reducedMotion ? { opacity: 1 } : { scale: 1 }) : undefined
          }
          transition={{ duration: reducedMotion ? 0.2 : 0.35 }}
        >
          <PathImg
            id={slot === 'sleeping' ? 'ui-bud-closed' : 'ui-bud-open'}
            px={82}
          />
        </m.span>
      )}
      {slot === 'sleeping' && (
        <>
          <MoonIcon />
          <span aria-hidden className="se-zz">
            z
          </span>
        </>
      )}
    </span>
  )
}

function StarIcon(): ReactElement {
  return (
    <svg viewBox="0 0 100 100" aria-hidden>
      <defs>
        <radialGradient id="se-star-g" cx="40%" cy="30%">
          <stop offset="0" stopColor="#fff6a8" />
          <stop offset=".6" stopColor="#ffd23f" />
          <stop offset="1" stopColor="#f0a818" />
        </radialGradient>
      </defs>
      <path
        d="M50 6 L62 36 L94 38 L69 59 L77 91 L50 73 L23 91 L31 59 L6 38 L38 36 Z"
        fill="url(#se-star-g)"
        stroke="#e39a10"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MoonIcon(): ReactElement {
  return (
    <svg className="se-moon" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <radialGradient id="se-moon-g" cx="35%" cy="30%">
          <stop offset="0" stopColor="#fffbd6" />
          <stop offset=".7" stopColor="#ffe27a" />
          <stop offset="1" stopColor="#f0b72a" />
        </radialGradient>
      </defs>
      <path
        d="M62 8 A44 44 0 1 0 92 70 A36 36 0 1 1 62 8 Z"
        fill="url(#se-moon-g)"
        stroke="#d99a1a"
        strokeWidth="3"
      />
    </svg>
  )
}

function CheckIcon(): ReactElement {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="se-btn-icon">
      <path
        d="M20 52 L42 72 L80 30"
        stroke="#fff"
        strokeWidth="14"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AgainIcon(): ReactElement {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="se-btn-icon">
      <path
        d="M76 34 A32 32 0 1 0 82 58"
        stroke="#fff"
        strokeWidth="12"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M84 14 L80 40 L56 34 Z" fill="#fff" />
    </svg>
  )
}

// ── Helpers -----------------------------------------------------------------

/**
 * Map the SessionEnd `surface` discriminant to the `ProgressTrack` shape
 * used by `pickFocusNode` / `pickRecentSuccessRate`. The two unions are
 * intentionally identical today (`'math' | 'word-song'`) but live in
 * different domains — the surface is a UI/audio routing key, the track
 * is a curriculum partition. Funnelling through one helper keeps the
 * coupling explicit so a future divergence (a third surface, or a track
 * rename) only needs touching once.
 */
function trackForSurface(surface: SessionEndSurface): ProgressTrack {
  return surface
}

/**
 * Compute the graduation-session split for the just-completed session
 * (ticket 86c9m3aec). Returns `null` when this was NOT a graduation
 * run, in which case `recordProgressOnSessionEnd` falls back to the
 * legacy `totalCorrect / 8` shape.
 *
 * Two-step verification (both must hold):
 *   1. The engine flagged the upcoming session as graduation when the
 *      planner request was issued — meaning at session-start, the last
 *      `threshold.sessions` qualifying entries were all canonical and
 *      the node was at 'practicing'. Re-evaluated here by reading
 *      `loadProgress()` BEFORE the new entry is appended; the value is
 *      identical to what App.tsx computed at session-start because
 *      `applyMasteryRule` only runs INSIDE
 *      `recordProgressOnSessionEnd` (the very next call after this
 *      function returns).
 *   2. The rendered plan actually contained novel-pool words.
 *      `targetWords` is the 8-word vector the screen displayed; we
 *      intersect with `WORD_SONG_NOVEL_PROBE_WORDS`. If the
 *      intersection is empty the live planner did NOT honour the
 *      graduation flag (likely the static `STATIC_WORD_SONG_PLANS`
 *      fallback ran). We treat that as a non-graduation session — the
 *      next session will re-attempt graduation per the detector.
 *
 * Defensive: when `targetWords` or `perProblemCorrect` is missing
 * (math sessions, hand-built test fixtures), this returns `null`
 * without inspecting the inputs further. Math sessions always return
 * `null` because `WORD_SONG_NOVEL_PROBE_WORDS` only resolves on the
 * word-song track.
 */
function computeGraduationSplit(
  progress: Progress,
  track: ProgressTrack,
  focusNode: SkillNode,
  payload: SessionEndPayload,
): GraduationSessionSplit | null {
  if (track !== 'word-song') return null
  const targetWords = payload.targetWords
  const perProblemCorrect = payload.perProblemCorrect
  if (!targetWords || !perProblemCorrect) return null
  if (targetWords.length !== perProblemCorrect.length) return null

  // Step 1: was the upcoming session flagged as graduation?
  if (!isGraduationSessionPending(progress, focusNode, track)) return null

  // Step 2: did the rendered plan actually use novel-pool words?
  const novelSet: ReadonlySet<string> = new Set(WORD_SONG_NOVEL_PROBE_WORDS)
  let canonicalCount = 0
  let canonicalCorrect = 0
  let novelCount = 0
  let novelCorrect = 0
  for (let i = 0; i < targetWords.length; i++) {
    const word = targetWords[i]!
    const correct = perProblemCorrect[i] === true
    if (novelSet.has(word)) {
      novelCount += 1
      if (correct) novelCorrect += 1
    } else {
      canonicalCount += 1
      if (correct) canonicalCorrect += 1
    }
  }

  // Live planner did not honour the graduation directive (likely
  // fallback static plan ran). Don't compute split — let the engine
  // treat this as a regular session and re-attempt graduation next
  // time.
  if (novelCount === 0) return null

  return {
    canonicalCorrect,
    canonicalCount,
    novelCorrect,
    novelCount,
  }
}

/**
 * Zip math facts + per-problem first-tap outcomes into the Leitner-
 * outcome shape the progress writer consumes (ticket 86c9pwgc8 — M4).
 *
 * Defensive shape:
 *   - When the two arrays have unequal lengths, emit only the
 *     overlapping prefix. A length mismatch indicates an upstream
 *     bug; emitting the partial set is safer than throwing (the
 *     screen has already done its job and bricking the session-end
 *     persistence over a length skew is the wrong tradeoff).
 *   - When `correct` is undefined (out-of-range index), the outcome
 *     still carries the fact so the box self-populates; the rank is
 *     left unchanged in the writer.
 */
function buildLeitnerOutcomes(
  facts: ReadonlyArray<{ a: number; b: number; op: '+' | '-' | '*' }>,
  perProblemCorrect: readonly boolean[],
): LeitnerOutcome[] | undefined {
  const n = Math.min(facts.length, perProblemCorrect.length)
  if (n === 0) return undefined
  const out: LeitnerOutcome[] = new Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = {
      fact: { a: facts[i]!.a, b: facts[i]!.b, op: facts[i]!.op },
      correct: perProblemCorrect[i],
    }
  }
  return out
}
