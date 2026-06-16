/**
 * Screen 5 -- Session End.
 *
 * Spec: `design/screen-5-session-end.md`
 *
 * Mounts after problem 8 on either Math or Word Song. Shows a calm,
 * predictable closing moment: stardust count-up, optional streak band,
 * spoken goodbye via Path A TTS, and a single "All done!" CTA that leads
 * to the Option C sleep splash.
 *
 * This is NOT a results screen or a report card. It celebrates "you did
 * the thing" without quantifying wrongs, ranking against past self, or
 * dangling a re-engagement nudge.
 *
 * Audio contract
 * --------------
 * All TTS is routed through `playUtteranceFn` (backed by
 * `sessionAudio.playSessionUtterance` in production). The session-start
 * audio bundle includes all Session-End utterances pre-rendered. This
 * screen does NOT use `lib/tts.speak()` or `preRecorded.playGreetLine()`.
 *
 * The audio context is already gesture-unlocked from the last tap on
 * Math/Word Song's problem 8. `useAudioUnlockGate` is NOT used here.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { createSfx, type Sfx } from '../../lib/sfx'
import { cancelSessionAudio } from '../../lib/audio'
import type { PlaySessionUtteranceOptions } from '../../lib/audio'
import StardustCounter from './StardustCounter'
import StreakBand from './StreakBand'
import SleepSplash from './SleepSplash'
import { recordSessionEnd } from './sessionHistory'
import { recordProgressOnSessionEnd } from './progressHistory'
import { focusRecapLine } from './friendlyNodeName'
import {
  defaultProgress,
  isGraduationSessionPending,
  loadProgress,
  pickFocusNode,
  type FocusMode,
  type Progress,
  type ProgressTrack,
  type SkillNode,
} from '../../lib/progress'
import { WORD_SONG_NOVEL_PROBE_WORDS } from '../../../api/_plannerWordList'
import type { GraduationSessionSplit, LeitnerOutcome } from './progressHistory'
import type { StorageAdapter } from '../Math/stardust'
import type { OfferedDistractorClass } from '../Math/Math'
import {
  WORDSONG_SESSION_END_BONUS,
  grantWordSongCompletionBonus,
} from '../_shared/wordSongCompletionBonus'
import type { ReactElement } from 'react'

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
 * Backed by `sessionAudio.playSessionUtterance` in production.
 */
export type PlayUtteranceFn = (
  utteranceId: string,
  opts?: PlaySessionUtteranceOptions,
) => Promise<void>

export interface SessionEndProps {
  /** Payload from the originating screen's `onSessionComplete`. */
  payload: SessionEndPayload | null
  /**
   * Optional: fires when Marian taps "All done!". When provided, the
   * screen routes to Hub via this handler instead of falling through
   * to the legacy Sleep splash. Wired by App.tsx as part of the Hub
   * navigation contract (`design/screen-hub.md` § "Q4: Session-End →
   * Hub flip"). When `undefined` the legacy Sleep-splash path runs —
   * preserved for unit tests + the dark-launch fallback Thomas
   * approves.
   */
  onAllDone?: () => void
  /** Test seam: replace the live Path A playback function. */
  playUtteranceFn?: PlayUtteranceFn
  /** Test seam: replace chime SFX. */
  chime?: Sfx
  /** Test seam: replace sparkle SFX. */
  sparkle?: Sfx
  /** Test seam: replace plink SFX. */
  plink?: Sfx
  /** Test seam: replace localStorage adapter. */
  storage?: StorageAdapter
  /** Test seam: clock injection. */
  now?: () => Date
}

// ── Sequence phases ---------------------------------------------------------

type Phase =
  | 'opener' // t=0: "You did it!" + sparkle burst
  | 'focus-recap' // t~1100: "You worked on <friendly-name> today!" (M5). SKIPPED entirely (never entered) when the `session.end.recap.focus` utterance is unavailable/rejects — see the focus-recap block in the TTS sequence effect (M5 #451 graceful skip).
  | 'recap' // t~2500: stardust count-up + "You earned N stars!"
  | 'streak' // t~4500: streak band (if finalStreak >= 3)
  | 'goodbye' // t~6100: "See you soon."
  | 'settled' // t~7300: CTA visible, idle
  | 'sleep-splash' // post-CTA-tap

