/**
 * The raft island on screen (raft-island-goal §§ 1-6, 9, 10; ACs I7-I10,
 * I12-I15), through the game frame with fake lines and effects, a seeded
 * shore and an in-memory store holding the learner's progress and island.
 */
import { setKeyValueStore } from '@marian/core'
import { progressAtStep } from '@marian/core/debug/stepProgress'
import { raftLoads } from '@marian/core/games/playPlace'
import { RAFT_ISLAND_STORAGE_KEY } from '@marian/core/games/raftIsland'
import { saveProgress } from '@marian/core/progress'
import { fireEvent, screen } from '@testing-library/react-native'
import * as Reanimated from 'react-native-reanimated'
import {
  activate,
  advance,
  byId,
  has,
  LINE_MS,
  mountGame,
  tap,
} from '../../../test/playHarness'
import { audioForWebPath } from '../../audio/bundledAudio'
import { createManifestLinePlayer } from '../../audio/manifestLines'
import type { AudioEngine } from '../../audio/engine'
import { PLAY_LINE_MANIFEST } from './playLines'
import {
  AFTER_HOMES_MS,
  AFTER_SCENE_MS,
  CHEER_MS,
  CLOSE_GAP_MS,
  FADE_MS,
  GLIDE_MS,
  HOME_BEAT_MS,
  HOP_HOME_MS,
  HOP_HOME_STAGGER_MS,
  PARTY_CLOSE_GAP_MS,
  PARTY_LAP_AT_MS,
  PARTY_LINE_AT_MS,
  RAFT_OPEN_DELAY_MS,
  REDUCED_GLIDE_MS,
  RETURN_MS,
  ROW_AT_MS,
  SCENE_AT_MS,
  SCENE_MS,
  SPLASH_END_MS,
} from './RaftCrossing'
import { RAFT_PICK_AFTER_MS, RAFT_SWAP_MS } from './RaftGame'
import {
  REDUCED_REVEAL_DOCK_AT_MS,
  REVEAL_DOCK_AT_MS,
  REVEAL_POND_AT_MS,
  REVEAL_UNLOCK_GAP_MS,
} from './RaftPicker'

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9]
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

let store: Map<string, string>
let writes: string[]

/** A learner on adding to ten, with `island` home on each raft. */
function seed(island: { 10?: number[]; 20?: number[] } = {}) {
  store = new Map()
  writes = []
  setKeyValueStore({
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      writes.push(k)
      store.set(k, v)
    },
    removeItem: (k) => {
      store.delete(k)
    },
  })
  saveProgress(progressAtStep('add-to-10'))
  store.set(
    RAFT_ISLAND_STORAGE_KEY,
    JSON.stringify({ 10: island[10] ?? [], 20: island[20] ?? [] }),
  )
  writes = []
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  setKeyValueStore(null)
  jest.useRealTimers()
  jest.restoreAllMocks()
})

const shoreIds = () =>
  screen
    .queryAllByTestId(/^raft-animal-\d+$/)
    .map((el) => Number(String(el.props.testID).split('-')[2]))
const weightOf = (id: number) => {
  const label = String(byId(`raft-animal-${id}`).props.accessibilityLabel)
  return NUMBER.indexOf(label.split(', ')[1]!)
}
const flag = () => String(byId('raft-flag').props.children)
const filled = () =>
  screen
    .queryAllByTestId(/^raft-home-\d-animal$/)
    .map((el) => Number(String(el.props.testID).split('-')[2]))
    .sort()
const island = () =>
  JSON.parse(store.get(RAFT_ISLAND_STORAGE_KEY) ?? '{}') as Record<
    string,
    number[]
  >
const back = async () => fireEvent.press(byId('play-game-back'))

/** Boards one load to `target` from the shore (the first `raftLoads` finds). */
async function loadTo(target: 10 | 20, prefer?: number[]) {
  const ids = shoreIds()
  const ws = ids.map(weightOf)
  let load = raftLoads(ws, target)[0]!
  if (prefer) {
    load =
      raftLoads(ws, target).find(
        (l) =>
          l.length === prefer.length && l.every((i) => prefer.includes(ws[i]!)),
      ) ?? load
  }
  for (const i of load) await tap(byId(`raft-animal-${ids[i]}`))
  return load.length
}

