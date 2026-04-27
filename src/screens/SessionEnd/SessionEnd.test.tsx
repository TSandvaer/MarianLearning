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

  it('renders Melody celebrating image', () => {
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

    const melodyImg = screen.getByTestId('session-end-melody')
    expect(melodyImg).toHaveAttribute('src', '/assets/melody-cheering.svg')
  })
})
