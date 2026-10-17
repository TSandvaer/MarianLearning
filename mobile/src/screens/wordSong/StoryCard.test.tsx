/**
 * The story card's word boxes are the geometry `storyLineCount` models
 * (`design/native/content-wave-3.md` § 4.2, § 4.3): text + the 0.35 em gap,
 * and the spotlight's + 4 an overhang that takes no layout width, so the
 * line counts `wordSongLayout.test.ts` pins are the card's.
 */
import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import {
  STORY_SPOT_OVERHANG,
  STORY_WORD_GAP_EM,
  wordSongLayout,
} from '../../layout/wordSongLayout'
import { PORTRAIT } from '../../../test/wordSongHarness'
import { StoryCard } from './StoryCard'

type Node = ReturnType<typeof screen.getByTestId>
const style = (n: Node) => StyleSheet.flatten(n.props.style)

it('a word box is its text + the gap; the spotlight overhangs it by 2 each side', async () => {
  const m = wordSongLayout(PORTRAIT).story
  await render(
    <StoryCard
      story="The dog ran to the pond."
      metrics={m}
      x={0}
      y={0}
      lit={[1]}
      pulses={{}}
      wordsEnabled
      onWordPress={() => {}}
    />,
  )
  expect(style(screen.getByTestId('word-story-word-1'))).toMatchObject({
    paddingHorizontal: (STORY_WORD_GAP_EM / 2) * m.font,
  })
  const lit = screen.getByTestId('word-story-lit-1')
  expect(style(lit)).toMatchObject({
    position: 'absolute',
    left: -STORY_SPOT_OVERHANG,
    right: -STORY_SPOT_OVERHANG,
  })
  // The box the spotlight sits in hugs the word: no padding of its own.
  let box = lit.parent
  while (box !== null && typeof box.type !== 'string') box = box.parent
  const s = style(box!)
  expect(s.height).toBe(m.font + 8)
  for (const k of [
    'padding',
    'paddingHorizontal',
    'paddingLeft',
    'paddingRight',
  ])
    expect(s).not.toHaveProperty(k)
})