/** Reduce Motion: depart → H0 (a 400 ms glide, no scene motion). */
const TO_H0_RM =
  ROW_AT_MS + REDUCED_GLIDE_MS + SCENE_AT_MS + LINE_MS + AFTER_SCENE_MS
/** Reduce Motion: H0 → the return or `P0` (fades at the seats, 150 ms). */
const walkRm = (n: number) =>
  HOP_HOME_STAGGER_MS * (n - 1) + FADE_MS + HOME_BEAT_MS + AFTER_HOMES_MS

/** Depart → H0, the walk home's start. */
const TO_H0 = ROW_AT_MS + GLIDE_MS + SCENE_AT_MS + SCENE_MS + AFTER_SCENE_MS
/** H0 → the return or the party (`P0`), for `n` animals. */
const walk = (n: number) =>
  HOP_HOME_STAGGER_MS * (n - 1) + HOP_HOME_MS + HOME_BEAT_MS + AFTER_HOMES_MS

describe('I7: the island record, and nothing else', () => {
  it('a trip writes only the island key, once per new kind; nothing else changes; no fetch', async () => {
    seed()
    const fetchSpy = jest.fn()
    const realFetch = global.fetch
    global.fetch = fetchSpy as unknown as typeof fetch
    const before = new Map(store)
    await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
    await loadTo(10, [7, 3])
    await advance(TO_H0 + walk(2) + RETURN_MS)
    expect(writes).toEqual([RAFT_ISLAND_STORAGE_KEY, RAFT_ISLAND_STORAGE_KEY])
    expect(island()).toEqual({ 10: [3, 7], 20: [] })
    for (const [k, v] of before) {
      if (k !== RAFT_ISLAND_STORAGE_KEY) expect(store.get(k)).toBe(v)
    }
    expect([...store.keys()].sort()).toEqual([...before.keys()].sort())
    expect(fetchSpy).not.toHaveBeenCalled()
    global.fetch = realFetch
  })

  it('a crossing that brings no new kind writes nothing', async () => {
    seed({ 10: [3, 7] })
    await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
    await loadTo(10, [7, 3])
    await advance(TO_H0 + walk(2) + RETURN_MS)
    expect(writes).toEqual([])
  })

  it('Back mid-crossing keeps every kind already home', async () => {
    seed()
    const g = await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
    await loadTo(10, [7, 3])
    // The hen (3) is home; the dog (7) is still hopping.
    await advance(TO_H0 + HOP_HOME_MS + 10)
    expect(island()[10]).toEqual([3])
    await back()
    expect(g.onExit).toHaveBeenCalledTimes(1)
    await advance(5000)
    expect(island()[10]).toEqual([3])
  })
})

