/**
 * The step intro lead line on Word Song's land-6 steps (content wave 1,
 * `design/native/content-wave-1.md` § 3.3, § 4.3, § 6.1, AC 13): it plays
 * before the scored problem 1 only, lights its letters while Emma says it,
 * and the CVC card's 1500 ms silent beat counts from its end. Fakes for
 * Emma's voice and the guide player.
 */
import { ADVANCE_AFTER_CORRECT_MS } from '@marian/core/shared/gameplayConstants'
import { bigWordsOf } from '@marian/core/wordSong/bigWordsSteps'
import { SILENT_TEXT_WINDOW_MS } from '@marian/core/wordSong/wordRound'
import type { WordSongSessionPlan } from '@marian/core/wordSong/wordSessionPlans'
import { act, fireEvent, screen, within } from '@testing-library/react-native'
import type { SessionGuideLineId, SessionGuidePlayer } from '../../audio'
import type { LineCallbacks } from '../../audio/linePlayback'
import {
  advance,
  flush,
  planOf,
  renderWordSong,
  say,
} from '../../../test/wordSongHarness'
import {
  INTRO_SPOT_OFF_MS,
  INTRO_STAGGER_MS,
  introSpotlight,
} from './introSpotlight'

const DUCK = planOf('cvc-word', bigWordsOf('duck-words'), { blend: false })
const CRAB = planOf('cvc-word', bigWordsOf('crab-words'), { blend: false })
const DUCK_INTRO = 'guide.session.intro.duck-words' as const
const CRAB_INTRO = 'guide.session.intro.crab-words' as const

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

type Harness = Awaited<ReturnType<typeof renderWordSong>>

/** The read plays and ends, then the right chip. */
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
  // The next CVC card's silent beat.
  await advance(SILENT_TEXT_WINDOW_MS)
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('introSpotlight (§ 3.3, § 4.3)', () => {
  it('duck words: the last two cells, together', () => {
    expect(introSpotlight(DUCK_INTRO, 'duck', false)).toEqual([
      null,
      null,
      0,
      0,
    ])
    expect(introSpotlight(DUCK_INTRO, 'ring', true)).toEqual([null, null, 0, 0])
  })

  it('crab words: every cell from the left, 150 ms apart; at once with Reduce Motion', () => {
    expect(introSpotlight(CRAB_INTRO, 'brick', false)).toEqual([
      0,
      INTRO_STAGGER_MS,
      2 * INTRO_STAGGER_MS,
      3 * INTRO_STAGGER_MS,
      4 * INTRO_STAGGER_MS,
    ])
    expect(introSpotlight(CRAB_INTRO, 'brick', true)).toEqual([0, 0, 0, 0, 0])
  })

  it('no other intro has a spotlight', () => {
    expect(
      introSpotlight('guide.session.intro.add-to-10', 'duck', false),
    ).toBeNull()
  })
})

