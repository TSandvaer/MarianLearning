/**
 * Web ↔ native parity for Word Song: the native screen builds every round
 * from `@marian/core/wordSong/wordRound` + `wordChips`. This renders the
 * web screen on every baked canon plan (each tier, each problem) and reads
 * back what it shows and plays: the chip order and names, the card, the
 * sentence tokens, when problem 1 is read and what the 2nd wrong tap
 * plays. It proves the web draws what core decides; the decisions are
 * pinned by `packages/core/src/wordSong/wordRound.test.ts`.
 *
 * Also pins core's copy of the novel probe words to the planner's.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WORD_SONG_NOVEL_PROBE_WORDS } from '../../../api/_plannerWordList'
import { NOVEL_PROBE_WORDS } from '@marian/core/wordSong/novelProbeWords'
import { wordSongSessionPlanFromServer } from '@marian/core/wordSong/planFromServer'
import {
  buildWordRound,
  chipLabel,
  secondWrongPrompt,
  sentenceTokens,
  type WordCard,
} from '@marian/core/wordSong/wordRound'
import type {
  WordSongProblem,
  WordSongSessionPlan,
} from '@marian/core/wordSong/wordSessionPlans'
import type { StorageAdapter } from '@marian/core/shared/stardust'

vi.mock('../../lib/sfx', () => ({
  createSfx: vi.fn(() => ({
    play: vi.fn(() => true),
    unload: vi.fn(),
    missedPlays: 0,
    loadFailed: false,
  })),
}))

import WordSong from './WordSong'

const CANON_DIR = resolve(process.cwd(), 'public/canon/word-song/level-1')

/**
 * Every baked Word Song plan the web plays, as the app rehydrates it. The
 * little stories (content wave 3 § 4) are native only: the frozen web
 * parses without `littleStories`, so their plans throw there by design.
 */
const PLANS: { file: string; plan: WordSongSessionPlan }[] = readdirSync(
  CANON_DIR,
)
  .filter((f) => f.endsWith('.json') && !f.endsWith('-stories.json'))
  .sort()
  .map((file) => {
    const json = JSON.parse(readFileSync(resolve(CANON_DIR, file), 'utf8'))
    return { file, plan: wordSongSessionPlanFromServer(json.plan) }
  })

const CARD_TESTID: Record<Exclude<WordCard, 'none' | 'story'>, string> = {
  picture: 'word-song-word-card',
  letter: 'word-song-letter-card',
  'letter-sound': 'word-song-letter-sound-card',
  sentence: 'word-song-sentence-panel',
}

function memoryStorage(): StorageAdapter {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  }
}

/** The plan with problem `i` first (it keeps its own `index`). */
function firstUp(plan: WordSongSessionPlan, i: number): WordSongSessionPlan {
  const p = plan.problems[i]!
  return {
    ...plan,
    problems: [p, ...plan.problems.filter((_, j) => j !== i)],
  }
}

function withMotion(node: ReactNode) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{node}</MotionConfig>
    </LazyMotion>
  )
}

function player() {
  const spoken: string[] = []
  return {
    spoken,
    play: vi.fn(async (text: string, opts?: { onPlay?: () => void }) => {
      spoken.push(text)
      opts?.onPlay?.()
    }),
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('the novel probe words', () => {
  it("core's copy is the planner's", () => {
    expect([...NOVEL_PROBE_WORDS]).toEqual([...WORD_SONG_NOVEL_PROBE_WORDS])
  })
})

it('the canon covers every card, a blend and the silent beat', () => {
  const rounds = PLANS.flatMap(({ plan }) =>
    plan.problems.map((p) => buildWordRound(p, { crossVowel: false })),
  )
  expect([...new Set(rounds.map((r) => r.card))].sort()).toEqual([
    'letter',
    'letter-sound',
    'none',
    'picture',
    'sentence',
  ])
  const firsts = PLANS.map(({ plan }) => plan.problems[0]!)
  expect(firsts.some((p) => secondWrongPrompt(p).kind === 'blend')).toBe(true)
  expect(
    firsts.some(
      (p) => buildWordRound(p, { crossVowel: false }).readAloudDelayMs > 0,
    ),
  ).toBe(true)
})

describe.each(PLANS)('$file', ({ plan }) => {
  it.each(plan.problems.map((p, i) => [p.index, i] as const))(
    'problem %s shows the round core builds',
    (_n, i) => {
      const problem = plan.problems[i]!
      const round = buildWordRound(problem, { crossVowel: false })
      const { unmount } = render(
        withMotion(
          <WordSong
            __testInitiallyAudioUnlocked
            plan={firstUp(plan, i)}
            storage={memoryStorage()}
          />,
        ),
      )
      const chips = screen.getAllByTestId('word-song-chip')
      expect(chips.map((c) => c.getAttribute('data-word'))).toEqual(
        round.chips.map((e) => e.word),
      )
      expect(chips.map((c) => c.getAttribute('aria-label'))).toEqual(
        round.chips.map((e) => chipLabel(round.chipFace, e.word)),
      )
      for (const [card, testId] of Object.entries(CARD_TESTID)) {
        expect(screen.queryAllByTestId(testId)).toHaveLength(
          card === round.card ? 1 : 0,
        )
      }
      if (round.card === 'sentence' && problem.sentenceFrame !== undefined) {
        const tokens = sentenceTokens(problem.sentenceFrame)
        expect(screen.queryAllByTestId('word-song-sentence-gap')).toHaveLength(
          tokens.filter((t) => t.kind === 'gap').length,
        )
        expect(
          screen
            .queryAllByTestId('word-song-sentence-word')
            .map((w) => w.getAttribute('data-word')),
        ).toEqual(tokens.flatMap((t) => (t.kind === 'word' ? [t.text] : [])))
      }
      unmount()
    },
  )

  it('reads problem 1 after the delay core sets', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const first = plan.problems[0]!
    const delay = buildWordRound(first, { crossVowel: false }).readAloudDelayMs
    const { spoken, play } = player()
    render(
      withMotion(
        <WordSong
          plan={plan}
          playUtterance={play}
          storage={memoryStorage()}
          getHowlerRunning={() => true}
        />,
      ),
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.max(0, delay - 50))
    })
    expect(spoken).toEqual(delay === 0 ? [first.utterances.read] : [])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(spoken).toEqual([first.utterances.read])
  })

  it('plays what core picks on the 2nd wrong tap', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    const first: WordSongProblem = plan.problems[0]!
    const { spoken, play } = player()
    render(
      withMotion(
        <WordSong
          __testInitiallyAudioUnlocked
          plan={plan}
          playUtterance={play}
          storage={memoryStorage()}
        />,
      ),
    )
    const wrong = screen
      .getAllByTestId('word-song-chip')
      .filter((c) => c.getAttribute('data-word') !== first.target.word)
    for (const chip of [wrong[0]!, wrong[1] ?? wrong[0]!]) {
      await act(async () => {
        fireEvent.click(chip)
        await vi.advanceTimersByTimeAsync(0)
      })
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(spoken).toEqual([
      first.utterances.reprompt,
      first.utterances.reprompt,
      secondWrongPrompt(first).text,
    ])
  })
})
