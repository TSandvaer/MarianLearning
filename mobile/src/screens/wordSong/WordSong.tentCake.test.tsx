/**
 * Content wave 2's Word Song cues (`design/native/content-wave-2.md` § 3.3,
 * § 4.3, AC 12, AC 13):
 * - tent words' lead "Read to the end!" lights the cells left to right and
 *   then pulses the last two; the silent beat counts from its end;
 * - cake words' lead dims the e at "quiet" and lights the vowel at "A",
 *   both back to normal 200 ms after the line;
 * - the 2nd wrong of every cake-words card sets the quiet-E cue until the
 *   advance, in any session; never from reveal.
 * Fakes for Emma's voice and the guide player.
 */
import { ADVANCE_AFTER_CORRECT_MS } from '@marian/core/shared/gameplayConstants'
import { bigWordsOf } from '@marian/core/wordSong/bigWordsSteps'
import { SILENT_TEXT_WINDOW_MS } from '@marian/core/wordSong/wordRound'
import type { WordSongSessionPlan } from '@marian/core/wordSong/wordSessionPlans'
import { act, fireEvent, screen, within } from '@testing-library/react-native'
import type {
  IntroGuideLineId,
  SessionGuideLineId,
  SessionGuidePlayer,
} from '../../audio'
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
  LIT_PULSE_MS,
  introEndPulse,
  introSpotlight,
  introTickCue,
  quietECue,
} from './introSpotlight'

const TENT = planOf('cvc-word', bigWordsOf('tent-words'), { blend: false })
const CAKE = planOf('cvc-word', bigWordsOf('cake-words'), { blend: false })
const TENT_INTRO = 'guide.session.intro.tent-words' as const
const CAKE_INTRO = 'guide.session.intro.cake-words' as const
const CAKE_LEAD = 'The E is quiet. It makes the A say its name.'

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

type GuideLine = ReturnType<typeof fakeGuide>['lines'][number]

async function startGuide(line: GuideLine) {
  await act(async () => {
    line.opts.onPlay?.()
    line.opts.onWordTick?.(0)
  })
  await flush()
}

async function tickGuide(line: GuideLine, i: number) {
  await act(async () => {
    line.opts.onWordTick?.(i)
  })
  await flush()
}

async function endGuide(line: GuideLine) {
  await act(async () => {
    line.end()
  })
  await flush()
}

function cellsWith(word: string, testID: string): number[] {
  return word
    .split('')
    .map((_, i) => i)
    .filter(
      (i) =>
        within(screen.getByTestId(`word-song-letter-${i}`)).queryByTestId(
          testID,
        ) !== null,
    )
}
const litCells = (word: string) => cellsWith(word, 'word-song-letter-lit')
const quietCells = (word: string) => cellsWith(word, 'word-song-letter-quiet')

/** Indexes of the cells marked for the end pulse. */
function endPulseCells(): number[] {
  return screen
    .queryAllByTestId('word-song-letter-end-pulse')
    .map((n) =>
      Number(
        String(
          within(n).getByTestId(/^word-song-letter-\d+$/).props.testID,
        ).replace('word-song-letter-', ''),
      ),
    )
}

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

/** A wrong chip of the current card. */
function wrongChip(target: string): string {
  return screen
    .getAllByTestId(/^word-song-chip-[a-z]+$/)
    .map((n) => String(n.props.testID).replace('word-song-chip-', ''))
    .find((w) => w !== target)!
}

