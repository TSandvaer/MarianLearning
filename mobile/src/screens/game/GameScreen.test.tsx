/**
 * Fill the flower bed, the play screen (mini-game spec
 * `design/native/mini-game-flower-bed.md` §§ 1.4-1.6, 2.3-2.7; N7-N14,
 * N16): the beats in order, the two wrong-tap tiers, the bed's repeat tap,
 * a tap that cuts a line, Reduce Motion, the hidden-app wait and a rotation
 * mid-round. The line player, the effects and the visibility store are
 * fakes; the round is fixed.
 */
import type { EmmaPose } from '@marian/core/character/emmaPose'
import type { FlowerBedBed } from '@marian/core/games/miniGames'
import { ANSWER_RANGE_MAX } from '@marian/core/math/distractors'
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { BackHandler, StyleSheet } from 'react-native'
import * as Reanimated from 'react-native-reanimated'
import type { Sfx } from '../../audio'
import type { LineCallbacks } from '../../audio/linePlayback'
import type { Viewport } from '../../layout/layout'
import { mathLayout } from '../../layout/mathLayout'
import type { AppVisibility } from '../../lifecycle/appVisibility'
import { buildChipOrder } from '../math/chipOrder'
import { bedRect } from './flowerBedGeometry'
import type { GameLineId, GameLinePlayer } from './gameLines'
import {
  BED_CHANGE_MS,
  GAME_OPEN_DELAY_MS,
  GAME_STEP_GAP_MS,
  GameScreen,
  HOP_MS,
  HOP_STAGGER_MS,
  type GameScreenProps,
  type GameSfx,
} from './GameScreen'

const PORTRAIT: Viewport = {
  width: 375,
  height: 667,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}
const LANDSCAPE: Viewport = {
  width: 667,
  height: 375,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
}
const HIDDEN = { includeHiddenElements: true }

/** The round every test plays: the lesson's three first, then three more. */
const ROUND: FlowerBedBed[] = [7, 6, 8, 1, 5, 9].map((given) => ({
  given,
  missing: 10 - given,
}))

interface Line {
  id: GameLineId
  opts: LineCallbacks
  resolve: () => void
}

function fakeLines() {
  const lines: Line[] = []
  const player: GameLinePlayer & {
    cancelActive: jest.Mock
    unload: jest.Mock
  } = {
    playLine: (id, opts = {}) =>
      new Promise<void>((resolve) => {
        lines.push({ id, opts, resolve })
      }),
    cancelActive: jest.fn(),
    unload: jest.fn(),
  }
  return { lines, player, ids: () => lines.map((l) => l.id) }
}

function fakeSfx(): GameSfx & Record<keyof GameSfx, { play: jest.Mock }> {
  const one = (): Sfx & { play: jest.Mock } => ({
    play: jest.fn(() => true),
    unload: jest.fn(),
    missedPlays: 0,
    loadFailed: false,
  })
  return { sparkle: one(), plink: one(), poof: one() }
}

function fakeVisibility() {
  let hidden = false
  const listeners = new Set<() => void>()
  const store: AppVisibility = {
    getIsHidden: () => hidden,
    subscribe: (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
  const set = async (to: boolean) => {
    await act(async () => {
      hidden = to
      listeners.forEach((l) => l())
    })
  }
  return { store, set }
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve()
  })
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
  await flush()
}

/** The line starts (its onPlay) and ends. */
async function say(line: Line) {
  await act(async () => {
    line.opts.onPlay?.()
    line.opts.onWordTick?.(0)
    line.resolve()
  })
  await flush()
}

/** The line starts but has not ended. */
async function start(line: Line) {
  await act(async () => {
    line.opts.onPlay?.()
    line.opts.onWordTick?.(0)
  })
  await flush()
}

async function setup(overrides: Partial<GameScreenProps> = {}) {
  const lines = fakeLines()
  const sfx = fakeSfx()
  const visibility = fakeVisibility()
  const onExit = jest.fn()
  const poses: EmmaPose[] = []
  const props: GameScreenProps = {
    layout: mathLayout(PORTRAIT),
    game: 'flower-bed',
    onExit,
    onPoseChange: (p) => poses.push(p),
    round: ROUND,
    linePlayer: lines.player,
    sfx,
    visibility: visibility.store,
    ...overrides,
  }
  const utils = await render(<GameScreen {...props} />)
  await flush()
  return {
    ...lines,
    sfx,
    visibility,
    onExit,
    unmount: utils.unmount,
    pose: () => poses.at(-1),
    rerender: (next: Partial<GameScreenProps>) =>
      utils.rerender(<GameScreen {...props} {...next} />),
    last: () => lines.lines.at(-1)!,
  }
}

