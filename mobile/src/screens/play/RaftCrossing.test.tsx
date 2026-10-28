/**
 * Raft crossing on screen (play-place § 2; ACs N7, N7a, N8, N13, N17),
 * through the game frame with fake lines, effects and a seeded shore.
 */
import { screen } from '@testing-library/react-native'
import { mathLayout } from '../../layout/mathLayout'
import {
  activate,
  advance,
  byId,
  dragTo,
  has,
  mountGame,
  PHONE_L,
  PHONE_P,
  tap,
} from '../../../test/playHarness'
import { centre, playArea, raftScene } from './playGeometry'
import {
  AFTER_HOMES_MS,
  AFTER_SCENE_MS,
  GLIDE_MS,
  HOME_BEAT_MS,
  HOP_HOME_MS,
  HOP_HOME_STAGGER_MS,
  RAFT_OPEN_DELAY_MS,
  RETURN_MS,
  ROW_AT_MS,
  SCENE_AT_MS,
  SCENE_MS,
  SPLASH_AT_MS,
  SPLASH_END_MS,
  WOBBLE_MS,
} from './RaftCrossing'

const sceneP = () => {
  const l = mathLayout(PHONE_P)
  return raftScene(playArea(l), l.tablet, l.landscape)
}
const deck = () => centre(sceneP().dock)
const flag = () => String(byId('raft-flag').props.children)
const shoreCount = () => screen.queryAllByTestId(/^raft-animal-\d+$/).length
const homeCount = () => screen.queryAllByTestId(/^raft-home-\d-animal$/).length

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('§ 4.1: the open line 300 ms after the fade-in', async () => {
  const g = await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
  await advance(RAFT_OPEN_DELAY_MS - 1)
  expect(g.lines).toEqual([])
  await advance(1)
  expect(g.lines).toEqual(['guide.play.raft.open'])
  expect(g.poses).toContain('listening')
})

describe('N7: board, take off, too heavy', () => {
  it('a tap boards; the flag and the total line follow; a take-off goes home', async () => {
    const g = await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
    expect(byId('raft-animal-0').props.accessibilityLabel).toBe('Dog, seven')
    await tap(byId('raft-animal-0'))
    expect(g.sfx.plink.play).toHaveBeenCalledTimes(1)
    expect(has('raft-aboard-0')).toBe(true)
    expect(has('raft-animal-0')).toBe(false)
    expect(flag()).toBe('7')
    expect(g.lines).toEqual(['guide.play.raft.total.7'])
    expect(byId('raft').props.accessibilityLabel).toBe('Raft for ten, seven')
    // A drop boards too, and its total cuts the one before.
    const cuts = (g.player.cancelActive as jest.Mock).mock.calls.length
    await dragTo(byId('raft-animal-5'), deck())
    expect(flag()).toBe('9')
    expect(g.lines).toEqual([
      'guide.play.raft.total.7',
      'guide.play.raft.total.9',
    ])
    expect(
      (g.player.cancelActive as jest.Mock).mock.calls.length,
    ).toBeGreaterThan(cuts)
    // Take off: tap the 2, and it is back on its spot.
    await tap(byId('raft-aboard-5'))
    expect(has('raft-animal-5')).toBe(true)
    expect(flag()).toBe('7')
    expect(g.lines.at(-1)).toBe('guide.play.raft.total.7')
    // Off at 0: nothing said.
    await tap(byId('raft-aboard-0'))
    expect(flag()).toBe('')
    expect(g.lines).toHaveLength(3)
  })

  it('a drop past 10 splashes: the old total stays, splash sound and line, the animal comes home', async () => {
    const g = await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
    await tap(byId('raft-animal-0'))
    await dragTo(byId('raft-animal-2'), deck())
    expect(flag()).toBe('7')
    expect(has('raft-splashing')).toBe(true)
    expect(has('raft-wobble')).toBe(true)
    // Drops are refused while the raft wobbles.
    await dragTo(byId('raft-animal-5'), deck())
    expect(has('raft-animal-5')).toBe(true)
    await advance(SPLASH_AT_MS)
    expect(g.sfx.splash.play).toHaveBeenCalledTimes(1)
    expect(g.lines.at(-1)).toBe('guide.play.raft.splash')
    expect(g.poses.at(-1)).toBe('puzzled-tilt')
    await advance(WOBBLE_MS - SPLASH_AT_MS)
    expect(has('raft-wobble')).toBe(false)
    await advance(SPLASH_END_MS - WOBBLE_MS)
    expect(has('raft-splashing')).toBe(false)
    expect(has('raft-animal-2')).toBe(true)
    expect(flag()).toBe('7')
    expect(g.poses.at(-1)).toBe('idle')
    // Draggable again at once; the 3 makes ten.
    await tap(byId('raft-animal-1'))
    expect(g.lines.at(-1)).toBe('guide.play.raft.go')
  })
})

