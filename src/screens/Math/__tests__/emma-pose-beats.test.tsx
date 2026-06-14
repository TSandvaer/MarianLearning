import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'

/*
 * ────────────────────────────────────────────────────────────────────────
 * FAILING-FIRST spec — Wave 14 Track B (ClickUp 86ca8kq7r).
 *
 * Two EmmaPose values are fully DEFINED (asset + tilt + spring + hold) but
 * never `setPose()`'d at runtime by Math.tsx:
 *
 *   - `listening`          — caption-reveal / Emma-speaking (read-aloud) beat.
 *   - `attentive-pointing` — hint / pre-canned-explanation beat.
 *
 * This spec PINS the intended behaviour. It is RED on current `main`
 * (the poses are never set; `data-pose` stays `idle` during these beats)
 * and is makeable-GREEN by Math.tsx `setPose()` wiring ALONE — no change to
 * EmmaCharacter.tsx or emmaPose.ts (those already define everything).
 *
 * The `data-pose` selector lives on the EmmaCharacter `<m.img>`
 * (`data-testid="math-emma"`) AND on the screen root (`data-testid="math"`).
 * We read `math-emma` — the canonical "is the right pose live?" selector
 * (emma-character-and-animation.md §5).
 * ────────────────────────────────────────────────────────────────────────
 */

// Stub the SFX factory so jsdom never tries to construct a real Howl.
// Mirrors Math.test.tsx exactly.
type FakeSfx = {
  play: ReturnType<typeof vi.fn>
  unload: ReturnType<typeof vi.fn>
  missedPlays: number
  loadFailed: boolean
}
const sfxState: { instances: FakeSfx[]; createCount: number } = {
  instances: [],
  createCount: 0,
}
vi.mock('../../../lib/sfx', () => ({
  createSfx: vi.fn(() => {
    const fake: FakeSfx = {
      play: vi.fn(() => true),
      unload: vi.fn(),
      missedPlays: 0,
      loadFailed: false,
    }
    sfxState.instances.push(fake)
    sfxState.createCount += 1
    return fake
  }),
}))

import MathScreen from '../Math'
import type { PlayMathUtteranceFn } from '../Math'
import type { MathSessionPlan } from '../sessionPlans'
import { type StorageAdapter } from '../../_shared/stardust'

function withMotion(node: ReactNode) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{node}</MotionConfig>
    </LazyMotion>
  )
}

/** Force the matchMedia query for prefers-reduced-motion. Mirrors the
 *  helper in EmmaCharacter.test.tsx so the project hook picks up the stub. */
function stubReducedMotion(matches: boolean) {
  return vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: matches && query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }))
}

/** A fixed two-problem plan. Problem 1 = 3 + 2 = 5 (legacy single-hint). */
function fixedPlan(): MathSessionPlan {
  return {
    id: 'test-plan',
    label: 'Test plan',
    problems: [
      {
        index: 1,
        addendA: 3,
        addendB: 2,
        correct: 5,
        op: '+',
        utterances: {
          read: 'Three plus two. How many?',
          correct: 'Yes! Five!',
          reprompt: 'Hmm... try again?',
          hint: 'Look. Three. And two more. How many now?',
          giveAnswer: 'This one is five.',
        },
      },
      {
        index: 2,
        addendA: 1,
        addendB: 4,
        correct: 5,
        op: '+',
        utterances: {
          read: 'One plus four. How many?',
          correct: 'Yes! Five!',
          reprompt: 'Hmm... try again?',
          hint: 'Look. One. And four more. How many now?',
          giveAnswer: 'This one is five.',
        },
      },
    ],
  }
}

function makeMemoryStorage(): StorageAdapter {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
  }
}

/**
 * Controllable PlayMathUtteranceFn fake. Captures every call so a test can
 * resolve them individually (hold the read-aloud / hint speak() pending
 * while asserting the pose, then resolve to assert it clears). Mirrors
 * Math.test.tsx's makePlayHarness.
 */