type H = Awaited<ReturnType<typeof setup>>

const chip = (v: number) => screen.getByTestId(`math-chip-${v}`)
const chipDisabled = (v: number) =>
  chip(v).props.accessibilityState?.disabled === true
const chipValues = () =>
  screen
    .getAllByTestId(/^math-chip-\d+$/)
    .map((c) => Number(String(c.props.testID).replace('math-chip-', '')))
const glows = (v: number) =>
  String(StyleSheet.flatten(chip(v).props.style)?.boxShadow ?? '').includes(
    '255, 214, 92',
  )
const tap = async (v: number) => {
  await fireEvent.press(chip(v))
  await flush()
}
const flowers = () => screen.queryAllByTestId('game-bed-flower', HIDDEN).length
const blooms = () =>
  screen.queryAllByTestId(/^game-bed-bloom-\d$/, HIDDEN).length
const hops = () => screen.queryAllByTestId(/^game-hop-\d$/, HIDDEN).length
const beads = (state: string) =>
  screen.queryAllByTestId(`game-problem-dot-${state}`, HIDDEN).length
/** The bed in play's hole in slot `i` (§ 2.2). */
const hole = (i: number) =>
  screen.getByTestId(
    new RegExp(`^game-bed-hole-${i}(-pulsed|-dipped)?$`),
    HIDDEN,
  )
/** What slot `i` holds: its hole, and a given flower or a planted bloom. */
const holds = (i: number) => {
  const slot = within(screen.getByTestId(`game-bed-slot-${i}`, HIDDEN))
  return {
    hole: slot.queryAllByTestId(/^game-bed-hole-\d/, HIDDEN).length,
    flower: slot.queryAllByTestId('game-bed-flower', HIDDEN).length,
    bloom: slot.queryAllByTestId(/^game-bed-bloom-\d$/, HIDDEN).length,
  }
}
const bedSlots = () => Array.from({ length: 10 }, (_, i) => holds(i))
const PLANTED = { hole: 1, flower: 1, bloom: 0 }
const EMPTY = { hole: 1, flower: 0, bloom: 0 }
const BLOOMED = { hole: 1, flower: 0, bloom: 1 }

/** The bloom of the last of `m` buds has ended this long after the tap. */
const bloomEnd = (m: number) => HOP_MS + HOP_STAGGER_MS * (m - 1) + 150

/** From the open line to bed 1's ask, its line started. */
async function toFirstAsk(h: H) {
  await advance(GAME_OPEN_DELAY_MS)
  await say(h.last())
  await advance(GAME_STEP_GAP_MS)
  await start(h.last())
}

