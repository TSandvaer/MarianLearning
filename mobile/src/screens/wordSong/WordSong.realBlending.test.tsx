/**
 * Real blending on the native Word Song (`design/native/real-blending.md`
 * § 3–§ 5, § 10, AC 12–17): land 2's two stops, read from the committed
 * canon through the native session parse.
 *
 * - Stop 1, blending sounds (`'listen-blend'`): "Listen.", 300 ms, then
 *   the blend clip cut before its word, the letters lit and held on the
 *   marks, the caption the sounds alone; the chips open at the cut.
 * - Stop 2, sounding out (`'sound-out'`): "What is it?"; the 2nd wrong is
 *   the cut sounds; the 3rd wrong is the whole clip, then the answer with
 *   the guided glow (Dave's extra, § 17).
 * - Both: the picture's slot stays empty until the answer, then the
 *   picture springs in and every letter lights.
 *
 * Silent: fakes for Emma's voice, the guide player and the tap player. The
 * marks fixture stands in for the six new clips until their render.
 */
import {
  ADVANCE_AFTER_CORRECT_MS,
  HINT_DELAY_AFTER_WRONG_MS,
} from '@marian/core/shared/gameplayConstants'
import { SILENT_TEXT_WINDOW_MS } from '@marian/core/wordSong/wordRound'
import type { WordSongSessionPlan } from '@marian/core/wordSong/wordSessionPlans'
import { act, fireEvent, screen, within } from '@testing-library/react-native'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { StyleSheet } from 'react-native'
import * as Reanimated from 'react-native-reanimated'
import type { SessionGuideLineId, SessionGuidePlayer } from '../../audio'
import { BLEND_MARKS } from '../../audio/blendMarks.generated'
import type { LineCallbacks } from '../../audio/linePlayback'
import { wordSongLayout } from '../../layout/wordSongLayout'
import { wordSongRoundFromServer } from '../../session/wordSongSession'
import { REPO_ROOT } from '../../../test/webSource'
import {
  advance,
  canonClips,
  flush,
  planOf,
  PORTRAIT,
  renderWordSong,
  say,
  type Line,
} from '../../../test/wordSongHarness'
import { introSpotlight } from './introSpotlight'

// The six new clips (mat, bat, can, cap, dad, jam) are measured at their
// render; until then a fixture stands in. A measured entry wins.
jest.mock('../../audio/blendMarks.generated', () => {
  const actual = jest.requireActual<{
    BLEND_MARKS: Record<string, unknown>
  }>('../../audio/blendMarks.generated')
  const fixture = (bytes: number) => ({
    bytes,
    sha256: 'fixture',
    segments: [
      [60, 420],
      [940, 1210],
      [1660, 1930],
      [2650, 3150],
    ],
  })
  return {
    BLEND_MARKS: {
      'm - a - t ... mat': fixture(31_001),
      'b - a - t ... bat': fixture(31_002),
      'c - a - n ... can': fixture(31_003),
      'c - a - p ... cap': fixture(31_004),
      'd - a - d ... dad': fixture(31_005),
      'j - a - m ... jam': fixture(31_006),
      ...actual.BLEND_MARKS,
    },
  }
})

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

type Stem = 'blending-cv' | 'sounding-out'
const STOP_1_INTRO = 'guide.session.intro.blending-cv' as const
const STOP_2_INTRO = 'guide.session.intro.sounding-out' as const

/** A forward session of `stem` from its committed canon, read as the app reads it. */
function forward(stem: Stem): WordSongSessionPlan {
  const canon = JSON.parse(
    readFileSync(
      join(
        REPO_ROOT,
        'public',
        'canon',
        'word-song',
        'level-1',
        `${stem}.json`,
      ),
      'utf8',
    ),
  ) as { plan: { id: string; label: string; utterances: unknown[] } }
  return wordSongRoundFromServer(canon.plan, {
    planKind: { kind: 'forward', warmup: [] },
    intro: `guide.session.intro.${stem}`,
    focusNode: stem,
  }).plan
}