describe('I8: the scene on the deck, the walk home, no crossing cap', () => {
  it('seated at arrival; the scene on the deck; lightest first, 300 ms apart; a fill and a repeat', async () => {
    seed({ 10: [7] })
    const g = await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
    expect(byId('raft-home-7-animal')).toBeTruthy()
    expect(has('raft-home-3-shape')).toBe(true)
    await loadTo(10, [7, 3])
    await advance(ROW_AT_MS + GLIDE_MS)
    expect(screen.queryAllByTestId(/^raft-aboard-\d+$/)).toHaveLength(2)
    await advance(SCENE_AT_MS)
    expect(screen.getAllByTestId(/^raft-scene-/)).toHaveLength(1)
    // The scene is the seated animals': they are still aboard.
    expect(screen.queryAllByTestId(/^raft-aboard-\d+$/)).toHaveLength(2)
    // H0 (and its 0 ms beat): the hen (3) hops first.
    await advance(SCENE_MS + AFTER_SCENE_MS + 10)
    expect(has('raft-hop-1')).toBe(true)
    expect(has('raft-hop-0')).toBe(false)
    const sparkles = g.sfx.sparkle.play.mock.calls.length
    await advance(HOP_HOME_MS + 10)
    // The hen fills: the burst, the sparkle, the shape gone.
    expect(has('raft-home-burst-3')).toBe(true)
    expect(g.sfx.sparkle.play.mock.calls.length).toBe(sparkles + 1)
    expect(has('raft-home-3-shape')).toBe(false)
    expect(has('raft-home-3-animal')).toBe(true)
    expect(has('raft-home-3-settle')).toBe(true)
    // The dog hops 300 ms after the hen.
    expect(has('raft-hop-0')).toBe(true)
    await advance(HOP_HOME_MS)
    // The dog was home: no burst, no sound, the wiggle.
    expect(has('raft-home-burst-7')).toBe(false)
    expect(g.sfx.sparkle.play.mock.calls.length).toBe(sparkles + 1)
    expect(has('raft-home-7-wiggle')).toBe(true)
    expect(filled()).toEqual([3, 7])
  })

  it('twelve crossings with no party all come back; the game never leaves on its own', async () => {
    // A full 10 island: the picker opens; its 10 raft never parties.
    seed({ 10: ALL })
    const g = await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
    await fireEvent.press(byId('raft-pond-10'))
    await advance(RAFT_PICK_AFTER_MS + RAFT_OPEN_DELAY_MS + LINE_MS)
    for (let k = 1; k <= 12; k++) {
      const n = await loadTo(10)
      expect(flag()).toBe('10')
      await advance(TO_H0 - AFTER_SCENE_MS)
      const lines = g.lines.length
      const poses = g.poses.length
      await advance(AFTER_SCENE_MS + walk(n) + RETURN_MS)
      // After the scene: no line, no wave; the raft is back and full.
      expect(g.lines.length).toBe(lines)
      expect(g.poses.slice(poses)).not.toContain('waving')
      expect(shoreIds()).toHaveLength(6)
      expect(screen.queryAllByTestId(/^raft-aboard-\d+$/)).toHaveLength(0)
      expect(byId('raft').props.accessibilityLabel).toBe('Raft for ten')
    }
    expect(g.lines).not.toContain('guide.play.raft.close')
    expect(g.lines).not.toContain('guide.play.raft.party')
    expect(has('raft-lap')).toBe(false)
    expect(g.onExit).not.toHaveBeenCalled()
    await advance(30_000)
    expect(g.onExit).not.toHaveBeenCalled()
    // Back still leaves at once: to the picker (two rafts open), then
    // the Play place.
    await back()
    expect(has('raft-picker')).toBe(true)
    await back()
    expect(g.onExit).toHaveBeenCalledTimes(1)
  })
})

/**
 * Carries the pig (9) and the bee (1) over (with the fox and the duck on
 * the 20 raft) and stops at `P0`.
 */
async function ninthCrossing(target: 10 | 20 = 10, reduced = false) {
  const g = await mountGame('raft', { shore: [9, 1, 6, 4, 8, 2] })
  const toP0 = (n: number) => (reduced ? TO_H0_RM + walkRm(n) : TO_H0 + walk(n))
  if (target === 20) {
    await fireEvent.press(byId('raft-pond-20'))
    await advance(RAFT_PICK_AFTER_MS + RAFT_SWAP_MS)
    await loadTo(20, [9, 1, 6, 4])
    await advance(toP0(4))
  } else {
    await loadTo(10, [9, 1])
    await advance(toP0(2))
  }
  return g
}

