/**
 * Word Song's contract (web `src/screens/WordSong/WordSong.tsx` + the
 * native spec), driven through a fake of Emma's voice. Silent.
 */
import {
  ADVANCE_AFTER_CORRECT_MS,
  HINT_DELAY_AFTER_WRONG_MS,
} from '@marian/core/shared/gameplayConstants'
import { act, fireEvent, screen } from '@testing-library/react-native'
import { BackHandler } from 'react-native'
import {
  advance,
  BLENDING,
  flush,
  planOf,
  renderWordSong,
  say,
} from '../../../test/wordSongHarness'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const chip = (word: string) => screen.getByTestId(`word-song-chip-${word}`)
const disabled = (word: string) =>
  chip(word).props.accessibilityState?.disabled === true
const wrongOf = (target: string) =>
  screen
    .getAllByTestId(/^word-song-chip-/)
    .map((c) => String(c.props.testID).replace('word-song-chip-', ''))
    .find((w) => w !== target)!

it('waits for the session start: getting ready, Emma listening, nothing read', async () => {
  const r = await renderWordSong({ audioReady: false })
  expect(screen.getByTestId('word-song-getting-ready')).toBeOnTheScreen()
  expect(screen.queryByTestId('word-song-chips')).toBeNull()
  expect(r.voice.lines).toHaveLength(0)
  expect(r.poses.at(-1)).toBe('listening')
})

it('reads problem 1 at once (blending-cv); the chips answer only after the read ENDS', async () => {
  const r = await renderWordSong()
  expect(r.voice.texts()).toEqual(['Tap the cat.'])
  expect(r.poses.at(-1)).toBe('listening')
  await say(r.voice.lines[0]!, { end: false })
  expect(disabled('cat')).toBe(true)
  await fireEvent.press(chip('cat'))
  expect(r.sfx.sparkle.play).not.toHaveBeenCalled()
  await act(async () => r.voice.lines[0]!.resolve())
  await flush()
  expect(disabled('cat')).toBe(false)
  expect(r.poses.at(-1)).toBe('idle')
})

it('right: sparkle + plink, celebration, "Yes!", then the next problem; no stardust', async () => {
  const r = await renderWordSong()
  await say(r.voice.lines[0]!)
  await fireEvent.press(chip('cat'))
  expect(r.sfx.sparkle.play).toHaveBeenCalledTimes(1)
  expect(r.sfx.plink.play).toHaveBeenCalledTimes(1)
  expect(r.poses).toContain('celebration')
  expect(r.voice.texts().at(-1)).toBe('Yes! Cat.')
  expect(screen.getByTestId('word-song-sparkle-burst')).toBeOnTheScreen()
  await say(r.voice.lines.at(-1)!)
  await advance(ADVANCE_AFTER_CORRECT_MS)
  expect(r.voice.texts().at(-1)).toBe('Tap the bag.')
  expect(
    screen.getByTestId('word-song-stardust').props.accessibilityLabel,
  ).toBe('Stardust: 0')
})

it('wrong: poof, shake, puzzled-tilt, "try again?"; 2nd: the hint 600 ms after; 3rd: the answer, only its chip', async () => {
  const r = await renderWordSong()
  await say(r.voice.lines[0]!)
  const wrong = wrongOf('cat')
  await fireEvent.press(chip(wrong))
  expect(r.sfx.poof.play).toHaveBeenCalledTimes(1)
  expect(r.poses).toContain('puzzled-tilt')
  expect(r.voice.texts().at(-1)).toBe('Hmm... try again?')
  await say(r.voice.lines.at(-1)!)
  await fireEvent.press(chip(wrong))
  await say(r.voice.lines.at(-1)!)
  await advance(HINT_DELAY_AFTER_WRONG_MS - 1)
  expect(r.voice.texts().at(-1)).toBe('Hmm... try again?')
  await advance(1)
  // blending-cv has no blend: the hint line (graceful skip).
  expect(r.voice.texts().at(-1)).toBe("Let's look. Cat.")
  expect(r.poses.at(-1)).toBe('attentive-pointing')
  await say(r.voice.lines.at(-1)!)
  await fireEvent.press(chip(wrong))
  await say(r.voice.lines.at(-1)!)
  expect(r.voice.texts().at(-1)).toBe('This one is cat.')
  expect(disabled(wrong)).toBe(true)
  expect(disabled('cat')).toBe(false)
})