/** `plan` from its problem `from` (0-based) on, with no lead. */
const fromProblem = (plan: WordSongSessionPlan, from: number) => ({
  ...plan,
  problems: plan.problems.slice(from),
})

const FAN = 'f - a - n ... fan'
const MAT = 'm - a - t ... mat'
const segs = (text: string) => BLEND_MARKS[text]!.segments
/** Letter k's mark: it lights 40 ms before its sound. */
const on = (text: string, k: number) => segs(text)[k]![0] - 40
/** The cut: the end of the 3rd sound + 80 ms (§ 4, § 8 `soundsCutMs`). */
const cut = (text: string) => segs(text)[2]![1] + 80

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

type Harness = Awaited<ReturnType<typeof renderWordSong>>

/** The indexes of the lit cells (a tap's light, the blend, a spotlight). */
function lit(): number[] {
  return screen
    .getAllByTestId(/^word-song-letter-\d$/)
    .map((_, i) => i)
    .filter(
      (i) =>
        within(screen.getByTestId(`word-song-letter-${i}`)).queryByTestId(
          'word-song-letter-lit',
        ) !== null,
    )
}

const chip = (word: string) => screen.getByTestId(`word-song-chip-${word}`)
const closed = (word: string) =>
  chip(word).props.accessibilityState?.disabled === true
const chipWords = () =>
  screen
    .getAllByTestId(/^word-song-chip-/)
    .map((c) => String(c.props.testID).replace('word-song-chip-', ''))
    .filter((w) => !w.startsWith('text'))
const allClosed = () => chipWords().every(closed)
const glowing = (word: string) =>
  String(StyleSheet.flatten(chip(word).props.style)?.boxShadow ?? '').includes(
    'rgba(255, 214, 92',
  )
const picture = () => screen.queryByTestId('word-song-word-picture')
const slot = () => screen.getByTestId('word-song-picture-slot')
/** The ribbon's words, all of them (revealed or not yet). */
function caption(): string {
  const ribbon = screen.queryByTestId('word-song-ribbon')
  if (ribbon === null) return ''
  return within(ribbon)
    .queryAllByTestId(/^caption-word-/)
    .map((w) => String(w.props.children))
    .join(' ')
}
const revealed = () =>
  within(screen.getByTestId('word-song-ribbon'))
    .queryAllByTestId('caption-word-revealed')
    .map((w) => String(w.props.children))
    .join(' ')

const last = (h: Harness): Line => h.voice.lines.at(-1)!

/** A chip on screen that is not `word`. */
const wrongOf = (word: string) => chipWords().find((w) => w !== word)!

/** A wrong tap and its re-prompt, to its end. */
async function wrongTap(h: Harness, word: string) {
  await fireEvent.press(chip(wrongOf(word)))
  await flush()
  const reprompt = last(h)
  expect(reprompt.text).toBe('Hmm... try again?')
  await say(reprompt)
}

/** The read is in flight: it ends, then the right chip, "Yes!", the advance. */
async function answerRight(h: Harness, word: string) {
  await say(last(h))
  await fireEvent.press(chip(word))
  await flush()
  await say(last(h))
  await advance(ADVANCE_AFTER_CORRECT_MS)
}