describe('I9: the party', () => {
  it('the ninth kind: celebration, the lap, "You did it!", the cheer and burst, the close line, then the reveal', async () => {
    seed({ 10: [1, 2, 3, 4, 5, 6, 7, 8] })
    const g = await ninthCrossing()
    // P0: touch locked, Emma celebrates.
    expect(g.poses.at(-1)).toBe('celebration')
    expect(island()[10]).toEqual(ALL)
    const plinks = g.sfx.plink.play.mock.calls.length
    await tap(byId(`raft-animal-${shoreIds()[0]}`))
    expect(g.sfx.plink.play.mock.calls.length).toBe(plinks)
    expect(screen.queryAllByTestId(/^raft-aboard-\d+$/)).toHaveLength(0)
    await advance(PARTY_LAP_AT_MS)
    expect(has('raft-lap')).toBe(true)
    await advance(PARTY_LINE_AT_MS - PARTY_LAP_AT_MS)
    expect(g.poses.at(-1)).toBe('cheering')
    expect(g.lines.at(-1)).toBe('guide.play.raft.party')
    expect(byId('play-game-ribbon')).toBeTruthy()
    const cheers = g.sfx.cheer.play.mock.calls.length
    await advance(LINE_MS)
    expect(g.sfx.cheer.play.mock.calls.length).toBe(cheers + 1)
    expect(has('raft-party-burst')).toBe(true)
    expect(has('raft-dance')).toBe(true)
    await advance(CHEER_MS + PARTY_CLOSE_GAP_MS)
    expect(g.lines.at(-1)).toBe('guide.play.raft.close')
    expect(g.lines.filter((l) => l === 'guide.play.raft.party')).toHaveLength(1)
    await advance(LINE_MS + CLOSE_GAP_MS)
    // R0: the picker, the 10 pond full; the 20 pond not yet.
    expect(has('raft-picker')).toBe(true)
    expect(has('raft-pond-10')).toBe(true)
    expect(has('raft-pond-20')).toBe(false)
    expect(g.poses.at(-1)).toBe('idle')
    for (const w of ALL) expect(has(`raft-pond-10-home-${w}-animal`)).toBe(true)
    await advance(REVEAL_POND_AT_MS)
    expect(has('raft-pond-20')).toBe(true)
    expect(has('raft-reveal-glide')).toBe(true)
    for (const w of ALL) expect(has(`raft-pond-20-home-${w}-shape`)).toBe(true)
    // Touch stays locked through the reveal.
    expect(byId('raft-pond-10').props.accessibilityState?.disabled).toBe(true)
    const sparkles = g.sfx.sparkle.play.mock.calls.length
    await advance(REVEAL_DOCK_AT_MS - REVEAL_POND_AT_MS)
    expect(g.sfx.sparkle.play.mock.calls.length).toBe(sparkles + 1)
    expect(g.poses.at(-1)).toBe('celebration')
    await advance(REVEAL_UNLOCK_GAP_MS)
    expect(g.poses.at(-1)).toBe('idle')
    expect(byId('raft-pond-20').props.accessibilityState?.disabled).toBe(false)
    expect(g.onExit).not.toHaveBeenCalled()
    // The picker waits for ever, silent.
    const lines = g.lines.length
    await advance(20_000)
    expect(g.lines.length).toBe(lines)
  })

  it('Back works through the party', async () => {
    seed({ 10: [1, 2, 3, 4, 5, 6, 7, 8] })
    const g = await ninthCrossing()
    await advance(PARTY_LINE_AT_MS + LINE_MS)
    await back()
    expect(g.onExit).toHaveBeenCalledTimes(1)
  })

  it('after the 20 island’s party the picker shows with no reveal', async () => {
    seed({ 10: ALL, 20: [2, 3, 5, 6, 7, 8, 9, 4].filter((w) => w !== 4) })
    // 20 island lacks 1 and 4: the 9 + 1 + 6 + 4 load fills both.
    const g = await ninthCrossing(20)
    expect(g.poses.at(-1)).toBe('celebration')
    await advance(PARTY_LINE_AT_MS + LINE_MS + CHEER_MS + PARTY_CLOSE_GAP_MS)
    expect(g.lines.at(-1)).toBe('guide.play.raft.close')
    await advance(LINE_MS + CLOSE_GAP_MS)
    expect(has('raft-picker')).toBe(true)
    expect(has('raft-pond-20')).toBe(true)
    expect(has('raft-reveal-glide')).toBe(false)
    expect(byId('raft-pond-20').props.accessibilityState?.disabled).toBe(false)
    expect(island()[20]).toEqual(ALL)
  })
})

describe('I10: the picker', () => {
  it('absent with one raft open', async () => {
    seed({ 10: [1, 2, 3] })
    await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
    expect(has('raft-picker')).toBe(false)
    expect(has('raft-crossing')).toBe(true)
  })

  it('with two it opens first; a pond starts that raft; Back goes to the picker, then the Play place', async () => {
    seed({ 10: ALL })
    const g = await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
    expect(has('raft-picker')).toBe(true)
    expect(has('raft-crossing')).toBe(false)
    await advance(2000)
    expect(g.lines).toEqual([])
    await fireEvent.press(byId('raft-pond-20'))
    expect(g.sfx.plink.play).toHaveBeenCalledTimes(1)
    await advance(RAFT_PICK_AFTER_MS)
    expect(has('raft-crossing')).toBe(true)
    expect(byId('raft-target').props.children).toBe('20')
    await advance(RAFT_OPEN_DELAY_MS)
    expect(g.lines.at(-1)).toBe('guide.play.raft.open.20')
    // Back from the trip: the picker, silent, no exit.
    await tap(byId(`raft-animal-${shoreIds()[0]}`))
    const lines = g.lines.length
    await back()
    expect(g.onExit).not.toHaveBeenCalled()
    expect(has('raft-picker')).toBe(true)
    await advance(10_000)
    expect(g.lines.length).toBe(lines)
    // Back from the picker: the Play place.
    await back()
    expect(g.onExit).toHaveBeenCalledTimes(1)
  })
})

