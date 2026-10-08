import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'
import SessionEnd from './SessionEnd'
import type { SessionEndPayload, PlayUtteranceFn } from './SessionEnd'
import type { Sfx } from '../../lib/sfx'
import type { StorageAdapter } from '@marian/core/math/stardust'
import {
  STARDUST_STORAGE_KEY,
  STARDUST_SCHEMA_VERSION,
} from '@marian/core/math/stardust'
import { loadStardust } from '@marian/core/shared/stardust'
import { WORDSONG_SESSION_END_BONUS } from '@marian/core/shared/wordSongCompletionBonus'
import {
  SESSION_HISTORY_KEY,
  SESSION_HISTORY_SCHEMA_VERSION,
} from '@marian/core/sessionEnd/sessionHistory'
import {
  STORAGE_KEY as PROGRESS_STORAGE_KEY,
  defaultProgress,
  isProgressV1,
  loadProgress,
  saveProgress,
  type Progress,
} from '@marian/core/progress'

// Guidance G2: Emma's session-end lines play through the map line player.
// Its Howl never ends in jsdom, so every test here gets a player that
// resolves at once — each beat then costs its real clip length (the
// floor), and the guidance tests read `pathPlays`.
const pathPlays: string[] = []
vi.mock('../Map/playMapLine', () => ({
  createMapLinePlayer: () => ({
    play: (line: { id: string }) => {
      pathPlays.push(line.id)
      return Promise.resolve()
    },
    cancel: () => {},
    unload: () => {},
  }),
}))

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

  it('records the review tier (not the simple-sentences forward fallback) when the whole tree is mastered (matches Jessica PR #474 invariant)', () => {
    // Jessica's failing-first e2e seeds the post-graduation, whole-word-song-
    // tree-mastered state. There the forward fallback in `pickFocusNode` is
    // the LAST node (`simple-sentences`), so a sessionCount-blind
    // re-derivation would record `skillFocus: ['simple-sentences']` instead
    // of the periodic review tier. Her spec asserts `reviewEntry.skillFocus`
    // deep-equals the review tier — this is the SessionEnd-unit mirror.
    const storage = createMemoryStorage()
    seedStardust(storage, 8)
    const base = defaultProgress('Marian')
    const allMastered = { ...base.skillLevels }
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
      allMastered[node] = 'mastered'
    }
    const progress: Progress = {
      ...base,
      skillLevels: allMastered,
      cvcGraduationSessionFired: true, // graduation done — periodic active
    }
    saveProgress(progress)
    const fixedDate = new Date('2026-06-15T18:00:00.000Z')

    render(
      withMotion(
        <SessionEnd
          payload={{
            ...WORD_SONG_PAYLOAD,
            // sessionCount 10 → round-robin index `floor(10/5) % 3 === 2`
            // → `cvc-words-short-u`. This is the identity App.tsx froze at
            // session-start with the real sessionCount.
            sessionFocus: { node: 'cvc-words-short-u', mode: 'cvc-review' },
          }}
          playUtteranceFn={createFakePlayUtterance()}
          chime={createFakeSfx()}
          sparkle={createFakeSfx()}
          storage={storage}
          now={() => fixedDate}
        />,
      ),
    )

    const loaded = loadProgress()
    const newEntry = loaded!.history[loaded!.history.length - 1]
    // Exactly Jessica's assertion: the review tier, NOT the forward
    // fallback (`simple-sentences`).
    expect(newEntry.skillFocus).toEqual(['cvc-words-short-u'])
    expect(newEntry.skillFocus).not.toContain('simple-sentences')
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
          storage={storage}
        />,
      ),
    )

    // CTA should not be visible initially
    expect(screen.queryByTestId('session-end-cta')).not.toBeInTheDocument()

    // Advance through the entire sequence with microtask flushes
    await advanceSequence(15_000)

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
          storage={storage}
        />,
      ),
    )

    await advanceSequence(15_000)

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
          storage={storage}
          onAllDone={onAllDone}
        />,
      ),
    )

    await advanceSequence(15_000)
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
          storage={storage}
        />,
      ),
    )

    await advanceSequence(15_000)
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
          storage={storage}
        />,
      ),
    )

    await advanceSequence(15_000)

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
          storage={storage}
        />,
      ),
    )

    await advanceSequence(15_000)
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
          storage={storage}
        />,
      ),
    )

    const emmaImg = screen.getByTestId('session-end-emma')
    expect(emmaImg).toHaveAttribute('src', '/assets/emma-cheering.svg')
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
  })

  describe('Guidance G2 beats (123jpnbca4t)', () => {
    beforeEach(() => {
      pathPlays.length = 0
    })

    function renderEnd(
      payload: SessionEndPayload,
      opts: {
        sparkle?: Sfx
        onAllDone?: () => void
        onAgain?: () => void
        storage?: ReturnType<typeof createMemoryStorage>
      } = {},
    ) {
      const storage = opts.storage ?? createMemoryStorage()
      seedStardust(storage, payload.totalStardust)
      return render(
        withMotion(
          <SessionEnd
            payload={payload}
            chime={createFakeSfx()}
            sparkle={opts.sparkle ?? createFakeSfx()}
            storage={storage}
            onAllDone={opts.onAllDone}
            onAgain={opts.onAgain}
          />,
        ),
      )
    }

    const slots = () =>
      screen
        .getAllByTestId('session-end-slot')
        .map((s) => s.getAttribute('data-slot'))

    it('good day: praise → flower flies in → "1 of 3" → sleeps tonight; buttons wait for the last line', async () => {
      // Baseline: add-to-10 practicing, no good days yet; 7/8 is a good day.
      const sparkle = createFakeSfx()
      renderEnd(MATH_PAYLOAD, { sparkle })
      const root = screen.getByTestId('session-end')
      expect(root).toHaveAttribute('data-day', 'good-day')
      expect(slots()).toEqual(['empty', 'empty', 'empty'])
      expect(screen.getByTestId('session-end-caption')).toHaveTextContent(
        'Seven right! You worked hard!',
      )
      expect(screen.queryByTestId('session-end-cta')).toBeNull()

      // Praise clip is 3.12 s: the flower is not out before it ends.
      await advanceSequence(3000)
      expect(screen.queryByTestId('session-end-new-flower')).toBeNull()
      await advanceSequence(600)
      expect(screen.getByTestId('session-end-new-flower')).toBeInTheDocument()
      expect(screen.getByTestId('session-end-caption')).toHaveTextContent(
        'You got a flower!',
      )
      // Lands ≈ the end of the 1.52 s flower clip: sleeping in slot 1.
      await advanceSequence(1600)
      expect(screen.queryByTestId('session-end-new-flower')).toBeNull()
      expect(slots()).toEqual(['sleeping', 'empty', 'empty'])
      expect(screen.getByTestId('session-end-count')).toHaveTextContent(
        '1 of 3',
      )
      expect(sparkle.play).toHaveBeenCalledTimes(1)

      // Count clip 1.36 s + gaps, then the why-and-when line.
      await advanceSequence(3000)
      expect(screen.getByTestId('session-end-caption')).toHaveTextContent(
        'It sleeps tonight. Come back tomorrow for one more.',
      )
      expect(screen.getByTestId('session-end-cta')).toHaveAccessibleName(
        'All done!',
      )
      expect(screen.queryByTestId('session-end-again')).toBeNull()
      await advanceSequence(5000)
      expect(root).toHaveAttribute('data-phase', 'settled')
      expect(pathPlays).toEqual([
        'guide.end.right.7',
        'guide.end.flower',
        'guide.end.count.1',
        'guide.end.sleeps',
      ])
    })

    it('3rd good day: "3 of 3!" then "A new path opens. Look!"; All done hands off (App routes to the map)', async () => {
      const day = (d: number) =>
        new Date(Date.now() - d * 86_400_000).toISOString()
      saveProgress({
        ...defaultProgress(),
        history: [
          { dateISO: day(2), skillFocus: ['add-to-10'], successRate: 1 },
          { dateISO: day(1), skillFocus: ['add-to-10'], successRate: 1 },
        ],
      })
      const onAllDone = vi.fn()
      renderEnd({ ...MATH_PAYLOAD, totalCorrect: 8 }, { onAllDone })
      const root = screen.getByTestId('session-end')
      expect(root).toHaveAttribute('data-day', 'unlock')
      expect(root).toHaveAttribute('data-path-beat', 'unlock')
      expect(slots()).toEqual(['grown', 'grown', 'empty'])
      await advanceSequence(15_000)
      expect(slots()).toEqual(['grown', 'grown', 'grown'])
      expect(screen.getByTestId('session-end-count')).toHaveTextContent(
        '3 of 3!',
      )
      expect(pathPlays).toEqual([
        'guide.end.right.8',
        'guide.end.flower',
        'guide.end.count.3',
        'guide.end.path-opens',
      ])
      fireEvent.click(screen.getByTestId('session-end-cta'))
      await advanceSequence(500)
      expect(onAllDone).toHaveBeenCalledTimes(1)
    })

    it('last step of a world: "3 of 3!" then "You grew your whole garden!" plays its clip', async () => {
      const day = (d: number) =>
        new Date(Date.now() - d * 86_400_000).toISOString()
      const base = defaultProgress()
      saveProgress({
        ...base,
        skillLevels: { ...base.skillLevels, 'mult-6-9': 'practicing' },
        history: [
          { dateISO: day(2), skillFocus: ['mult-6-9'], successRate: 1 },
          { dateISO: day(1), skillFocus: ['mult-6-9'], successRate: 1 },
        ],
      })
      renderEnd({
        ...MATH_PAYLOAD,
        totalCorrect: 8,
        sessionFocus: { node: 'mult-6-9', mode: 'forward' },
      })
      expect(screen.getByTestId('session-end')).toHaveAttribute(
        'data-day',
        'world-done',
      )
      await advanceSequence(15_000)
      expect(screen.getByTestId('session-end-count')).toHaveTextContent(
        '3 of 3!',
      )
      expect(screen.getByTestId('session-end-caption')).toHaveTextContent(
        'You grew your whole garden!',
      )
      expect(pathPlays).toEqual([
        'guide.end.right.8',
        'guide.end.flower',
        'guide.end.count.3',
        'guide.end.world-done',
      ])
    })

    it('not-yet day: warm praise, tray untouched, "Play again…" once; Again + Home; never a negative beat', async () => {
      const onAgain = vi.fn()
      const onAllDone = vi.fn()
      const storage = createMemoryStorage()
      renderEnd(
        { ...MATH_PAYLOAD, totalCorrect: 5 },
        { onAgain, onAllDone, storage },
      )
      const root = screen.getByTestId('session-end')
      expect(root).toHaveAttribute('data-day', 'not-yet')
      expect(screen.getByTestId('session-end-emma')).toHaveAttribute(
        'src',
        '/assets/emma-idle.svg',
      )
      await advanceSequence(10_000)
      expect(pathPlays).toEqual([
        'guide.end.not-yet.praise',
        'guide.end.not-yet.again',
      ])
      expect(slots()).toEqual(['empty', 'empty', 'empty'])
      expect(screen.queryByTestId('session-end-new-flower')).toBeNull()
      expect(screen.queryByTestId('session-end-count')).toBeNull()
      expect(screen.getByTestId('session-end-again')).toHaveAccessibleName(
        'Again',
      )
      expect(screen.getByTestId('session-end-cta')).toHaveAccessibleName('Home')
      const text = (root.textContent ?? '').toLowerCase()
      for (const bad of ['wrong', 'failed', 'oops', 'missed', '✗', '❌']) {
        expect(text).not.toContain(bad)
      }
      fireEvent.click(screen.getByTestId('session-end-again'))
      await advanceSequence(500)
      expect(onAgain).toHaveBeenCalledTimes(1)
      expect(onAllDone).not.toHaveBeenCalled()
    })

    it('a second not-yet session the same day gets the practice line only', async () => {
      const storage = createMemoryStorage()
      const first = renderEnd({ ...MATH_PAYLOAD, totalCorrect: 4 }, { storage })
      await advanceSequence(10_000)
      first.unmount()
      pathPlays.length = 0
      renderEnd({ ...MATH_PAYLOAD, totalCorrect: 4 }, { storage })
      await advanceSequence(10_000)
      expect(pathPlays).toEqual(['guide.end.not-yet.praise'])
    })

    it('same-day replay after today’s flower: practice praise, no new flower, the flower still sleeps', async () => {
      saveProgress({
        ...defaultProgress(),
        history: [
          {
            dateISO: new Date().toISOString(),
            skillFocus: ['add-to-10'],
            successRate: 1,
          },
        ],
      })
      renderEnd({ ...MATH_PAYLOAD, totalCorrect: 8 })
      const root = screen.getByTestId('session-end')
      expect(root).toHaveAttribute('data-day', 'practice')
      await advanceSequence(10_000)
      expect(pathPlays).toEqual(['guide.end.not-yet.praise'])
      expect(slots()).toEqual(['sleeping', 'empty', 'empty'])
      expect(screen.queryByTestId('session-end-count')).toBeNull()
      expect(screen.getByTestId('session-end-cta')).toHaveAccessibleName(
        'All done!',
      )
    })

    it('no stardust total is shown; stars are one per right answer with no number', () => {
      renderEnd({ ...MATH_PAYLOAD, totalStardust: 36 })
      const root = screen.getByTestId('session-end')
      expect(root.textContent ?? '').not.toContain('36')
      expect(screen.queryByTestId('stardust-counter')).toBeNull()
      expect(
        screen.getByTestId('session-end-stars').querySelectorAll('svg'),
      ).toHaveLength(MATH_PAYLOAD.totalCorrect)
      expect(screen.getByTestId('session-end-stars').textContent).toBe('')
    })
  })
})
