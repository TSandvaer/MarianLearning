/**
 * The letter row (word-song-native.md § 3): a row wider than the stage
 * steps F down 4 pt at a time, never below 0.8 F; a new F (a rotation)
 * starts over. Letter presses report their index; the lit letter is
 * `selected`.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { LetterRow } from './LetterRow'

function row(font: number, onPress = jest.fn(), lit: number | null = null) {
  return (
    <LetterRow
      word="sheep"
      font={font}
      cellMin={48}
      maxWidth={343}
      lit={lit}
      onLetterPress={onPress}
    />
  )
}

const sizeNow = () =>
  StyleSheet.flatten(screen.getByText('s').props.style).fontSize as number

async function layout(width: number) {
  await act(async () => {
    fireEvent(screen.getByTestId('word-song-letters'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width, height: 88 } },
    })
  })
}

it('steps F down 4 at a time while the row is too wide, never below 0.8 F', async () => {
  await render(row(72))
  expect(sizeNow()).toBe(72)
  await layout(400)
  expect(sizeNow()).toBe(68)
  for (let i = 0; i < 10; i++) await layout(400)
  // 0.8 × 72 = 57.6: 60 is the last step.
  expect(sizeNow()).toBe(60)
  await layout(300)
  expect(sizeNow()).toBe(60)
})

it('a new F (rotation) starts over', async () => {
  const r = await render(row(72))
  await layout(400)
  expect(sizeNow()).toBe(68)
  await r.rerender(row(56))
  expect(sizeNow()).toBe(56)
})

it('reports presses; the lit letter is selected', async () => {
  const onPress = jest.fn()
  await render(row(72, onPress, 2))
  await fireEvent.press(screen.getByTestId('word-song-letter-3'))
  expect(onPress).toHaveBeenCalledWith(3)
  const selected = [0, 1, 2, 3, 4].filter(
    (i) =>
      screen.getByTestId(`word-song-letter-${i}`).props.accessibilityState
        ?.selected,
  )
  expect(selected).toEqual([2])
})
