/**
 * The Play games in the app's clay look, phase A1 (play-games-restyle
 * § 2 T1-T6, T12; § 6 ACs 2-6): the game frame stands in the Play place's
 * garden, and the raft is drawn in the Map's and the lessons' clay. Paint
 * only: `playGeometry.test.ts` is unchanged (AC 1).
 */
import { screen, within } from '@testing-library/react-native'
import { processColor, StyleSheet } from 'react-native'
import * as Reanimated from 'react-native-reanimated'
import { hubLayout } from '../../layout/hubLayout'
import type { Viewport } from '../../layout/layout'
import { mathLayout } from '../../layout/mathLayout'
import {
  advance,
  byId,
  has,
  mountGame,
  PHONE_L,
  PHONE_P,
  tap,
} from '../../../test/playHarness'
import { gardenBackground } from '../hub/clay'
import { playArea, raftScene } from './playGeometry'
import { GLIDE_MS, ROW_AT_MS } from './RaftCrossing'

type Node = ReturnType<typeof screen.getByTestId>

const BAR = { top: 0, bottom: 20, left: 0, right: 0 }
/** The audit's iPad Pro 11-inch frames (play-games-restyle § 1.1). */
const TABLET_P: Viewport = { width: 834, height: 1210, insets: BAR }
const TABLET_L: Viewport = { width: 1210, height: 834, insets: BAR }
const FORMS: [string, Viewport][] = [
  ['phone portrait', PHONE_P],
  ['phone landscape', PHONE_L],
  ['tablet portrait', TABLET_P],
  ['tablet landscape', TABLET_L],
]
const SHORE = [7, 3, 6, 4, 8, 2]

const styleOf = (el: Node) => StyleSheet.flatten(el.props.style) ?? {}
const sceneOf = (v: Viewport) => {
  const l = mathLayout(v)
  return { l, scene: raftScene(playArea(l), l.tablet, l.landscape) }
}
const nodes = (root: Node): Node[] => [
  root,
  ...root.children.flatMap((c) => (typeof c === 'string' ? [] : nodes(c))),
]
/** A ClayOval's face stops and slab, read off its SVG host tree. */
const ovalOf = (root: Node) => {
  const all = nodes(root)
  const face = all.find(
    (n) => n.type === 'RNSVGRadialGradient' && !/-soft$/.test(n.props.name),
  )!
  const g = face.props.gradient as number[]
  const ellipses = all.filter((n) => n.type === 'RNSVGEllipse')
  // The soft shadow, the slab, the face: the slab is the solid fill.
  const slab = ellipses.find((n) => n.props.fill.type === 0)!
  return {
    stops: [g[1]! >>> 0, g[3]! >>> 0, g[5]! >>> 0],
    slab: slab.props.fill.payload >>> 0,
  }
}
const argb = (hex: string) => (processColor(hex) as number) >>> 0

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('T1 (AC 2): the frame stands in the Play place garden', () => {
  const GAMES = FORMS.flatMap(([name, v]) =>
    (['raft', 'critters'] as const).map((game) => [game, name, v] as const),
  )
  it.each(GAMES)(
    '%s, %s: the Hub garden, without Emma’s light',
    async (game, _, v) => {
      await mountGame(game, { viewport: v, shore: SHORE })
      const bg = styleOf(byId('play-game-background'))
      expect(bg.backgroundColor).toBe('#cdebb4')
      expect(bg.experimental_backgroundImage).toBe(
        gardenBackground(hubLayout(v).garden),
      )
      expect(has('hub-emma-light')).toBe(false)
      expect(has('hub-backdrop')).toBe(false)
    },
  )
})