it('two quick wrong taps: the second still gets its blend or hint', async () => {
  const r = await renderWordSong()
  await say(r.voice.lines[0]!)
  const wrong = wrongOf('cat')
  await fireEvent.press(chip(wrong))
  const first = r.voice.lines.at(-1)!
  await fireEvent.press(chip(wrong)) // cuts the first re-prompt
  await act(async () => first.resolve())
  await say(r.voice.lines.at(-1)!)
  await advance(HINT_DELAY_AFTER_WRONG_MS)
  expect(r.voice.texts().at(-1)).toBe("Let's look. Cat.")
})

it('a right answer during the re-prompt schedules no hint over "Yes!"', async () => {
  const r = await renderWordSong()
  await say(r.voice.lines[0]!)
  const wrong = wrongOf('cat')
  await fireEvent.press(chip(wrong))
  await say(r.voice.lines.at(-1)!)
  await fireEvent.press(chip(wrong))
  const reprompt = r.voice.lines.at(-1)!
  await fireEvent.press(chip('cat'))
  await act(async () => reprompt.resolve())
  await advance(HINT_DELAY_AFTER_WRONG_MS + 100)
  expect(r.voice.texts()).not.toContain("Let's look. Cat.")
})

it('8 problems → the result: ever-correct, target words, first-tap words', async () => {
  const r = await renderWordSong()
  for (let i = 0; i < 8; i++) {
    const p = BLENDING.problems[i]!
    await say(r.voice.lines.at(-1)!)
    if (i === 0) {
      await fireEvent.press(chip(wrongOf(p.target.word)))
      await say(r.voice.lines.at(-1)!)
    }
    await fireEvent.press(chip(p.target.word))
    await say(r.voice.lines.at(-1)!)
    await advance(ADVANCE_AFTER_CORRECT_MS)
  }
  expect(r.onSessionComplete).toHaveBeenCalledTimes(1)
  const result = r.onSessionComplete.mock.calls[0]![0]
  expect(result).toMatchObject({
    surface: 'word-song',
    earnedThisSession: 0,
    totalCorrect: 8,
    finalStreak: 7,
    targetWords: BLENDING.problems.map((p) => p.target.word),
    perProblemCorrect: Array(8).fill(true),
  })
  expect(result.perProblemAnswerWord[0]).not.toBe('cat')
  expect(result.perProblemAnswerWord.slice(1)).toEqual(
    BLENDING.problems.slice(1).map((p) => p.target.word),
  )
})

it('the back arrow and Android back: silence, then the Hub', async () => {
  const add = jest.spyOn(BackHandler, 'addEventListener')
  const r = await renderWordSong()
  await fireEvent.press(screen.getByTestId('word-song-back-to-hub'))
  expect(r.cancelLine).toHaveBeenCalledTimes(1)
  expect(r.onRequestExit).toHaveBeenCalledTimes(1)
  const back = add.mock.calls.find(
    ([e]) => e === 'hardwareBackPress',
  )![1] as unknown as () => boolean | null | undefined
  let handled: boolean | null | undefined
  await act(async () => {
    handled = back()
  })
  expect(handled).toBe(true)
  expect(r.cancelLine).toHaveBeenCalledTimes(2)
  expect(r.onRequestExit).toHaveBeenCalledTimes(2)
  add.mockRestore()
})

it('a ch / sh / th word draws as a written-word problem (no pictures)', async () => {
  await renderWordSong({ plan: planOf('blending-cv', ['ship', 'cat', 'bag']) })
  expect(screen.getByTestId('word-song-letters-card')).toBeOnTheScreen()
  expect(screen.queryByTestId('word-song-word-picture')).toBeNull()
  expect(
    screen.getAllByTestId('word-song-chip-text-written-word'),
  ).toHaveLength(3)
  expect(chip('ship').props.accessibilityLabel).toBe('Word ship')
})

it('a probe word (nap) shows its baked picture', async () => {
  await renderWordSong({ plan: planOf('blending-cv', ['nap', 'cat', 'bag']) })
  expect(screen.getByTestId('word-song-word-picture')).toBeOnTheScreen()
  // The card and its chip.
  expect(screen.getAllByTestId('word-picture-nap')).toHaveLength(2)
})
