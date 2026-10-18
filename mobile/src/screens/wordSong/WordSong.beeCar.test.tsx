/**
 * Content wave 4's bee words and car words on the native Word Song
 * (`design/native/content-wave-4.md` § 3.3, § 4.3, § 5, AC 12): the lead
 * "Two letters, one sound!" (duck words' text and cue) lights the word's
 * last two cells together before the scored problem 1, and plays nowhere
 * else (problems 2–8, reviews, peeks, warm-up hearts). Each card deals its
 * own step's chip row (sheep in bee words: ship and jeep, not the sh step's
 * shoe and shell). Fakes for Emma's voice and the guide player.
 */
import { ADVANCE_AFTER_CORRECT_MS } from '@marian/core/shared/gameplayConstants'
import {
  BIG_WORDS_STEPS,
  type BigWordsStep,
} from '@marian/core/wordSong/bigWordsSteps'
import { SILENT_TEXT_WINDOW_MS } from '@marian/core/wordSong/wordRound'
import type { WordSongSessionPlan } from '@marian/core/wordSong/wordSessionPlans'
import { act, fireEvent, screen, within } from '@testing-library/react-native'
import type { SessionGuideLineId, SessionGuidePlayer } from '../../audio'
import type { LineCallbacks } from '../../audio/linePlayback'
import { wordSongRoundFromServer } from '../../session/wordSongSession'
import {
  advance,
  flush,
  renderWordSong,
  say,
} from '../../../test/wordSongHarness'
import { introSpotlight } from './introSpotlight'

const BEE_INTRO = 'guide.session.intro.bee-words' as const
const CAR_INTRO = 'guide.session.intro.car-words' as const

/** A land-6-format block (`bigWordsCanonCheck.ts`'s lines). */
function block(n: number, word: string, prefix = 'p') {
  const cap = word.charAt(0).toUpperCase() + word.slice(1)
  return [
    { id: `word.${prefix}${n}.read`, text: `Read the ${word}.` },
    { id: `word.${prefix}${n}.correct`, text: `Yes! That's a ${word}.` },
    { id: `word.${prefix}${n}.reprompt`, text: 'Hmm... try again?' },
    { id: `word.${prefix}${n}.hint`, text: `Let's look. ${cap}.` },
    { id: `word.${prefix}${n}.giveAnswer`, text: `This one is ${word}.` },
  ]
}

const wordsOf = (step: BigWordsStep) => BIG_WORDS_STEPS[step].map((r) => r.word)

/** A forward session of `step`, read as the native session start reads it. */
function forward(step: BigWordsStep): WordSongSessionPlan {
  return wordSongRoundFromServer(
    {
      id: `${step}-level-1`,
      label: step,
      utterances: wordsOf(step).flatMap((w, i) => block(i + 1, w)),
    },
    {
      planKind: { kind: 'forward', warmup: [] },
      intro: `guide.session.intro.${step}`,
      focusNode: step,
    },
  ).plan
}

const BEE = forward('bee-words')
const CAR = forward('car-words')

function fakeGuide() {
  const lines: {
    id: SessionGuideLineId
    opts: LineCallbacks
    end: () => void
  }[] = []
  const player: SessionGuidePlayer = {
    playLine: (id, opts = {}) =>
      new Promise<void>((resolve) => {
        lines.push({ id, opts, end: resolve })
      }),
    cancelActive: jest.fn(),
    unload: jest.fn(),
  }
  return { lines, player }
}

async function startGuide(line: { opts: LineCallbacks }) {
  await act(async () => {
    line.opts.onPlay?.()
  })
  await flush()
}

async function endGuide(line: { end: () => void }) {
  await act(async () => {
    line.end()
  })
  await flush()
}

/** Indexes of the cells whose spotlight is on. */
function litCells(word: string): number[] {
  return word
    .split('')
    .map((_, i) => i)
    .filter(
      (i) =>
        within(screen.getByTestId(`word-song-letter-${i}`)).queryByTestId(
          'word-song-letter-lit',
        ) !== null,
    )
}

const chipWords = () =>
  screen
    .getAllByTestId(/^word-song-chip-[a-z]+$/)
    .map((n) => String(n.props.testID).replace('word-song-chip-', ''))
    .sort()

type Harness = Awaited<ReturnType<typeof renderWordSong>>