describe('T2-T6: the raft in clay', () => {
  it.each(FORMS)('%s: no line on any piece (AC 3)', async (_, v) => {
    await mountGame('raft', { viewport: v, shore: SHORE })
    const lined = nodes(byId('raft-crossing')).filter((n) =>
      Object.entries(styleOf(n)).some(
        ([key, value]) =>
          /^border\w*Width$/.test(key) &&
          typeof value === 'number' &&
          value > 0,
      ),
    )
    expect(lined.map((n) => n.props.testID ?? n.type)).toEqual([])
  })

  it.each(FORMS)(
    '%s: a pool under the island and the water, a sand band, ripples, no wave line (AC 4)',
    async (_, v) => {
      await mountGame('raft', { viewport: v, shore: SHORE })
      const { l, scene } = sceneOf(v)
      const A = playArea(l)
      const k = l.tablet ? 1 : 7 / 12
      const R = 48 * k
      const pool = styleOf(byId('raft-pool'))
      expect(pool.borderRadius).toBe(R)
      expect(pool.boxShadow).toContain(`0 ${10 * k}px 0 #4a9cc8`)
      // The island stands in the water; the pool runs R under the shore.
      if (scene.axis === 'up') {
        expect(pool.top).toBe(scene.island.y)
        expect(pool.top + pool.height).toBeCloseTo(scene.shore.y + R)
        expect(pool.left).toBe(A.x)
        expect(pool.width).toBe(A.width)
      } else {
        expect(pool.left).toBe(scene.shore.x + scene.shore.width - R)
        expect(pool.left + pool.width).toBeCloseTo(A.x + A.width)
        expect(pool.top).toBe(A.y)
        expect(pool.height).toBe(A.height)
      }
      const shore = styleOf(byId('raft-shore'))
      expect(shore.borderRadius).toBe(R)
      expect(shore.boxShadow).toContain('#e8c77a')
      expect(shore.experimental_backgroundImage).toBe(
        'linear-gradient(#ffeec2, #e8c77a)',
      )
      // raft-water keeps its rect, unpainted.
      const water = styleOf(byId('raft-water'))
      expect(water).toMatchObject({
        left: scene.water.x,
        top: scene.water.y,
        width: scene.water.width,
        height: scene.water.height,
      })
      expect(water.backgroundColor).toBeUndefined()
      const ripples = screen.getAllByTestId('raft-ripple').map(styleOf)
      expect(ripples).toHaveLength(5)
      for (const r of ripples) {
        expect(r.height).toBe(l.tablet ? 6 : 4)
        expect(r.width).toBeLessThan(0.2 * scene.water.width)
      }
      const fullWidthWave = nodes(byId('raft-crossing')).filter((n) => {
        const s = styleOf(n)
        return s.top === '45%' && s.left === 0 && s.right === 0
      })
      expect(fullWidthWave).toEqual([])
    },
  )

  it.each(FORMS)(
    '%s: the island is a honey clay oval with two green clay bushes (T3)',
    async (_, v) => {
      await mountGame('raft', { viewport: v, shore: SHORE })
      const oval = ovalOf(byId('raft-mound'))
      expect(oval.stops).toEqual(['#ffeec2', '#f2c27a', '#d9a159'].map(argb))
      expect(oval.slab).toBe(argb('#b27b37'))
      const bushes = screen.getAllByTestId('raft-bush').map(styleOf)
      expect(bushes).toHaveLength(2)
      for (const b of bushes) expect(b.boxShadow).toContain('#3f8a2e')
    },
  )

  it.each(FORMS)(
    '%s: clay logs on a wood base, two ropes, a cream clay flag (T4, AC 6)',
    async (_, v) => {
      await mountGame('raft', { viewport: v, shore: SHORE })
      const { scene } = sceneOf(v)
      expect(styleOf(byId('raft-deck')).borderRadius).toBeCloseTo(
        0.14 * scene.a,
      )
      const logs = screen.getAllByTestId('raft-log').map(styleOf)
      expect(logs).toHaveLength(5)
      for (const log of logs) {
        expect(log.experimental_backgroundImage).toBe(
          'linear-gradient(#e7b07a 0%, #c98a55 55%, #a86c3c 100%)',
        )
        expect(log.borderRadius).toBeCloseTo(log.height / 2)
      }
      expect(screen.getAllByTestId('raft-rope')).toHaveLength(2)
      const flag = styleOf(byId('raft-flag-box'))
      expect(flag.experimental_backgroundImage).toBe(
        'linear-gradient(#fffdf8, #fff1e2)',
      )
      expect(flag.boxShadow).toContain('0 3px 0 #efcfb4')
    },
  )

  it.each(FORMS)(
    '%s: every weight tag is a cream clay tile on the Number Garden slab (T5, AC 6)',
    async (_, v) => {
      await mountGame('raft', { viewport: v, shore: SHORE })
      const tablet = mathLayout(v).tablet
      await tap(byId('raft-animal-0'))
      const tags = screen.getAllByTestId('raft-tag').map(styleOf)
      // Five on the shore, one aboard.
      expect(tags).toHaveLength(6)
      for (const t of tags) {
        expect(t.experimental_backgroundImage).toBe(
          'linear-gradient(#ffffff 0%, #fff7ee 60%, #ffeedd 100%)',
        )
        expect(t.boxShadow).toContain(`0 ${tablet ? 4 : 3}px 0 #dba675`)
      }
    },
  )
})