describe('duck words: the intro before the scored problem 1', () => {
  it('plays "Two letters, one sound!" first, lights c and k, and the silent beat runs from its end', async () => {
    const guide = fakeGuide()
    const h = await renderWordSong({
      plan: DUCK,
      sessionIntro: DUCK_INTRO,
      sessionGuide: guide.player,
    })
    expect(guide.lines.map((l) => l.id)).toEqual([DUCK_INTRO])
    expect(h.voice.lines).toHaveLength(0)
    await startGuide(guide.lines[0]!)
    expect(litCells('duck')).toEqual([2, 3])
    expect(h.poses.at(-1)).toBe('listening')

    await endGuide(guide.lines[0]!)
    // Still lit just under 200 ms after the line ends, dark at 200 ms.
    await advance(INTRO_SPOT_OFF_MS - 1)
    expect(litCells('duck')).toEqual([2, 3])
    await advance(1)
    expect(litCells('duck')).toEqual([])
    // The 1500 ms beat counts from the line's end (no 400 ms gap first).
    await advance(SILENT_TEXT_WINDOW_MS - INTRO_SPOT_OFF_MS - 1)
    expect(h.voice.lines).toHaveLength(0)
    await advance(1)
    expect(h.voice.texts()).toEqual(['Read the duck.'])
  })

  it('no lead on problems 2-8; the 2nd wrong plays the hint line (no blend clip)', async () => {
    const guide = fakeGuide()
    const h = await renderWordSong({
      plan: DUCK,
      sessionIntro: DUCK_INTRO,
      sessionGuide: guide.player,
    })
    await startGuide(guide.lines[0]!)
    await endGuide(guide.lines[0]!)
    await advance(SILENT_TEXT_WINDOW_MS)

    // Problem 1: two wrong taps, then the hint, then the right one.
    await say(h.voice.lines.at(-1)!)
    const wrong = screen
      .getAllByTestId(/^word-song-chip-[a-z]+$/)
      .map((n) => String(n.props.testID).replace('word-song-chip-', ''))
      .find((w) => w !== 'duck')!
    await fireEvent.press(screen.getByTestId(`word-song-chip-${wrong}`))
    await flush()
    await say(h.voice.lines.at(-1)!)
    await fireEvent.press(screen.getByTestId(`word-song-chip-${wrong}`))
    await flush()
    await say(h.voice.lines.at(-1)!)
    await advance(1000)
    expect(h.voice.texts()).toContain("Let's look. Duck.")
    expect(h.voice.texts().some((t) => t.includes(' - '))).toBe(false)
    await say(h.voice.lines.at(-1)!)
    await fireEvent.press(screen.getByTestId('word-song-chip-duck'))
    await flush()
    await say(h.voice.lines.at(-1)!)
    await advance(ADVANCE_AFTER_CORRECT_MS)
    await advance(SILENT_TEXT_WINDOW_MS)

    for (let i = 1; i < 8; i++) await answerRight(h, DUCK, i)
    expect(guide.lines.map((l) => l.id)).toEqual([DUCK_INTRO])
    expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
  })
})

describe('crab words', () => {
  it('"Read all the letters!" lights every cell of flag', async () => {
    const guide = fakeGuide()
    await renderWordSong({
      plan: CRAB,
      sessionIntro: CRAB_INTRO,
      sessionGuide: guide.player,
    })
    expect(guide.lines.map((l) => l.id)).toEqual([CRAB_INTRO])
    await startGuide(guide.lines[0]!)
    expect(litCells('flag')).toEqual([0, 1, 2, 3])
  })
})

describe('where the intro does not play', () => {
  it('warm-up hearts keep their own line; the intro goes to the scored problem 1', async () => {
    const round: WordSongSessionPlan = {
      ...DUCK,
      problems: [
        { ...DUCK.problems[6]!, index: 1 },
        { ...DUCK.problems[7]!, index: 2 },
        ...DUCK.problems,
      ],
    }
    const guide = fakeGuide()
    const h = await renderWordSong({
      plan: round,
      warmupCount: 2,
      sessionIntro: DUCK_INTRO,
      sessionGuide: guide.player,
    })
    expect(guide.lines.map((l) => l.id)).toEqual(['guide.session.warmup'])
    await startGuide(guide.lines[0]!)
    expect(litCells('lock')).toEqual([])
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
      DUCK_INTRO,
    ])
  })

  it('a review plays its opener only', async () => {
    const guide = fakeGuide()
    await renderWordSong({
      plan: DUCK,
      review: true,
      sessionIntro: DUCK_INTRO,
      sessionGuide: guide.player,
    })
    expect(guide.lines.map((l) => l.id)).toEqual(['guide.session.review'])
  })

  it('a Map peek plays its opener only', async () => {
    const guide = fakeGuide()
    await renderWordSong({
      plan: { ...CRAB, problems: CRAB.problems.slice(0, 3) },
      peek: 'crab-words',
      sessionIntro: CRAB_INTRO,
      sessionGuide: guide.player,
    })
    expect(guide.lines.map((l) => l.id)).toEqual([
      'guide.session.peek-open.crab-words',
    ])
  })
})