describe('stop 1, blending sounds: the read (AC 12)', () => {
  it('lead, 400 ms, "Listen.", 300 ms, then the sounds to the cut: held lights, the sounds caption, chips closed, no picture', async () => {
    const plan = forward('blending-cv')
    expect(plan.problems.map((p) => p.contentType)).toEqual(
      Array(8).fill('listen-blend'),
    )
    const guide = fakeGuide()
    const h = await renderWordSong({
      plan,
      clipFor: canonClips,
      sessionIntro: STOP_1_INTRO,
      sessionGuide: guide.player,
    })
    expect(guide.lines.map((l) => l.id)).toEqual([STOP_1_INTRO])
    expect(h.voice.lines).toHaveLength(0)
    // The card: the letters and the empty slot, no picture.
    expect(slot()).toBeOnTheScreen()
    expect(picture()).toBeNull()
    await startGuide(guide.lines[0]!)
    // Stop 1's lead lights nothing (AC 15).
    expect(lit()).toEqual([])
    await endGuide(guide.lines[0]!)
    await advance(399)
    expect(h.voice.lines).toHaveLength(0)
    await advance(1)
    expect(h.voice.texts()).toEqual(['Listen.'])
    expect(h.poses.at(-1)).toBe('listening')
    expect(allClosed()).toBe(true)
    await say(last(h))
    expect(allClosed()).toBe(true)
    await advance(299)
    expect(h.voice.lines).toHaveLength(1)
    expect(allClosed()).toBe(true)
    await advance(1)

    const sounds = last(h)
    expect(sounds.text).toBe(FAN)
    expect(sounds.opts.endAtMs).toBe(cut(FAN))
    expect(h.poses.at(-1)).toBe('attentive-pointing')
    // The ribbon shows the sounds, never the word.
    expect(caption()).toBe('f - a - n')
    await say(sounds, { end: false, ms: [on(FAN, 0) - 1] })
    expect(lit()).toEqual([])
    await say(sounds, { end: false, ms: [on(FAN, 0)] })
    expect(lit()).toEqual([0])
    expect(revealed()).toBe('f')
    await say(sounds, { end: false, ms: [on(FAN, 1)] })
    expect(lit()).toEqual([0, 1])
    expect(revealed()).toBe('f - a')
    await say(sounds, { end: false, ms: [on(FAN, 2), cut(FAN) - 1] })
    expect(lit()).toEqual([0, 1, 2])
    expect(revealed()).toBe('f - a - n')
    expect(allClosed()).toBe(true)
    expect(picture()).toBeNull()
    // The cut ends the line: dark, the chips open.
    await say(sounds, { end: false, ms: [cut(FAN)] })
    expect(lit()).toEqual([])
    expect(caption()).toBe('f - a - n')
    expect(caption()).not.toContain('fan')
    expect(allClosed()).toBe(false)
    expect(picture()).toBeNull()
    expect(h.voice.lines).toHaveLength(2)
  })
})

describe('stop 1, blending sounds: wrong twice, then right (AC 13)', () => {
  it('the reprompt, 600 ms, the whole clip one letter at a time; the right tap mounts the picture and lights all three', async () => {
    const plan = forward('blending-cv')
    const h = await renderWordSong({ plan, clipFor: canonClips })
    await say(last(h))
    await advance(300)
    await say(last(h), { end: false, ms: [cut(FAN)] })
    expect(allClosed()).toBe(false)
    const slotStyle = StyleSheet.flatten(slot().props.style)
    const P = wordSongLayout(PORTRAIT).picture
    expect(slotStyle).toMatchObject({ width: P, height: P })

    await wrongTap(h, 'fan')
    await wrongTap(h, 'fan')
    await advance(HINT_DELAY_AFTER_WRONG_MS - 1)
    expect(last(h).text).toBe('Hmm... try again?')
    await advance(1)
    const blend = last(h)
    expect(blend.text).toBe(FAN)
    expect(blend.opts.endAtMs).toBeUndefined()
    expect(h.poses.at(-1)).toBe('attentive-pointing')
    await say(blend, { end: false, ms: [on(FAN, 1) - 1] })
    expect(lit()).toEqual([0])
    await say(blend, { end: false, ms: [on(FAN, 1)] })
    expect(lit()).toEqual([1])
    await say(blend, { end: false, ms: [on(FAN, 2), on(FAN, 3)] })
    expect(lit()).toEqual([0, 1, 2])
    // The whole clip's caption ends on the word: the answer is being given.
    await say(blend)
    expect(caption()).toBe(FAN)
    expect(lit()).toEqual([])

    await fireEvent.press(chip('fan'))
    await flush()
    expect(last(h).text).toBe("Yes! That's a fan.")
    expect(picture()).toBeOnTheScreen()
    // The picture mounts in its slot; the slot keeps its P × P, so the row
    // below it does not move.
    expect(within(slot()).getByTestId('word-song-word-picture')).toBeTruthy()
    expect(StyleSheet.flatten(slot().props.style)).toEqual(slotStyle)
    expect(lit()).toEqual([0, 1, 2])
    // The revealed picture is inert (Decision 7).
    await fireEvent.press(screen.getByTestId('word-song-word-picture'))
    expect(h.tap.calls).toHaveLength(0)
    await say(last(h))
    expect(lit()).toEqual([0, 1, 2])
    await advance(ADVANCE_AFTER_CORRECT_MS)
    // Problem 2: the slot is empty again.
    expect(picture()).toBeNull()
    expect(last(h).text).toBe('Listen.')
  })
})