function makePlayHarness(opts: { autoResolve?: boolean } = {}) {
  const calls: Array<{
    text: string
    resolve: () => void
    reject: (err: Error) => void
  }> = []

  const playUtterance: PlayMathUtteranceFn = vi.fn(async (text, playOpts) => {
    return await new Promise<void>((resolve, reject) => {
      calls.push({ text, resolve, reject })
      playOpts?.onPlay?.()
      const words = text.split(/\s+/).filter(Boolean)
      for (let i = 0; i < words.length; i++) {
        playOpts?.onWordTick?.(i)
      }
      if (opts.autoResolve !== false) {
        Promise.resolve().then(() => resolve())
      }
    })
  })

  return {
    playUtterance,
    calls,
    spoken(): string[] {
      return calls.map((c) => c.text)
    },
    /** Resolve a single pending call by the text it was invoked with. */
    resolveByText(text: string): void {
      for (const c of calls) if (c.text === text) c.resolve()
    },
    resolveAll(): void {
      for (const c of calls) c.resolve()
    },
  }
}

/**
 * Read the CURRENT pose. EmmaCharacter wraps its `<m.img>` in
 * `<AnimatePresence>`; during a pose transition the exiting img and the
 * entering img both carry the same testid for one commit (the exit
 * animation hasn't unmounted yet under jsdom). AnimatePresence mounts the
 * new child LAST in document order, so the final matching element is the
 * live pose. Returns `data-pose` of that element.
 */
const POSE = (testid = 'math-emma') => {
  const all = screen.getAllByTestId(testid)
  return all[all.length - 1].getAttribute('data-pose')
}
/** Read the live EmmaCharacter element (newest mount) for attribute checks. */
const emmaEl = (testid = 'math-emma') => {
  const all = screen.getAllByTestId(testid)
  return all[all.length - 1]
}

