import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'

// Stub the SFX factory so jsdom never tries to construct a real Howl.
// Same pattern as Math.test.tsx.
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
vi.mock('../../lib/sfx', () => ({
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

import WordSong from './WordSong'
import type { PlayWordSongUtteranceFn } from './WordSong'
import type { WordSongSessionPlan } from './wordSessionPlans'
import { STARDUST_STORAGE_KEY, type StorageAdapter } from '../_shared/stardust'
import { getWordEntry } from './wordPack'

/*
 * NOTE on `__testInitiallyAudioUnlocked` threaded through every render below:
 *
 * PR #83 (ticket 86c9guh4y) added a `disabled={!readAloudPlayed}` gate on
 * the chip buttons so Marian can't tap before hearing the question.
 * jsdom + React 19 silently swallows `fireEvent.click` on `<button
 * disabled>`, so without this seam every chip-tap test no-ops. The seam
 * pre-arms `audioUnlocked` AND `readAloudPlayed` so chips render
 * tappable on first paint. Production callers never pass this. See
 * Math.test.tsx for the longer-form rationale and ticket 86c9guh4y.
 */

function withMotion(node: ReactNode) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{node}</MotionConfig>
    </LazyMotion>
  )
}

/** A fixed plan for tests — uses real word entries so distractor matrix
 *  resolves cleanly. Uses the easiest words across both tiers so every
 *  problem has 3 chips with predictable values. */
function fixedPlan(): WordSongSessionPlan {
  const words = ['cat', 'bag', 'jam', 'fan', 'pan', 'man', 'tag', 'cap']
  return {
    id: 'test-plan',
    label: 'Test plan',
    problems: words.map((word, i) => {
      const target = getWordEntry(word)
      const Word = word[0].toUpperCase() + word.slice(1)
      return {
        index: i + 1,
        target,
        utterances: {
          read: `Tap the ${word}.`,
          correct: `Yes! ${Word}.`,
          reprompt: 'Hmm... try again?',
          hint: `Let's look. ${Word}.`,
          giveAnswer: `This one is ${word}.`,
        },
      }
    }),
  }
}

/**
 * A `cvc-word` content-type plan for the silent-text-window tests.
 * Identical shape to `fixedPlan()` except every problem carries
 * `contentType: 'cvc-word'` and the read line uses the "Read the X."
 * template (matching what `planFromServer.parse` emits for the
 * `cvc-word` content type). Ticket 86c9m3ae6.
 */
function cvcWordPlan(): WordSongSessionPlan {
  const words = ['cat', 'bag', 'jam', 'fan', 'pan', 'man', 'tag', 'cap']
  return {
    id: 'test-plan-cvc-word',
    label: 'Test plan (cvc-word)',
    problems: words.map((word, i) => {
      const target = getWordEntry(word)
      const Word = word[0].toUpperCase() + word.slice(1)
      return {
        index: i + 1,
        target,
        contentType: 'cvc-word',
        utterances: {
          read: `Read the ${word}.`,
          correct: `Yes! ${Word}.`,
          reprompt: 'Hmm... try again?',
          hint: `Let's look. ${Word}.`,
          giveAnswer: `This one is ${word}.`,
        },
      }
    }),
  }
}

/**
 * A `sight-word` content-type plan for the Wave 11 sight-words render
 * tests (W11-03, ticket 86ca7xmvz). Every problem carries
 * `contentType: 'sight-word'` and draws its target from the sight-words
 * pool (real `WordEntry` rows Kevin shipped in W11-02 / PR #386 — they
 * resolve via `getWordEntry` and have `TARGET_PAIRINGS` rows, so the
 * distractor trio builds without a dedicated picker). The read line uses
 * Dave's "Find the word: <word>." carrier; the `correct` slot uses the
 * stable "Yes! <Word>." encoding the canon shares.
 */
function sightWordPlan(): WordSongSessionPlan {
  // First 8 of Dave's Batch-1 starter pool. All have TARGET_PAIRINGS rows.
  const words = ['the', 'a', 'is', 'it', 'go', 'no', 'to', 'do']
  return {
    id: 'test-plan-sight-word',
    label: 'Test plan (sight-word)',
    problems: words.map((word, i) => {
      const target = getWordEntry(word)
      const Word = word[0].toUpperCase() + word.slice(1)
      return {
        index: i + 1,
        target,
        contentType: 'sight-word',
        utterances: {
          read: `Find the word: ${word}.`,
          correct: `Yes! ${Word}.`,
          reprompt: 'Hmm... try again?',
          hint: `Look. ${Word}.`,
          giveAnswer: `This one is ${word}.`,
        },
      }
    }),
  }
}

/**
 * A `simple-sentence` content-type plan for the Wave 13 simple-sentences
 * render tests (W13-03/04, ticket 86ca8e6fr). Every problem carries
 * `contentType: 'simple-sentence'`, a `sentenceFrame` with the `___` gap,
 * and a `sceneId` on the gentle problems. The target is resolved from the
 * `correct` line ("Yes! <Word>.") — never the gapped read. Mirrors the
 * wire shape Kevin's W13-03 canon produces.
 */
function simpleSentencePlan(): WordSongSessionPlan {
  // 3 gentle (scene-bearing) + 5 trap, matching Dave's gentle/trap split.
  const rows: ReadonlyArray<{
    frame: string
    target: string
    sceneId?: string
  }> = [
    { frame: 'The cat ___ the mat.', target: 'sat', sceneId: 'cat-sat-mat' },
    { frame: 'The dog ___.', target: 'ran', sceneId: 'dog-ran' },
    { frame: 'I see the ___.', target: 'dog', sceneId: 'see-dog' },
    { frame: 'The sun is ___.', target: 'hot' },
    { frame: '___ are in the van.', target: 'they' },
    { frame: 'Put it ___ the mat.', target: 'on' },
    { frame: 'The mat is ___.', target: 'red' },
    { frame: 'We can go ___.', target: 'there' },
  ]
  return {
    id: 'test-plan-simple-sentence',
    label: 'Test plan (simple-sentence)',
    problems: rows.map(({ frame, target, sceneId }, i) => {
      const entry = getWordEntry(target)
      const Word = target[0].toUpperCase() + target.slice(1)
      return {
        index: i + 1,
        target: entry,
        contentType: 'simple-sentence' as const,
        sentenceFrame: frame,
        sceneId,
        utterances: {
          read: `Finish the sentence: ${frame.replace('___', 'blank')}`,
          correct: `Yes! ${Word}.`,
          reprompt: 'Hmm... try again?',
          hint: `Listen. ${frame.replace('___', target)}`,
          giveAnswer: `This one is ${target}.`,
        },
      }
    }),
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
 * Build a controllable PlayWordSongUtteranceFn fake. Captures every call
 * so tests can assert what was spoken.
 */
function makePlayHarness(opts: { autoResolve?: boolean } = {}) {
  const calls: Array<{
    text: string
    resolve: () => void
    reject: (err: Error) => void
  }> = []

  const playUtterance: PlayWordSongUtteranceFn = vi.fn(
    async (text, playOpts) => {
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
    },
  )

  return {
    playUtterance,
    calls,
    spoken(): string[] {
      return calls.map((c) => c.text)
    },
    resolveAll(): void {
      for (const c of calls) c.resolve()
    },
  }
}

describe('Word Song screen', () => {
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

  it('renders the first problem on mount with HUD, emma, word card, and chips', () => {
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    expect(screen.getByTestId('word-song')).toBeInTheDocument()
    expect(screen.getByTestId('word-song-hud')).toBeInTheDocument()
    expect(screen.getByTestId('word-song-stardust')).toHaveAttribute(
      'data-total',
      '0',
    )

    // Word card with picture + letters
    expect(screen.getByTestId('word-song-word-card')).toHaveAttribute(
      'data-word',
      'cat',
    )
    expect(screen.getByTestId('word-song-word-picture')).toBeInTheDocument()
    const letters = screen.getAllByTestId('word-song-letter')
    expect(letters).toHaveLength(3) // c-a-t
    expect(letters[0]).toHaveAttribute('data-letter', 'c')
    expect(letters[1]).toHaveAttribute('data-letter', 'a')
    expect(letters[2]).toHaveAttribute('data-letter', 't')

    // 3 chips total — 1 correct + 2 distractors
    const chips = screen.getAllByTestId('word-song-chip')
    expect(chips).toHaveLength(3)
    const words = chips.map((c) => c.getAttribute('data-word'))
    expect(words).toContain('cat') // correct
    expect(new Set(words).size).toBe(3) // all distinct

    // Streak indicator hidden until streak >= 2.
    expect(screen.queryByTestId('word-song-streak')).not.toBeInTheDocument()
  })

  it("uses Kyle's gentle-tier matrix pair for problem 1 (cat → [bus, sun])", () => {
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chips = screen.getAllByTestId('word-song-chip')
    const words = chips.map((c) => c.getAttribute('data-word'))
    expect(words).toEqual(expect.arrayContaining(['cat', 'bus', 'sun']))
  })

  it('happy path: tapping correct picture does NOT grant stardust per-tap (ticket 86c9kwvza), but increments streak and advances', async () => {
    // Ticket 86c9kwvza (locked 2026-05-02): word-song stardust moved to
    // completion-contingent. Per-correct grants were removed; the +5 flat
    // bonus lands at session-end inside SessionEnd's mount effect (see
    // `progressHistory.ts`-adjacent `grantWordSongCompletionBonus`). The
    // streak counter, sparkle SFX, plink SFX, celebration animation, and
    // HUD pop all remain — those are sensory rewards, not points-rewards.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const storage = makeMemoryStorage()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={storage}
        />,
      ),
    )

    const correctChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!
    expect(correctChip).toBeDefined()

    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // Stardust is unchanged after the chip-tap reward path runs. The
    // celebration utterance still fires; the streak counter still
    // advances; only the points grant was removed.
    expect(screen.getByTestId('word-song-stardust')).toHaveAttribute(
      'data-total',
      '0',
    )
    expect(harness.spoken()).toContain('Yes! Cat.')
    expect(screen.getByTestId('word-song')).toHaveAttribute('data-streak', '1')
    expect(screen.queryByTestId('word-song-streak')).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1200)
      await Promise.resolve()
    })

    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-problem-index',
      '1',
    )

    // Storage was not bumped during play — the unmount-write flushes the
    // current (unchanged) total. The +5 completion bonus is granted at
    // session-end, not here.
    const stored = storage.getItem(STARDUST_STORAGE_KEY)
    if (stored !== null) {
      expect(JSON.parse(stored).total).toBe(0)
    }
  })

  it('wrong-then-right: stardust still unchanged per-tap (ticket 86c9kwvza); streak does not advance', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chips = screen.getAllByTestId('word-song-chip')
    const correctChip = chips.find(
      (c) => c.getAttribute('data-word') === 'cat',
    )!
    const wrongChip = chips.find((c) => c.getAttribute('data-word') !== 'cat')!

    await act(async () => {
      fireEvent.click(wrongChip)
      await Promise.resolve()
    })

    expect(harness.spoken()).toContain('Hmm... try again?')

    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // Per ticket 86c9kwvza: word-song no longer grants stardust per-correct.
    // Streak break behaviour (resets to 0 after a wrong on this problem)
    // is unchanged.
    expect(screen.getByTestId('word-song-stardust')).toHaveAttribute(
      'data-total',
      '0',
    )
    expect(screen.getByTestId('word-song')).toHaveAttribute('data-streak', '0')
  })

  it('hint utterance fires after 2 wrong attempts on the same problem', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chips = screen.getAllByTestId('word-song-chip')
    const wrongChips = chips.filter(
      (c) => c.getAttribute('data-word') !== 'cat',
    )

    await act(async () => {
      fireEvent.click(wrongChips[0])
      await Promise.resolve()
    })
    await act(async () => {
      fireEvent.click(wrongChips[1] ?? wrongChips[0])
      await Promise.resolve()
    })

    // Hint timer (600ms beat) hasn't fired yet — fast-forward.
    await act(async () => {
      vi.advanceTimersByTime(700)
      await Promise.resolve()
    })

    // Per spec line 297: hint TTS = "Let's look. {Word}." — sound-out
    // happens via the per-letter phoneme audio (deferred to phoneme-pipeline
    // workstream), but the hint utterance itself fires now.
    expect(harness.spoken()).toContain("Let's look. Cat.")
  })

  it('streak threshold [3, 5, 8] no longer grants bonus stardust (ticket 86c9kwvza); streak still advances and pulses visually', async () => {
    // Per ticket 86c9kwvza: word-song stardust is completion-contingent,
    // not streak-contingent. The streak counter still increments and the
    // streak band still pulses at threshold values (sensory reward), but
    // the per-threshold +1 stardust grant was removed.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const plan = fixedPlan()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={plan}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const tapCorrect = async () => {
      const chips = screen.getAllByTestId('word-song-chip')
      const idx = Number(
        screen.getByTestId('word-song').getAttribute('data-problem-index'),
      )
      const correctWord = plan.problems[idx].target.word
      const correctChip = chips.find(
        (c) => c.getAttribute('data-word') === correctWord,
      )!
      await act(async () => {
        fireEvent.click(correctChip)
        await Promise.resolve()
      })
      await act(async () => {
        vi.advanceTimersByTime(1200)
        await Promise.resolve()
      })
    }

    await tapCorrect() // streak=1
    await tapCorrect() // streak=2
    await tapCorrect() // streak=3 — visual pulse, no stardust grant

    expect(screen.getByTestId('word-song-stardust')).toHaveAttribute(
      'data-total',
      '0',
    )
    expect(screen.getByTestId('word-song')).toHaveAttribute('data-streak', '3')
    expect(screen.getByTestId('word-song-streak')).toBeInTheDocument()
  })

  it('streak resets to 0 on a wrong tap that breaks an active streak', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const plan = fixedPlan()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={plan}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const tapCorrect = async () => {
      const chips = screen.getAllByTestId('word-song-chip')
      const idx = Number(
        screen.getByTestId('word-song').getAttribute('data-problem-index'),
      )
      const correctWord = plan.problems[idx].target.word
      const correctChip = chips.find(
        (c) => c.getAttribute('data-word') === correctWord,
      )!
      await act(async () => {
        fireEvent.click(correctChip)
        await Promise.resolve()
      })
      await act(async () => {
        vi.advanceTimersByTime(1200)
        await Promise.resolve()
      })
    }

    await tapCorrect()
    await tapCorrect()
    expect(screen.getByTestId('word-song')).toHaveAttribute('data-streak', '2')
    expect(screen.getByTestId('word-song-streak')).toBeInTheDocument()

    // Now tap wrong on problem 3.
    const chips = screen.getAllByTestId('word-song-chip')
    const idx = Number(
      screen.getByTestId('word-song').getAttribute('data-problem-index'),
    )
    const correctWord = plan.problems[idx].target.word
    const wrongChip = chips.find(
      (c) => c.getAttribute('data-word') !== correctWord,
    )!

    await act(async () => {
      fireEvent.click(wrongChip)
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(800)
      await Promise.resolve()
    })

    expect(screen.getByTestId('word-song')).toHaveAttribute('data-streak', '0')
  })

  it('after 3 wrong attempts, guided completion dims other chips and disables them', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const wrongChips = screen
      .getAllByTestId('word-song-chip')
      .filter((c) => c.getAttribute('data-word') !== 'cat')

    for (let i = 0; i < 3; i++) {
      const ch = wrongChips[i % wrongChips.length]
      await act(async () => {
        fireEvent.click(ch)
        await Promise.resolve()
      })
      await act(async () => {
        vi.advanceTimersByTime(800)
        await Promise.resolve()
      })
    }

    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-guided',
      'true',
    )

    const chipsAfter = screen.getAllByTestId('word-song-chip')
    for (const c of chipsAfter) {
      const isCorrect = c.getAttribute('data-word') === 'cat'
      if (isCorrect) {
        expect(c).not.toBeDisabled()
      } else {
        expect(c).toBeDisabled()
      }
    }

    expect(harness.spoken()).toContain('This one is cat.')
  })

  it('rage-tap: 5 rapid clicks on correct picture chip do NOT grant stardust (ticket 86c9kwvza) and produce a single auto-advance', async () => {
    // Strict single-grant on rapid tap, mirrors Math's PR #66 fix to
    // ticket 86c9gy4mf.
    //
    // Reproduces the worst-case 8-year-old gesture (frustrated smash on
    // the correct picture chip) and asserts the strict single-grant
    // behaviour:
    //   - exactly 1 stardust granted (data-total='1')
    //   - streak advances by exactly 1 (data-streak='1')
    //   - exactly one auto-advance scheduled (problem-index goes 0 → 1)
    //   - onSessionComplete is NOT called (we're 1/8 deep, not 8/8)
    //
    // Background: prior to the ref-guard, `problemState.resolved` was
    // held in React useState. Five synchronous fireEvent.click calls all
    // captured the same closure with resolved=false and each ran the full
    // reward path → 5 base stardust + streak bonuses at thresholds 3 and
    // 5 (= 2 extra) = 7 total. The fix moves the gate to a useRef
    // (`resolvedRef.current`) so the very next click in the same tick
    // sees the flipped value and bails. The visual `disabled` chip
    // styling still derives from React state; only the synchronous gate
    // uses the ref.
    //
    // In the real browser the chip is `disabled` once resolved — disabled
    // buttons swallow the second click natively. jsdom does not honour
    // that, so the bug surfaced here even though it might not reproduce
    // on iPad. The ref-guard protects both environments.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const onSessionComplete = vi.fn()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          onSessionComplete={onSessionComplete}
        />,
      ),
    )

    const correctChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!

    // 5 synchronous clicks — no awaits between them.
    await act(async () => {
      for (let i = 0; i < 5; i++) {
        fireEvent.click(correctChip)
      }
      await Promise.resolve()
    })

    // Per ticket 86c9kwvza: word-song no longer grants stardust per-tap,
    // so this counter stays at 0 regardless of how many times the chip is
    // tapped. The original ref-guard (ticket 86c9gy4mf) still protects the
    // streak / advance / onSessionComplete paths from compounding —
    // exercised below.
    expect(screen.getByTestId('word-song-stardust')).toHaveAttribute(
      'data-total',
      '0',
    )
    expect(screen.getByTestId('word-song')).toHaveAttribute('data-streak', '1')

    // onSessionComplete has NOT yet fired — auto-advance is scheduled but
    // the timer hasn't elapsed. This is problem 1 of 8; the session ends
    // only when the 8th problem's auto-advance lands.
    expect(onSessionComplete).not.toHaveBeenCalled()

    // Drain the auto-advance timer (1200ms). Exactly one advance should
    // fire — we land on problem index 1 (the second problem), not 2+.
    // The clearTimeout guard collapses repeated setTimeout calls into a
    // single pending advance, and the ref-guard ensures only the first
    // click ever schedules one.
    await act(async () => {
      vi.advanceTimersByTime(1200)
      await Promise.resolve()
    })

    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-problem-index',
      '1',
    )
    // Still no session-complete; we're 1/8 deep, not 8/8.
    expect(onSessionComplete).not.toHaveBeenCalled()
    // Stardust still 0 — word-song doesn't grant per-tap (ticket 86c9kwvza).
    expect(screen.getByTestId('word-song-stardust')).toHaveAttribute(
      'data-total',
      '0',
    )
  })

  it('rage-tap wrong chip: 5 rapid taps fire exactly 1 hint and 1 guided-completion', async () => {
    // Ticket 86c9gyb2v — peer-review follow-up to PR #69 (Word Song impl)
    // and the rage-tap fix in 86c9gy4mf. Same closure-stale class of bug as
    // `problemState.resolved`, but on the wrong-tap path:
    // `problemState.{wrongCount,hintPlayed,guidedPlayed}` were all read from
    // a captured closure inside `handleWrongTap`. 5 rapid wrong-taps in the
    // same React batch window all read pre-batch values:
    //   - each computed `nextWrongCount = 0 + 1 = 1` (stale wrongCount=0)
    //   - or all simultaneously crossed the hint/guided thresholds on a
    //     later batch when the closure refreshed
    //   - `!problemState.hintPlayed` / `!problemState.guidedPlayed` guards
    //     absorbed most damage but could still queue duplicate hint timers
    //     and duplicate guided dispatches.
    //
    // Direct mirror of Math 86c9gy7ju / PR #74. The Word Song-specific
    // wrinkle is a repromptInFlightRef lock that guards the .then() after
    // speak(reprompt) — if the problem advances while the reprompt is
    // in-flight, the stale .then() is a no-op instead of dispatching
    // hint/guided into the next problem.
    //
    // Each rapid tap DOES fire its own reprompt (5 taps → 5 reprompts).
    // Deduplication is at the hint/guided level via the ref-mirror gates,
    // not at the reprompt level. This test asserts:
    //   - reprompt fires once per tap (5 total);
    //   - hint fires EXACTLY once (ref gate deduplicates);
    //   - guided fires EXACTLY once (ref gate deduplicates);
    //   - guided-active state latches to true.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // Pick one specific wrong chip — Marian is rage-tapping the SAME chip
    // (worst-case 8-year-old gesture). Choose the first non-correct chip.
    const wrongChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') !== 'cat')!
    expect(wrongChip).toBeDefined()

    // 5 synchronous clicks on the same wrong chip — no awaits between them.
    // This is the closure-stale-window: every click runs in the same React
    // batch, so without the ref fix every click reads the pre-batch state.
    await act(async () => {
      for (let i = 0; i < 5; i++) {
        fireEvent.click(wrongChip)
      }
      await Promise.resolve()
    })

    // Drain the hint timer (600ms beat) AND the reprompt-then guided
    // dispatch microtasks. Advance plenty of time to let any duplicate
    // timers that the bug WOULD have queued elapse — if the gate is
    // working, only one of each fires regardless.
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    const spoken = harness.spoken()

    // Reprompt fires once per tap — that's correct behaviour, not a bug.
    // Each wrong tap reprompts, even rapid ones; the deduplication is at
    // the hint/guided level, not at the reprompt level.
    const repromptCount = spoken.filter((t) => t === 'Hmm... try again?').length
    expect(repromptCount).toBe(5)

    // The load-bearing assertions: hint and giveAnswer each fire EXACTLY
    // once. Pre-fix: with batched closures crossing the threshold together,
    // multiple hint timers / guided dispatches could queue, producing
    // counts >1.
    const hintCount = spoken.filter((t) => t === "Let's look. Cat.").length
    expect(hintCount).toBe(1)

    const giveAnswerCount = spoken.filter(
      (t) => t === 'This one is cat.',
    ).length
    expect(giveAnswerCount).toBe(1)

    // Guided state is active exactly once (the latching also drives the
    // visual chip-dim). data-guided is the live attribute.
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-guided',
      'true',
    )
  })

  it('single wrong-tap: no hint, no guided dispatch (regression guard)', async () => {
    // Ticket 86c9gyb2v AC: "No regression in single-tap wrong-handling".
    // After exactly ONE wrong tap, only the reprompt should have spoken;
    // the hint threshold is 2 and the guided threshold is 3, so neither
    // should fire. This guards against a refactor that accidentally moves
    // the gate from "==2" to ">=2" or similar.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const wrongChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') !== 'cat')!

    await act(async () => {
      fireEvent.click(wrongChip)
      await Promise.resolve()
    })

    // Generous timer drain — even the longest hint-beat path (600ms +
    // hint utterance + post-hint pose timer) would have elapsed by now.
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    const spoken = harness.spoken()

    // Reprompt fired exactly once.
    expect(spoken.filter((t) => t === 'Hmm... try again?').length).toBe(1)

    // Hint did NOT fire.
    expect(spoken.filter((t) => t === "Let's look. Cat.").length).toBe(0)

    // Guided dispatch did NOT fire.
    expect(spoken.filter((t) => t === 'This one is cat.').length).toBe(0)

    // Guided state is NOT active.
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-guided',
      'false',
    )
  })

  it('per-problem reset: rage-tap on problem 1 does not leak gates into problem 2', async () => {
    // Ticket 86c9gyb2v AC: "starting a fresh problem zeroes the ref AND
    // the state". The wrongCount/hintPlayed/guidedPlayed refs (and the
    // in-flight reprompt lock) must reset alongside
    // `setProblemState(FRESH_PROBLEM_STATE)` in `advanceToNext`, or else
    // problem 2 would inherit a latched `hintPlayedRef.current=true` and
    // never fire a hint of its own (and worse, problem 2's chip-tap gate
    // would still see `wrongCountRef.current=5` — meaning even the FIRST
    // wrong tap of problem 2 would already be past the guided threshold).
    //
    // This test rage-taps problem 1 to drive the gates fully latched
    // (hint + guided fired), advances past it, then verifies problem 2
    // behaves like a fresh problem: a single wrong tap fires no hint and
    // no guided dispatch.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const plan = fixedPlan()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={plan}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // Problem 1: rage-tap wrong chip 5x to fully latch all three gates.
    const p1WrongChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') !== 'cat')!
    await act(async () => {
      for (let i = 0; i < 5; i++) {
        fireEvent.click(p1WrongChip)
      }
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    // Tap the correct chip on problem 1 (guided-completion path makes it
    // the only enabled one). This advances to problem 2 after the 1200ms
    // auto-advance timer.
    const p1CorrectChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!
    await act(async () => {
      fireEvent.click(p1CorrectChip)
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(1200)
      await Promise.resolve()
    })

    // We're now on problem 2.
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-problem-index',
      '1',
    )
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-guided',
      'false',
    )

    // Snapshot the spoken-list count BEFORE the problem-2 wrong tap so we
    // can isolate problem 2's emissions from the problem-1 noise.
    const spokenBeforeP2Tap = [...harness.spoken()]

    // Problem 2: single wrong tap. This is the regression-guard payload —
    // if the refs leaked from problem 1, this single tap would already
    // see `wrongCountRef.current = 5` and dispatch hint + guided
    // immediately. Post-fix: refs are reset, so this is a fresh tap on a
    // fresh problem.
    const p2TargetWord = plan.problems[1].target.word
    const p2WrongChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') !== p2TargetWord)!
    await act(async () => {
      fireEvent.click(p2WrongChip)
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })

    const newlySpoken = harness.spoken().slice(spokenBeforeP2Tap.length)

    // Exactly the reprompt for problem 2's single wrong tap. Problem 2's
    // hint copy ("Let's look. Bag.") and giveAnswer copy ("This one is
    // bag.") MUST NOT have fired — those would only fire if the refs
    // leaked from problem 1.
    const p2WordCap = p2TargetWord[0].toUpperCase() + p2TargetWord.slice(1)
    expect(newlySpoken).toContain('Hmm... try again?')
    expect(newlySpoken).not.toContain(`Let's look. ${p2WordCap}.`)
    expect(newlySpoken).not.toContain(`This one is ${p2TargetWord}.`)
    // Guided remains inactive on problem 2.
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-guided',
      'false',
    )
  })

  it('completes the session on problem 8 and invokes onSessionComplete with surface=word-song', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    const plan = fixedPlan()
    const onSessionComplete = vi.fn()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={plan}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          onSessionComplete={onSessionComplete}
        />,
      ),
    )

    const tapCorrect = async () => {
      const chips = screen.getAllByTestId('word-song-chip')
      const idx = Number(
        screen.getByTestId('word-song').getAttribute('data-problem-index'),
      )
      const correctWord = plan.problems[idx].target.word
      const correctChip = chips.find(
        (c) => c.getAttribute('data-word') === correctWord,
      )!
      await act(async () => {
        fireEvent.click(correctChip)
        await Promise.resolve()
      })
      await act(async () => {
        vi.advanceTimersByTime(1200)
        await Promise.resolve()
      })
    }

    for (let i = 0; i < 8; i++) {
      await tapCorrect()
    }

    // Ticket 86c9kwvza: word-song no longer grants stardust per-correct
    // or per-streak-threshold. The +5 completion bonus is granted later,
    // inside SessionEnd's mount effect. The payload here therefore
    // reports `totalStardust = 0` (no in-session grants) and
    // `earnedThisSession = 0`. `totalCorrect` and `finalStreak` carry
    // the gameplay-state Marian actually produced.
    expect(onSessionComplete).toHaveBeenCalledTimes(1)
    const arg = onSessionComplete.mock.calls[0][0]
    expect(arg.totalCorrect).toBe(8)
    expect(arg.totalStardust).toBe(0)
    expect(arg.finalStreak).toBe(8)
    expect(arg.earnedThisSession).toBe(0)
    expect(arg.surface).toBe('word-song')
  })

  it("chips have an accessible label with the picture's word", () => {
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const chips = screen.getAllByTestId('word-song-chip')
    for (const c of chips) {
      const w = c.getAttribute('data-word')
      expect(c).toHaveAttribute('aria-label', `Picture of ${w}`)
    }
  })

  it('does not display any "X" or "wrong" copy on a wrong tap (anti-dark-pattern)', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const wrongChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') !== 'cat')!

    await act(async () => {
      fireEvent.click(wrongChip)
      await Promise.resolve()
    })

    const screenText = screen.getByTestId('word-song').textContent ?? ''
    expect(screenText.toLowerCase()).not.toContain('wrong')
    expect(screenText.toLowerCase()).not.toContain('incorrect')
  })

  it('letter taps pulse the letter visually, independent of attempt count', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // Streak shouldn't change, attempt-count effects shouldn't fire — letter
    // taps are pure exploration affordance per spec §"Letter-tap state".
    const initialStreak = screen
      .getByTestId('word-song')
      .getAttribute('data-streak')

    const letters = screen.getAllByTestId('word-song-letter')
    await act(async () => {
      fireEvent.click(letters[0])
      fireEvent.click(letters[1])
      fireEvent.click(letters[2])
      await Promise.resolve()
    })

    // Tapping letters did NOT advance the problem or break a streak.
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-problem-index',
      '0',
    )
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-streak',
      initialStreak ?? '0',
    )

    // Letter elements still tappable (exploration affordance).
    expect(letters[0]).not.toBeDisabled()
  })

  it('chip-tap kicks resumeAudioContext synchronously before audio (ticket 86c9gvd0y Phase 2)', async () => {
    const harness = makePlayHarness()
    const resumeSpy = vi.fn()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          resumeAudioContext={resumeSpy}
        />,
      ),
    )

    expect(resumeSpy).not.toHaveBeenCalled()

    const correctChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!

    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    expect(resumeSpy).toHaveBeenCalledTimes(1)
    const resumeOrder = resumeSpy.mock.invocationCallOrder[0]
    const playOrder = (
      harness.playUtterance as unknown as {
        mock: { invocationCallOrder: number[] }
      }
    ).mock.invocationCallOrder[0]
    expect(resumeOrder).toBeLessThan(playOrder)
  })

  it('chip-tap kicks unlockAudioSession synchronously before audio (ticket 86c9gvd0y Phase 5)', async () => {
    const harness = makePlayHarness()
    const unlockSpy = vi.fn()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          unlockAudioSession={unlockSpy}
        />,
      ),
    )

    expect(unlockSpy).not.toHaveBeenCalled()

    const correctChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!

    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    expect(unlockSpy).toHaveBeenCalledTimes(1)
    const unlockOrder = unlockSpy.mock.invocationCallOrder[0]
    const playOrder = (
      harness.playUtterance as unknown as {
        mock: { invocationCallOrder: number[] }
      }
    ).mock.invocationCallOrder[0]
    expect(unlockOrder).toBeLessThan(playOrder)
  })

  it('stardust persists with the SHARED Math/Word Song key (cross-screen accumulation)', async () => {
    // Per spec §"Stardust treatment" → "Cross-screen accumulation": same
    // key as Math (`marian-tutor.stardust.v1`), same schema. A Math
    // session that ended with N stardust should be visible on Word Song
    // mount.
    const storage = makeMemoryStorage()
    // Pre-seed storage as if Math had run first.
    storage.setItem(
      STARDUST_STORAGE_KEY,
      JSON.stringify({
        total: 5,
        lastUpdatedAt: new Date(0).toISOString(),
        schemaVersion: 1,
      }),
    )

    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={storage}
        />,
      ),
    )

    // Word Song mounts and reads the existing total — counter shows 5.
    expect(screen.getByTestId('word-song-stardust')).toHaveAttribute(
      'data-total',
      '5',
    )
  })

  // ── Celebration UX bug fix: SFX call site + visible animation markers ──
  //
  // Background: Thomas's iPad test pass reported the correct-tap celebration
  // was "practically not visible" and there was no reward sound. Causes:
  //  - HUD pop was 250ms — too brief next to the 1200ms auto-advance
  //  - Sparkle burst was a spring with ~600ms tail — undershot the 800ms target
  //  - Emma pose-swap was a 200ms cross-fade — no perceptible "wiggle"
  // Tests below verify the fix without coupling to the exact frame-by-frame
  // timing values (those live as named constants and can be tweaked).

  it('reward SFX (sparkle + plink) fire on correct tap', async () => {
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // Three SFX instances are created at mount: sparkle, poof, plink.
    // Order matches the createSfx call order in WordSong.tsx.
    expect(sfxState.createCount).toBe(3)
    const [sparkle, poof, plink] = sfxState.instances
    expect(sparkle.play).not.toHaveBeenCalled()
    expect(plink.play).not.toHaveBeenCalled()

    const correctChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!

    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // Reward SFX both fired exactly once. Poof (wrong-tap SFX) did NOT fire.
    expect(sparkle.play).toHaveBeenCalledTimes(1)
    expect(plink.play).toHaveBeenCalledTimes(1)
    expect(poof.play).not.toHaveBeenCalled()
  })

  it('reward SFX is wired to the sfx-sparkle.mp3 asset path', async () => {
    // Documents the asset contract: the sparkle SFX MUST be sourced from
    // /assets/sfx-sparkle.mp3 (per Math symmetry + assets-todo.md). If the
    // file path drifts, the test catches it before iPad QA does.
    const { createSfx } = (await import('../../lib/sfx')) as unknown as {
      createSfx: ReturnType<typeof vi.fn>
    }
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={makePlayHarness().playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // Three calls — sparkle, poof, plink — and the sparkle one points at
    // /assets/sfx-sparkle.mp3.
    const calls = createSfx.mock.calls.map((c) => c[0])
    const sparkleCall = calls.find((c) => c.src === '/assets/sfx-sparkle.mp3')
    expect(sparkleCall).toBeDefined()
    expect(sparkleCall.volume).toBeGreaterThan(0)
  })

  it('Emma celebration wiggle is suppressed under prefers-reduced-motion', async () => {
    const matchMediaSpy = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }))

    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const correctChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!

    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // AnimatePresence keeps the exiting (idle) and entering
    // (celebration) <m.img> in the DOM concurrently during the
    // cross-fade. Pick the celebration one explicitly — under
    // reduced-motion its wiggle marker is false even though the pose
    // still flipped.
    const emmas = screen.getAllByTestId('word-song-emma')
    const emmaCelebration = emmas.find(
      (el) => el.getAttribute('data-pose') === 'celebration',
    )
    expect(emmaCelebration).toBeDefined()
    expect(emmaCelebration).toHaveAttribute('data-wiggling', 'false')

    matchMediaSpy.mockRestore()
  })

  it('Emma plays a celebration wiggle on correct tap (data-wiggling=true)', async () => {
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // Idle state: only one Emma node, with no wiggle.
    const emmaIdle = screen.getByTestId('word-song-emma')
    expect(emmaIdle).toHaveAttribute('data-pose', 'idle')
    expect(emmaIdle).toHaveAttribute('data-wiggling', 'false')

    const correctChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!

    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // After correct tap, AnimatePresence keeps both the exiting (idle)
    // and the entering (celebration) <m.img> in the tree during the
    // cross-fade. Find the celebration one — it carries the wiggle marker.
    const emmas = screen.getAllByTestId('word-song-emma')
    const emmaCelebration = emmas.find(
      (el) => el.getAttribute('data-pose') === 'celebration',
    )
    expect(emmaCelebration).toBeDefined()
    expect(emmaCelebration).toHaveAttribute('data-wiggling', 'true')
  })

  it('renders the picture chip SVG with the correct picture-key data attribute', () => {
    const harness = makePlayHarness()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // Each chip should carry a picture-key matching its target word.
    const chips = screen.getAllByTestId('word-song-chip')
    for (const chip of chips) {
      const word = chip.getAttribute('data-word')
      const pictureKey = chip.getAttribute('data-picture-key')
      // pictureKey defaults to word for the placeholder pack — when real
      // assets land, this assertion still holds (file naming is
      // `picture-{word}.svg`).
      expect(pictureKey).toBe(word)
      // The inner picture SVG renders with the same key.
      const innerPicture = within(chip).getByTestId('word-picture')
      expect(innerPicture).toHaveAttribute('data-picture-key', word)
    }
  })

  /*
   * ╔══════════════════════════════════════════════════════════════════════╗
   * ║ COLD-MOUNT REAL-FLOW REGRESSION TEST — ticket 86c9hf4ef              ║
   * ║                                                                      ║
   * ║ Mirrors the Math.test.tsx cold-mount real-flow test. Same root       ║
   * ║ cause (Splash → Greet → screen handoff leaves Howler ctx running     ║
   * ║ but local audioUnlocked false → chips stay disabled forever),        ║
   * ║ same fix shape (read-aloud effect accepts Howler-running as a        ║
   * ║ second authorisation alongside audioUnlocked).                       ║
   * ║                                                                      ║
   * ║ See Math.test.tsx for the longer-form rationale and Thomas's iPad    ║
   * ║ empirical evidence.                                                  ║
   * ╚══════════════════════════════════════════════════════════════════════╝
   */
  it('cold-mount real-flow: when Howler ctx is already running, read-aloud fires and chips become enabled (ticket 86c9hf4ef)', async () => {
    const harness = makePlayHarness()
    const getHowlerRunning = vi.fn(() => true)

    render(
      withMotion(
        <WordSong
          // NOTE: __testInitiallyAudioUnlocked deliberately NOT passed.
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-read-aloud-played',
      'false',
    )

    // Drain the full microtask queue rather than counting ticks; see
    // Math.test.tsx cold-mount real-flow test for the rationale
    // (ticket 86c9hf4ef).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    // First problem in fixedPlan() targets the word "cat". Exact-match
    // equality (single-element array) so a double-speak regression fails
    // the test loudly. See Math.test.tsx for the full rationale and
    // ticket 86c9hf4ef.
    expect(harness.spoken()).toEqual(['Tap the cat.'])
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-read-aloud-played',
      'true',
    )

    const chips = screen.getAllByTestId('word-song-chip')
    expect(chips).toHaveLength(3)
    for (const chip of chips) {
      expect(chip).not.toBeDisabled()
    }

    expect(getHowlerRunning).toHaveBeenCalled()
  })

  it('cold-mount: when Howler ctx is NOT running, read-aloud does NOT fire on mount (ticket 86c9hf4ef)', async () => {
    // Negative-path mirror of the Math test — see Math.test.tsx for the
    // belt-and-suspenders rationale.
    const harness = makePlayHarness()
    const getHowlerRunning = vi.fn(() => false)

    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(harness.spoken()).toHaveLength(0)
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-read-aloud-played',
      'false',
    )
    const chips = screen.getAllByTestId('word-song-chip')
    for (const chip of chips) {
      expect(chip).toBeDisabled()
    }
  })

  /*
   * Production silent-fail regression — ticket 86c9hf4ef round 2.
   *
   * Mirrors the Math.test.tsx test of the same name. When `playUtterance`
   * resolves AFTER React has committed the cold-mount audioUnlocked flip
   * (production-real timing — Howler's 'end' event fires seconds after
   * play()), chips MUST still unlock. The previous closure-cancelled
   * flag bailed the .then() in this case and bricked the screen on real
   * iPad (Thomas's 2026-04-27 PR #88 deploy capture). See
   * Math.test.tsx for the full rationale.
   */
  it('cold-mount real-flow: chips unlock even when speak() resolves AFTER the audioUnlocked flip causes the effect to re-run (ticket 86c9hf4ef round 2)', async () => {
    const harness = makePlayHarness({ autoResolve: false })
    const getHowlerRunning = vi.fn(() => true)

    render(
      withMotion(
        <WordSong
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

    // Read-aloud was kicked off (proves we entered the fast path).
    expect(harness.spoken()).toEqual(['Tap the cat.'])
    // But chips stay disabled until speak() resolves.
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-read-aloud-played',
      'false',
    )

    // Resolve speak() — corresponds to Howler 'end' firing in production.
    // Pre-fix: cleanup-set cancelled=true bails the .then(), chips never
    // unlock. Post-fix: .then() bails only on unmount or problem-advance,
    // so setReadAloudPlayed(true) fires.
    await act(async () => {
      harness.resolveAll()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-read-aloud-played',
      'true',
    )
    const chips = screen.getAllByTestId('word-song-chip')
    expect(chips).toHaveLength(3)
    for (const chip of chips) {
      expect(chip).not.toBeDisabled()
    }
    // Sanity: only spoke once (spokeReadAloudRef latch held).
    expect(harness.spoken()).toEqual(['Tap the cat.'])
  })

  /*
   * First-problem audio-race regression — ticket 86c9hjnn8.
   *
   * Mirrors the Math.test.tsx test of the same name. The cold-mount fast
   * path must NOT speak while the parent's Path A fetch is still in
   * flight (`audioReady={false}`). When the prop flips to `true` the read-
   * aloud fires against the REAL playUtterance — not the silent default
   * the parent passed pre-fetch. See Math.test.tsx for the long-form
   * rationale.
   */
  it('audioReady gate: when false on mount, read-aloud waits; when flipped to true the bound playUtterance is used (ticket 86c9hjnn8)', async () => {
    const silentHarness = makePlayHarness()
    const realHarness = makePlayHarness()
    const getHowlerRunning = vi.fn(() => true)

    const { rerender } = render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={silentHarness.playUtterance}
          audioReady={false}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(silentHarness.spoken()).toEqual([])
    expect(realHarness.spoken()).toEqual([])
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-read-aloud-played',
      'false',
    )

    rerender(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={realHarness.playUtterance}
          audioReady={true}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(silentHarness.spoken()).toEqual([])
    expect(realHarness.spoken()).toEqual(['Tap the cat.'])
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-read-aloud-played',
      'true',
    )
    const chips = screen.getAllByTestId('word-song-chip')
    for (const chip of chips) {
      expect(chip).not.toBeDisabled()
    }
  })

  /*
   * Ticket 86c9j60qr — celebration audio cutoff. WordSong mirrors Math's
   * advance-on-correct path; same fix shape; same regression risk. See
   * Math.test.tsx for the long-form rationale.
   */
  it('correct-tap auto-advance waits for the celebration audio to finish (ticket 86c9j60qr)', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness({ autoResolve: false })

    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    const correctChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!
    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    expect(harness.spoken()).toContain('Yes! Cat.')
    const spokenAfterTap = [...harness.spoken()]

    // Min-dwell timer fires; pre-fix this would also fire the next read.
    await act(async () => {
      vi.advanceTimersByTime(1200)
      await Promise.resolve()
    })

    // Still on problem 0 — celebration speak() still pending. The spoken
    // list MUST NOT have grown (no problem-2 read-aloud dispatched).
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-problem-index',
      '0',
    )
    expect(harness.spoken()).toEqual(spokenAfterTap)
    expect(harness.spoken()).not.toContain('Tap the bag.')

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })
    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-problem-index',
      '0',
    )

    // Resolve speak() — advance fires.
    await act(async () => {
      harness.resolveAll()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-problem-index',
      '1',
    )
  })

  it('correct-tap advance fires at hard ceiling even if speak() never resolves (ticket 86c9j60qr)', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const harness = makePlayHarness({ autoResolve: false })

    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    await act(async () => {
      await Promise.resolve()
    })

    const correctChip = screen
      .getAllByTestId('word-song-chip')
      .find((c) => c.getAttribute('data-word') === 'cat')!
    await act(async () => {
      fireEvent.click(correctChip)
      await Promise.resolve()
    })

    // No resolveAll() — advance must fire on the hard-ceiling timer.
    await act(async () => {
      vi.advanceTimersByTime(4000)
      await Promise.resolve()
    })

    expect(screen.getByTestId('word-song')).toHaveAttribute(
      'data-problem-index',
      '1',
    )
  })

  /*
   * Cold-mount swap-jolt regression — ticket 86c9kxb5q. Mirrors the Math
   * test of the same name. The render gate hides the word card + chips
   * while `audioReady === false`, so the static-fallback Q1's picture and
   * letters never paint long enough to swap to the canon-derived plan.
   * See Math.test.tsx for the long-form rationale.
   */
  it('render gate: audioReady=false hides the word card + chips; HUD + Emma stay (ticket 86c9kxb5q)', () => {
    const harness = makePlayHarness()

    render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          audioReady={false}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    // HUD + Emma stay mounted.
    expect(screen.getByTestId('word-song')).toBeInTheDocument()
    expect(screen.getByTestId('word-song-hud')).toBeInTheDocument()
    expect(screen.getByTestId('word-song-emma')).toBeInTheDocument()

    // Problem area absent.
    expect(screen.queryByTestId('word-song-word-card')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('word-song-word-picture'),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('word-song-letters')).not.toBeInTheDocument()
    expect(screen.queryByTestId('word-song-chips')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('word-song-chip')).toHaveLength(0)
  })

  it('render gate: audioReady=true renders the word card + chips (ticket 86c9kxb5q)', () => {
    const harness = makePlayHarness()

    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={fixedPlan()}
          playUtterance={harness.playUtterance}
          audioReady={true}
          storage={makeMemoryStorage()}
        />,
      ),
    )

    expect(screen.getByTestId('word-song-word-card')).toBeInTheDocument()
    expect(screen.getByTestId('word-song-word-picture')).toBeInTheDocument()
    expect(screen.getByTestId('word-song-letters')).toBeInTheDocument()
    expect(screen.getByTestId('word-song-chips')).toBeInTheDocument()
    expect(screen.getAllByTestId('word-song-chip')).toHaveLength(3)
    expect(screen.getByTestId('word-song-word-card')).toHaveAttribute(
      'data-word',
      'cat',
    )
  })

  it('render gate: flipping audioReady false → true makes the word card appear (ticket 86c9kxb5q)', async () => {
    const silentHarness = makePlayHarness()
    const realHarness = makePlayHarness()
    const getHowlerRunning = vi.fn(() => true)

    const { rerender } = render(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={silentHarness.playUtterance}
          audioReady={false}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    // Pre-flip: word card absent.
    expect(screen.queryByTestId('word-song-word-card')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('word-song-chip')).toHaveLength(0)

    rerender(
      withMotion(
        <WordSong
          plan={fixedPlan()}
          playUtterance={realHarness.playUtterance}
          audioReady={true}
          storage={makeMemoryStorage()}
          getHowlerRunning={getHowlerRunning}
        />,
      ),
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    // Post-flip: word card renders against the real plan.
    expect(screen.getByTestId('word-song-word-card')).toBeInTheDocument()
    expect(screen.getAllByTestId('word-song-chip')).toHaveLength(3)
    expect(screen.getByTestId('word-song-word-card')).toHaveAttribute(
      'data-word',
      'cat',
    )

    // Audio fired against the real player on the same flip.
    expect(silentHarness.spoken()).toEqual([])
    expect(realHarness.spoken()).toEqual(['Tap the cat.'])
  })

  // ── Mid-skill back-arrow (#86c9j53ra) ──────────────────────────────────

  describe('mid-skill back-arrow (Hub navigation contract)', () => {
    it('does NOT render the back-arrow when no `onRequestExit` is provided (legacy direct-route)', () => {
      const harness = makePlayHarness()
      render(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
          />,
        ),
      )
      expect(screen.queryByTestId('word-song-back-to-hub')).toBeNull()
    })

    it('renders the back-arrow with aria-label="Back" and a 56pt touch zone when `onRequestExit` is provided', () => {
      const harness = makePlayHarness()
      const onRequestExit = vi.fn()
      render(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
            onRequestExit={onRequestExit}
          />,
        ),
      )
      const back = screen.getByTestId('word-song-back-to-hub')
      expect(back).toBeInTheDocument()
      expect(back.getAttribute('aria-label')).toBe('Back')
      // 56pt touch zone per design/screen-hub.md § "Mid-skill exit
      // contract" — same ergonomics as Math + the parent gate.
      expect(back.getAttribute('style')).toMatch(/56pt/)
    })

    it('fires `onRequestExit` exactly once on tap', () => {
      const harness = makePlayHarness()
      const onRequestExit = vi.fn()
      render(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
            onRequestExit={onRequestExit}
          />,
        ),
      )
      const back = screen.getByTestId('word-song-back-to-hub')
      back.click()
      expect(onRequestExit).toHaveBeenCalledTimes(1)
    })
  })

  // ── Silent-text window for cvc-word problems (ticket 86c9m3ae6) ─────────

  describe('silent-text window on cvc-word problems', () => {
    /*
     * NOTE on harness setup: the read-aloud effect short-circuits when
     * `spokeReadAloudRef` is already true, and `__testInitiallyAudioUnlocked`
     * pre-arms that ref. So these tests use the cold-mount real-flow path
     * (`getHowlerRunning={() => true}`, NO `__testInitiallyAudioUnlocked`)
     * to actually exercise the read-aloud effect end-to-end. Mirrors the
     * cold-mount tests further up the file.
     */

    /**
     * AC #1: cvc-word problems must NOT fire `playUtterance(read)`
     * synchronously on mount. The text renders immediately so Marian can
     * decode it; the read-aloud is deferred by 1500ms.
     *
     * This test FAILS without the fix — pre-fix the read fires on the
     * mount microtask, so `harness.spoken()` is `['Read the cat.']`
     * immediately after the microtask drain (long before any fake-timer
     * advance).
     */
    it('cvc-word: defers read-aloud by ≥1500ms after mount; word text is on screen the whole time', async () => {
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
      })
      const harness = makePlayHarness()
      const getHowlerRunning = vi.fn(() => true)
      render(
        withMotion(
          <WordSong
            plan={cvcWordPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
            getHowlerRunning={getHowlerRunning}
          />,
        ),
      )

      // Word text is on screen from first paint — the silent window only
      // delays AUDIO, not the visual reveal.
      expect(screen.getByTestId('word-song-word-card')).toHaveAttribute(
        'data-word',
        'cat',
      )

      // Drain pending microtasks. Pre-fix the read-aloud microtask would
      // run here and `harness.spoken()` would already contain
      // `'Read the cat.'`. Post-fix it must still be empty.
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(harness.spoken()).toEqual([])

      // Step to just BEFORE the 1500ms boundary — still silent.
      await act(async () => {
        vi.advanceTimersByTime(1499)
        await Promise.resolve()
      })
      expect(harness.spoken()).toEqual([])

      // Cross the boundary — read fires exactly once.
      await act(async () => {
        vi.advanceTimersByTime(1)
        await Promise.resolve()
      })
      expect(harness.spoken()).toEqual(['Read the cat.'])
    })

    /**
     * AC #4: blending-cv problems are UNAFFECTED. The "Tap the X." flow
     * must continue to fire audio immediately on mount — that flow is
     * recognise-by-name and doesn't benefit from a decode beat.
     *
     * Negative test: regression guard on the immediate-fire path.
     */
    it('blending-cv: read-aloud fires immediately on mount (no silent window)', async () => {
      const harness = makePlayHarness()
      const getHowlerRunning = vi.fn(() => true)
      render(
        withMotion(
          <WordSong
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
            getHowlerRunning={getHowlerRunning}
          />,
        ),
      )

      // No fake-timer advance — only microtask drain. The blending-cv
      // path schedules the read on the same mount microtask as the
      // legacy immediate-fire flow. `setTimeout(0)` flushes both.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      expect(harness.spoken()).toEqual(['Tap the cat.'])
    })

    /**
     * AC #5: visibility-pause integration. If Marian backgrounds the
     * iPad mid-window, the read must NOT fire while the page is hidden.
     * When she un-hides, the read fires exactly once (no double-fire).
     *
     * Implementation: when the silent-text setTimeout fires, we check
     * `document.hidden`; if true, we attach a one-shot
     * `visibilitychange` listener that re-fires the same dispatch path
     * when the page becomes visible.
     */
    it('cvc-word: visibility-hidden mid-window defers read; un-hide fires read exactly once', async () => {
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
      })
      const harness = makePlayHarness()
      const getHowlerRunning = vi.fn(() => true)

      // Simulate the iPad backgrounding mid-window: stub document.hidden.
      const hiddenDescriptor = Object.getOwnPropertyDescriptor(
        Document.prototype,
        'hidden',
      )
      let hiddenValue = false
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => hiddenValue,
      })

      try {
        render(
          withMotion(
            <WordSong
              plan={cvcWordPlan()}
              playUtterance={harness.playUtterance}
              storage={makeMemoryStorage()}
              getHowlerRunning={getHowlerRunning}
            />,
          ),
        )

        // Drain initial microtasks (read-aloud effect schedules its
        // setTimeout here).
        await act(async () => {
          await Promise.resolve()
        })

        // Background the page mid-window (before the 1500ms timer fires).
        hiddenValue = true
        await act(async () => {
          document.dispatchEvent(new Event('visibilitychange'))
          await Promise.resolve()
        })

        // Cross the silent-window boundary — read MUST stay silent
        // because document.hidden is true. 1500ms matches the constant
        // in WordSong.tsx; if production retunes, update both.
        await act(async () => {
          vi.advanceTimersByTime(1500)
          await Promise.resolve()
        })
        expect(harness.spoken()).toEqual([])

        // Stay hidden for a long time — still silent (proves no orphan
        // setTimeout is going to fire late).
        await act(async () => {
          vi.advanceTimersByTime(5000)
          await Promise.resolve()
        })
        expect(harness.spoken()).toEqual([])

        // Foreground — the listener should re-arm and fire the read once.
        hiddenValue = false
        await act(async () => {
          document.dispatchEvent(new Event('visibilitychange'))
          await Promise.resolve()
        })
        expect(harness.spoken()).toEqual(['Read the cat.'])

        // Bouncing visibility again must not double-fire (latch holds).
        hiddenValue = true
        await act(async () => {
          document.dispatchEvent(new Event('visibilitychange'))
          await Promise.resolve()
        })
        hiddenValue = false
        await act(async () => {
          document.dispatchEvent(new Event('visibilitychange'))
          await Promise.resolve()
        })
        expect(harness.spoken()).toEqual(['Read the cat.'])
      } finally {
        if (hiddenDescriptor) {
          Object.defineProperty(Document.prototype, 'hidden', hiddenDescriptor)
        } else {
          // jsdom default: re-delete the override.
          delete (document as unknown as { hidden?: boolean }).hidden
        }
      }
    })
  })

  // ── Sight-words recognition mechanic (Wave 11 W11-03, 86ca7xmvz) ────────

  describe('sight-words content type (audio-first written-word matching)', () => {
    /**
     * Mechanic assertion A — NO picture card for sight words. The
     * CVC/blending-cv tiers always render `word-song-word-picture` (the
     * 180pt meaning-anchor); sight words have no picturable referent
     * (Dave W11-01 §"Recognition mechanic" point 1) so the card must be
     * absent. This mirrors Jessica's W11-04 test 3 assertion A. The
     * letters-of-the-word decode breakdown (`word-song-letters`) is also
     * absent — sight words are recognised whole, not decoded.
     */
    it('renders NO picture card and NO letter breakdown (whole-word recognition)', () => {
      render(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={sightWordPlan()}
            playUtterance={makePlayHarness().playUtterance}
            audioReady={true}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      expect(
        screen.queryByTestId('word-song-word-picture'),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('word-song-word-card'),
      ).not.toBeInTheDocument()
      expect(screen.queryByTestId('word-song-letters')).not.toBeInTheDocument()
    })

    /**
     * Mechanic assertion B — each chip presents the WRITTEN word as
     * visible text (no `<WordPicture>` SVG). Each chip's text content
     * contains its `data-word`. Mirrors Jessica's W11-04 test 3
     * assertion B (chip innerText contains data-word).
     */
    it('renders 3 written-word text chips; each chip text contains its data-word', () => {
      render(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={sightWordPlan()}
            playUtterance={makePlayHarness().playUtterance}
            audioReady={true}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      const chips = screen.getAllByTestId('word-song-chip')
      expect(chips).toHaveLength(3)

      // No picture SVG in any chip; a written-word glyph in each.
      expect(screen.queryAllByTestId('word-picture')).toHaveLength(0)
      expect(screen.getAllByTestId('word-song-chip-sight-word')).toHaveLength(3)

      for (const chip of chips) {
        const word = chip.getAttribute('data-word')
        expect(word).not.toBeNull()
        // The written word is the chip's visible text content.
        expect((chip.textContent ?? '').trim().toLowerCase()).toContain(
          (word as string).toLowerCase(),
        )
      }
    })

    /**
     * Exactly one chip is the correct (target) chip, and its word is the
     * problem's target — a sight-words-pool word. Mirrors Jessica's
     * W11-04 test 3 correct-chip assertion.
     */
    it('marks exactly one chip data-correct=true and it carries the target sight word', () => {
      render(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={sightWordPlan()}
            playUtterance={makePlayHarness().playUtterance}
            audioReady={true}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      const correctChips = screen
        .getAllByTestId('word-song-chip')
        .filter((c) => c.getAttribute('data-correct') === 'true')
      expect(correctChips).toHaveLength(1)
      // Problem 1 target is 'the' per sightWordPlan().
      expect(correctChips[0].getAttribute('data-word')).toBe('the')
    })

    /**
     * No decoding beat for sight words — the read-aloud fires immediately
     * on mount (NOT after the 1500ms silent window). A "sound it out" beat
     * is wrong for whole-word recognition: GPC on "was" yields the
     * non-word /wæs/ (Dave W11-01 §"Recognition mechanic" point 2). This
     * guards against a future widening of the `isCvcWord` gate to include
     * `sight-word`. Companion to the `blending-cv` immediate-fire test
     * above — same no-fake-timer microtask-drain shape.
     */
    it('fires read-aloud immediately on mount (no silent decoding beat)', async () => {
      const harness = makePlayHarness()
      const getHowlerRunning = vi.fn(() => true)
      render(
        withMotion(
          <WordSong
            plan={sightWordPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
            getHowlerRunning={getHowlerRunning}
          />,
        ),
      )

      // No fake-timer advance — only a microtask drain. If sight-word were
      // (wrongly) gated into the silent window this would still be empty
      // here and only fire after a 1500ms advance.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      expect(harness.spoken()).toEqual(['Find the word: the.'])
    })

    /**
     * "Never a red X" preserved — a wrong tap swaps Emma to the
     * puzzled-tilt pose and the wrong chip stays tappable (no disable, no
     * error chime, no red X). Same invariant the CVC tiers hold; sight
     * words inherit it through the shared chip-frame code path.
     */
    it('never a red X — wrong tap leaves chips tappable and shows puzzled-tilt', () => {
      render(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={sightWordPlan()}
            playUtterance={makePlayHarness().playUtterance}
            audioReady={true}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      const wrongChip = screen
        .getAllByTestId('word-song-chip')
        .find((c) => c.getAttribute('data-correct') === 'false')
      expect(wrongChip).toBeDefined()

      act(() => {
        fireEvent.click(wrongChip!)
      })

      // Emma reacts in character — puzzled-tilt, not a red X. During the
      // AnimatePresence pose swap the exiting idle Emma can still be in the
      // DOM alongside the entering puzzled-tilt one, so assert the new pose
      // is PRESENT among the rendered Emmas rather than expecting a single
      // element.
      const poses = screen
        .getAllByTestId('word-song-emma')
        .map((el) => el.getAttribute('data-pose'))
      expect(poses).toContain('puzzled-tilt')
      // The wrong chip is still tappable (retry stays open).
      expect(wrongChip!).not.toBeDisabled()
    })
  })

  // ── Plan re-derivation on prop flip (ticket 86c9jteud) ─────────────────

  describe('plan re-derivation on `plan` prop flip', () => {
    /**
     * Regression for ticket 86c9jteud. App.tsx mounts Word Song with the
     * static fallback plan, kicks `prepareWordSongPathA()`, and once that
     * resolves swaps the `plan` prop to the server-derived plan. The
     * screen must pick up the new plan reference; otherwise
     * `playUtterance(text)` lookups miss the server-rendered audio (the
     * textToId map is keyed on Haiku-rendered text), giving silent
     * (caption-only) sessions on iPad.
     *
     * The bug shape: `useMemo<WordSongSessionPlan>(() => planProp ?? ...,
     * [])` captures the prop value at mount and ignores subsequent
     * changes. Fix: include `planProp` in the deps array.
     *
     * This test FAILS on the buggy `[]` deps (problem 1's word stays at
     * "cat" after the prop flip) and PASSES on the `[planProp]` fix
     * (problem 1's word becomes "bag" after the flip).
     */
    function secondPlan(): WordSongSessionPlan {
      // Reuse fixedPlan()'s tail so the diff is concentrated on
      // problem 1 — the flip is observable via the word card's
      // `data-word` attribute.
      const base = fixedPlan()
      const bagEntry = getWordEntry('bag')
      return {
        id: 'server-plan',
        label: 'Server plan',
        problems: [
          {
            index: 1,
            target: bagEntry,
            utterances: {
              read: 'Tap the bag.',
              correct: 'Yes! Bag.',
              reprompt: 'Hmm... try again?',
              hint: "Let's look. Bag.",
              giveAnswer: 'This one is bag.',
            },
          },
          ...base.problems.slice(1),
        ],
      }
    }

    it('re-derives the displayed plan when `plan` flips from fallback to server-derived without remount', () => {
      const harness = makePlayHarness()
      const { rerender } = render(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={fixedPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      // Pre-flip — the static fallback's problem 1 word is "cat".
      expect(screen.getByTestId('word-song-word-card')).toHaveAttribute(
        'data-word',
        'cat',
      )

      // Flip the prop in place — same component instance, no key change,
      // no remount. Mirrors what App.tsx does when
      // `prepareWordSongPathA()` settles after Word Song has already
      // mounted.
      rerender(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={secondPlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      // Post-flip — server plan's problem 1 word is "bag". If the screen
      // ignored the prop change (the buggy `useMemo([], [])` shape), it
      // would still show "cat".
      expect(screen.getByTestId('word-song-word-card')).toHaveAttribute(
        'data-word',
        'bag',
      )
    })

    it('keeps `plan` referentially stable across re-renders with the same prop reference', () => {
      // Sibling invariant: when `planProp` doesn't change, the memoized
      // `plan` value MUST stay referentially stable. Several downstream
      // `useMemo`/effect deps key on `plan`; thrashing the identity on
      // every render would re-roll chip order + re-fire effects.
      const planRef = fixedPlan()
      const harness = makePlayHarness()
      const { rerender } = render(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={planRef}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      const before = screen
        .getAllByTestId('word-song-chip')
        .map((c) => c.getAttribute('data-word'))

      rerender(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={planRef}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      const after = screen
        .getAllByTestId('word-song-chip')
        .map((c) => c.getAttribute('data-word'))

      expect(after).toEqual(before)
    })
  })

  describe('simple-sentences content type (sentence-completion cloze)', () => {
    /**
     * Mechanic assertion A — NO picture card for simple sentences. The
     * reading surface is the SENTENCE PANEL, not a single-word picture
     * card. Mirrors Jessica's W13-05 test 3 assertion A
     * (`word-song-word-picture` count = 0).
     */
    it('renders NO picture card and NO letter breakdown (cloze reading surface)', () => {
      render(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={simpleSentencePlan()}
            playUtterance={makePlayHarness().playUtterance}
            audioReady={true}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      expect(
        screen.queryByTestId('word-song-word-picture'),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('word-song-word-card'),
      ).not.toBeInTheDocument()
      expect(screen.queryByTestId('word-song-letters')).not.toBeInTheDocument()
    })

    /**
     * Mechanic assertion B — the net-new sentence panel is present with a
     * styled blank gap. Mirrors Jessica's W13-05 test 3 panel assertions
     * (`word-song-sentence-panel` count = 1, `word-song-sentence-gap`
     * count = 1, `data-gap-filled="false"` before the correct tap).
     */
    it('renders the sentence panel with exactly one styled gap (unfilled before correct)', () => {
      render(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={simpleSentencePlan()}
            playUtterance={makePlayHarness().playUtterance}
            audioReady={true}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      expect(screen.getAllByTestId('word-song-sentence-panel')).toHaveLength(1)
      const gaps = screen.getAllByTestId('word-song-sentence-gap')
      expect(gaps).toHaveLength(1)
      expect(gaps[0].getAttribute('data-gap-filled')).toBe('false')
    })

    /**
     * Regression — the gap token may carry ATTACHED punctuation when it
     * sits at a clause edge ("The dog ___." → token "___."). A naive
     * `token === '___'` equality misses that and renders the literal
     * "___." as plain text with no styled gap (Jessica's W13-05 test 3
     * caught this). The render must detect the "___" substring and peel
     * the punctuation. This plan's problem 2 is "The dog ___." — exactly
     * the attached-period shape.
     */
    it('renders the styled gap even when punctuation is attached to the gap token', () => {
      // A single-problem plan whose ONLY problem has an attached-period gap.
      const plan: WordSongSessionPlan = {
        id: 'test-attached-gap',
        label: 'attached-gap',
        problems: Array.from({ length: 8 }, (_, i) => {
          const entry = getWordEntry('ran')
          return {
            index: i + 1,
            target: entry,
            contentType: 'simple-sentence' as const,
            sentenceFrame: 'The dog ___.', // gap carries the trailing period
            utterances: {
              read: 'Finish the sentence: The dog ___.',
              correct: 'Yes! Ran.',
              reprompt: 'Hmm... try again?',
              hint: 'Listen. The dog ran.',
              giveAnswer: 'This one is ran.',
            },
          }
        }),
      }
      render(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={plan}
            playUtterance={makePlayHarness().playUtterance}
            audioReady={true}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      // The styled gap is present (not swallowed into a plain "___." word).
      const gaps = screen.getAllByTestId('word-song-sentence-gap')
      expect(gaps).toHaveLength(1)
      // The literal "___" never reaches the DOM as visible text.
      expect(
        screen.getByTestId('word-song-sentence-panel').textContent,
      ).not.toContain('___')
    })

    /**
     * Mechanic assertion C — chips render as written-word text (no
     * picture SVG), reusing the sight-words chip shape (Kyle §3.3 / §7 Q5).
     * 3 chips; each chip's text contains its data-word.
     */
    it('renders 3 written-word text chips; each chip text contains its data-word', () => {
      render(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={simpleSentencePlan()}
            playUtterance={makePlayHarness().playUtterance}
            audioReady={true}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      const chips = screen.getAllByTestId('word-song-chip')
      expect(chips).toHaveLength(3)
      expect(screen.queryAllByTestId('word-picture')).toHaveLength(0)
      expect(screen.getAllByTestId('word-song-chip-sight-word')).toHaveLength(3)

      for (const chip of chips) {
        const word = chip.getAttribute('data-word')
        expect(word).not.toBeNull()
        expect((chip.textContent ?? '').trim().toLowerCase()).toContain(
          (word as string).toLowerCase(),
        )
      }
    })

    /**
     * The correct chip carries the target resolved from the `correct`
     * line, NOT the gapped read. Problem 1 frame "The cat ___ the mat."
     * gaps "sat" (the read says "blank"); the correct chip's word is "sat".
     */
    it('marks exactly one chip data-correct=true carrying the correct-derived target', () => {
      render(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={simpleSentencePlan()}
            playUtterance={makePlayHarness().playUtterance}
            audioReady={true}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      const correctChips = screen
        .getAllByTestId('word-song-chip')
        .filter((c) => c.getAttribute('data-correct') === 'true')
      expect(correctChips).toHaveLength(1)
      // Problem 1 target is 'sat' (resolved from "Yes! Sat.").
      expect(correctChips[0].getAttribute('data-word')).toBe('sat')
    })

    /**
     * Fill-on-correct closure beat (Kyle §3.2 / sponsor Q2): tapping the
     * correct chip fills the gap with the target word in place
     * (`data-gap-filled="true"`).
     */
    it('fills the gap with the target word on a correct tap (closure beat)', async () => {
      render(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={simpleSentencePlan()}
            playUtterance={makePlayHarness().playUtterance}
            audioReady={true}
            storage={makeMemoryStorage()}
          />,
        ),
      )

      // Gap starts unfilled.
      expect(
        screen
          .getByTestId('word-song-sentence-gap')
          .getAttribute('data-gap-filled'),
      ).toBe('false')

      const correctChip = screen
        .getAllByTestId('word-song-chip')
        .find((c) => c.getAttribute('data-correct') === 'true')!
      await act(async () => {
        fireEvent.click(correctChip)
        await Promise.resolve()
      })

      // Gap is now filled with the target word in place.
      const gap = screen.getByTestId('word-song-sentence-gap')
      expect(gap.getAttribute('data-gap-filled')).toBe('true')
      expect(gap.textContent?.toLowerCase()).toContain('sat')
    })

    /**
     * No decoding beat — the read-aloud fires immediately on mount (NOT
     * after the 1500ms silent CVC window). The cloze task is syntactic
     * prediction, not phonics; `isCvcWord` must NOT widen to include
     * `simple-sentence` (Kyle §2). Mirrors the sight-words immediate-fire
     * guard.
     */
    it('fires read-aloud immediately on mount (no silent decoding beat)', async () => {
      const harness = makePlayHarness()
      const getHowlerRunning = vi.fn(() => true)
      render(
        withMotion(
          <WordSong
            plan={simpleSentencePlan()}
            playUtterance={harness.playUtterance}
            storage={makeMemoryStorage()}
            getHowlerRunning={getHowlerRunning}
          />,
        ),
      )

      await act(async () => {
        await Promise.resolve()
      })

      // The read line fired without any fake-timer advance.
      expect(harness.calls.length).toBeGreaterThan(0)
      expect(harness.calls[0].text).toContain('Finish the sentence:')
    })
  })
})