describe('stop 2, sounding out: P3, mat (AC 14)', () => {
  const plan = () => fromProblem(forward('sounding-out'), 2)

  it('"What is it?" with no lead, the chips open at its end; a letter tap plays its own sound, inert while a line plays', async () => {
    const p = plan()
    expect(p.problems[0]!.contentType).toBe('sound-out')
    expect(p.problems[0]!.target.word).toBe('mat')
    const guide = fakeGuide()
    const h = await renderWordSong({
      plan: p,
      clipFor: canonClips,
      sessionGuide: guide.player,
    })
    expect(guide.lines).toHaveLength(0)
    expect(h.voice.texts()).toEqual(['What is it?'])
    expect(allClosed()).toBe(true)
    expect(picture()).toBeNull()
    await fireEvent.press(screen.getByTestId('word-song-letter-0'))
    expect(h.tap.calls).toHaveLength(0)
    await say(last(h))
    expect(allClosed()).toBe(false)
    await fireEvent.press(screen.getByTestId('word-song-letter-0'))
    expect(h.tap.calls).toEqual([
      {
        uri: canonClips(MAT)!.uri,
        from: segs(MAT)[0]![0] - 30,
        to: segs(MAT)[0]![1] + 80,
      },
    ])
    expect(lit()).toEqual([0])
    // Not a move: nothing said, nothing recorded.
    expect(h.voice.texts()).toEqual(['What is it?'])
  })

  it('the 2nd wrong plays the sounds cut before the word, lights held, the caption "m - a - t"', async () => {
    const h = await renderWordSong({ plan: plan(), clipFor: canonClips })
    await say(last(h))
    await wrongTap(h, 'mat')
    await wrongTap(h, 'mat')
    await advance(HINT_DELAY_AFTER_WRONG_MS)
    const sounds = last(h)
    expect(sounds.text).toBe(MAT)
    expect(sounds.opts.endAtMs).toBe(cut(MAT))
    expect(caption()).toBe('m - a - t')
    expect(h.poses.at(-1)).toBe('attentive-pointing')
    await say(sounds, { end: false, ms: [on(MAT, 0), on(MAT, 1)] })
    expect(lit()).toEqual([0, 1])
    await say(sounds, { end: false, ms: [on(MAT, 2)] })
    expect(lit()).toEqual([0, 1, 2])
    expect(revealed()).toBe('m - a - t')
    await say(sounds, { end: false, ms: [cut(MAT)] })
    expect(lit()).toEqual([])
    expect(caption()).toBe('m - a - t')
    expect(picture()).toBeNull()
  })

  it('the 3rd wrong: the whole clip, one letter at a time, nothing answers and no glow; then "This one is mat." with the glow; the guided tap reveals and is not counted', async () => {
    const p = plan()
    const h = await renderWordSong({ plan: p, clipFor: canonClips })
    await say(last(h))
    await wrongTap(h, 'mat')
    await wrongTap(h, 'mat')
    await advance(HINT_DELAY_AFTER_WRONG_MS)
    await say(last(h), { end: false, ms: [cut(MAT)] })

    await fireEvent.press(chip(wrongOf('mat')))
    await flush()
    const reprompt = last(h)
    expect(reprompt.text).toBe('Hmm... try again?')
    await say(reprompt)
    // No 600 ms wait: the clip starts when the reprompt ends.
    const clip = last(h)
    expect(clip.text).toBe(MAT)
    expect(clip.opts.endAtMs).toBeUndefined()
    expect(h.poses.at(-1)).toBe('attentive-pointing')
    expect(allClosed()).toBe(true)
    expect(glowing('mat')).toBe(false)
    // Nothing answers during the clip: no chip, no letter.
    await fireEvent.press(chip('mat'))
    await fireEvent.press(screen.getByTestId('word-song-letter-1'))
    await flush()
    expect(last(h)).toBe(clip)
    expect(h.tap.calls).toHaveLength(0)
    expect(picture()).toBeNull()

    await say(clip, { end: false, ms: [on(MAT, 0)] })
    expect(lit()).toEqual([0])
    await say(clip, { end: false, ms: [on(MAT, 1)] })
    expect(lit()).toEqual([1])
    await say(clip, { end: false, ms: [on(MAT, 3)] })
    expect(lit()).toEqual([0, 1, 2])
    expect(glowing('mat')).toBe(false)
    await say(clip)
    expect(caption()).toBe(MAT)

    const answer = last(h)
    expect(answer.text).toBe('This one is mat.')
    expect(glowing('mat')).toBe(true)
    expect(closed('mat')).toBe(false)
    expect(closed(wrongOf('mat'))).toBe(true)
    await say(answer)
    await fireEvent.press(chip('mat'))
    await flush()
    expect(last(h).text).toBe("Yes! That's a mat.")
    expect(picture()).toBeOnTheScreen()
    expect(lit()).toEqual([0, 1, 2])
    await say(last(h))
    await advance(ADVANCE_AFTER_CORRECT_MS)

    for (const problem of p.problems.slice(1)) {
      await answerRight(h, problem.target.word)
    }
    expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
    const result = h.onSessionComplete.mock.calls[0]![0]
    expect(result.perProblemCorrect).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
    ])
    expect(result.firstTapCorrect[0]).toBe(false)
  })
})

