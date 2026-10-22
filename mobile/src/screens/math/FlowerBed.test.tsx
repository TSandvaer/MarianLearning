/**
 * The flower bed, its look (`design/native/mini-game-flower-bed.md` § 2.2,
 * "Soil beds") as amended for the lesson card
 * (`design/native/flower-bed-into-add-to-10.md` § 3, § 5, Dave's D1): brown
 * soil in a wood rim, one furrow between the rows, the given flowers each
 * planted in its hole, and the empty slots bare soil with no hole until the
 * hint or a landing bud opens it. Hint 1 ripples the planted flowers by row.
 * None of the progress trays' art (D7).
 */
import { act, render, screen, within } from '@testing-library/react-native'
import { processColor, StyleSheet } from 'react-native'
import * as Reanimated from 'react-native-reanimated'
import type { TestInstance } from 'test-renderer'
import { FlowerBed, ROW_RIPPLE_GAP_MS } from './FlowerBed'
import { FRAME_COLUMNS, FRAME_ROWS } from './tenFrame'

const HIDDEN = { includeHiddenElements: true }
/** 2 pt per unit: the 130-unit viewBox at 260 pt. */
const WIDTH = 260
const UNIT = WIDTH / 130

const slot = (i: number) => screen.getByTestId(`math-bed-slot-${i}`, HIDDEN)
const holeIn = (i: number) =>
  within(slot(i)).getByTestId(`math-bed-hole-${i}`, HIDDEN)
/** Slot i's hole, opened or not, whatever its suffix. */
const holesIn = (i: number) =>
  within(slot(i))
    .queryAllByTestId(new RegExp(`^math-bed-hole-${i}(-|$)`), HIDDEN)
    .map((n) => String(n.props.testID))
/** react-native-svg's host nodes of one kind, e.g. `RNSVGRect`. */
const svg = (kind: string, root: TestInstance = screen.root!) =>
  root.queryAll((n) => n.type === `RNSVG${kind}`)
/** A colour as react-native-svg hands it to the host. */
const paint = (hex: string) => ({ type: 0, payload: processColor(hex) })

it('§ 2.2: soil #7d4a26 in a 3-unit wood rim #c98a55, radius 8 (a planter, not the trays’ pill)', async () => {
  await render(<FlowerBed width={WIDTH} given={7} />)
  const frames = svg('Rect')
  expect(frames).toHaveLength(1)
  expect(frames[0]!.props).toMatchObject({
    x: 1.5,
    y: 1.5,
    width: 127,
    height: 57,
    rx: 8,
    ry: 8,
    fill: paint('#7d4a26'),
    stroke: paint('#c98a55'),
    strokeWidth: 3,
  })
})

it('§ 2.2: one furrow between the rows at y 30, and no vertical split (D6)', async () => {
  await render(<FlowerBed width={WIDTH} given={7} />)
  expect(svg('Line').map((l) => l.props)).toEqual([
    expect.objectContaining({
      x1: 8,
      y1: 30,
      x2: 122,
      y2: 30,
      stroke: paint('#3d2112'),
      strokeWidth: 2,
      strokeLinecap: 1, // round
    }),
  ])
})

it.each([0, 7, 10])(
  'D1: given %i, the strict 2 × 5 grid; a flat hole under each given flower, the empty slots bare soil',
  async (given) => {
    await render(<FlowerBed width={WIDTH} given={given} />)
    for (let i = 0; i < 10; i++) {
      const box = StyleSheet.flatten(slot(i).props.style)
      // The ten-frame's slot centres, top row first.
      expect(box.left + box.width / 2).toBe(FRAME_COLUMNS[i % 5]! * UNIT)
      expect(box.top + box.height / 2).toBe(
        FRAME_ROWS[Math.floor(i / 5)]! * UNIT,
      )
      if (i < given) {
        expect(svg('Circle', holeIn(i)).map((c) => c.props)).toEqual([
          expect.objectContaining({
            r: 7,
            fill: paint('#3d2112'),
            stroke: paint('#a86c3c'),
            strokeWidth: 1.5,
          }),
        ])
      } else {
        expect(holesIn(i)).toEqual([])
        expect(svg('Circle', slot(i))).toHaveLength(0)
      }
      expect(
        within(slot(i)).queryAllByTestId('math-bed-flower', HIDDEN),
      ).toHaveLength(i < given ? 1 : 0)
    }
    // Flat, like the lesson's ten-frame: no gradient (the trays' wells).
    expect(svg('LinearGradient')).toHaveLength(0)
    expect(svg('RadialGradient')).toHaveLength(0)
  },
)