describe('Math — Emma pose beats (Wave 14 Track B)', () => {
  beforeEach(() => {
    sfxState.instances = []
    sfxState.createCount = 0
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // ── RED-on-base lever #1: listening during the read-aloud beat ──────────
  //
  // Cold-mount real flow: getHowlerRunning() returns true (Greet already
  // unlocked Howler), __testInitiallyAudioUnlocked deliberately NOT passed,
  // so the read-aloud effect fires speak(read). The harness holds that
  // speak() pending (autoResolve:false). While Emma is speaking the
  // read-aloud, the pose must be `listening`. On the speak() onEnd it must
  // clear back to `idle`.
  it('shows `listening` while Emma reads the problem aloud, clears to `idle` on speak onEnd', async () => {
    const harness = makePlayHarness({ autoResolve: false })
    const getHowlerRunning = vi.fn(() => true)

    render(
      withMotion(
        <MathScreen
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    // Drain the queueMicrotask → speak() dispatch chain WITHOUT resolving
    // the speak() promise (autoResolve:false leaves it pending).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    // The read-aloud was dispatched and is in flight.
    expect(harness.spoken()).toEqual(['Three plus two. How many?'])

    // RED-on-base lever: pose is `listening` while Emma speaks.
    expect(POSE()).toBe('listening')

    // Resolve the read-aloud speak() (its onEnd) → pose returns to idle.
    await act(async () => {
      harness.resolveByText('Three plus two. How many?')
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(POSE()).toBe('idle')
  })

  // ── RED-on-base lever #2: attentive-pointing during the hint beat ───────
  //
  // After 2 wrong taps the hint fires (reprompt.then → 600ms hint timer →
  // runHintSequence → speak(hint)). We hold the hint speak() pending and
  // assert the pose is `attentive-pointing`, then resolve and assert idle.
  it('shows `attentive-pointing` while the hint plays, clears to `idle` on hint onEnd', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness({ autoResolve: false })
    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const wrongTap = async () => {
      const chips = screen.getAllByTestId('math-chip')
      const wrongChip = chips.find(
        (c) => Number(c.getAttribute('data-value')) !== 5,
      )!
      await act(async () => {
        fireEvent.click(wrongChip)
        await Promise.resolve()
      })
    }

    // Two wrong taps → the second crosses HINT_AFTER_WRONG_COUNT.
    await wrongTap()
    // Resolve the first reprompt so its .then() returns Emma to idle.
    await act(async () => {
      harness.resolveByText('Hmm... try again?')
      await Promise.resolve()
    })
    await wrongTap()
    // Resolve the second reprompt → schedules the 600ms hint timer.
    await act(async () => {
      harness.resolveByText('Hmm... try again?')
      await Promise.resolve()
    })

    // Fire the 600ms hint-delay timer → runHintSequence → speak(hint).
    await act(async () => {
      vi.advanceTimersByTime(600)
      await Promise.resolve()
    })

    // The hint is in flight (held pending by the harness).
    expect(harness.spoken()).toContain(
      'Look. Three. And two more. How many now?',
    )

    // RED-on-base lever: pose is `attentive-pointing` while the hint plays.
    expect(POSE()).toBe('attentive-pointing')

    // Resolve the hint speak() (its onEnd) → pose returns to idle.
    await act(async () => {
      harness.resolveByText('Look. Three. And two more. How many now?')
      await Promise.resolve()
      // returnToIdle uses a setTimeout(0) to clear the pose.
      vi.advanceTimersByTime(0)
      await Promise.resolve()
    })

    expect(POSE()).toBe('idle')
  })

  // ── Regression-lock: puzzled-tilt still fires on a wrong tap ────────────
  // Passes on base today; must STILL pass after the pose-beat wiring lands
  // (the new beats must not clobber the wrong-answer reaction).
  it('regression-lock: wrong tap still swaps Emma to `puzzled-tilt`', async () => {
    const harness = makePlayHarness()
    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chips = screen.getAllByTestId('math-chip')
    const wrongChip = chips.find(
      (c) => Number(c.getAttribute('data-value')) !== 5,
    )!
    await act(async () => {
      fireEvent.click(wrongChip)
      await Promise.resolve()
    })

    expect(POSE()).toBe('puzzled-tilt')
  })

  // ── Regression-lock: celebration still fires on a correct tap ───────────
  it('regression-lock: correct tap still swaps Emma to `celebration`', async () => {
    const harness = makePlayHarness({ autoResolve: false })
    render(
      withMotion(
        <MathScreen
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chips = screen.getAllByTestId('math-chip')
    const correctChip = chips.find(
      (c) => Number(c.getAttribute('data-value')) === 5,
    )!
    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // celebration is set synchronously in handleCorrectTap, before the
    // celebration speak() resolves (held pending here so auto-advance
    // doesn't whisk us to the next problem mid-assert).
    expect(POSE()).toBe('celebration')
  })

  // ── Reduce-motion: pose SVG still swaps; tilt skipped ───────────────────
  //
  // Under prefers-reduced-motion the `listening` SVG must still render
  // (Marian sees the right face) but data-wiggling must be "false" (tilt
  // skipped). This is enforced by the SHARED EmmaCharacter via
  // usePrefersReducedMotion — so it falls out of the same screen-level
  // setPose('listening') wiring with no extra reduce-motion branch in Math.
  it('reduce-motion: `listening` SVG swaps but tilt is skipped (data-wiggling=false)', async () => {
    stubReducedMotion(true)
    const harness = makePlayHarness({ autoResolve: false })
    const getHowlerRunning = vi.fn(() => true)

    render(
      withMotion(
        <MathScreen
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const emma = emmaEl('math-emma')
    // Right face: the listening SVG renders.
    expect(emma.getAttribute('data-pose')).toBe('listening')
    expect(emma.getAttribute('src')).toBe('/assets/emma-listening.svg')
    // Tilt skipped under reduce-motion.
    expect(emma.getAttribute('data-wiggling')).toBe('false')
  })
})