describe('leads (AC 15)', () => {
  it("sounding out's lead lights the cells left to right, 150 ms apart; at once with Reduce Motion", () => {
    expect(introSpotlight(STOP_2_INTRO, 'fan', false)).toEqual([0, 150, 300])
    expect(introSpotlight(STOP_2_INTRO, 'fan', true)).toEqual([0, 0, 0])
    expect(introSpotlight(STOP_1_INTRO, 'fan', false)).toBeNull()
  })

  it('stop 2\'s P1 lead lights the three cells with the pulse, dark 200 ms after it ends, then "What is it?"', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming')
    const guide = fakeGuide()
    const h = await renderWordSong({
      plan: forward('sounding-out'),
      clipFor: canonClips,
      sessionIntro: STOP_2_INTRO,
      sessionGuide: guide.player,
    })
    expect(guide.lines.map((l) => l.id)).toEqual([STOP_2_INTRO])
    timing.mockClear()
    await startGuide(guide.lines[0]!)
    expect(lit()).toEqual([0, 1, 2])
    // The lit pulse (1 → 1.2 → 1, 2 × 200 ms).
    expect(
      timing.mock.calls.map(([to, c]) => [to, c?.duration]),
    ).toContainEqual([1.2, 200])
    expect(h.voice.lines).toHaveLength(0)
    await endGuide(guide.lines[0]!)
    await advance(199)
    expect(lit()).toEqual([0, 1, 2])
    await advance(1)
    expect(lit()).toEqual([])
    await advance(199)
    expect(h.voice.texts()).toEqual(['What is it?'])
  })

  it('Reduce Motion: the lead lights them at once, with no pulse', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    const timing = jest.spyOn(Reanimated, 'withTiming')
    const guide = fakeGuide()
    await renderWordSong({
      plan: forward('sounding-out'),
      sessionIntro: STOP_2_INTRO,
      sessionGuide: guide.player,
    })
    timing.mockClear()
    await startGuide(guide.lines[0]!)
    expect(lit()).toEqual([0, 1, 2])
    expect(
      timing.mock.calls.map(([to, c]) => [to, c?.duration]),
    ).not.toContainEqual([1.2, 200])
  })

  it('no lead on P2–P8', async () => {
    const plan = forward('sounding-out')
    const guide = fakeGuide()
    const h = await renderWordSong({
      plan,
      clipFor: canonClips,
      sessionIntro: STOP_2_INTRO,
      sessionGuide: guide.player,
    })
    await endGuide(guide.lines[0]!)
    await advance(400)
    for (const problem of plan.problems) {
      expect(last(h).text).toBe('What is it?')
      await answerRight(h, problem.target.word)
    }
    expect(guide.lines.map((l) => l.id)).toEqual([STOP_2_INTRO])
    expect(h.onSessionComplete).toHaveBeenCalledTimes(1)
  })

  it('a review, a peek, a replay and a warm-up heart play no step lead', async () => {
    const plan = forward('sounding-out')
    const three = { ...plan, problems: plan.problems.slice(0, 3) }
    const cases: [Parameters<typeof renderWordSong>[0], SessionGuideLineId][] =
      [
        [{ plan, review: true }, 'guide.session.review'],
        [
          { plan: three, peek: 'sounding-out' },
          'guide.session.peek-open.sounding-out',
        ],
        [
          { plan, peek: 'sounding-out', replay: true },
          'guide.session.replay-open.sounding-out',
        ],
      ]
    for (const [props, opener] of cases) {
      const guide = fakeGuide()
      const h = await renderWordSong({
        ...props,
        sessionIntro: STOP_2_INTRO,
        sessionGuide: guide.player,
      })
      expect(guide.lines.map((l) => l.id)).toEqual([opener])
      await h.unmount()
    }
    const warm: WordSongSessionPlan = {
      ...plan,
      problems: [
        { ...plan.problems[6]!, index: 1 },
        { ...plan.problems[7]!, index: 2 },
        ...plan.problems,
      ],
    }
    const guide = fakeGuide()
    const h = await renderWordSong({
      plan: warm,
      warmupCount: 2,
      sessionIntro: STOP_2_INTRO,
      sessionGuide: guide.player,
    })
    expect(guide.lines.map((l) => l.id)).toEqual(['guide.session.warmup'])
    await startGuide(guide.lines[0]!)
    expect(lit()).toEqual([])
    await h.unmount()
  })
})

