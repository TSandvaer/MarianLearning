/**
 * The native Word Song calls (`design/native/word-song-native.md` § 4–§ 6):
 * the silent beat, letter and picture tap-to-hear, and the blend's
 * marks-driven highlight. Silent: the voice and the tap player are fakes.
 */
import { HINT_DELAY_AFTER_WRONG_MS } from '@marian/core/shared/gameplayConstants'
import { act, fireEvent, screen } from '@testing-library/react-native'
import { BLEND_MARKS } from '../../audio/blendMarks.generated'
import {
  advance,
  canonClips,
  planOf,
  renderWordSong,
  say,
} from '../../../test/wordSongHarness'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const CAT = 'c - a - t ... cat'
const SEGS = BLEND_MARKS[CAT]!.segments
const lit = () =>
  [0, 1, 2].filter(
    (i) =>
      screen.getByTestId(`word-song-letter-${i}`).props.accessibilityState
        ?.selected === true,
  )

it('cvc-word: the word shows, Emma waits 1.5 s, then reads', async () => {
  const r = await renderWordSong({
    plan: planOf('cvc-word'),
    clipFor: canonClips,
  })
  expect(screen.getByTestId('word-song-word-card')).toBeOnTheScreen()
  await advance(1499)
  expect(r.voice.lines).toHaveLength(0)
  await advance(1)
  expect(r.voice.texts()).toEqual(['Read the cat.'])
})

it('a letter tap plays its own sound, lit, and holds the read to 1 s after it', async () => {
  const r = await renderWordSong({
    plan: planOf('cvc-word'),
    clipFor: canonClips,
  })
  await advance(1200)
  await fireEvent.press(screen.getByTestId('word-song-letter-1'))
  expect(r.tap.calls).toEqual([
    { uri: canonClips(CAT)!.uri, from: SEGS[1]![0] - 30, to: SEGS[1]![1] + 80 },
  ])
  expect(lit()).toEqual([1])
  await advance(999)
  expect(r.voice.lines).toHaveLength(0)
  await advance(1)
  expect(r.voice.texts()).toEqual(['Read the cat.'])
  // Emma's line cut the tap sound and its light.
  expect(lit()).toEqual([])
})

it('letters are inert while Emma speaks; the picture only after the read', async () => {
  const r = await renderWordSong({
    plan: planOf('cvc-word'),
    clipFor: canonClips,
  })
  await advance(1500)
  await fireEvent.press(screen.getByTestId('word-song-word-picture'))
  await fireEvent.press(screen.getByTestId('word-song-letter-0'))
  expect(r.tap.calls).toHaveLength(0)
  await say(r.voice.lines[0]!)
  await fireEvent.press(screen.getByTestId('word-song-word-picture'))
  expect(r.tap.calls).toEqual([
    { uri: canonClips(CAT)!.uri, from: SEGS[3]![0] - 30, to: null },
  ])
  expect(lit()).toEqual([0, 1, 2])
  await act(async () => r.tap.end())
  expect(lit()).toEqual([])
  // No move: nothing recorded, Emma unmoved.
  expect(r.voice.texts()).toEqual(['Read the cat.'])
})

it('blending-cv: the picture replays the read line', async () => {
  const r = await renderWordSong()
  await say(r.voice.lines[0]!)
  await fireEvent.press(screen.getByTestId('word-song-word-picture'))
  expect(r.voice.texts()).toEqual(['Tap the cat.', 'Tap the cat.'])
  expect(r.tap.calls).toHaveLength(0)
})

it('the 2nd wrong: the blend lights each letter on its mark, all on the word, dark at the end', async () => {
  const r = await renderWordSong({
    plan: planOf('cvc-word'),
    clipFor: canonClips,
  })
  await advance(1500)
  await say(r.voice.lines[0]!)
  for (let i = 0; i < 2; i++) {
    await fireEvent.press(
      screen.getByTestId('word-song-chip-' + otherThan('cat')),
    )
    await say(r.voice.lines.at(-1)!)
  }
  await advance(HINT_DELAY_AFTER_WRONG_MS)
  const blend = r.voice.lines.at(-1)!
  expect(blend.text).toBe(CAT)
  expect(r.poses.at(-1)).toBe('attentive-pointing')
  const on = (k: number) => SEGS[k]![0] - 40
  const shown = () => screen.queryAllByTestId('caption-word-revealed').length
  await say(blend, { end: false, ms: [on(1) - 1] })
  expect(lit()).toEqual([0])
  // The caption follows the marks too: "c", then "c - a".
  expect(shown()).toBe(1)
  await say(blend, { end: false, ms: [on(1)] })
  expect(lit()).toEqual([1])
  expect(shown()).toBe(3)
  await say(blend, { end: false, ms: [on(2), on(3)] })
  expect(lit()).toEqual([0, 1, 2])
  await say(blend, { end: true })
  expect(lit()).toEqual([])
  expect(r.poses.at(-1)).toBe('idle')
})

it('a clip that is not the measured one falls back to the even ticks', async () => {
  const r = await renderWordSong({
    plan: planOf('cvc-word'),
    clipFor: (t) => ({
      uri: 'file:///x.mp3',
      bytes: (canonClips(t)?.bytes ?? 0) + 1,
    }),
  })
  await advance(1500)
  await say(r.voice.lines[0]!)
  for (let i = 0; i < 2; i++) {
    await fireEvent.press(
      screen.getByTestId('word-song-chip-' + otherThan('cat')),
    )
    await say(r.voice.lines.at(-1)!)
  }
  await advance(HINT_DELAY_AFTER_WRONG_MS)
  const blend = r.voice.lines.at(-1)!
  await say(blend, { end: false, ms: [SEGS[2]![0]] })
  // The clock does nothing without marks; the ticks lit up to the word.
  expect(lit()).toEqual([0, 1, 2])
  // A letter tap without marks pulses silently.
  await say(blend)
  await fireEvent.press(screen.getByTestId('word-song-letter-2'))
  expect(r.tap.calls).toHaveLength(0)
  expect(lit()).toEqual([2])
})

it('the silent beat pauses in the background and resumes with the time left', async () => {
  const r = await renderWordSong({
    plan: planOf('cvc-word'),
    clipFor: canonClips,
  })
  await advance(1000)
  await act(async () => r.vis.set(true))
  await advance(30_000)
  expect(r.voice.lines).toHaveLength(0)
  await act(async () => r.vis.set(false))
  await advance(499)
  expect(r.voice.lines).toHaveLength(0)
  await advance(1)
  expect(r.voice.texts()).toEqual(['Read the cat.'])
})

/** A chip on screen that is not `word`. */
function otherThan(word: string): string {
  return screen
    .getAllByTestId(/^word-song-chip-/)
    .map((c) => String(c.props.testID).replace('word-song-chip-', ''))
    .find((w) => !w.startsWith('text') && w !== word)!
}
