import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'
import SessionEnd from './SessionEnd'
import type { SessionEndPayload, PlayUtteranceFn } from './SessionEnd'
import type { Sfx } from '../../lib/sfx'
import type { StorageAdapter } from '../Math/stardust'
import { STARDUST_STORAGE_KEY, STARDUST_SCHEMA_VERSION } from '../Math/stardust'
import { SESSION_HISTORY_KEY } from './sessionHistory'

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
  })

  afterEach(() => {
    vi.useRealTimers()
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

      // Drain the full sequence: opener (t=0), recap (t=1400), streak
      // (t=3400), goodbye (t=5000), CTA (t=6200).
      await advanceSequence(8000)

      // Count-based assertion per `feedback_count_assertions_on_regression_tests`:
      // exact array equality so a duplicate or a re-ordered call fails the
      // test loudly.
      expect(playUtterance.calls).toEqual([
        'session.end.opener',
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

      // No recap.* call when stardust is zero (matches the
      // SessionEnd.tsx `if (p.totalStardust > 0)` gate). Streak still
      // fires because finalStreak >= 3.
      expect(playUtterance.calls).toEqual([
        'session.end.opener',
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
      // (5000ms in) and verify the LAST word of "See you soon." is
      // revealed — the silent-fallback shim only ticks word 0 ("See")
      // and the caption would be stuck there.
      await advanceSequence(5500)

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
        'session.end.recap.9',
        'session.end.streak.5',
        'session.end.goodbye',
      ])

      // CTA appears regardless of the streak miss.
      expect(screen.getByTestId('session-end-cta')).toBeInTheDocument()
    })
  })
})