describe('without marks (AC 16)', () => {
  it('stop 1: "Listen.", then the hint in place of the sounds, then the chips open', async () => {
    const h = await renderWordSong({ plan: forward('blending-cv') })
    expect(h.voice.texts()).toEqual(['Listen.'])
    await say(last(h))
    await advance(300)
    expect(h.voice.texts()).toEqual(['Listen.', "Let's look. Fan."])
    expect(allClosed()).toBe(true)
    await say(last(h))
    expect(allClosed()).toBe(false)
    expect(picture()).toBeNull()
  })

  it('stop 2: the 2nd wrong plays the hint, the 3rd "This one is mat." alone; letter taps only light', async () => {
    const h = await renderWordSong({
      plan: fromProblem(forward('sounding-out'), 2),
    })
    await say(last(h))
    await fireEvent.press(screen.getByTestId('word-song-letter-2'))
    expect(h.tap.calls).toHaveLength(0)
    expect(lit()).toEqual([2])
    await wrongTap(h, 'mat')
    await wrongTap(h, 'mat')
    await advance(HINT_DELAY_AFTER_WRONG_MS)
    expect(last(h).text).toBe("Let's look. Mat.")
    await say(last(h))
    await fireEvent.press(chip(wrongOf('mat')))
    await flush()
    await say(last(h))
    expect(last(h).text).toBe('This one is mat.')
    expect(glowing('mat')).toBe(true)
    expect(h.voice.texts()).not.toContain(MAT)
  })

  it('a review mixing a stop-1, a stop-2 and a cvc-words block plays each in its own beats', async () => {
    const stop1 = forward('blending-cv').problems[0]!
    const stop2 = forward('sounding-out').problems[2]!
    const cvc = planOf('cvc-word', ['cat']).problems[0]!
    const plan: WordSongSessionPlan = {
      id: 'review',
      label: 'review',
      problems: [
        { ...stop1, index: 1 },
        { ...stop2, index: 2 },
        { ...cvc, index: 3 },
      ],
    }
    const guide = fakeGuide()
    const h = await renderWordSong({
      plan,
      review: true,
      clipFor: canonClips,
      sessionIntro: STOP_1_INTRO,
      sessionGuide: guide.player,
    })
    expect(guide.lines.map((l) => l.id)).toEqual(['guide.session.review'])
    await endGuide(guide.lines[0]!)
    await advance(400)
    // Stop 1: "Listen.", 300 ms, the sounds to the cut.
    expect(last(h).text).toBe('Listen.')
    await say(last(h))
    await advance(300)
    expect(last(h).text).toBe(FAN)
    expect(last(h).opts.endAtMs).toBe(cut(FAN))
    await say(last(h), { end: false, ms: [cut(FAN)] })
    await fireEvent.press(chip('fan'))
    await flush()
    await say(last(h))
    await advance(ADVANCE_AFTER_CORRECT_MS)
    // Stop 2: "What is it?", the picture hidden.
    expect(last(h).text).toBe('What is it?')
    expect(picture()).toBeNull()
    await answerRight(h, 'mat')
    // cvc-words: the picture shows, the silent beat, "Read the cat."
    expect(picture()).toBeOnTheScreen()
    expect(last(h).text).toBe("Yes! That's a mat.")
    await advance(SILENT_TEXT_WINDOW_MS)
    expect(last(h).text).toBe('Read the cat.')
    expect(guide.lines).toHaveLength(1)
  })
})

