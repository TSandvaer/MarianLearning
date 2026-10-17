/**
 * The story word-tap cue's hand (Kyle's call on PR #599): Greet's
 * finger-tap hand at size S (48 pt on phones, 64 on a tablet), its
 * fingertip (0.5 S, 0.28 S) on the press point, 2 pt above the
 * bottom-centre of word 0's text box. It mounts 8 pt low and rises, then
 * presses [Reduce Motion: at the point, no press]. The card's last child,
 * see-through to touch and to VoiceOver.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import * as Reanimated from 'react-native-reanimated'
import { ICON_SIZE } from '../greet/WakeNudgeIcon'
import { wordSongLayout } from '../../layout/wordSongLayout'
import { PORTRAIT } from '../../../test/wordSongHarness'
import { StoryCard } from './StoryCard'
import { StoryTapCue } from './StoryTapCue'
import {
  STORY_TAP_CUE_DELAY_MS,
  STORY_TAP_CUE_FIRE_MS,
  STORY_TAP_CUE_TOTAL_MS,
  storyTapCueMotion,
  storyTapCueSize,
} from './storyTapCueMotion'

type Node = ReturnType<typeof screen.getByTestId>
const style = (n: Node) => StyleSheet.flatten(n.props.style)
const HIDDEN = { includeHiddenElements: true } as const
const translateY = (n: Node) =>
  (style(n).transform as Record<string, number>[]).find(
    (t) => 'translateY' in t,
  )!.translateY

afterEach(() => jest.restoreAllMocks())

it('the timeline: the hand at beat + 600, the fire at + 1,000, gone at + 2,400', () => {
  expect(STORY_TAP_CUE_DELAY_MS).toBe(600)
  expect(STORY_TAP_CUE_DELAY_MS + STORY_TAP_CUE_FIRE_MS).toBe(1_000)
  expect(STORY_TAP_CUE_DELAY_MS + STORY_TAP_CUE_TOTAL_MS).toBe(2_400)
})

it("size S: 48 pt on phones, Greet's 64 on a tablet", () => {
  expect(storyTapCueSize(false)).toBe(48)
  expect(storyTapCueSize(true)).toBe(ICON_SIZE)
})

it('full motion rises 8 pt and presses; Reduce Motion does neither', () => {
  expect(storyTapCueMotion(false)).toEqual({ riseFrom: 8, press: true })
  expect(storyTapCueMotion(true)).toEqual({ riseFrom: 0, press: false })
})

it('mounts 8 pt below its point, see-through to touch and VoiceOver', async () => {
  await render(<StoryTapCue x={100} y={50} size={48} leaving={false} />)
  // Hidden from VoiceOver: the default query skips it.
  expect(screen.queryByTestId('word-story-tap-cue')).toBeNull()
  const hand = screen.getByTestId('word-story-tap-cue', HIDDEN)
  expect(hand.props.accessible).toBe(false)
  expect(hand.props.importantForAccessibility).toBe('no-hide-descendants')
  expect(hand.props.accessibilityElementsHidden).toBe(true)
  expect(style(hand)).toMatchObject({
    position: 'absolute',
    pointerEvents: 'none',
    left: 100 - 0.5 * 48,
    top: 50 - 0.28 * 48,
    width: 48,
    height: 48,
    opacity: 0,
  })
  expect(translateY(hand)).toBe(8)
})

it('Reduce Motion: mounts at its point', async () => {
  jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
  await render(<StoryTapCue x={100} y={50} size={48} leaving={false} />)
  expect(translateY(screen.getByTestId('word-story-tap-cue', HIDDEN))).toBe(0)
})

/** The [to, duration] of every timing the hand schedules. */
function timings() {
  const spy = jest.spyOn(Reanimated, 'withTiming')
  return () => spy.mock.calls.map(([to, cfg]) => [to, cfg?.duration])
}

it('full motion schedules the rise (to 0 over 300 ms) and the press (0.9 over 100, back over 150)', async () => {
  const calls = timings()
  await render(<StoryTapCue x={100} y={50} size={48} leaving={false} />)
  expect(calls()).toEqual(
    expect.arrayContaining([
      [1, 300],
      [0, 300],
      [0.9, 100],
      [1, 150],
      [0, 400],
    ]),
  )
})

it('Reduce Motion schedules the fades only: no rise, no press', async () => {
  jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
  const calls = timings()
  await render(<StoryTapCue x={100} y={50} size={48} leaving={false} />)
  expect(calls()).toContainEqual([1, 300])
  expect(calls()).toContainEqual([0, 400])
  expect(calls()).not.toContainEqual([0, 300])
  expect(calls()).not.toContainEqual([0.9, 100])
  expect(calls()).not.toContainEqual([1, 150])
})

it('her tap: the hand fades out over 200 ms', async () => {
  const calls = timings()
  await render(<StoryTapCue x={100} y={50} size={48} leaving={false} />)
  expect(calls()).not.toContainEqual([0, 200])
  await screen.rerender(<StoryTapCue x={100} y={50} size={48} leaving />)
  expect(calls()).toContainEqual([0, 200])
})

describe('on the story card', () => {
  const m = wordSongLayout(PORTRAIT).story
  const F = m.font

  async function card(props: { tapCue: boolean; measure: boolean }) {
    await render(
      <StoryCard
        story="The fox sat on a rug. The fox is red."
        metrics={m}
        x={0}
        y={0}
        lit={[]}
        pulses={{}}
        wordsEnabled
        onWordPress={() => {}}
        tapCue={props.tapCue}
        tapCueLeaving={false}
        tapCueSize={48}
      />,
    )
    if (props.measure)
      await fireEvent(screen.getByTestId('word-story-word-0'), 'layout', {
        nativeEvent: {
          layout: { x: 0, y: 0, width: 60, height: m.lineHeight },
        },
      })
  }

  it("is the card's last child, its fingertip 2 pt above the bottom-centre of word 0's text box", async () => {
    await card({ tapCue: true, measure: true })
    const hand = screen.getByTestId('word-story-tap-cue', HIDDEN)
    const kids = screen.getByTestId('word-story').children
    expect(kids.at(-1)).toBe(hand)
    // Card coordinates: Yoga measures absolute insets inside the border,
    // where the padding (and so row 0) starts.
    const pressX = m.padding.horizontal + 30
    const pressY = m.padding.vertical + (m.lineHeight + F + 8) / 2 - 2
    expect(style(hand).left).toBeCloseTo(pressX - 0.5 * 48)
    expect(style(hand).top).toBeCloseTo(pressY - 0.28 * 48)
    // Not inside the word's scaling view: it must not pulse with the word.
    let up = hand.parent
    while (up !== null && up.props.testID !== 'word-story') {
      expect(up.props.testID).not.toBe('word-story-word-0')
      up = up.parent
    }
  })

  it("waits for word 0's frame", async () => {
    await card({ tapCue: true, measure: false })
    expect(screen.getByTestId('word-story-word-0')).toBeOnTheScreen()
    expect(screen.queryByTestId('word-story-tap-cue', HIDDEN)).toBeNull()
  })

  it('no hand without the cue', async () => {
    await card({ tapCue: false, measure: true })
    expect(screen.getByTestId('word-story-word-0')).toBeOnTheScreen()
    expect(screen.queryByTestId('word-story-tap-cue', HIDDEN)).toBeNull()
  })
})