// ── Timing constants (spec section "Audio dispatch sequence") ---------------

const OPENER_DELAY_MS = 0
// M5 (ticket 86c9kmwh0): the focus-recap beat ("You worked on … today!")
// lands between the opener and the stardust recap. The downstream beats
// (recap / streak / goodbye / CTA) each shift +1100ms to keep the same
// ~1.4-2s breathing room between spoken lines that the pre-M5 sequence had.
const FOCUS_RECAP_DELAY_MS = 1100
const RECAP_DELAY_MS = 2500
const STREAK_DELAY_MS = 4500
const GOODBYE_DELAY_MS = 6100
const CTA_DELAY_MS = 7300
// Fallback CTA reveal if all audio fails. Bumped +1100ms in lockstep with
// the focus-recap shift so the silent-audio path still settles AFTER the
// last spoken beat would have, never before it.
const FALLBACK_CTA_DELAY_MS = 5100

// ── Spring presets (spec section "Motion") ----------------------------------

const RIBBON_SPRING = {
  type: 'spring' as const,
  stiffness: 260,
  damping: 20,
}

const CTA_SPRING = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 16,
}

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
  playUtteranceFn,
  chime: chimeProp,
  sparkle: sparkleProp,
  plink: plinkProp,
  storage,
  now,
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
   * Word-song completion bonus (ticket 86c9kwvza, locked 2026-05-02).
   *
   * Per Dave's audit, word-song stardust moved from per-correct-tap to
   * per-session-end. WordSong no longer mutates the stardust store while
   * Marian is playing; the flat `+WORDSONG_SESSION_END_BONUS` is granted
   * here, in the mount effect, alongside the other session-end persistence
   * writes. Math is unchanged — its grants land per-correct inside Math.tsx.
   *
   * `displayedTotalStardust` is what the counter ticks up to AND what the
   * `data-total-stardust` data-attribute exposes for QA. For math it equals
   * `payload.totalStardust` (already includes the in-session grants). For
   * word-song it equals `payload.totalStardust + WORDSONG_SESSION_END_BONUS`
   * because the bonus has not yet been folded into the payload at the point
   * Marian's last chip-tap fires `onSessionComplete`.
   */
  const wordSongCompletionGrant =
    p.surface === 'word-song' ? WORDSONG_SESSION_END_BONUS : 0
  const displayedTotalStardust = p.totalStardust + wordSongCompletionGrant
  const displayedEarnedThisSession =
    p.surface === 'word-song' ? wordSongCompletionGrant : p.earnedThisSession

  /**
   * Focus-recap copy (M5, ticket 86c9kmwh0): "You worked on <friendly-name>
   * today!". The friendly name is derived from the session's focus node —
   * the SAME `pickFocusNode(loadProgress() ?? defaultProgress(), track)`
   * derivation the mount-persistence effect uses below. Computed once via a
   * lazy initializer so it reflects the focus node as it was at SESSION-
   * START: `applyMasteryRule()` (which could shift `skillLevels`) only runs
   * INSIDE `recordProgressOnSessionEnd` in the mount effect, which has not
   * fired yet at first render — so this read sees exactly what the planner
   * saw, matching the P0.2 invariant documented on the mount effect.
   */
  const [focusRecapCopy] = useState<string>(() => {
    // ticket 86ca9atqh: prefer the threaded session focus node so the recap
    // names the tier the session ACTUALLY ran under (a periodic CVC review
    // names the reviewed CVC tier, not the sessionCount-blind forward node).
    // Falls back to the re-derivation for hand-built fixtures.
    if (payload?.sessionFocus) {
      return focusRecapLine(payload.sessionFocus.node)
    }
    const progressForFocus = loadProgress() ?? defaultProgress()
    const track = trackForSurface(payload?.surface ?? 'math')
    // `.node` — the recap copy only needs the focus node, not the
    // forward/cvc-review mode (ticket 86c9qa6n3 widened the return shape).
    return focusRecapLine(pickFocusNode(progressForFocus, track).node)
  })

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
  const [plinkInstance] = useState<Sfx>(
    () => plinkProp ?? createSfx({ src: '/assets/sfx-plink.mp3', volume: 0.6 }),
  )

  // ── Phase state machine -------------------------------------------------

  const [phase, setPhase] = useState<Phase>('opener')
  const [captionText, setCaptionText] = useState('')
  const [captionRevealed, setCaptionRevealed] = useState(0)
  const [showStardustCounter, setShowStardustCounter] = useState(false)
  const [showStreakBand, setShowStreakBand] = useState(false)
  const [showCta, setShowCta] = useState(false)
  const [ctaTapping, setCtaTapping] = useState(false)

  // Refs for timer cleanup
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const audioFailedRef = useRef(false)

  const addTimer = useCallback((cb: () => void, ms: number) => {
    const id = setTimeout(() => {
      // Remove from the tracked list
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
  //   1. `recordSessionEnd` -> `marian-tutor.session-history.v1` (Hub stats:
  //      session count, day-streak, lastPlayed, etc.)
  //   2. `recordProgressOnSessionEnd` -> `marian-tutor:progress:v1` (adaptive
  //      engine plumbing: rolling SessionHistoryEntry list capped at 30, plus
  //      profile.lastPlayedISO). Ticket 86c9kmu63 is the first production
  //      caller of `saveProgress` — until now the progress blob was only
  //      exercised by unit tests.
  //
  // Both writes use the same wall-clock instant for clean cross-payload
  // correlation. The progress write goes through its own helper so the
  // SessionEnd component stays UI-only; the helper handles `loadProgress
  // ?? defaultProgress()` and the `MAX_SESSION_HISTORY=30` trim is enforced
  // inside `saveProgress`.

  useEffect(() => {
    const clock = now ?? (() => new Date())
    const dateISO = clock().toISOString()
    // Word-song completion bonus (ticket 86c9kwvza). Persists FIRST so
    // `recordSessionEnd` (which reads stardust to compute Hub's
    // `cumulativeStardust` field) sees the post-bonus total — otherwise
    // Hub would understate cumulative stardust for word-song sessions.
    if (p.surface === 'word-song') {
      grantWordSongCompletionBonus(storage, now)
    }
    recordSessionEnd(p.finalStreak, storage, now)
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

    recordProgressOnSessionEnd({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Play utterance helper (tolerant of missing fn) ----------------------

  const playUtterance = useCallback(
    (
      utteranceId: string,
      opts?: PlaySessionUtteranceOptions,
    ): Promise<void> => {
      if (!playUtteranceFn) {
        // Silent fallback: fire onPlay immediately, tick words linearly
        // at 165 wpm so caption still reveals. Matches Math's default.
        return new Promise<void>((resolve) => {
          opts?.onPlay?.()
          opts?.onWordTick?.(0)
          resolve()
        })
      }
      return playUtteranceFn(utteranceId, opts)
    },
    [playUtteranceFn],
  )

  // ── Orchestrate the TTS sequence on mount -------------------------------

  useEffect(() => {
    // Fallback timer: surface CTA even if all audio fails
    const fallbackTimerId = addTimer(() => {
      if (!showCta) {
        setShowCta(true)
        setPhase('settled')
      }
    }, FALLBACK_CTA_DELAY_MS)

    // t=0: Opener -- "You did it!"
    const runSequence = async () => {
      try {
        // Play sparkle SFX on entry
        sparkleInstance.play()

        // Play opener utterance
        setPhase('opener')
        await new Promise<void>((resolve, reject) => {
          const timer = addTimer(() => {
            playUtterance('session.end.opener', {
              onPlay: () => {
                // Cancel the fallback timer -- audio is working
                clearTimeout(fallbackTimerId)
                timersRef.current = timersRef.current.filter(
                  (t) => t !== fallbackTimerId,
                )
              },
              onWordTick: (wordIndex) => {
                setCaptionText('You did it!')
                setCaptionRevealed(wordIndex + 1)
              },
            })
              .then(resolve)
              .catch(reject)
          }, OPENER_DELAY_MS)
          // If timer never fires (shouldn't happen but be defensive)
          if (timer === undefined) resolve()
        })
      } catch (err) {
        console.warn('[SessionEnd] opener utterance failed:', err)
        audioFailedRef.current = true
      }

      // t=1100: Focus recap -- "You worked on <friendly-name> today!" (M5,
      // ticket 86c9kmwh0). One new spoken beat, surface-independent.
      //
      // GRACEFUL SKIP (Thomas-approved, M5 #451 follow-up to Jessica's #453
      // P1). Audio id `session.end.recap.focus` is NOT in the committed canon
      // bundle yet (the planner directive that emits it ships separately;
      // re-baking all tiers is M5-out-of-scope). On a real device pre-bake the
      // id misses the howl-map and the singleton `playSessionUtterance`
      // REJECTS without ever firing `onPlay`/`onWordTick` — so we must NOT
      // commit the `focus-recap` phase up front: doing so leaves a dead pause
      // (phase delay, no audio, no caption) for the whole inter-beat gap,
      // which Jessica's #453 caught. A captioned-but-silent line would also
      // violate audio-first.
      //
      // So we attempt the utterance FIRST and only enter the `focus-recap`
      // phase + reveal the caption REACTIVELY, from inside `onPlay`/
      // `onWordTick` — i.e. only when the utterance actually engages. If it
      // rejects (unbaked id on a real device), we skip the phase entirely:
      // no phase flip, no caption, no dwell. The sequence collapses cleanly
      // to the next beat with no dead pause. Once the clip is baked, the
      // utterance plays and the beat engages normally with audio + caption,
      // with zero further code change.
      //
      // Note: the unit-test "silent fallback fires onWordTick(0)" path only
      // runs when `playUtteranceFn === undefined` (the internal shim) — it
      // does NOT mask the production reject. See the reject-path unit test in
      // SessionEnd.test.tsx.
      //
      // Copy is client-supplied (`focusRecapCopy`, derived from the session
      // focus node) so the caption is correct independent of audio state.
      //
      // Timing collapse: on the SKIP path the promise resolves immediately at
      // ~opener-end, and the recap beat below schedules at
      // `RECAP_DELAY_MS - FOCUS_RECAP_DELAY_MS` (1400ms) — which lands recap
      // one standard inter-beat gap after the opener, exactly the pre-M5
      // cadence. So removing the focus-recap beat removes precisely its added
      // time with no dead pause and no special-casing of the recap delay.
      await new Promise<void>((resolve) => {
        addTimer(() => {
          playUtterance('session.end.recap.focus', {
            onPlay: () => {
              // Engine fired the audio: commit the phase. Caption is set by
              // `onWordTick`.
              setPhase('focus-recap')
            },
            onWordTick: (wordIndex) => {
              // First tick is the commit point for engines that don't fire a
              // separate `onPlay` (the internal silent shim ticks word 0
              // without an `onPlay`). Set the phase here too so the engaged
              // path is robust regardless of which callback fires first.
              setPhase('focus-recap')
              setCaptionText(focusRecapCopy)
              setCaptionRevealed(wordIndex + 1)
            },
          })
            .then(resolve)
            .catch((err) => {
              // Reject = id unavailable (unbaked) OR a real play error. Skip
              // the beat: no phase, no caption, no dwell. Resolve immediately
              // so the recap beat fires one standard inter-beat gap later
              // instead of holding the full focus-recap window silent.
              console.warn('[SessionEnd] focus-recap utterance skipped:', err)
              resolve()
            })
        }, FOCUS_RECAP_DELAY_MS - OPENER_DELAY_MS)
      })

      // t=2500: Recap -- copy is surface-dependent.
      //
      //   - math: "You earned N stars!" where N = totalStardust (unchanged).
      //     Utterance id `session.end.recap.<N>` is in the planner bundle.
      //   - word-song (ticket 86c9kwvza): "You earned 5 stars for finishing!"
      //     Copy is fixed — the +5 is the completion bonus, not a function
      //     of how many problems Marian got right. Utterance id
      //     `session.end.recap.wordsong-completion` is a NEW id; until the
      //     planner's audio bundle includes it, the silent fallback (which
      //     fires `onWordTick(0)` once) keeps the caption pipeline alive
      //     and the existing graceful-degradation path bridges the audio.
      //
      // Skip-when-zero only applies to math (word-song always has a +5
      // grant to celebrate, even on a session where Marian got 0 correct).
      try {
        setPhase('recap')
        setShowStardustCounter(true)

        if (p.surface === 'word-song') {
          await new Promise<void>((resolve) => {
            addTimer(() => {
              const recapId = 'session.end.recap.wordsong-completion'
              const copy = `You earned ${numberToWord(WORDSONG_SESSION_END_BONUS)} stars for finishing!`
              playUtterance(recapId, {
                onWordTick: (wordIndex) => {
                  setCaptionText(copy)
                  setCaptionRevealed(wordIndex + 1)
                },
              })
                .then(resolve)
                .catch((err) => {
                  console.warn('[SessionEnd] recap utterance failed:', err)
                  resolve()
                })
            }, RECAP_DELAY_MS - FOCUS_RECAP_DELAY_MS)
          })
        } else if (p.totalStardust > 0) {
          await new Promise<void>((resolve) => {
            addTimer(() => {
              const recapId = `session.end.recap.${p.totalStardust}`
              playUtterance(recapId, {
                onWordTick: (wordIndex) => {
                  const starWord =
                    p.totalStardust === 1
                      ? `You earned one star!`
                      : `You earned ${numberToWord(p.totalStardust)} stars!`
                  setCaptionText(starWord)
                  setCaptionRevealed(wordIndex + 1)
                },
              })
                .then(resolve)
                .catch((err) => {
                  console.warn('[SessionEnd] recap utterance failed:', err)
                  resolve()
                })
            }, RECAP_DELAY_MS - FOCUS_RECAP_DELAY_MS)
          })
        } else {
          // Zero stardust on math: skip the recap line but wait the gap.
          await new Promise<void>((resolve) => {
            addTimer(resolve, RECAP_DELAY_MS - FOCUS_RECAP_DELAY_MS)
          })
        }
      } catch {
        // Swallow -- continue sequence
      }

      // t=4500: Streak -- "N in a row! Wow!" (only if finalStreak >= 3)
      if (p.finalStreak >= 3) {
        try {
          setPhase('streak')
          setShowStreakBand(true)

          await new Promise<void>((resolve) => {
            addTimer(() => {
              const streakId = `session.end.streak.${p.finalStreak}`
              playUtterance(streakId, {
                onWordTick: (wordIndex) => {
                  setCaptionText(`${p.finalStreak} in a row! Wow!`)
                  setCaptionRevealed(wordIndex + 1)
                },
              })
                .then(resolve)
                .catch((err) => {
                  console.warn('[SessionEnd] streak utterance failed:', err)
                  resolve()
                })
            }, STREAK_DELAY_MS - RECAP_DELAY_MS)
          })
        } catch {
          // Swallow -- continue sequence
        }
      }

      // t=6100: Goodbye -- "See you soon."
      try {
        setPhase('goodbye')
        await new Promise<void>((resolve) => {
          const baseDelay =
            p.finalStreak >= 3
              ? GOODBYE_DELAY_MS - STREAK_DELAY_MS
              : GOODBYE_DELAY_MS - RECAP_DELAY_MS
          addTimer(() => {
            playUtterance('session.end.goodbye', {
              onPlay: () => {
                // Cancel fallback timer if it somehow survived
                clearTimeout(fallbackTimerId)
              },
              onWordTick: (wordIndex) => {
                setCaptionText('See you soon.')
                setCaptionRevealed(wordIndex + 1)
              },
            })
              .then(resolve)
              .catch((err) => {
                console.warn('[SessionEnd] goodbye utterance failed:', err)
                resolve()
              })
          }, baseDelay)
        })
      } catch {
        // Swallow
      }

      // t=7300: CTA appears
      const settledDelay = CTA_DELAY_MS - GOODBYE_DELAY_MS
      addTimer(() => {
        setPhase('settled')
        setShowCta(true)
        // Clear caption after goodbye settles
        setCaptionText('')
        setCaptionRevealed(0)
      }, settledDelay)
    }

    void runSequence()

    return () => {
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Cleanup SFX on unmount ----------------------------------------------

  useEffect(() => {
    return () => {
      chimeInstance.unload()
      sparkleInstance.unload()
      plinkInstance.unload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── CTA tap handler -----------------------------------------------------

  const handleCtaTap = useCallback(() => {
    if (phase === 'sleep-splash') return

    setCtaTapping(true)
    chimeInstance.play()

    // Cancel any in-flight TTS
    cancelSessionAudio()

    // Hub-route flip (`design/screen-hub.md` § Q4): when the orchestrator
    // wires `onAllDone`, route to Hub instead of falling through to the
    // legacy Sleep splash. The chime + scale tween still play; only the
    // post-300ms destination changes. When `onAllDone` is undefined,
    // legacy Sleep splash renders — preserves existing tests + supports
    // a dark-launch fallback if Thomas opts for one.
    if (onAllDone) {
      addTimer(() => {
        onAllDone()
      }, 300)
      return
    }

    // Fade to sleep splash after 300ms (legacy path).
    addTimer(() => {
      setPhase('sleep-splash')
    }, 300)
  }, [phase, chimeInstance, addTimer, onAllDone])

  // ── Sparkle particles (entry burst) -------------------------------------
  // Positions are generated once via useState lazy initializer. This avoids
  // both the useMemo react-hooks/purity violation (Math.random) and the
  // useRef react-hooks/refs violation (reading .current during render).

  const [sparkleParticles] = useState(() =>
    generateSparkleParticles(reducedMotion),
  )

  // ── Render ----------------------------------------------------------------

  const showRibbon = captionText.length > 0

  return (
    <m.main
      data-testid="session-end"
      data-surface={p.surface}
      data-phase={phase}
      data-total-stardust={displayedTotalStardust}
      data-earned={displayedEarnedThisSession}
      data-final-streak={p.finalStreak}
      data-completion-bonus={wordSongCompletionGrant}
      className="
        relative flex h-full w-full flex-col items-center
        bg-my-cream text-ink
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]
        overflow-hidden
      "
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Twilight wash background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 35%, rgba(230,210,245,0.5) 0%, rgba(255,245,250,0) 60%), linear-gradient(180deg, #FFF5FA 0%, #F5EDF7 100%)',
        }}
      />

      {/* Emma celebrating -- centered, ~38vh */}
      <div className="pointer-events-none relative flex h-[38vh] w-full items-center justify-center">
        {/* Sparkle burst on entry */}
        <AnimatePresence>
          {phase !== 'sleep-splash' &&
            sparkleParticles.map((particle) => (
              <m.div
                key={`sparkle-${particle.id}`}
                aria-hidden
                className="absolute"
                initial={{ opacity: 1, x: 0, y: 0, scale: 0.5 }}
                animate={
                  reducedMotion
                    ? { opacity: [1, 0], scale: 0.5 }
                    : {
                        opacity: [1, 0],
                        x: particle.x,
                        y: particle.y,
                        scale: [0.5, 1, 0],
                      }
                }
                transition={{
                  duration: 1.2,
                  delay: particle.delay,
                  ease: 'easeOut',
                }}
              >
                <SparkleParticle />
              </m.div>
            ))}
        </AnimatePresence>

        {/* Emma image -- uses emma-cheering.svg (the canonical
            big-celebration pose, BOTH hands raised; reserved for
            Session-End and never used per-problem). Replaces the legacy
            melody-cheering.svg in the Phase 3b character pivot
            (ticket 86c9jccp7). */}
        <AnimatePresence initial={false}>
          <m.img
            layoutId="emma"
            key="celebrating"
            data-testid="session-end-emma"
            src="/assets/emma-cheering.svg"
            alt="Emma celebrating"
            draggable={false}
            className="absolute h-full w-auto select-none"
            initial={
              reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }
            }
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            transition={
              reducedMotion
                ? { duration: 0.3 }
                : {
                    type: 'spring',
                    stiffness: 180,
                    damping: 20,
                  }
            }
          />
        </AnimatePresence>
      </div>

      {/* Speech ribbon -- identical pattern to Greet/Math caption */}
      {showRibbon && (
        <m.div
          data-testid="session-end-ribbon"
          role="status"
          aria-live="polite"
          className="
            mx-auto mt-2 mb-4 w-[88%] max-w-2xl
            rounded-3xl border-[3px] border-my-pink bg-white
            px-6 py-3
            shadow-[0_8px_24px_rgba(244,143,177,0.18)]
            text-center
          "
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reducedMotion ? { duration: 0.3 } : RIBBON_SPRING}
        >
          <p
            data-testid="session-end-caption"
            className="font-display text-[2.4rem] leading-snug text-ink"
          >
            {renderCaption(captionText, captionRevealed)}
          </p>
        </m.div>
      )}

      {/* Stardust counter -- ~14vh band. For word-song, the displayed
          total includes the +5 completion bonus so Marian sees the post-
          grant number tick up. Math is unchanged. */}
      <div className="flex h-[14vh] items-center justify-center">
        <StardustCounter
          totalStardust={displayedTotalStardust}
          active={showStardustCounter}
          plink={plinkInstance}
          reducedMotion={reducedMotion}
        />
      </div>

      {/* Streak band -- ~10vh, fixed height even when hidden */}
      <StreakBand
        finalStreak={p.finalStreak}
        visible={showStreakBand}
        reducedMotion={reducedMotion}
      />

      {/* Spacer -- ~8vh breathing room */}
      <div className="h-[8vh]" aria-hidden />

      {/* "All done!" CTA -- ~12vh bottom band, thumb-zone */}
      <div className="flex h-[12vh] w-full items-center justify-center">
        <AnimatePresence>
          {showCta && phase !== 'sleep-splash' && (
            <m.button
              key="cta-all-done"
              data-testid="session-end-cta"
              type="button"
              aria-label="All done!"
              onClick={handleCtaTap}
              className="
                flex select-none items-center justify-center gap-2
                rounded-full border-[3px] border-my-pink bg-white
                px-10 font-display text-[2rem] text-my-rose
                shadow-[0_6px_20px_rgba(244,143,177,0.25)]
                active:scale-95
                touch-manipulation
              "
              style={{
                height: '88pt',
                minWidth: '220pt',
              }}
              initial={
                reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }
              }
              animate={
                ctaTapping
                  ? { opacity: 1, scale: [1, 0.95, 1] }
                  : reducedMotion
                    ? { opacity: 1 }
                    : { opacity: 1, scale: 1 }
              }
              exit={{ opacity: 0 }}
              transition={
                ctaTapping
                  ? { duration: 0.2, ease: 'easeOut' }
                  : reducedMotion
                    ? { duration: 0.2 }
                    : CTA_SPRING
              }
            >
              <span aria-hidden>&#x2713;</span>
              <span>All done!</span>
            </m.button>
          )}
        </AnimatePresence>
      </div>

      {/* Sleep splash overlay (Option C) */}
      <AnimatePresence>
        {phase === 'sleep-splash' && <SleepSplash key="sleep-splash" />}
      </AnimatePresence>
    </m.main>
  )
}

// ── Helpers -----------------------------------------------------------------

/** Render caption text with word-by-word reveal. Same pattern as Greet. */
function renderCaption(text: string, revealedCount: number): ReactElement[] {
  const words = text.split(/\s+/).filter(Boolean)
  return words.map((word, i) => (
    <m.span
      key={`caption-${i}`}
      data-testid="session-end-caption-word"
      data-revealed={i < revealedCount ? 'true' : 'false'}
      className="inline-block"
      style={{ marginRight: i === words.length - 1 ? 0 : '0.4em' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: i < revealedCount ? 1 : 0 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
    >
      {word}
    </m.span>
  ))
}

/** Inline sparkle particle SVG. Same shape as Math/Greet. */
function SparkleParticle(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      role="presentation"
      aria-hidden
    >
      <path
        d="M12 2 L13.6 9.4 L21 11 L13.6 12.6 L12 20 L10.4 12.6 L3 11 L10.4 9.4 Z"
        fill="#FFD966"
        stroke="#E0B800"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Generate sparkle particle positions. Called once during ref init
 *  (outside of render) to avoid react-hooks/purity lint violations
 *  from Math.random(). */
function generateSparkleParticles(
  reducedMotion: boolean,
): { id: number; x: number; y: number; delay: number }[] {
  const spread = reducedMotion ? 200 : 300
  const maxDelay = reducedMotion ? 0.2 : 0.3
  return Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * spread,
    y: (Math.random() - 0.5) * spread,
    delay: Math.random() * maxDelay,
  }))
}

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

/** Convert a number (0-19) to its English word for the TTS caption. */
function numberToWord(n: number): string {
  const words = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
  ]
  return words[n] ?? String(n)
}