describe('Reduce Motion (AC 17)', () => {
  /** [to, duration] of every timing scheduled after `fn`. */
  async function scheduledBy(fn: () => Promise<void>) {
    const timing = jest.spyOn(Reanimated, 'withTiming')
    const spring = jest.spyOn(Reanimated, 'withSpring')
    timing.mockClear()
    spring.mockClear()
    await fn()
    return {
      timings: timing.mock.calls.map(([to, c]) => [to, c?.duration]),
      springs: spring.mock.calls.map(([to, c]) => [to, c?.stiffness]),
    }
  }

  async function toRightTap(): Promise<Harness> {
    const h = await renderWordSong({
      plan: fromProblem(forward('sounding-out'), 2),
      clipFor: canonClips,
    })
    await say(last(h))
    return h
  }

  it('full motion: the picture springs in (260 / 16) and fades over 150 ms; the letters pulse', async () => {
    await toRightTap()
    const s = await scheduledBy(async () => {
      await fireEvent.press(chip('mat'))
      await flush()
    })
    expect(picture()).toBeOnTheScreen()
    expect(s.springs).toContainEqual([1, 260])
    expect(s.timings).toContainEqual([1, 150])
    expect(s.timings).toContainEqual([1.2, 200])
  })

  it('Reduce Motion: the picture fades in over 200 ms with no scale, and the lights have no pulse', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    await toRightTap()
    const s = await scheduledBy(async () => {
      await fireEvent.press(chip('mat'))
      await flush()
    })
    expect(picture()).toBeOnTheScreen()
    expect(lit()).toEqual([0, 1, 2])
    expect(s.timings).toContainEqual([1, 200])
    expect(s.springs).not.toContainEqual([1, 260])
    expect(s.timings).not.toContainEqual([1.2, 200])
  })
})