describe('I12, I13: the 20 raft', () => {
  it('the flag counts to 20, the totals are spoken, the board says 20 throughout', async () => {
    seed({ 10: ALL })
    const g = await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
    await fireEvent.press(byId('raft-pond-20'))
    await advance(RAFT_PICK_AFTER_MS + RAFT_SWAP_MS)
    const ids = shoreIds()
    await tap(byId(`raft-animal-${ids[0]}`))
    await tap(byId(`raft-animal-${ids[1]}`))
    expect(flag()).toBe('10')
    expect(g.lines.at(-1)).toBe('guide.play.raft.total.10')
    await tap(byId(`raft-animal-${ids[2]}`))
    expect(flag()).toBe('16')
    expect(g.lines.at(-1)).toBe('guide.play.raft.total.16')
    expect(byId('raft').props.accessibilityLabel).toBe(
      'Raft for twenty, sixteen',
    )
    expect(byId('raft-target').props.children).toBe('20')
    await tap(byId(`raft-animal-${ids[3]}`))
    expect(flag()).toBe('20')
    expect(g.lines.at(-1)).toBe('guide.play.raft.go.20')
    await advance(TO_H0)
    expect(byId('raft-target').props.children).toBe('20')
  })

  it('stuck: after two splashes a newcomer of raftNewcomer’s weight walks in, unannounced; boarding it makes 20', async () => {
    seed({ 10: ALL })
    const g = await mountGame('raft', { shore: [9, 9, 5, 6, 7, 8] })
    await fireEvent.press(byId('raft-pond-20'))
    await advance(RAFT_PICK_AFTER_MS + RAFT_SWAP_MS)
    const [a, b, c, d] = shoreIds()
    await tap(byId(`raft-animal-${a}`))
    await tap(byId(`raft-animal-${b}`))
    expect(flag()).toBe('18')
    await tap(byId(`raft-animal-${c}`))
    await advance(SPLASH_END_MS)
    const linesBefore = g.lines.length
    const plinks = g.sfx.plink.play.mock.calls.length
    await tap(byId(`raft-animal-${d}`))
    await advance(SPLASH_END_MS)
    const fresh = shoreIds().filter((id) => id > 5)
    expect(fresh).toHaveLength(1)
    expect(byId(`raft-animal-${fresh[0]}`).props.accessibilityLabel).toBe(
      'Frog, two',
    )
    expect(g.lines.slice(linesBefore)).toEqual(['guide.play.raft.splash'])
    expect(g.sfx.plink.play.mock.calls.length).toBe(plinks)
    expect(g.poses.at(-1)).toBe('idle')
    await tap(byId(`raft-animal-${fresh[0]}`))
    expect(g.lines.at(-1)).toBe('guide.play.raft.go.20')
  })

  it('the 10 raft’s board says 10 and never changes', async () => {
    seed()
    await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
    expect(byId('raft-target').props.children).toBe('10')
    await loadTo(10, [7, 3])
    await advance(TO_H0 + walk(2) + RETURN_MS)
    expect(byId('raft-target').props.children).toBe('10')
  })
})

