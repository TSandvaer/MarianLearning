/**
 * Fill the flower bed's bed, its look (mini-game spec
 * `design/native/mini-game-flower-bed.md` § 2.2, amended 2026-10-20 to
 * "Soil beds"): brown soil in a wood rim, one furrow between the rows, and a
 * flat planting hole at every slot of the ten-frame's grid, the given
 * flowers planted in theirs. None of the progress trays' art (D7).
 */
import { render, screen, within } from '@testing-library/react-native'
import { processColor, StyleSheet } from 'react-native'
import type { TestInstance } from 'test-renderer'
import { FRAME_COLUMNS, FRAME_ROWS } from '../math/tenFrame'
import { FlowerBed } from './FlowerBed'

const HIDDEN = { includeHiddenElements: true }
/** 2 pt per unit: the 130-unit viewBox at 260 pt. */
const WIDTH = 260
const UNIT = WIDTH / 130

const slot = (i: number) => screen.getByTestId(`game-bed-slot-${i}`, HIDDEN)
const holeIn = (i: number) =>
  within(slot(i)).getByTestId(`game-bed-hole-${i}`, HIDDEN)
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
  '§ 2.2: given %i, a flat hole at every slot on the strict 2 × 5 grid; the given flowers are planted in theirs',
  async (given) => {
    await render(<FlowerBed width={WIDTH} given={given} />)
    for (let i = 0; i < 10; i++) {
      const box = StyleSheet.flatten(slot(i).props.style)
      // The ten-frame's slot centres, top row first.
      expect(box.left + box.width / 2).toBe(FRAME_COLUMNS[i % 5]! * UNIT)
      expect(box.top + box.height / 2).toBe(
        FRAME_ROWS[Math.floor(i / 5)]! * UNIT,
      )
      expect(svg('Circle', holeIn(i)).map((c) => c.props)).toEqual([
        expect.objectContaining({
          r: 7,
          fill: paint('#3d2112'),
          stroke: paint('#a86c3c'),
          strokeWidth: 1.5,
        }),
      ])
      expect(
        within(slot(i)).queryAllByTestId('game-bed-flower', HIDDEN),
      ).toHaveLength(i < given ? 1 : 0)
    }
    // Flat, like the lesson's ten-frame: no gradient (the trays' wells).
    expect(svg('LinearGradient')).toHaveLength(0)
    expect(svg('RadialGradient')).toHaveLength(0)
  },
)