/** The current bed's right move, through to the next bed's ask (started). */
async function playBed(h: H, k: number) {
  const { missing } = ROUND[k]!
  await tap(missing)
  await say(h.last()) // the yes line
  await advance(bloomEnd(missing) + GAME_STEP_GAP_MS)
  if (k < ROUND.length - 1) {
    await advance(BED_CHANGE_MS)
    await start(h.last())
  }
}

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('N7: the beats of § 2.4, in order', () => {
  it('open → 400 ms → ask; the chips are closed until the ask’s onPlay', async () => {
    const h = await setup()
    expect(h.ids()).toEqual([])
    expect(h.pose()).toBe('idle')
    await advance(GAME_OPEN_DELAY_MS - 1)
    expect(h.ids()).toEqual([])
    await advance(1)
    expect(h.ids()).toEqual(['guide.game.bed.open'])
    expect(screen.getByTestId('game-ribbon')).toHaveProp(
      'accessibilityLabel',
      'Ten flowers in every bed!',
    )
    await say(h.last())
    await advance(GAME_STEP_GAP_MS - 1)
    expect(h.ids()).toEqual(['guide.game.bed.open'])
    await advance(1)
    expect(h.ids()).toEqual(['guide.game.bed.open', 'guide.game.bed.ask.7'])
    expect(h.pose()).toBe('listening')
    for (const v of chipValues()) expect(chipDisabled(v)).toBe(true)
    await start(h.last())
    for (const v of chipValues()) expect(chipDisabled(v)).toBe(false)
    await act(async () => h.last().resolve())
    await flush()
    expect(h.pose()).toBe('idle')
  })

  it('a right tap: sparkle and plink, the burst, celebration, the yes line, m buds and the bead; every slot then holds a hole with a flower on it', async () => {
    const h = await setup()
    await toFirstAsk(h)
    expect(flowers()).toBe(7)
    // § 2.2: a hole at every slot; the given flowers are planted in theirs.
    expect(bedSlots()).toEqual([
      ...Array<typeof PLANTED>(7).fill(PLANTED),
      EMPTY,
      EMPTY,
      EMPTY,
    ])
    expect(beads('completed')).toBe(0)
    await tap(3)
    expect(h.sfx.sparkle.play).toHaveBeenCalledTimes(1)
    expect(h.sfx.plink.play).toHaveBeenCalledTimes(1)
    expect(h.sfx.poof.play).not.toHaveBeenCalled()
    expect(screen.getByTestId('math-sparkle-burst', HIDDEN)).toBeOnTheScreen()
    expect(h.pose()).toBe('celebration')
    expect(h.last().id).toBe('guide.game.bed.yes.7')
    expect(hops()).toBe(3)
    expect(blooms()).toBe(3)
    expect(beads('completed')).toBe(1)
    for (const v of chipValues()) expect(chipDisabled(v)).toBe(true)
    // The buds land in the empty holes, and the holes stay under them.
    await advance(bloomEnd(3))
    expect(bedSlots()).toEqual([
      ...Array<typeof PLANTED>(7).fill(PLANTED),
      BLOOMED,
      BLOOMED,
      BLOOMED,
    ])
  })

  it('then the slide and the next ask: max(yes end, last bloom end) + 400, then + 300', async () => {
    const h = await setup()
    await toFirstAsk(h)
    await tap(3)
    await say(h.last())
    await advance(bloomEnd(3) + GAME_STEP_GAP_MS - 1)
    expect(screen.queryByTestId('game-bed-slide', HIDDEN)).not.toBeOnTheScreen()
    await advance(1)
    expect(screen.getByTestId('game-bed-slide', HIDDEN)).toBeOnTheScreen()
    expect(h.pose()).toBe('idle')
    // The old chips are gone; the next ones mount with the next ask.
    expect(screen.queryAllByTestId(/^math-chip-\d+$/)).toHaveLength(0)
    await advance(BED_CHANGE_MS - 1)
    expect(h.last().id).toBe('guide.game.bed.yes.7')
    await advance(1)
    expect(h.last().id).toBe('guide.game.bed.ask.6')
    expect(screen.queryByTestId('game-bed-slide', HIDDEN)).not.toBeOnTheScreen()
    expect(flowers()).toBe(6)
    expect(chipValues()).toHaveLength(3)
  })

  it('a long yes line holds the slide until it ends', async () => {
    const h = await setup()
    await toFirstAsk(h)
    await tap(3)
    await advance(bloomEnd(3) + 2000)
    expect(screen.queryByTestId('game-bed-slide', HIDDEN)).not.toBeOnTheScreen()
    await act(async () => h.last().resolve())
    await flush()
    await advance(GAME_STEP_GAP_MS)
    expect(screen.getByTestId('game-bed-slide', HIDDEN)).toBeOnTheScreen()
  })

  it('after bed 6: 400 ms → cheering and the closer → 400 ms → the Map', async () => {
    const h = await setup()
    await toFirstAsk(h)
    for (let k = 0; k < 6; k++) await playBed(h, k)
    expect(beads('completed')).toBe(6)
    expect(h.last().id).toBe('guide.game.bed.close')
    expect(h.pose()).toBe('cheering')
    // The full bed stays; no slide.
    expect(screen.queryByTestId('game-bed-slide', HIDDEN)).not.toBeOnTheScreen()
    await say(h.last())
    await advance(GAME_STEP_GAP_MS - 1)
    expect(h.onExit).not.toHaveBeenCalled()
    await advance(1)
    expect(h.onExit).toHaveBeenCalledTimes(1)
    // Six asks, six yeses, one open, one close: no other line, no "again?".
    expect(h.ids()).toEqual([
      'guide.game.bed.open',
      ...ROUND.flatMap(({ given }) => [
        `guide.game.bed.ask.${given}`,
        `guide.game.bed.yes.${given}`,
      ]),
      'guide.game.bed.close',
    ])
  })
})

