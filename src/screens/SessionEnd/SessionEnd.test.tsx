import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'
import SessionEnd from './SessionEnd'
import type { SessionEndPayload, PlayUtteranceFn } from './SessionEnd'
import type { Sfx } from '../../lib/sfx'
import type { StorageAdapter } from '../Math/stardust'
import { STARDUST_STORAGE_KEY, STARDUST_SCHEMA_VERSION } from '../Math/stardust'
import { loadStardust } from '../_shared/stardust'
import { WORDSONG_SESSION_END_BONUS } from '../_shared/wordSongCompletionBonus'
import {
  SESSION_HISTORY_KEY,
  SESSION_HISTORY_SCHEMA_VERSION,
} from './sessionHistory'
import {
  STORAGE_KEY as PROGRESS_STORAGE_KEY,
  defaultProgress,
  isProgressV1,
  loadProgress,
  saveProgress,
  type Progress,
} from '../../lib/progress'

function withMotion(node: ReactNode) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{node}</MotionConfig>
    </LazyMotion>
  )
}

/** Minimal fake SFX that tracks play/unload calls. */
function createFakeSfx(): Sfx {
  return {
    play: vi.fn(() => true),
    unload: vi.fn(),
    get missedPlays() {
      return 0
    },
    get loadFailed() {
      return false
    },
  }
}

/** Minimal in-memory storage for tests. */
function createMemoryStorage(): StorageAdapter & {
  store: Map<string, string>
} {
  const store = new Map<string, string>()
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
  }
}

/** Fake playUtterance that resolves immediately and tracks calls. */
function createFakePlayUtterance(): PlayUtteranceFn & {
  calls: string[]
} {
  const calls: string[] = []
  const fn = vi.fn(
    (
      utteranceId: string,
      opts?: {
        onPlay?: () => void
        onWordTick?: (wordIndex: number) => void
      },
    ) => {
      calls.push(utteranceId)
      opts?.onPlay?.()
      opts?.onWordTick?.(0)
      return Promise.resolve()
    },
  ) as unknown as PlayUtteranceFn & { calls: string[] }
  fn.calls = calls
  return fn
}

/**
 * Fake playUtterance that walks the caller-supplied caption word-by-word
 * end-to-end. The screen's `onWordTick` only sees `wordIndex` (the screen
 * owns the caption text), so we infer the per-utterance word count from
 * the id family and tick once per word. Used to cover the regression
 * fixed in ticket 86c9kj2u6 — pre-fix the silent-fallback shim ticked
 * `wordIndex=0` exactly once and the caption appeared "stuck on the
 * first word" of every phase.
 */
function createWordWalkingPlayUtterance(): PlayUtteranceFn & {
  calls: string[]
} {
  // Word counts pulled from SessionEnd.tsx's caption strings:
  //   opener: "You did it!" -> 3
  //   recap.1: "You earned one star!" -> 4
  //   recap.N (N>=2): "You earned <word> stars!" -> 4
  //   streak.N: "<N> in a row! Wow!" -> 5
  //   goodbye: "See you soon." -> 3
  function wordCountForId(id: string): number {
    if (id === 'session.end.opener') return 3
    if (id === 'session.end.recap.wordsong-completion') return 6
    if (id.startsWith('session.end.recap.')) return 4
    if (id.startsWith('session.end.streak.')) return 5
    if (id === 'session.end.goodbye') return 3
    return 1
  }

  const calls: string[] = []
  const fn = vi.fn(
    (
      utteranceId: string,
      opts?: {
        onPlay?: () => void
        onWordTick?: (wordIndex: number) => void
      },
    ) => {
      calls.push(utteranceId)
      opts?.onPlay?.()
      const wc = wordCountForId(utteranceId)
      for (let i = 0; i < wc; i++) opts?.onWordTick?.(i)
      return Promise.resolve()
    },
  ) as unknown as PlayUtteranceFn & { calls: string[] }
  fn.calls = calls
  return fn
}

/**
 * Fake playUtterance that misses on a given id family and otherwise
 * walks word-by-word. Used to cover the graceful-degradation contract:
 * a single utterance miss must not brick the phase machine; the next
 * phase still runs and the CTA still appears.
 */
function createMissingIdPlayUtterance(
  missingPrefix: string,
): PlayUtteranceFn & {
  calls: string[]
} {
  function wordCountForId(id: string): number {
    if (id === 'session.end.opener') return 3
    if (id === 'session.end.recap.wordsong-completion') return 6
    if (id.startsWith('session.end.recap.')) return 4
    if (id.startsWith('session.end.streak.')) return 5
    if (id === 'session.end.goodbye') return 3
    return 1
  }

  const calls: string[] = []
  const fn = vi.fn(
    (
      utteranceId: string,
      opts?: {
        onPlay?: () => void
        onWordTick?: (wordIndex: number) => void
      },
    ) => {
      calls.push(utteranceId)
      if (utteranceId.startsWith(missingPrefix)) {
        // Mirrors the production shape: when the singleton howl map has
        // no entry for an id, `playSessionUtterance` rejects. The
        // SessionEnd phase wrappers `.catch(resolve)` so the sequence
        // continues regardless.
        return Promise.reject(
          new Error(`[fake] no utterance with id "${utteranceId}"`),
        )
      }
      opts?.onPlay?.()
      const wc = wordCountForId(utteranceId)
      for (let i = 0; i < wc; i++) opts?.onWordTick?.(i)
      return Promise.resolve()
    },
  ) as unknown as PlayUtteranceFn & { calls: string[] }
  fn.calls = calls
  return fn
}

/**
 * Advance fake timers and flush all pending microtasks/promises.
 * The Session End sequence is async (await on Promises that resolve
 * when timers fire), so we need to interleave timer advancement with
 * microtask flushes. This helper advances in small steps.
 */