describe('N7a: a stuck raft gets a newcomer (D4)', () => {
  async function stuck() {
    const g = await mountGame('raft', { shore: [6, 2, 5, 7, 9, 9] })
    await tap(byId('raft-animal-0'))
    return g
  }

  it('after the second splash, a 4 walks into the empty spot, unannounced; boarding it departs', async () => {
    const g = await stuck()
    await tap(byId('raft-animal-2'))
    await advance(SPLASH_END_MS)
    expect(has('raft-animal-6')).toBe(false)
    const linesBefore = g.lines.length
    await tap(byId('raft-animal-3'))
    await advance(SPLASH_END_MS)
    expect(has('raft-animal-6')).toBe(true)
    expect(byId('raft-animal-6').props.accessibilityLabel).toBe('Duck, four')
    // Only the splash line; no newcomer line, sound or pose.
    expect(g.lines.slice(linesBefore)).toEqual(['guide.play.raft.splash'])
    expect(g.sfx.plink.play).toHaveBeenCalledTimes(1)
    expect(g.poses.at(-1)).toBe('idle')
    await tap(byId('raft-animal-6'))
    expect(g.lines.at(-1)).toBe('guide.play.raft.go')
  })

  it('a board between the two splashes resets the count', async () => {
    await stuck()
    await tap(byId('raft-animal-2'))
    await advance(SPLASH_END_MS)
    await tap(byId('raft-animal-1'))
    await tap(byId('raft-aboard-1'))
    await tap(byId('raft-animal-3'))
    await advance(SPLASH_END_MS)
    expect(has('raft-animal-6')).toBe(false)
  })

  it('one aboard, its spot taken by the newcomer: taking it off sends the newcomer out', async () => {
    await stuck()
    await tap(byId('raft-animal-2'))
    await advance(SPLASH_END_MS)
    await tap(byId('raft-animal-3'))
    await advance(SPLASH_END_MS)
    await tap(byId('raft-aboard-0'))
    expect(has('raft-animal-6')).toBe(false)
    expect(has('raft-leaving-6')).toBe(true)
    expect(has('raft-animal-0')).toBe(true)
    expect(shoreCount()).toBe(6)
  })
})