describe('N8: a wrong tap changes nothing in the bed', () => {
  it('1st wrong: poof, shake, puzzled, "Hmm... try again?", the empty holes pulse; every chip still answers', async () => {
    const h = await setup()
    await toFirstAsk(h)
    await tap(2)
    expect(h.sfx.poof.play).toHaveBeenCalledTimes(1)
    expect(h.sfx.sparkle.play).not.toHaveBeenCalled()
    expect(h.pose()).toBe('puzzled-tilt')
    expect(h.last().id).toBe('guide.game.again')
    expect(flowers()).toBe(7)
    expect(blooms()).toBe(0)
    expect(hops()).toBe(0)
    expect(screen.queryAllByTestId(/-pulsed$/, HIDDEN)).toHaveLength(0)
    await start(h.last())
    expect(
      screen
        .queryAllByTestId(/^game-bed-hole-\d-pulsed$/, HIDDEN)
        .map((r) => r.props.testID),
    ).toEqual([
      'game-bed-hole-7-pulsed',
      'game-bed-hole-8-pulsed',
      'game-bed-hole-9-pulsed',
    ])
    for (const v of chipValues()) expect(chipDisabled(v)).toBe(false)
    await act(async () => h.last().resolve())
    await flush()
    expect(h.pose()).toBe('idle')
    expect(flowers()).toBe(7)
  })

  it('2nd wrong: after the again line, the right chip glows, the others dim and do nothing, Emma points, "This one is three."', async () => {
    const h = await setup()
    await toFirstAsk(h)
    await tap(2)
    await say(h.last())
    await tap(4)
    expect(h.sfx.poof.play).toHaveBeenCalledTimes(2)
    expect(h.last().id).toBe('guide.game.again')
    expect(glows(3)).toBe(false)
    await say(h.last())
    expect(h.last().id).toBe('guide.game.this-is.3')
    expect(h.pose()).toBe('attentive-pointing')
    expect(glows(3)).toBe(true)
    expect(chipDisabled(3)).toBe(false)
    expect(chipDisabled(2)).toBe(true)
    expect(chipDisabled(4)).toBe(true)
    const count = h.ids().length
    await tap(2)
    await tap(4)
    expect(h.ids()).toHaveLength(count)
    expect(h.sfx.poof.play).toHaveBeenCalledTimes(2)
    expect(flowers()).toBe(7)
    expect(blooms()).toBe(0)
    // The glowing chip runs the full right move, buds and all.
    await say(h.last())
    await tap(3)
    expect(h.sfx.sparkle.play).toHaveBeenCalledTimes(1)
    expect(h.last().id).toBe('guide.game.bed.yes.7')
    expect(hops()).toBe(3)
    expect(blooms()).toBe(3)
    expect(beads('completed')).toBe(1)
  })

  it('the wrong count resets on every bed', async () => {
    const h = await setup()
    await toFirstAsk(h)
    await tap(2)
    await say(h.last())
    await playBed(h, 0)
    // Bed 2 (6 + 4): one wrong is the first tier again, not the guide.
    const wrong = chipValues().find((v) => v !== 4)!
    await tap(wrong)
    await say(h.last())
    expect(h.last().id).toBe('guide.game.again')
    expect(
      screen.queryAllByTestId(/^game-bed-hole-\d-pulsed$/, HIDDEN),
    ).toHaveLength(4)
  })
})

describe('N9: the chips', () => {
  it('each bed’s chips are buildChipOrder’s, with index 3 + k, and hold m inside 1-10', async () => {
    const h = await setup()
    await toFirstAsk(h)
    for (let k = 0; k < 6; k++) {
      const { given, missing } = ROUND[k]!
      const expected = buildChipOrder(
        {
          index: 3 + (k + 1),
          addendA: given,
          addendB: missing,
          correct: missing,
          op: '+',
          utterances: {
            read: '',
            correct: '',
            reprompt: '',
            giveAnswer: '',
          },
        },
        ANSWER_RANGE_MAX,
        'add-to-10',
      ).values
      expect(h.last().id).toBe(`guide.game.bed.ask.${given}`)
      expect(chipValues()).toEqual([...expected])
      expect(chipValues()).toContain(missing)
      for (const v of chipValues()) {
        expect(v).toBeGreaterThanOrEqual(1)
        expect(v).toBeLessThanOrEqual(10)
      }
      await playBed(h, k)
    }
  })
})