async function advanceSequence(totalMs: number, stepMs = 200) {
  let elapsed = 0
  while (elapsed < totalMs) {
    const step = Math.min(stepMs, totalMs - elapsed)
    await act(async () => {
      vi.advanceTimersByTime(step)
    })
    // Flush microtasks
    await act(async () => {
      await Promise.resolve()
    })
    elapsed += step
  }
}

function seedStardust(storage: StorageAdapter, total: number) {
  ;(storage as ReturnType<typeof createMemoryStorage>).store.set(
    STARDUST_STORAGE_KEY,
    JSON.stringify({
      total,
      lastUpdatedAt: new Date().toISOString(),
      schemaVersion: STARDUST_SCHEMA_VERSION,
    }),
  )
}

const MATH_PAYLOAD: SessionEndPayload = {
  totalCorrect: 7,
  totalStardust: 9,
  finalStreak: 5,
  earnedThisSession: 9,
  surface: 'math',
}

const WORD_SONG_PAYLOAD: SessionEndPayload = {
  totalCorrect: 6,
  totalStardust: 8,
  finalStreak: 4,
  earnedThisSession: 8,
  surface: 'word-song',
}

describe('SessionEnd', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // SessionEnd's mount effect persists to `marian-tutor:progress:v1`
    // (ticket 86c9kmu63). That write goes through `saveProgress`, which
    // hits `window.localStorage` directly — there's no injectable adapter
    // on the progress module yet. Clear the slot per-test so progress
    // entries don't leak across tests in this file.
    if (typeof window !== 'undefined') window.localStorage.clear()
    // T2 cloud-sync (ticket 86c9pkfyu) — silence the fire-and-forget
    // warn from `pushProgressToCloud`. The push fails in jsdom because
    // '/api/progress' isn't a parseable URL; the warn isn't relevant
    // to these tests' assertions.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    if (typeof window !== 'undefined') window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders the session-end screen with Math payload', () => {
    const storage = createMemoryStorage()
    seedStardust(storage, 9)

    render(
      withMotion(
        <SessionEnd
          payload={MATH_PAYLOAD}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
        />,
      ),
    )

    const root = screen.getByTestId('session-end')
    expect(root).toHaveAttribute('data-surface', 'math')
    expect(root).toHaveAttribute('data-total-stardust', '9')
    expect(root).toHaveAttribute('data-final-streak', '5')
  })

  it('renders with Word Song payload', () => {
    const storage = createMemoryStorage()
    seedStardust(storage, 8)

    render(
      withMotion(
        <SessionEnd
          payload={WORD_SONG_PAYLOAD}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
        />,
      ),
    )

    expect(screen.getByTestId('session-end')).toHaveAttribute(
      'data-surface',
      'word-song',
    )
  })

  it('defaults to math surface when payload is null', () => {
    const storage = createMemoryStorage()

    render(
      withMotion(
        <SessionEnd
          payload={null}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
        />,
      ),
    )

    expect(screen.getByTestId('session-end')).toHaveAttribute(
      'data-surface',
      'math',
    )
  })

  it('persists session history on mount', () => {
    const storage = createMemoryStorage()
    const fixedDate = new Date('2026-04-27T14:00:00.000Z')
    seedStardust(storage, 9)

    render(
      withMotion(
        <SessionEnd
          payload={MATH_PAYLOAD}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
          now={() => fixedDate}
        />,
      ),
    )

    const history = JSON.parse(storage.store.get(SESSION_HISTORY_KEY)!)
    expect(history.sessionCount).toBe(1)
    expect(history.longestStreakEver).toBe(5)
    expect(history.cumulativeStardust).toBe(9)
  })

  // Adaptive-engine plumbing (ticket 86c9kmu63). The mount effect now also
  // persists into `marian-tutor:progress:v1`. These three tests pin the
  // wiring; the per-call shape contract is covered in
  // `progressHistory.test.ts`.

  it('persists progress to marian-tutor:progress:v1 on first mount (math)', () => {
    const storage = createMemoryStorage()
    seedStardust(storage, 9)
    const fixedDate = new Date('2026-04-30T18:30:00.000Z')

    render(
      withMotion(
        <SessionEnd
          payload={MATH_PAYLOAD}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
          now={() => fixedDate}
        />,
      ),
    )

    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY)
    expect(raw).not.toBeNull()
    const loaded = loadProgress()
    expect(isProgressV1(loaded)).toBe(true)
    expect(loaded?.history).toHaveLength(1)
    expect(loaded?.history[0]).toEqual({
      dateISO: '2026-04-30T18:30:00.000Z',
      skillFocus: ['add-to-10'],
      successRate: MATH_PAYLOAD.totalCorrect / 8,
    })
    expect(loaded?.profile.lastPlayedISO).toBe('2026-04-30T18:30:00.000Z')
  })

  it('persists progress with the word-song skillFocus when surface is word-song', () => {
    const storage = createMemoryStorage()
    seedStardust(storage, 8)
    const fixedDate = new Date('2026-04-30T19:00:00.000Z')

    render(
      withMotion(
        <SessionEnd
          payload={WORD_SONG_PAYLOAD}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
          now={() => fixedDate}
        />,
      ),
    )

    const loaded = loadProgress()
    // Pre-step-2 (the original P0 clamp, ticket 86c9kt47v) this expected
    // 'blending-cv' because pickFocusNode was hard-clamped on the
    // word-song branch. Step 2 (ticket 86c9kxu07) un-clamped the picker
    // — it now walks LITERACY_TREE honouring skillLevels, same as the
    // math walker. The default Progress doc has letter-sounds as the
    // first non-mastered literacy node (per `defaults.ts` — Marian's
    // April 2026 diagnostic), so a fresh-profile word-song session
    // attributes its history to letter-sounds. This is the intended
    // behaviour: even though the planner falls back to blending-cv
    // content for letter-sounds (untuned tier), the recorded focus is
    // what the picker actually selected.
    expect(loaded?.history[0].skillFocus).toEqual(['letter-sounds'])
    expect(loaded?.history[0].successRate).toBe(
      WORD_SONG_PAYLOAD.totalCorrect / 8,
    )
  })

  // ── Periodic CVC-review skillFocus mislabel (ticket 86ca9atqh) ──────────
  //
  // AC3: a REAL SessionEnd-level test exercising the periodic CVC-review
  // path. Before the fix, SessionEnd re-derived its focus via
  // `pickFocusNode(progress, track)` with `sessionCount` OMITTED (→ 0). The
  // periodic-review branch of `pickCvcReviewNode` is gated on
  // `sessionCount > 0 && sessionCount % 5 === 0`, so a sessionCount-blind
  // re-derivation falls through to the FORWARD walk and lands on the next
  // non-mastered node (e.g. `digraphs-sh`). App.tsx's session-start
  // kick-effect, by contrast, passes the REAL sessionCount, so the session
  // actually RAN as a CVC review — but SessionEnd recorded `skillFocus` for
  // the forward node. That mislabel is read by `applyMasteryRule`'s
  // `qualifies()` filter (`skillFocus.includes(node)`, mastery.ts:620), so a
  // high-scoring cross-vowel review wrongly credited the forward tier's 90/3
  // counter (mastery contamination).
  //
  // The fix threads the picked session focus identity (`sessionFocus =
  // { node, mode }`) through the SessionEnd payload, so SessionEnd records
  // the ACTUAL focus the session ran under instead of re-deriving it
  // sessionCount-blind. These tests pin the SessionEnd consumer of that
  // threaded field — the kick-vs-session-end divergence had ZERO coverage
  // before this ticket (the pre-existing `progressHistory.test.ts` periodic
  // case hand-constructs a `focusMode` production wouldn't emit and so
  // bypasses the re-derivation entirely).

  /**
   * Seed a post-graduation, all-CVC-mastered Progress doc plus a
   * session-history blob with the given `sessionCount`. This is the state
   * a real returning Marian is in once every CVC tier is mastered, the
   * graduation review has fired, and she is doing ordinary forward work on
   * `digraphs-sh` — interleaved with periodic cross-vowel reviews every 5th
   * session.
   */
  function seedPeriodicReviewState(
    storage: ReturnType<typeof createMemoryStorage>,
    sessionCount: number,
  ): void {
    const base = defaultProgress('Marian')
    const progress: Progress = {
      ...base,
      skillLevels: {
        ...base.skillLevels,
        // Everything up to and including all CVC tiers mastered; the
        // forward walk's first non-mastered node is `digraphs-sh`, which
        // is exactly the tier the ticket warns would be contaminated.
        'letter-sounds': 'mastered',
        'blending-cv': 'mastered',
        'cvc-words': 'mastered',
        'cvc-words-short-o': 'mastered',
        'cvc-words-short-u': 'mastered',
        'cvc-words-short-i': 'mastered',
        'cvc-words-short-e': 'mastered',
        'digraphs-sh': 'practicing',
      },
      // Graduation review already fired — periodic round-robin is active.
      cvcGraduationSessionFired: true,
    }
    saveProgress(progress)
    // `recordSessionEnd` reads + increments sessionCount from this blob;
    // the value we re-derive against in the (buggy) path is what matters
    // for the divergence, but the SessionEnd re-derivation OMITS it
    // entirely — so the threaded `sessionFocus` is the only correct source.
    storage.store.set(
      SESSION_HISTORY_KEY,
      JSON.stringify({
        schemaVersion: SESSION_HISTORY_SCHEMA_VERSION,
        sessionCount,
        lastSessionCompletedAt: '2026-06-15T10:00:00.000Z',
        longestStreakEver: 5,
        cumulativeStardust: 40,
        lastSessionStardust: 5,
        dayStreak: 3,
        todayTreesTouched: { date: '', trees: [] },
        lastSuggestion: null,
        consecutiveOverrides: 0,
        suggestionCooldownUntil: null,
      }),
    )
  }

  it('records the THREADED cvc-review focus node on a periodic review session (AC1/AC2)', () => {
    const storage = createMemoryStorage()
    seedStardust(storage, 8)
    // sessionCount 10 → `10 % 5 === 0`, round-robin index
    // `floor(10/5) % 3 === 2` → `cvc-words-short-u`. App.tsx picked this at
    // session-start with the real sessionCount and the session ran as a
    // cross-vowel review on short-u.
    seedPeriodicReviewState(storage, 10)
    const fixedDate = new Date('2026-06-15T18:00:00.000Z')

    render(
      withMotion(
        <SessionEnd
          payload={{
            ...WORD_SONG_PAYLOAD,
            // The focus identity the session actually ran under, frozen at
            // session-start kick-time and threaded through the payload.
            sessionFocus: { node: 'cvc-words-short-u', mode: 'cvc-review' },
          }}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
          now={() => fixedDate}
        />,
      ),
    )

    const loaded = loadProgress()
    const newEntry = loaded!.history[loaded!.history.length - 1]
    // AC2: skillFocus is the CVC review tier, NOT the forward node
    // (`digraphs-sh`) the sessionCount-blind re-derivation would have
    // produced. So `qualifies()` credits short-u, not digraphs-sh.
    expect(newEntry.skillFocus).toEqual(['cvc-words-short-u'])
  })

  it('does NOT credit the forward node (digraphs-sh) on a periodic review (mastery-contamination guard)', () => {
    const storage = createMemoryStorage()
    seedStardust(storage, 8)
    seedPeriodicReviewState(storage, 10)
    const fixedDate = new Date('2026-06-15T18:00:00.000Z')

    render(
      withMotion(
        <SessionEnd
          payload={{
            ...WORD_SONG_PAYLOAD,
            totalCorrect: 8, // high score — exactly what would contaminate
            sessionFocus: { node: 'cvc-words-short-u', mode: 'cvc-review' },
          }}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
          now={() => fixedDate}
        />,
      ),
    )

    const loaded = loadProgress()
    const newEntry = loaded!.history[loaded!.history.length - 1]
    // The forward node MUST NOT appear in skillFocus — a high-scoring
    // cross-vowel review must never count toward digraphs-sh's 90/3.
    expect(newEntry.skillFocus).not.toContain('digraphs-sh')
  })

  it('falls back to the sessionCount-blind re-derivation when sessionFocus is absent (back-compat)', () => {
    // Hand-built fixtures + math sessions that predate the threaded field
    // still re-derive. The graduation review is sessionCount-INDEPENDENT
    // (its branch fires on `cvcGraduationSessionFired === false` once the
    // whole tree is mastered), so the re-derivation still agrees with the
    // kick-effect there — only the PERIODIC branch diverges, and that
    // requires the threaded field.
    const storage = createMemoryStorage()
    seedStardust(storage, 8)
    const base = defaultProgress('Marian')
    // Whole word-song tree mastered so the forward walk finds NOTHING and
    // the graduation review fires (sessionCount-independent → short-u).
    const allMasteredWordSong = { ...base.skillLevels }
    for (const node of [
      'letter-names',
      'letter-sounds',
      'blending-cv',
      'cvc-words',
      'cvc-words-short-o',
      'cvc-words-short-u',
      'cvc-words-short-i',
      'cvc-words-short-e',
      'digraphs-sh',
      'digraphs-ch',
      'digraphs-th-voiceless',
      'sight-words',
      'simple-sentences',
    ] as const) {
      allMasteredWordSong[node] = 'mastered'
    }
    const progress: Progress = {
      ...base,
      skillLevels: allMasteredWordSong,
      cvcGraduationSessionFired: false, // graduation not yet fired
    }
    saveProgress(progress)
    const fixedDate = new Date('2026-06-15T18:00:00.000Z')

    render(
      withMotion(
        <SessionEnd
          // No `sessionFocus` field — exercises the back-compat fallback.
          payload={WORD_SONG_PAYLOAD}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
          now={() => fixedDate}
        />,
      ),
    )

    const loaded = loadProgress()
    const newEntry = loaded!.history[loaded!.history.length - 1]
    // Graduation review (sessionCount-independent) → short-u, agreeing
    // with what the kick-effect would have picked. Re-derivation is safe
    // here precisely because this branch ignores sessionCount.
    expect(newEntry.skillFocus).toEqual(['cvc-words-short-u'])
  })

  it('shows the stardust counter', () => {
    const storage = createMemoryStorage()
    seedStardust(storage, 9)

    render(
      withMotion(
        <SessionEnd
          payload={MATH_PAYLOAD}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
        />,
      ),
    )

    expect(screen.getByTestId('stardust-counter')).toBeInTheDocument()
  })

  it('shows streak band slot when finalStreak >= 3', async () => {
    const storage = createMemoryStorage()
    seedStardust(storage, 9)

    render(
      withMotion(
        <SessionEnd
          payload={{ ...MATH_PAYLOAD, finalStreak: 5 }}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
        />,
      ),
    )

    await advanceSequence(5000)

    expect(screen.getByTestId('streak-band-slot')).toBeInTheDocument()
  })

  it('does NOT show streak band content when finalStreak < 3', async () => {
    const storage = createMemoryStorage()
    seedStardust(storage, 2)

    render(
      withMotion(
        <SessionEnd
          payload={{ ...MATH_PAYLOAD, finalStreak: 2 }}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
        />,
      ),
    )

    await advanceSequence(8000)

    expect(screen.getByTestId('streak-band-slot')).toBeInTheDocument()
    expect(screen.queryByTestId('streak-band')).not.toBeInTheDocument()
  })

  it('shows "All done!" CTA after the full sequence', async () => {
    const storage = createMemoryStorage()
    seedStardust(storage, 9)

    render(
      withMotion(
        <SessionEnd
          payload={MATH_PAYLOAD}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
        />,
      ),
    )

    // CTA should not be visible initially
    expect(screen.queryByTestId('session-end-cta')).not.toBeInTheDocument()

    // Advance through the entire sequence with microtask flushes
    await advanceSequence(8000)

    expect(screen.getByTestId('session-end-cta')).toBeInTheDocument()
  })

  it('transitions to sleep splash on CTA tap', async () => {
    const storage = createMemoryStorage()
    const chime = createFakeSfx()
    seedStardust(storage, 9)

    render(
      withMotion(
        <SessionEnd
          payload={MATH_PAYLOAD}
          playUtteranceFn={createFakePlayUtterance()}
          chime={chime}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
        />,
      ),
    )

    await advanceSequence(8000)

    const cta = screen.getByTestId('session-end-cta')
    fireEvent.click(cta)

    expect(chime.play).toHaveBeenCalled()

    await advanceSequence(500)

    expect(screen.getByTestId('sleep-splash')).toBeInTheDocument()
  })

  it('routes to Hub via `onAllDone` when provided (Hub-flip post-#86c9j53ra)', async () => {
    const storage = createMemoryStorage()
    const chime = createFakeSfx()
    const onAllDone = vi.fn()
    seedStardust(storage, 9)

    render(
      withMotion(
        <SessionEnd
          payload={MATH_PAYLOAD}
          playUtteranceFn={createFakePlayUtterance()}
          chime={chime}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
          onAllDone={onAllDone}
        />,
      ),
    )

    await advanceSequence(8000)
    fireEvent.click(screen.getByTestId('session-end-cta'))
    expect(chime.play).toHaveBeenCalled()

    // Same 300ms tween-out as the legacy sleep-splash path; then
    // onAllDone fires.
    await advanceSequence(500)
    expect(onAllDone).toHaveBeenCalledTimes(1)
    // Sleep splash must NOT mount when onAllDone is wired —
    // SessionEnd hands off to the orchestrator instead.
    expect(screen.queryByTestId('sleep-splash')).toBeNull()
  })

  it('sleep splash shows "Come back soon." text with no TTS', async () => {
    const storage = createMemoryStorage()
    const playUtterance = createFakePlayUtterance()
    seedStardust(storage, 9)

    render(
      withMotion(
        <SessionEnd
          payload={MATH_PAYLOAD}
          playUtteranceFn={playUtterance}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
        />,
      ),
    )

    await advanceSequence(8000)
    fireEvent.click(screen.getByTestId('session-end-cta'))
    await advanceSequence(500)

    expect(screen.getByTestId('sleep-splash-text')).toHaveTextContent(
      'Come back soon.',
    )

    // No additional TTS calls after sleep splash
    const callsBefore = playUtterance.calls.length
    await advanceSequence(5000)
    expect(playUtterance.calls.length).toBe(callsBefore)
  })

  it('does not display totalCorrect anywhere (anti-dark-pattern)', async () => {
    const storage = createMemoryStorage()
    seedStardust(storage, 4)

    render(
      withMotion(
        <SessionEnd
          payload={{ ...MATH_PAYLOAD, totalCorrect: 4, totalStardust: 4 }}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
        />,
      ),
    )

    await advanceSequence(8000)

    const text = (
      screen.getByTestId('session-end').textContent ?? ''
    ).toLowerCase()
    expect(text).not.toContain('wrong')
    expect(text).not.toContain('failed')
    expect(text).not.toContain('try again')
    expect(text).not.toContain('only')
    expect(text).not.toContain('correct')
  })

  it('has no re-engagement nudge on sleep splash (anti-dark-pattern)', async () => {
    const storage = createMemoryStorage()
    seedStardust(storage, 9)

    render(
      withMotion(
        <SessionEnd
          payload={MATH_PAYLOAD}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
        />,
      ),
    )

    await advanceSequence(8000)
    fireEvent.click(screen.getByTestId('session-end-cta'))
    await advanceSequence(500)

    const splashText = (
      screen.getByTestId('sleep-splash').textContent ?? ''
    ).toLowerCase()
    expect(splashText).not.toContain('start')
    expect(splashText).not.toContain('play again')
    expect(splashText).not.toContain('new session')
    expect(splashText).not.toContain('tomorrow')
    expect(splashText).not.toContain("don't forget")
    expect(splashText).toContain('come back soon')
  })

  it('shows CTA via fallback timer when no playUtterance is provided', async () => {
    const storage = createMemoryStorage()
    seedStardust(storage, 9)

    // No playUtteranceFn -- the default silent fallback resolves
    // immediately, so the fallback timer's onPlay callback fires
    // immediately too (cancelling the fallback). The sequence still
    // completes and shows the CTA.
    render(
      withMotion(
        <SessionEnd
          payload={MATH_PAYLOAD}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
        />,
      ),
    )

    await advanceSequence(8000)

    expect(screen.getByTestId('session-end-cta')).toBeInTheDocument()
  })

  it('plays sparkle SFX on mount', () => {
    const storage = createMemoryStorage()
    const sparkle = createFakeSfx()
    seedStardust(storage, 9)

    render(
      withMotion(
        <SessionEnd
          payload={MATH_PAYLOAD}
          playUtteranceFn={createFakePlayUtterance()}
          sparkle={sparkle}
          chime={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
        />,
      ),
    )

    expect(sparkle.play).toHaveBeenCalled()
  })

  it('renders Emma celebrating image', () => {
    const storage = createMemoryStorage()
    seedStardust(storage, 9)

    render(
      withMotion(
        <SessionEnd
          payload={MATH_PAYLOAD}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          plink={createFakeSfx()}
          storage={storage}
        />,
      ),
    )

    const emmaImg = screen.getByTestId('session-end-emma')
    expect(emmaImg).toHaveAttribute('src', '/assets/emma-cheering.svg')
  })

  /**
   * Regression: ticket 86c9kj2u6
   *
   * Pre-fix bugs (cooperating):
   *   1. App.tsx never passed `playUtteranceFn` to <SessionEnd>, so the
   *      silent-fallback shim fired `onPlay()` + `onWordTick(0)` once per
   *      phase. The ribbon revealed exactly one word ("You", "you", "8",
   *      "See") then advanced — captions appeared stuck on the first
   *      word of every line.
   *   2. The Haiku planner emitted only 8 problems x 5 slot ids = 40
   *      utterances and zero `session.end.*` ids, so even with the prop
   *      wired the singleton howl-map lookup would miss every line.
   *
   * These tests pin the contract that fixes both:
   *   - `playUtteranceFn` is invoked with the four expected ids in order
   *     (use `.toEqual([...])` count-based assertion per the
   *     count-assertion rule, not `.toContain`).
   *   - The caption reveals the LAST word of each phase, not just the
   *     first — exercising the regression directly via a fake that
   *     ticks words end-to-end.
   *   - Graceful degradation: a single utterance miss does not brick
   *     the phase machine; the CTA still appears via the sequence's own
   *     dwell timers.
   */
  describe('Path A wiring contract (ticket 86c9kj2u6)', () => {
    it('invokes playUtteranceFn with the four ids in opener -> recap -> streak -> goodbye order', async () => {
      const storage = createMemoryStorage()
      seedStardust(storage, 9)
      const playUtterance = createWordWalkingPlayUtterance()

      render(
        withMotion(
          <SessionEnd
            payload={{
              ...MATH_PAYLOAD,
              totalStardust: 9,
              finalStreak: 5,
            }}
            playUtteranceFn={playUtterance}
            chime={createFakeSfx()}
            sparkle={createFakeSfx()}
            plink={createFakeSfx()}
            storage={storage}
          />,
        ),
      )

      // Drain the full sequence: opener (t=0), focus-recap (t=1100), recap
      // (t=2500), streak (t=4500), goodbye (t=6100), CTA (t=7300).
      await advanceSequence(8000)

      // Count-based assertion per `feedback_count_assertions_on_regression_tests`:
      // exact array equality so a duplicate or a re-ordered call fails the
      // test loudly.
      expect(playUtterance.calls).toEqual([
        'session.end.opener',
        'session.end.recap.focus',
        'session.end.recap.9',
        'session.end.streak.5',
        'session.end.goodbye',
      ])
    })

    it('skips the recap utterance when totalStardust is 0', async () => {
      const storage = createMemoryStorage()
      seedStardust(storage, 0)
      const playUtterance = createWordWalkingPlayUtterance()

      render(
        withMotion(
          <SessionEnd
            payload={{
              ...MATH_PAYLOAD,
              totalStardust: 0,
              finalStreak: 4,
            }}
            playUtteranceFn={playUtterance}
            chime={createFakeSfx()}
            sparkle={createFakeSfx()}
            plink={createFakeSfx()}
            storage={storage}
          />,
        ),
      )

      await advanceSequence(8000)

      // No recap.<N> call when stardust is zero (matches the
      // SessionEnd.tsx `if (p.totalStardust > 0)` gate). The focus-recap
      // line (M5) is NOT stardust-gated, so it still fires. Streak still
      // fires because finalStreak >= 3.
      expect(playUtterance.calls).toEqual([
        'session.end.opener',
        'session.end.recap.focus',
        'session.end.streak.4',
        'session.end.goodbye',
      ])
    })

    it('skips the streak utterance when finalStreak < 3', async () => {
      const storage = createMemoryStorage()
      seedStardust(storage, 4)
      const playUtterance = createWordWalkingPlayUtterance()

      render(
        withMotion(
          <SessionEnd
            payload={{
              ...MATH_PAYLOAD,
              totalStardust: 4,
              finalStreak: 2,
            }}
            playUtteranceFn={playUtterance}
            chime={createFakeSfx()}
            sparkle={createFakeSfx()}
            plink={createFakeSfx()}
            storage={storage}
          />,
        ),
      )

      await advanceSequence(8000)

      expect(playUtterance.calls).toEqual([
        'session.end.opener',
        'session.end.recap.focus',
        'session.end.recap.4',
        'session.end.goodbye',
      ])
    })

    it('reveals the last word of each phase, not just the first (the bug being fixed)', async () => {
      const storage = createMemoryStorage()
      seedStardust(storage, 8)
      const playUtterance = createWordWalkingPlayUtterance()

      render(
        withMotion(
          <SessionEnd
            payload={{
              ...MATH_PAYLOAD,
              totalStardust: 8,
              finalStreak: 8,
            }}
            playUtteranceFn={playUtterance}
            chime={createFakeSfx()}
            sparkle={createFakeSfx()}
            plink={createFakeSfx()}
            storage={storage}
          />,
        ),
      )

      // Goodbye text is the LAST caption to render before the CTA replaces
      // the ribbon. We sample the caption right at the goodbye phase
      // (6100ms in post-M5 focus-recap shift, was 5000ms pre-M5) and verify
      // the LAST word of "See you soon." is revealed — the silent-fallback
      // shim only ticks word 0 ("See") and the caption would be stuck there.
      // 6500ms is past goodbye (6100) but before the CTA clears the caption
      // (7300).
      await advanceSequence(6500)

      // Capture the words and their reveal state. SessionEnd renders one
      // <span data-testid="session-end-caption-word"> per word with a
      // data-revealed boolean attr.
      const words = screen
        .queryAllByTestId('session-end-caption-word')
        .map((el) => ({
          text: el.textContent,
          revealed: el.getAttribute('data-revealed') === 'true',
        }))

      // Three words ("See", "you", "soon."). The fix: every word is
      // revealed by the time we sample (the fake ticks all words on
      // play). The bug shape: only the first word would be revealed.
      expect(words).toHaveLength(3)
      expect(words[0]!.revealed).toBe(true)
      expect(words[words.length - 1]!.revealed).toBe(true)
    })

    it('continues the sequence and shows the CTA when one utterance lookup misses (graceful degradation)', async () => {
      const storage = createMemoryStorage()
      seedStardust(storage, 9)
      // Streak utterance rejects (simulates the singleton lookup failing
      // for an id the planner did not emit, e.g. a server-subset path or
      // an unexpected stardust value). The phase machine must still fire
      // goodbye and reveal the CTA.
      const playUtterance = createMissingIdPlayUtterance('session.end.streak.')

      render(
        withMotion(
          <SessionEnd
            payload={{
              ...MATH_PAYLOAD,
              totalStardust: 9,
              finalStreak: 5,
            }}
            playUtteranceFn={playUtterance}
            chime={createFakeSfx()}
            sparkle={createFakeSfx()}
            plink={createFakeSfx()}
            storage={storage}
          />,
        ),
      )

      await advanceSequence(8000)

      // The miss path was still attempted — we want the call to be
      // recorded so the diagnostic surface (console.warn) fires too.
      expect(playUtterance.calls).toEqual([
        'session.end.opener',
        'session.end.recap.focus',
        'session.end.recap.9',
        'session.end.streak.5',
        'session.end.goodbye',
      ])

      // CTA appears regardless of the streak miss.
      expect(screen.getByTestId('session-end-cta')).toBeInTheDocument()
    })
  })

  /**
   * Focus-recap graceful SKIP on the REAL reject path (M5 #451, Thomas-
   * approved interim for Jessica's #453 P1).
   *
   * The `session.end.recap.focus` audio id is NOT in the committed canon
   * bundle yet. On a real device pre-bake the singleton
   * `playSessionUtterance` REJECTS the unbaked id WITHOUT firing
   * `onPlay`/`onWordTick` (`sessionAudio.ts` `!entry → reject`). The screen
   * must gracefully SKIP the focus-recap beat entirely in that case — NOT
   * enter the `focus-recap` phase at all — so there is no dead pause (phase
   * delay, no audio, no caption) and no audio-first-violating silent caption.
   *
   * IMPORTANT — these tests must drive the REAL reject path, NOT
   * `createFakePlayUtterance` (which fires `onWordTick` for ANY id and so
   * MASKS the bug; per Jessica's #453 finding). `createMissingIdPlayUtterance`
   * mirrors production: it rejects for the supplied prefix without ticking,
   * exactly like the singleton missing-howl-map path.
   */
  describe('focus-recap graceful skip on reject (M5 #451)', () => {
    const FOCUS_RECAP_COPY = 'You worked on adding to ten today!'

    it('NEVER enters the focus-recap phase when the utterance rejects (no dead pause)', async () => {
      const storage = createMemoryStorage()
      seedStardust(storage, 9)
      // localStorage is cleared in beforeEach → loadProgress() is null →
      // defaultProgress() → math focus node is `add-to-10`. The REAL reject
      // path: focus-recap id rejects without firing onPlay/onWordTick.
      const playUtterance = createMissingIdPlayUtterance(
        'session.end.recap.focus',
      )

      render(
        withMotion(
          <SessionEnd
            payload={{ ...MATH_PAYLOAD, totalStardust: 9, finalStreak: 5 }}
            playUtteranceFn={playUtterance}
            chime={createFakeSfx()}
            sparkle={createFakeSfx()}
            plink={createFakeSfx()}
            storage={storage}
          />,
        ),
      )

      // Sample data-phase across the whole pre-recap window in fine steps so
      // a transient `focus-recap` flip cannot slip between samples. The bug
      // shape is: phase sits in `focus-recap` for the inter-beat gap with no
      // audio + no caption. The fix: phase goes opener → recap, never
      // passing through focus-recap.
      const observedPhases = new Set<string>()
      const root = screen.getByTestId('session-end')
      for (let elapsed = 0; elapsed < 2800; elapsed += 100) {
        observedPhases.add(root.getAttribute('data-phase') ?? '')
        await act(async () => {
          vi.advanceTimersByTime(100)
        })
        await act(async () => {
          await Promise.resolve()
        })
      }
      observedPhases.add(root.getAttribute('data-phase') ?? '')

      // The phase machine moves opener → recap with no focus-recap stop.
      expect(observedPhases.has('focus-recap')).toBe(false)
      expect(observedPhases.has('opener')).toBe(true)
      expect(observedPhases.has('recap')).toBe(true)
    })

    it('NEVER renders the focus-recap caption when the utterance rejects (no silent caption)', async () => {
      const storage = createMemoryStorage()
      seedStardust(storage, 9)
      const playUtterance = createMissingIdPlayUtterance(
        'session.end.recap.focus',
      )

      render(
        withMotion(
          <SessionEnd
            payload={{ ...MATH_PAYLOAD, totalStardust: 9, finalStreak: 5 }}
            playUtteranceFn={playUtterance}
            chime={createFakeSfx()}
            sparkle={createFakeSfx()}
            plink={createFakeSfx()}
            storage={storage}
          />,
        ),
      )

      // Walk across the focus-recap window and assert the focus-recap copy
      // never appears in the ribbon at any sampled instant. A captioned-but-
      // silent line would violate audio-first; the skip path renders no
      // caption for this beat at all. We join the per-word caption spans with
      // a space (the ribbon renders one <span> per word, so `textContent`
      // alone concatenates without spaces).
      for (let elapsed = 0; elapsed < 2800; elapsed += 100) {
        const caption = screen
          .queryAllByTestId('session-end-caption-word')
          .map((el) => el.textContent)
          .join(' ')
        expect(caption).not.toBe(FOCUS_RECAP_COPY)
        await act(async () => {
          vi.advanceTimersByTime(100)
        })
        await act(async () => {
          await Promise.resolve()
        })
      }
    })

    it('collapses timing cleanly — recap + goodbye still fire and the CTA appears (no brick)', async () => {
      const storage = createMemoryStorage()
      seedStardust(storage, 9)
      const playUtterance = createMissingIdPlayUtterance(
        'session.end.recap.focus',
      )

      render(
        withMotion(
          <SessionEnd
            payload={{ ...MATH_PAYLOAD, totalStardust: 9, finalStreak: 5 }}
            playUtteranceFn={playUtterance}
            chime={createFakeSfx()}
            sparkle={createFakeSfx()}
            plink={createFakeSfx()}
            storage={storage}
          />,
        ),
      )

      await advanceSequence(8000)

      // focus-recap was ATTEMPTED (so the bake-later path stays wired) but
      // its REJECTION did not stop the sequence: recap (9), streak (5) and
      // goodbye all fire, and the CTA reveals. Count-based equality per the
      // project regression-test convention.
      expect(playUtterance.calls).toEqual([
        'session.end.opener',
        'session.end.recap.focus',
        'session.end.recap.9',
        'session.end.streak.5',
        'session.end.goodbye',
      ])
      expect(screen.getByTestId('session-end-cta')).toBeInTheDocument()
    })

    it('STILL engages the beat (phase + caption) once the id is bakeable (resolve path)', async () => {
      // Forward-proof: when the clip is baked, the utterance resolves AND
      // ticks, so the beat engages normally — phase flips to focus-recap and
      // the caption reveals. This fake ticks the focus-recap word AND DEFERS
      // its resolve to the next macrotask, so the `focus-recap` phase commits
      // to the DOM before the recap block's own `setPhase('recap')` runs
      // (a synchronously-resolving fake would batch the two setPhase calls in
      // one React flush and the transient focus-recap phase would never paint
      // — a test artifact, not a product behaviour).
      const storage = createMemoryStorage()
      seedStardust(storage, 9)
      const calls: string[] = []
      const playUtterance = ((
        utteranceId: string,
        opts?: {
          onPlay?: () => void
          onWordTick?: (wordIndex: number) => void
        },
      ) => {
        calls.push(utteranceId)
        opts?.onPlay?.()
        opts?.onWordTick?.(0)
        if (utteranceId === 'session.end.recap.focus') {
          // Defer resolve so the engaged focus-recap phase paints first.
          return new Promise<void>((resolve) => setTimeout(resolve, 0))
        }
        return Promise.resolve()
      }) as PlayUtteranceFn

      render(
        withMotion(
          <SessionEnd
            payload={{ ...MATH_PAYLOAD, totalStardust: 9, finalStreak: 5 }}
            playUtteranceFn={playUtterance}
            chime={createFakeSfx()}
            sparkle={createFakeSfx()}
            plink={createFakeSfx()}
            storage={storage}
          />,
        ),
      )

      // Drive just past the 1100ms focus-recap delay. On the engaged path the
      // phase IS `focus-recap` and the focus-recap copy DOES render — the
      // mirror image of the reject-path tests above.
      await advanceSequence(1300)

      const root = screen.getByTestId('session-end')
      expect(root).toHaveAttribute('data-phase', 'focus-recap')
      const caption = screen
        .queryAllByTestId('session-end-caption-word')
        .map((el) => el.textContent)
        .join(' ')
      expect(caption).toBe(FOCUS_RECAP_COPY)
      expect(calls).toContain('session.end.recap.focus')
    })
  })

  /**
   * Word-song completion-contingent stardust (ticket 86c9kwvza, locked
   * 2026-05-02).
   *
   * Per Dave's audit, word-song no longer grants stardust per chip-tap.
   * The flat +5 completion bonus lands here, in SessionEnd's mount
   * effect. Math is unchanged and exercised by the surrounding tests.
   *
   * These tests pin:
   *   - The shared stardust store gains exactly +5 on word-song mount.
   *   - The displayed counter ticks up to `payload.totalStardust + 5`.
   *   - The recap utterance id flips from `recap.<N>` to a fixed
   *     `recap.wordsong-completion` id.
   *   - The recap caption reads "You earned five stars for finishing!"
   *   - Math sessions are NOT bumped by the bonus.
   */
  describe('word-song completion-contingent stardust (ticket 86c9kwvza)', () => {
    it('grants exactly +5 stardust to the shared store on word-song mount', () => {
      const storage = createMemoryStorage()
      seedStardust(storage, 8)

      render(
        withMotion(
          <SessionEnd
            payload={{ ...WORD_SONG_PAYLOAD, totalStardust: 8 }}
            playUtteranceFn={createFakePlayUtterance()}
            chime={createFakeSfx()}
            sparkle={createFakeSfx()}
            plink={createFakeSfx()}
            storage={storage}
          />,
        ),
      )

      expect(loadStardust(storage).total).toBe(8 + WORDSONG_SESSION_END_BONUS)
    })

    it('does NOT grant the bonus on math mount (math is unchanged)', () => {
      const storage = createMemoryStorage()
      seedStardust(storage, 9)

      render(
        withMotion(
          <SessionEnd
            payload={{ ...MATH_PAYLOAD, totalStardust: 9 }}
            playUtteranceFn={createFakePlayUtterance()}
            chime={createFakeSfx()}
            sparkle={createFakeSfx()}
            plink={createFakeSfx()}
            storage={storage}
          />,
        ),
      )

      expect(loadStardust(storage).total).toBe(9)
    })

    it('exposes the post-bonus total via data-total-stardust on the root', () => {
      const storage = createMemoryStorage()
      seedStardust(storage, 8)

      render(
        withMotion(
          <SessionEnd
            payload={{ ...WORD_SONG_PAYLOAD, totalStardust: 8 }}
            playUtteranceFn={createFakePlayUtterance()}
            chime={createFakeSfx()}
            sparkle={createFakeSfx()}
            plink={createFakeSfx()}
            storage={storage}
          />,
        ),
      )

      const root = screen.getByTestId('session-end')
      expect(root).toHaveAttribute(
        'data-total-stardust',
        String(8 + WORDSONG_SESSION_END_BONUS),
      )
      expect(root).toHaveAttribute(
        'data-completion-bonus',
        String(WORDSONG_SESSION_END_BONUS),
      )
      expect(root).toHaveAttribute(
        'data-earned',
        String(WORDSONG_SESSION_END_BONUS),
      )
    })

    it('plays the dedicated recap.wordsong-completion utterance id (not recap.<N>)', async () => {
      const storage = createMemoryStorage()
      seedStardust(storage, 8)
      const playUtterance = createWordWalkingPlayUtterance()

      render(
        withMotion(
          <SessionEnd
            payload={{ ...WORD_SONG_PAYLOAD, totalStardust: 8, finalStreak: 1 }}
            playUtteranceFn={playUtterance}
            chime={createFakeSfx()}
            sparkle={createFakeSfx()}
            plink={createFakeSfx()}
            storage={storage}
          />,
        ),
      )

      await advanceSequence(8000)

      // Streak is below 3 → streak utterance is skipped. The focus-recap
      // line (M5) fires after the opener; the stardust recap id is the
      // word-song-specific id. Count-based equality per the project
      // regression-test convention.
      expect(playUtterance.calls).toEqual([
        'session.end.opener',
        'session.end.recap.focus',
        'session.end.recap.wordsong-completion',
        'session.end.goodbye',
      ])
    })

    it('reveals the recap caption "You earned five stars for finishing!"', async () => {
      const storage = createMemoryStorage()
      seedStardust(storage, 0)
      const playUtterance = createWordWalkingPlayUtterance()

      render(
        withMotion(
          <SessionEnd
            payload={{ ...WORD_SONG_PAYLOAD, totalStardust: 0, finalStreak: 0 }}
            playUtteranceFn={playUtterance}
            chime={createFakeSfx()}
            sparkle={createFakeSfx()}
            plink={createFakeSfx()}
            storage={storage}
          />,
        ),
      )

      // Drain through the recap phase but stop before goodbye so the
      // caption is still on the recap line.
      await advanceSequence(3300)

      const captionWords = screen
        .queryAllByTestId('session-end-caption-word')
        .map((el) => el.textContent)
        .join(' ')
      expect(captionWords).toBe('You earned five stars for finishing!')
    })
  })
})