describe('N8: crossings', () => {
  /** Board the two shore animals that make ten (by weight). */
  async function loadTen(shore: number[]) {
    const ids = screen
      .queryAllByTestId(/^raft-animal-\d+$/)
      .map((el) => Number(String(el.props.testID).split('-')[2]))
    const weights = new Map(ids.map((id) => [id, shore[id] ?? weightOf(id)]))
    for (const a of ids) {
      for (const b of ids) {
        if (a !== b && weights.get(a)! + weights.get(b)! === 10) {
          await tap(byId(`raft-animal-${a}`))
          await tap(byId(`raft-animal-${b}`))
          return
        }
      }
    }
    throw new Error('no pair on the shore')
  }
  const NUMBER = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
  ]
  const weightOf = (id: number) => {
    const label = String(byId(`raft-animal-${id}`).props.accessibilityLabel)
    return NUMBER.indexOf(label.split(', ')[1]!)
  }

  it('ten departs, lands, plays a scene on the deck, walks home and returns to a full shore; the third does not end the trip (I8)', async () => {
    const shore = [7, 3, 6, 4, 8, 2]
    const g = await mountGame('raft', { shore })
    let lastScene: string | null = null
    for (let k = 1; k <= 3; k++) {
      const sparkles = g.sfx.sparkle.play.mock.calls.length
      await loadTen(shore)
      expect(g.sfx.sparkle.play.mock.calls.length).toBe(sparkles + 1)
      expect(g.poses.at(-1)).toBe('waving')
      expect(g.lines.at(-1)).toBe('guide.play.raft.go')
      expect(flag()).toBe('10')
      // Boarding is closed: a tap only hops.
      const plinks = g.sfx.plink.play.mock.calls.length
      const someone = screen.queryAllByTestId(/^raft-animal-\d+$/)[0]!
      await tap(someone)
      expect(g.sfx.plink.play.mock.calls.length).toBe(plinks)
      await advance(ROW_AT_MS)
      expect(has('raft-rowing')).toBe(true)
      await advance(GLIDE_MS)
      // At the landing the two stay seated.
      expect(screen.queryAllByTestId(/^raft-aboard-\d+$/)).toHaveLength(2)
      await advance(SCENE_AT_MS)
      expect(g.lines.at(-1)).toBe('guide.play.raft.silly')
      expect(g.poses.at(-1)).toBe('cheering')
      const scene = screen.getAllByTestId(/^raft-scene-/)[0]!.props
        .testID as string
      expect(scene).not.toBe(lastScene)
      lastScene = scene
      await advance(
        SCENE_MS +
          AFTER_SCENE_MS +
          HOP_HOME_STAGGER_MS +
          HOP_HOME_MS +
          HOME_BEAT_MS +
          AFTER_HOMES_MS +
          RETURN_MS,
      )
      expect(screen.queryAllByTestId(/^raft-aboard-\d+$/)).toHaveLength(0)
      expect(shoreCount()).toBe(6)
      expect(g.poses.at(-1)).toBe('idle')
    }
    expect(g.lines).not.toContain('guide.play.raft.close')
    await advance(10_000)
    expect(g.onExit).not.toHaveBeenCalled()
  })
})

describe('N13: a new layout keeps the trip', () => {
  it('rotation mid-load keeps who is aboard; rotation mid-crossing keeps the crossing and the island (I11)', async () => {
    const g = await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
    await tap(byId('raft-animal-2'))
    await g.relayout(PHONE_L)
    expect(has('raft-aboard-2')).toBe(true)
    expect(flag()).toBe('6')
    await tap(byId('raft-animal-3'))
    await advance(ROW_AT_MS + GLIDE_MS / 2)
    await g.relayout(PHONE_P)
    await advance(
      GLIDE_MS / 2 +
        SCENE_AT_MS +
        SCENE_MS +
        AFTER_SCENE_MS +
        HOP_HOME_STAGGER_MS +
        HOP_HOME_MS,
    )
    expect(homeCount()).toBe(2)
    expect(shoreCount()).toBe(4)
  })
})

describe('N17: VoiceOver', () => {
  it('activate boards and takes off; the raft is labelled, not a button', async () => {
    await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
    expect(byId('raft').props.accessibilityRole).toBeUndefined()
    await activate(byId('raft-animal-4'))
    expect(has('raft-aboard-4')).toBe(true)
    expect(byId('raft').props.accessibilityLabel).toBe('Raft for ten, eight')
    expect(byId('raft-aboard-4').props.accessibilityLabel).toBe('Goat, eight')
    await activate(byId('raft-aboard-4'))
    expect(has('raft-animal-4')).toBe(true)
  })
})