/** The read ends; two wrong taps; the hint line starts (not ended). */
async function toSecondWrong(h: Harness, target: string) {
  await say(h.voice.lines.at(-1)!)
  const wrong = wrongChip(target)
  await fireEvent.press(screen.getByTestId(`word-song-chip-${wrong}`))
  await flush()
  await say(h.voice.lines.at(-1)!)
  await fireEvent.press(screen.getByTestId(`word-song-chip-${wrong}`))
  await flush()
  await say(h.voice.lines.at(-1)!)
  await advance(1000)
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('introSpotlight and friends (§ 3.3, § 4.3)', () => {
  it('tent words: every cell from the left, 150 ms apart; at once with Reduce Motion', () => {
    expect(introSpotlight(TENT_INTRO, 'tent', false)).toEqual([
      0,
      INTRO_STAGGER_MS,
      2 * INTRO_STAGGER_MS,
      3 * INTRO_STAGGER_MS,
    ])
    expect(introSpotlight(TENT_INTRO, 'tent', true)).toEqual([0, 0, 0, 0])
  })

  it('tent words: the last two cells pulse together once the last has lit; no pulse with Reduce Motion', () => {
    const at = 3 * INTRO_STAGGER_MS + LIT_PULSE_MS
    expect(introEndPulse(TENT_INTRO, 'tent', false)).toEqual([
      null,
      null,
      at,
      at,
    ])
    expect(introEndPulse(TENT_INTRO, 'tent', true)).toBeNull()
    expect(
      introEndPulse('guide.session.intro.crab-words', 'flag', false),
    ).toBeNull()
  })

  it('cake words: no spotlight at the start; the cue cells are vowel = 2nd, e = 4th, cake words only', () => {
    expect(introSpotlight(CAKE_INTRO, 'cake', false)).toBeNull()
    expect(bigWordsOf('cake-words').map(quietECue)).toEqual(
      Array(8).fill({ vowel: 1, quiet: 3 }),
    )
    expect(['cap', 'tent', 'duck', 'bed', 'pin'].map(quietECue)).toEqual(
      Array(5).fill(null),
    )
  })

  it('cake words: "quiet" dims the e, "A" lights the vowel; the fallback text works too', () => {
    const cues = CAKE_LEAD.split(' ').map((_, i) =>
      introTickCue(CAKE_INTRO, CAKE_LEAD, 'cake', i),
    )
    expect(cues).toEqual([
      null,
      null,
      null,
      { quiet: 3 },
      null,
      null,
      null,
      { light: 1 },
      null,
      null,
      null,
    ])
    const fallback = 'The E is quiet. A says its name.'
    expect(introTickCue(CAKE_INTRO, fallback, 'cake', 3)).toEqual({ quiet: 3 })
    expect(introTickCue(CAKE_INTRO, fallback, 'cake', 4)).toEqual({ light: 1 })
    expect(
      introTickCue(TENT_INTRO as IntroGuideLineId, CAKE_LEAD, 'cake', 3),
    ).toBeNull()
  })
})

describe('tent words: the intro before the scored problem 1 (AC 12)', () => {
  it('"Read to the end!" lights every cell and pulses n and t; dark 200 ms after; the silent beat runs from its end', async () => {
    const guide = fakeGuide()
    const h = await renderWordSong({
      plan: TENT,
      sessionIntro: TENT_INTRO,
      sessionGuide: guide.player,
    })
    expect(guide.lines.map((l) => l.id)).toEqual([TENT_INTRO])
    expect(h.voice.lines).toHaveLength(0)
    await startGuide(guide.lines[0]!)
    expect(litCells('tent')).toEqual([0, 1, 2, 3])
    expect(endPulseCells()).toEqual([2, 3])
    expect(quietCells('tent')).toEqual([])

    await endGuide(guide.lines[0]!)
    await advance(INTRO_SPOT_OFF_MS - 1)
    expect(litCells('tent')).toEqual([0, 1, 2, 3])
    await advance(1)
    expect(litCells('tent')).toEqual([])
    expect(endPulseCells()).toEqual([])
    // The 1500 ms beat counts from the line's end (no 400 ms gap first).
    await advance(SILENT_TEXT_WINDOW_MS - INTRO_SPOT_OFF_MS - 1)
    expect(h.voice.lines).toHaveLength(0)
    await advance(1)
    expect(h.voice.texts()).toEqual(['Read the tent.'])
  })

  it('no lead on problems 2-8; the 2nd wrong plays the hint line with no quiet cue', async () => {
    const guide = fakeGuide()
    const h = await renderWordSong({
      plan: TENT,
      sessionIntro: TENT_INTRO,
      sessionGuide: guide.player,
    })
    await startGuide(guide.lines[0]!)
    await endGuide(guide.lines[0]!)
    await advance(SILENT_TEXT_WINDOW_MS)

    await toSecondWrong(h, 'tent')
    expect(h.voice.texts()).toContain("Let's look. Tent.")
    expect(quietCells('tent')).toEqual([])
    expect(litCells('tent')).toEqual([])
    await say(h.voice.lines.at(-1)!)
    await fireEvent.press(screen.getByTestId('word-song-chip-tent'))
    await flush()
    await say(h.voice.lines.at(-1)!)
    await advance(ADVANCE_AFTER_CORRECT_MS)
    await advance(SILENT_TEXT_WINDOW_MS)

    for (let i = 1; i < 8; i++) await answerRight(h, TENT, i)
    expect(guide.lines.map((l) => l.id)).toEqual([TENT_INTRO])
    expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
  })

  it('a Map peek plays its opener only, with no intro cue', async () => {
    const guide = fakeGuide()
    await renderWordSong({
      plan: { ...TENT, problems: TENT.problems.slice(0, 3) },
      peek: 'tent-words',
      sessionIntro: TENT_INTRO,
      sessionGuide: guide.player,
    })
    expect(guide.lines.map((l) => l.id)).toEqual([
      'guide.session.peek-open.tent-words',
    ])
  })
})

describe('cake words: the lead and the quiet-E cue (AC 13)', () => {
  it('no cell is quiet or lit at reveal; "quiet" dims cell 4, "A" lights cell 2; both normal 200 ms after the line', async () => {
    const guide = fakeGuide()
    const h = await renderWordSong({
      plan: CAKE,
      sessionIntro: CAKE_INTRO,
      sessionGuide: guide.player,
    })
    expect(guide.lines.map((l) => l.id)).toEqual([CAKE_INTRO])
    const lead = guide.lines[0]!
    await startGuide(lead)
    expect(quietCells('cake')).toEqual([])
    expect(litCells('cake')).toEqual([])
    for (let i = 1; i < 3; i++) await tickGuide(lead, i)
    expect(quietCells('cake')).toEqual([])
    await tickGuide(lead, 3) // "quiet."
    expect(quietCells('cake')).toEqual([3])
    expect(litCells('cake')).toEqual([])
    for (let i = 4; i < 7; i++) await tickGuide(lead, i)
    expect(litCells('cake')).toEqual([])
    await tickGuide(lead, 7) // "A"
    expect(litCells('cake')).toEqual([1])
    expect(quietCells('cake')).toEqual([3])
    for (let i = 8; i < 11; i++) await tickGuide(lead, i)

    await endGuide(lead)
    await advance(INTRO_SPOT_OFF_MS - 1)
    expect(quietCells('cake')).toEqual([3])
    expect(litCells('cake')).toEqual([1])
    await advance(1)
    expect(quietCells('cake')).toEqual([])
    expect(litCells('cake')).toEqual([])
    await advance(SILENT_TEXT_WINDOW_MS - INTRO_SPOT_OFF_MS)
    expect(h.voice.texts()).toEqual(['Read the cake.'])
  })

  it('the 2nd wrong sets cell 4 quiet and cell 2 lit until the advance, through the 3rd try; the next card reveals clean', async () => {
    const guide = fakeGuide()
    const h = await renderWordSong({
      plan: CAKE,
      sessionIntro: CAKE_INTRO,
      sessionGuide: guide.player,
    })
    await startGuide(guide.lines[0]!)
    await endGuide(guide.lines[0]!)
    await advance(SILENT_TEXT_WINDOW_MS)

    await toSecondWrong(h, 'cake')
    expect(h.voice.lines.at(-1)!.text).toBe("Let's look. Cake.")
    expect(quietCells('cake')).toEqual([3])
    expect(litCells('cake')).toEqual([1])
    await say(h.voice.lines.at(-1)!)
    // Still there for the 3rd try, and after Emma gives the answer.
    await advance(5000)
    expect(quietCells('cake')).toEqual([3])
    expect(litCells('cake')).toEqual([1])
    await fireEvent.press(
      screen.getByTestId(`word-song-chip-${wrongChip('cake')}`),
    )
    await flush()
    await say(h.voice.lines.at(-1)!)
    await flush()
    expect(h.voice.lines.at(-1)!.text).toBe('This one is cake.')
    expect(quietCells('cake')).toEqual([3])
    await say(h.voice.lines.at(-1)!)
    await fireEvent.press(screen.getByTestId('word-song-chip-cake'))
    await flush()
    await say(h.voice.lines.at(-1)!)
    expect(quietCells('cake')).toEqual([3])
    await advance(ADVANCE_AFTER_CORRECT_MS)
    // Problem 2, kite: revealed with no cue (never from reveal).
    expect(screen.getByTestId('word-song-letters')).toBeTruthy()
    expect(quietCells('kite')).toEqual([])
    expect(litCells('kite')).toEqual([])
    await advance(SILENT_TEXT_WINDOW_MS)
    expect(h.voice.lines.at(-1)!.text).toBe('Read the kite.')

    // Kite's own 2nd wrong brings the cue on kite (no lead plays here).
    await toSecondWrong(h, 'kite')
    expect(h.voice.lines.at(-1)!.text).toBe("Let's look. Kite.")
    expect(quietCells('kite')).toEqual([3])
    expect(litCells('kite')).toEqual([1])
    expect(guide.lines.map((l) => l.id)).toEqual([CAKE_INTRO])
  })

  it('a review keeps the cue on a cake-words card (no lead)', async () => {
    const guide = fakeGuide()
    const h = await renderWordSong({
      plan: CAKE,
      review: true,
      sessionGuide: guide.player,
    })
    expect(guide.lines.map((l) => l.id)).toEqual(['guide.session.review'])
    await startGuide(guide.lines[0]!)
    await endGuide(guide.lines[0]!)
    await advance(400 + SILENT_TEXT_WINDOW_MS)
    expect(quietCells('cake')).toEqual([])
    await toSecondWrong(h, 'cake')
    expect(quietCells('cake')).toEqual([3])
    expect(litCells('cake')).toEqual([1])
  })
})