/** The read plays and ends, then the right chip, then the next beat. */
async function answerRight(h: Harness, plan: WordSongSessionPlan, i: number) {
  const problem = plan.problems[i]!
  const read = h.voice.lines.at(-1)!
  expect(read.text).toBe(problem.utterances.read)
  await say(read)
  await fireEvent.press(
    screen.getByTestId(`word-song-chip-${problem.target.word}`),
  )
  await flush()
  await say(h.voice.lines.at(-1)!)
  await advance(ADVANCE_AFTER_CORRECT_MS)
  await advance(SILENT_TEXT_WINDOW_MS)
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('introSpotlight: duck words’ ending-pair cue (§ 3.3, § 4.3)', () => {
  it('bee: e e; car: a r; with Reduce Motion too', () => {
    expect(introSpotlight(BEE_INTRO, 'bee', false)).toEqual([null, 0, 0])
    expect(introSpotlight(CAR_INTRO, 'car', true)).toEqual([null, 0, 0])
  })
})

describe.each([
  ['bee words', BEE, BEE_INTRO, 'bee'],
  ['car words', CAR, CAR_INTRO, 'car'],
] as const)(
  '%s: the lead before the scored problem 1 (AC 12)',
  (_n, plan, intro, word) => {
    it('lights the last two cells together; the silent beat runs from its end', async () => {
      const guide = fakeGuide()
      const h = await renderWordSong({
        plan,
        sessionIntro: intro,
        sessionGuide: guide.player,
      })
      expect(guide.lines.map((l) => l.id)).toEqual([intro])
      expect(h.voice.lines).toHaveLength(0)
      await startGuide(guide.lines[0]!)
      expect(litCells(word)).toEqual([1, 2])
      await endGuide(guide.lines[0]!)
      await advance(SILENT_TEXT_WINDOW_MS - 1)
      expect(h.voice.lines).toHaveLength(0)
      await advance(1)
      expect(h.voice.texts()).toEqual([`Read the ${word}.`])
    })

    it('no lead on problems 2–8; every card deals its own row', async () => {
      const guide = fakeGuide()
      const h = await renderWordSong({
        plan,
        sessionIntro: intro,
        sessionGuide: guide.player,
      })
      await startGuide(guide.lines[0]!)
      await endGuide(guide.lines[0]!)
      await advance(SILENT_TEXT_WINDOW_MS)
      const rows = BIG_WORDS_STEPS[`${word}-words` as BigWordsStep]
      for (let i = 0; i < 8; i++) {
        const row = rows[i]!
        expect([row.word, chipWords()]).toEqual([
          row.word,
          [row.word, ...(i < 3 ? row.gentle : row.trap)].sort(),
        ])
        await answerRight(h, plan, i)
      }
      expect(guide.lines.map((l) => l.id)).toEqual([intro])
      expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
    })

    it('a review plays its opener only', async () => {
      const guide = fakeGuide()
      await renderWordSong({
        plan,
        review: true,
        sessionIntro: intro,
        sessionGuide: guide.player,
      })
      expect(guide.lines.map((l) => l.id)).toEqual(['guide.session.review'])
    })

    it('a Map peek plays its opener only', async () => {
      const guide = fakeGuide()
      const step = `${word}-words` as const
      await renderWordSong({
        plan: { ...plan, problems: plan.problems.slice(0, 3) },
        peek: step,
        sessionIntro: intro,
        sessionGuide: guide.player,
      })
      expect(guide.lines.map((l) => l.id)).toEqual([
        `guide.session.peek-open.${step}`,
      ])
    })

    it('warm-up hearts keep their own line; the lead goes to the scored problem 1', async () => {
      const round: WordSongSessionPlan = {
        ...plan,
        problems: [
          { ...plan.problems[6]!, index: 1 },
          { ...plan.problems[7]!, index: 2 },
          ...plan.problems,
        ],
      }
      const guide = fakeGuide()
      const h = await renderWordSong({
        plan: round,
        warmupCount: 2,
        sessionIntro: intro,
        sessionGuide: guide.player,
      })
      expect(guide.lines.map((l) => l.id)).toEqual(['guide.session.warmup'])
      await startGuide(guide.lines[0]!)
      expect(litCells(round.problems[0]!.target.word)).toEqual([])
      await endGuide(guide.lines[0]!)
      await advance(400 + SILENT_TEXT_WINDOW_MS)
      await answerRight(h, round, 0)
      await startGuide(guide.lines[1]!)
      await endGuide(guide.lines[1]!)
      await advance(400 + SILENT_TEXT_WINDOW_MS)
      await answerRight(h, round, 1)
      expect(guide.lines.map((l) => l.id)).toEqual([
        'guide.session.warmup',
        'guide.session.warmup',
        intro,
      ])
    })
  },
)

describe('the step rows reach the screen through the session start (§ 5)', () => {
  it('bee words P4 (sheep): ship and jeep, not the sh step’s shell', async () => {
    expect(BEE.problems[3]!.chipRow).toEqual({
      gentle: ['pot', 'map'],
      trap: ['ship', 'jeep'],
    })
    const guide = fakeGuide()
    await renderWordSong({
      plan: { ...BEE, problems: [BEE.problems[3]!] },
      sessionGuide: guide.player,
    })
    expect(chipWords()).toEqual(['jeep', 'sheep', 'ship'])
  })

  it('a review block keeps its step’s row: a car-words shark and an sh-step shark', () => {
    const review = wordSongRoundFromServer(
      {
        id: 'review-word-song',
        label: 'review',
        utterances: [
          'shark',
          'shark',
          'bee',
          'tree',
          'leaf',
          'seal',
          'peach',
          'seed',
        ].flatMap((w, i) => block(i + 1, w)),
      },
      {
        planKind: {
          kind: 'review',
          blocks: [
            { node: 'car-words', problem: 5 },
            { node: 'digraphs-sh', problem: 6 },
            ...[1, 2, 3, 6, 7, 8].map((problem) => ({
              node: 'bee-words' as const,
              problem,
            })),
          ],
        },
        intro: null,
      },
    )
    expect(review.review).toBe(true)
    expect(review.plan.problems[0]!.chipRow?.trap).toEqual(['ship', 'star'])
    expect(review.plan.problems[1]!.chipRow).toBeUndefined()
  })
})