describe('N10: the bed’s repeat tap', () => {
  it('while the bed waits, a tap on the soil or on a hole says the ask again; never during a line or after the right tap; no tap plants a hole', async () => {
    const h = await setup()
    await advance(GAME_OPEN_DELAY_MS)
    const bed = () => fireEvent.press(screen.getByTestId('game-bed'))
    // During the open line: nothing.
    await bed()
    expect(h.ids()).toEqual(['guide.game.bed.open'])
    await say(h.last())
    await advance(GAME_STEP_GAP_MS)
    // During the ask: nothing.
    await start(h.last())
    await bed()
    expect(h.ids()).toHaveLength(2)
    await act(async () => h.last().resolve())
    await flush()
    // Waiting: the ask again.
    await bed()
    expect(h.ids()).toEqual([
      'guide.game.bed.open',
      'guide.game.bed.ask.7',
      'guide.game.bed.ask.7',
    ])
    expect(h.pose()).toBe('listening')
    await say(h.last())
    // A tap on a hole, empty or planted, is a bed tap: the ask again (D8).
    await fireEvent.press(hole(8))
    await say(h.last())
    await fireEvent.press(hole(2))
    expect(h.ids().slice(2)).toEqual([
      'guide.game.bed.ask.7',
      'guide.game.bed.ask.7',
      'guide.game.bed.ask.7',
    ])
    await say(h.last())
    // No hole is planted one by one: nothing hops, blooms or sounds.
    expect(bedSlots()).toEqual([
      ...Array<typeof PLANTED>(7).fill(PLANTED),
      EMPTY,
      EMPTY,
      EMPTY,
    ])
    expect(hops()).toBe(0)
    expect(h.sfx.sparkle.play).not.toHaveBeenCalled()
    expect(h.sfx.plink.play).not.toHaveBeenCalled()
    expect(beads('completed')).toBe(0)
    // After the right tap: nothing, even once the yes line has ended.
    await tap(3)
    await say(h.last())
    await bed()
    await fireEvent.press(hole(8))
    expect(h.ids().at(-1)).toBe('guide.game.bed.yes.7')
    expect(h.ids()).toHaveLength(6)
  })
})

describe('N11: a chip tap during a line', () => {
  it('cuts the ask and plays its own response', async () => {
    const h = await setup()
    await toFirstAsk(h)
    h.player.cancelActive.mockClear()
    await tap(3)
    expect(h.player.cancelActive).toHaveBeenCalled()
    expect(h.last().id).toBe('guide.game.bed.yes.7')
  })

  it('cuts the again line: a right tap there plays the right move, and no guide follows', async () => {
    const h = await setup()
    await toFirstAsk(h)
    await tap(2)
    await say(h.last())
    await tap(4)
    await start(h.last()) // the 2nd "again", still playing
    h.player.cancelActive.mockClear()
    await tap(3)
    expect(h.player.cancelActive).toHaveBeenCalled()
    expect(h.last().id).toBe('guide.game.bed.yes.7')
    await say(h.last())
    await flush()
    expect(h.ids()).not.toContain('guide.game.this-is.3')
  })
})

describe('N12: Reduce Motion', () => {
  it('no hop, slide or hole scale: the buds, the bed change and the hint fade', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    const h = await setup()
    await toFirstAsk(h)
    await tap(2)
    await start(h.last())
    expect(screen.queryAllByTestId(/-pulsed$/, HIDDEN)).toHaveLength(0)
    expect(
      screen.queryAllByTestId(/^game-bed-hole-\d-dipped$/, HIDDEN),
    ).toHaveLength(3)
    await act(async () => h.last().resolve())
    await flush()
    await tap(3)
    expect(hops()).toBe(0)
    expect(blooms()).toBe(3)
    await say(h.last())
    // Each bud fades in over its hole, and the hole stays (§ 2.7).
    expect(bedSlots()).toEqual([
      ...Array<typeof PLANTED>(7).fill(PLANTED),
      BLOOMED,
      BLOOMED,
      BLOOMED,
    ])
    // The buds fade in 80 ms apart and crossfade: the last ends at 160 + 400.
    await advance(80 * 2 + 400 + GAME_STEP_GAP_MS)
    expect(screen.queryByTestId('game-bed-slide', HIDDEN)).not.toBeOnTheScreen()
    expect(screen.getByTestId('game-bed-crossfade', HIDDEN)).toBeOnTheScreen()
  })
})

