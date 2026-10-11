/**
 * The ribbon's fixed slot (`maxLines`, Word Song: word-song-native.md
 * § 3): a long line never grows the ribbon; the text slides up so the
 * newest revealed word sits on the slot's last line.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { CaptionRibbon } from './CaptionRibbon'

const LINE = 30
const TEXT = 'one two three four five six seven eight nine ten'

function ribbon(revealedCount: number, maxLines?: number) {
  return (
    <CaptionRibbon
      text={TEXT}
      revealedCount={revealedCount}
      lineKey="1"
      fontSize={22}
      lineHeight={LINE}
      padding={{ horizontal: 16, vertical: 10 }}
      maxLines={maxLines}
    />
  )
}

/** Two words per line: word i at y = floor(i / 2) × LINE. */
async function layOut() {
  const words = [
    ...screen.queryAllByTestId('caption-word-revealed'),
    ...screen.queryAllByTestId('caption-word-hidden'),
  ].sort(
    (a, b) => TEXT.indexOf(a.props.children) - TEXT.indexOf(b.props.children),
  )
  for (const [i, w] of words.entries()) {
    await act(async () => {
      fireEvent(w, 'layout', {
        nativeEvent: {
          layout: {
            x: 0,
            y: Math.floor(i / 2) * LINE,
            width: 40,
            height: LINE,
          },
        },
      })
    })
  }
}

/** Lines the text has slid up (the row's test ID). */
function linesUp(): number {
  const row = screen.getByTestId(/^caption-lines-up-/)
  return Number(String(row.props.testID).replace('caption-lines-up-', ''))
}

it('clips the text to the slot', async () => {
  await render(ribbon(1, 3))
  const clip = screen.getAllByTestId(/^caption-word-/)[0]!.parent!.parent!
  expect(StyleSheet.flatten(clip.props.style)).toMatchObject({
    maxHeight: 3 * LINE,
    overflow: 'hidden',
  })
})

it('slides up a line when the newest word passes the slot, never before', async () => {
  const r = await render(ribbon(5, 3))
  await layOut()
  await r.rerender(ribbon(6, 3)) // word 6 on line 3: still in the slot
  expect(linesUp()).toBe(0)
  await r.rerender(ribbon(7, 3)) // word 7 on line 4: one line up
  expect(linesUp()).toBe(1)
  await r.rerender(ribbon(10, 3)) // word 10 on line 5: two lines up
  expect(linesUp()).toBe(2)
})

it('without maxLines the ribbon grows and never scrolls', async () => {
  await render(ribbon(10))
  await layOut()
  expect(screen.queryByTestId(/^caption-lines-up-/)).toBeNull()
})