it('is the lesson card picture: test ID math-bed, the slots math-bed-slot-<i>', async () => {
  await render(<FlowerBed width={WIDTH} given={7} />)
  expect(screen.getByTestId('math-bed', HIDDEN)).toBeOnTheScreen()
  expect(screen.getAllByTestId(/^math-bed-slot-\d$/, HIDDEN)).toHaveLength(10)
})

describe('the hints and the right move (§ 4, § 5)', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  const rerenderWith = async (
    rerender: (el: React.ReactElement) => Promise<void> | void,
    props: Partial<React.ComponentProps<typeof FlowerBed>>,
  ) => {
    await rerender(<FlowerBed width={WIDTH} given={7} {...props} />)
  }

  it('pulseGiven: the top row together at once, the bottom row together 300 ms later', async () => {
    const { rerender } = await render(<FlowerBed width={WIDTH} given={7} />)
    await rerenderWith(rerender, { pulseGiven: 1 })
    const pulsed = () =>
      screen
        .queryAllByTestId(/^math-bed-given-\d-pulsed$/, HIDDEN)
        .map((n) => Number(String(n.props.testID).split('-')[3]))
        .sort()
    expect(pulsed()).toEqual([0, 1, 2, 3, 4])
    expect(ROW_RIPPLE_GAP_MS).toBe(300)
    await act(async () => {
      jest.advanceTimersByTime(ROW_RIPPLE_GAP_MS - 1)
    })
    expect(pulsed()).toEqual([0, 1, 2, 3, 4])
    await act(async () => {
      jest.advanceTimersByTime(1)
    })
    expect(pulsed()).toEqual([0, 1, 2, 3, 4, 5, 6])
    // No hole opens on hint 1.
    for (const i of [7, 8, 9]) expect(holesIn(i)).toEqual([])
  })

  it('pulseGiven with g ≤ 5: one ripple', async () => {
    const { rerender } = await render(<FlowerBed width={WIDTH} given={4} />)
    await rerender(<FlowerBed width={WIDTH} given={4} pulseGiven={1} />)
    expect(
      screen.queryAllByTestId(/^math-bed-given-\d-pulsed$/, HIDDEN),
    ).toHaveLength(4)
  })

  it('hint: the shut holes open and pulse; a second rise does not pulse them again', async () => {
    const { rerender } = await render(<FlowerBed width={WIDTH} given={7} />)
    await rerenderWith(rerender, { hint: 1 })
    for (const i of [7, 8, 9]) {
      expect(holesIn(i)).toEqual([`math-bed-hole-${i}-pulsed`])
    }
    expect(screen.queryAllByTestId(/^math-bed-bloom-/, HIDDEN)).toEqual([])
    await rerenderWith(rerender, { hint: 2 })
    for (const i of [7, 8, 9]) {
      expect(holesIn(i)).toEqual([`math-bed-hole-${i}-pulsed`])
    }
  })

  it('filled with the holes shut: hole j appears as bud j lands, not before', async () => {
    const land = (j: number) => 360 + 80 * j
    const { rerender } = await render(
      <FlowerBed width={WIDTH} given={7} landMs={land} />,
    )
    await rerenderWith(rerender, { filled: true, landMs: land })
    for (let j = 0; j < 3; j++) {
      expect(holesIn(7 + j)).toEqual([])
    }
    let t = 0
    for (let j = 0; j < 3; j++) {
      await act(async () => {
        jest.advanceTimersByTime(land(j) - 1 - t)
      })
      expect(holesIn(7 + j)).toEqual([])
      await act(async () => {
        jest.advanceTimersByTime(1)
      })
      t = land(j)
      expect(holesIn(7 + j)).toEqual([`math-bed-hole-${7 + j}`])
    }
  })

  it('Reduce Motion: no ripple; at the hint the holes fade in and dip', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    const { rerender } = await render(<FlowerBed width={WIDTH} given={7} />)
    await rerenderWith(rerender, { pulseGiven: 1 })
    expect(
      screen.queryAllByTestId(/^math-bed-given-\d-pulsed$/, HIDDEN),
    ).toEqual([])
    await rerenderWith(rerender, { pulseGiven: 1, hint: 1 })
    for (const i of [7, 8, 9]) {
      expect(holesIn(i)).toEqual([`math-bed-hole-${i}-dipped`])
    }
  })

  it('Reduce Motion: a shut hole fades in with its bud, at 80 × j ms', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    const { rerender } = await render(<FlowerBed width={WIDTH} given={7} />)
    await rerenderWith(rerender, { filled: true })
    for (let j = 0; j < 3; j++) {
      await act(async () => {
        jest.advanceTimersByTime(j === 0 ? 0 : 80)
      })
      expect(holesIn(7 + j)).toEqual([`math-bed-hole-${7 + j}`])
      if (j < 2) expect(holesIn(8 + j)).toEqual([])
    }
  })
})