describe('I14: Reduce Motion', () => {
  beforeEach(() => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
  })

  it('a fill and a repeat: fades only; the sparkle still sounds', async () => {
    seed({ 10: [7] })
    const g = await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
    await loadTo(10, [7, 3])
    const sparkles = g.sfx.sparkle.play.mock.calls.length
    await advance(TO_H0_RM + walkRm(2))
    expect(g.sfx.sparkle.play.mock.calls.length).toBe(sparkles + 1)
    expect(screen.queryAllByTestId(/^raft-home-burst-/)).toHaveLength(0)
    expect(screen.queryAllByTestId(/-settle$/)).toHaveLength(0)
    expect(screen.queryAllByTestId(/-wiggle$/)).toHaveLength(0)
    expect(has('raft-home-7-dim')).toBe(true)
    expect(screen.queryAllByTestId(/^raft-scene-/)).toHaveLength(0)
    expect(has('raft-rowing')).toBe(false)
    expect(filled()).toEqual([3, 7])
  })

  it('the party brightens instead of the lap, dance and burst; the reveal fades; lines keep their times', async () => {
    seed({ 10: [1, 2, 3, 4, 5, 6, 7, 8] })
    const g = await ninthCrossing(10, true)
    expect(g.poses.at(-1)).toBe('celebration')
    await advance(PARTY_LAP_AT_MS)
    expect(has('raft-lap')).toBe(false)
    expect(has('raft-brighten')).toBe(true)
    await advance(PARTY_LINE_AT_MS - PARTY_LAP_AT_MS)
    expect(g.lines.at(-1)).toBe('guide.play.raft.party')
    await advance(LINE_MS)
    expect(has('raft-party-burst')).toBe(false)
    expect(has('raft-dance')).toBe(false)
    await advance(CHEER_MS + PARTY_CLOSE_GAP_MS)
    expect(g.lines.at(-1)).toBe('guide.play.raft.close')
    await advance(LINE_MS + CLOSE_GAP_MS + REVEAL_POND_AT_MS)
    expect(has('raft-pond-20')).toBe(true)
    expect(has('raft-reveal-glide')).toBe(false)
    const sparkles = g.sfx.sparkle.play.mock.calls.length
    await advance(REDUCED_REVEAL_DOCK_AT_MS - REVEAL_POND_AT_MS)
    expect(g.sfx.sparkle.play.mock.calls.length).toBe(sparkles + 1)
    await advance(REVEAL_UNLOCK_GAP_MS)
    expect(byId('raft-pond-20').props.accessibilityState?.disabled).toBe(false)
  })
})

describe('I15: VoiceOver', () => {
  it('homes, the raft and the ponds are labelled; the picker’s insides are hidden', async () => {
    seed({ 10: [3, 9] })
    await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
    expect(byId('raft-home-9').props.accessibilityLabel).toBe('Pig, nine, home')
    expect(byId('raft-home-1').props.accessibilityLabel).toBe(
      'Bee, one, empty home',
    )
    expect(byId('raft-home-9').props.accessibilityRole).toBeUndefined()
    expect(byId('raft').props.accessibilityLabel).toBe('Raft for ten')
    await activate(byId(`raft-animal-${shoreIds()[0]}`))
    expect(byId('raft').props.accessibilityLabel).toBe('Raft for ten, seven')
    await screen.unmount()

    seed({ 10: ALL, 20: [1] })
    await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
    for (const [t, label] of [
      [10, 'Raft for ten'],
      [20, 'Raft for twenty'],
    ] as const) {
      const pond = byId(`raft-pond-${t}`)
      expect(pond.props.accessibilityRole).toBe('button')
      expect(pond.props.accessibilityLabel).toBe(label)
      expect(byId(`raft-pond-${t}-raft`).props.accessible).toBe(false)
      expect(
        byId(`raft-pond-${t}-home-1`).props.accessibilityLabel,
      ).toBeUndefined()
    }
  })
})

describe('the 20 raft’s lines: a missing clip stays silent and safe', () => {
  it('each plays its clip when bundled, else walks its caption and resolves', async () => {
    jest.useRealTimers()
    const speak = jest.fn(() => Promise.resolve())
    const engine = {
      speak,
      cancelVoice: jest.fn(),
      voice: { activeLabel: null },
      releasePrefix: jest.fn(),
    } as unknown as AudioEngine
    const player = createManifestLinePlayer('play', PLAY_LINE_MANIFEST, engine)
    const ids = [
      'guide.play.raft.open.20',
      'guide.play.raft.go.20',
      ...[10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map(
        (t) => `guide.play.raft.total.${t}`,
      ),
    ] as const
    for (const id of ids) {
      const line = PLAY_LINE_MANIFEST[id as keyof typeof PLAY_LINE_MANIFEST]
      expect(line.src).not.toBeNull()
      const bundled = audioForWebPath(line.src!) !== undefined
      speak.mockClear()
      const ticks: number[] = []
      await expect(
        player.playLine(id as keyof typeof PLAY_LINE_MANIFEST, {
          onWordTick: (i) => ticks.push(i),
        }),
      ).resolves.toBeUndefined()
      expect(speak).toHaveBeenCalledTimes(bundled ? 1 : 0)
      if (!bundled) expect(ticks.length).toBeGreaterThan(0)
    }
  })
})