describe('T6 (AC 5): plinths on the shore, contact shadows everywhere', () => {
  it.each(FORMS)(
    '%s: a plinth in every shore piece, none aboard or on the island',
    async (_, v) => {
      await mountGame('raft', { viewport: v, shore: SHORE })
      const tablet = mathLayout(v).tablet
      const pieces = screen.getAllByTestId(/^raft-animal-\d+$/)
      expect(pieces).toHaveLength(6)
      for (const piece of pieces) {
        const plinths = within(piece).getAllByTestId('raft-plinth')
        expect(plinths).toHaveLength(1)
        const oval = ovalOf(plinths[0]!)
        expect(oval.stops).toEqual(['#fffaf0', '#efdcc0', '#d6b890'].map(argb))
        expect(oval.slab).toBe(argb('#b8946a'))
      }
      // 7 + 3: aboard, then across to the island.
      await tap(byId('raft-animal-0'))
      expect(
        within(byId('raft-aboard-0')).queryAllByTestId('raft-plinth'),
      ).toEqual([])
      await tap(byId('raft-animal-1'))
      await advance(ROW_AT_MS + GLIDE_MS)
      for (const i of [0, 1]) {
        const island = byId(`raft-island-${i}`)
        expect(within(island).queryAllByTestId('raft-plinth')).toEqual([])
        const picture = styleOf(within(island).getByTestId('raft-picture'))
        expect(picture.shadowColor).toBe('rgba(60, 30, 10, 0.28)')
        expect(picture.shadowOffset).toEqual({
          width: 0,
          height: tablet ? 4 : 3,
        })
      }
      // Every picture on screen carries the contact shadow.
      for (const p of screen.getAllByTestId('raft-picture').map(styleOf)) {
        expect(p.shadowRadius).toBe(tablet ? 4 : 3)
      }
    },
  )
})

describe('T12: Reduce Motion, VoiceOver, touch', () => {
  const PAINT = [
    'raft-pool',
    'raft-ripple',
    'raft-mound',
    'raft-bush',
    'raft-shore',
    'raft-deck',
    'raft-log',
    'raft-rope',
    'raft-plinth',
  ]
  const paint = () =>
    PAINT.map((id) => screen.getAllByTestId(id).map((n) => styleOf(n)))

  it('Reduce Motion draws the same clay', async () => {
    await mountGame('raft', { shore: SHORE })
    const moving = paint()
    await screen.unmount()
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    await mountGame('raft', { shore: SHORE })
    expect(paint()).toEqual(moving)
  })

  it('the paint takes no touch and says nothing to VoiceOver', async () => {
    await mountGame('raft', { shore: SHORE })
    for (const id of PAINT) {
      for (const n of screen.getAllByTestId(id)) {
        expect(n.props.accessible).not.toBe(true)
        let up: Node | null = n
        while (up !== null && up.props.pointerEvents !== 'none') {
          up = up.parent
        }
        expect(up).not.toBeNull()
      }
    }
  })
})