describe('N13: the app hidden', () => {
  it('the advance after a yes line waits while hidden and runs on the return', async () => {
    const h = await setup()
    await toFirstAsk(h)
    await tap(3)
    await say(h.last())
    await h.visibility.set(true)
    await advance(bloomEnd(3) + GAME_STEP_GAP_MS + 5000)
    expect(screen.queryByTestId('game-bed-slide', HIDDEN)).not.toBeOnTheScreen()
    expect(h.last().id).toBe('guide.game.bed.yes.7')
    await h.visibility.set(false)
    await flush()
    expect(screen.getByTestId('game-bed-slide', HIDDEN)).toBeOnTheScreen()
    await advance(BED_CHANGE_MS)
    expect(h.last().id).toBe('guide.game.bed.ask.6')
  })
})

describe('N14: a rotation mid-round', () => {
  it('keeps the bed, its full slots, the wrong count and the line, and lays out again', async () => {
    const h = await setup()
    await toFirstAsk(h)
    await playBed(h, 0) // bed 2: 6 + 4
    await tap(chipValues().find((v) => v !== 4)!)
    await start(h.last()) // "Hmm... try again?" playing
    const lines = h.ids().length
    h.player.cancelActive.mockClear()
    const land = mathLayout(LANDSCAPE)
    await h.rerender({ layout: land })
    await flush()
    expect(h.ids()).toHaveLength(lines)
    expect(h.player.cancelActive).not.toHaveBeenCalled()
    expect(flowers()).toBe(6)
    const box = bedRect(land.problem)
    expect(screen.getByTestId('game-bed')).toHaveStyle({
      left: box.x,
      top: box.y,
      width: box.width,
      height: box.height,
    })
    expect(screen.getByTestId('math-chip-4').props.accessibilityState).toEqual({
      disabled: false,
    })
    // The wrong count held: the 2nd wrong now guides.
    await act(async () => h.last().resolve())
    await flush()
    await tap(chipValues().find((v) => v !== 4 && !chipDisabled(v))!)
    await say(h.last())
    expect(h.last().id).toBe('guide.game.this-is.4')
  })

  it('a hop in flight ends at once: no bud flies to an old position', async () => {
    const h = await setup()
    await toFirstAsk(h)
    await tap(3)
    expect(hops()).toBe(3)
    await h.rerender({ layout: mathLayout(LANDSCAPE) })
    await flush()
    expect(hops()).toBe(0)
    expect(blooms()).toBe(3)
  })
})

describe('N16 and Back', () => {
  it('the HUD: 6 beads under the game prefix, no stardust pill, no streak', async () => {
    await setup()
    expect(screen.getByTestId('game-hud')).toBeOnTheScreen()
    expect(screen.getAllByTestId(/^game-problem-dot-/, HIDDEN)).toHaveLength(6)
    expect(screen.queryByTestId('game-stardust')).not.toBeOnTheScreen()
    expect(screen.queryByTestId('game-streak')).not.toBeOnTheScreen()
    expect(screen.queryByTestId('math-hud')).not.toBeOnTheScreen()
  })

  it('Back mid-line: the Map at once, the line cut, nothing further', async () => {
    const h = await setup()
    await toFirstAsk(h)
    h.player.cancelActive.mockClear()
    await fireEvent.press(screen.getByTestId('game-back-to-hub'))
    expect(h.onExit).toHaveBeenCalledTimes(1)
    expect(h.player.cancelActive).toHaveBeenCalled()
    await advance(10_000)
    expect(h.onExit).toHaveBeenCalledTimes(1)
  })

  it('Android back is Back', async () => {
    const back = jest.spyOn(BackHandler, 'addEventListener')
    const h = await setup()
    const androidBack = back.mock.calls.at(-1)![1] as () => boolean
    await act(async () => {
      expect(androidBack()).toBe(true)
    })
    expect(h.onExit).toHaveBeenCalledTimes(1)
  })

  it('unmount releases the line player and the effects', async () => {
    const h = await setup()
    await act(async () => {
      await h.unmount()
    })
    expect(h.player.unload).toHaveBeenCalled()
    expect(h.sfx.sparkle.unload).toHaveBeenCalled()
  })
})
