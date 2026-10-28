/**
 * Letter critters' four-letter rounds on screen (`design/native/critters-four-letter.md`
 * § 3-§ 8, ACs F11-F19; since the pictured-only boards, § 15, F28), for a
 * learner past cvc-words with short o current. The four-letter round is
 * a c d l m p s, a round of the pictured-only rule: targets caps, clap,
 * lamp, maps, every one pictured (lamp a lesson word with its praise), in
 * that board order; extras camp, damp, slap; d the decoy. F28's round is
 * the `critters-hunt-four` seed's, a b c d n s t (ants bats cats sand;
 * band the extra). The roll-in rounds are the `critters-hunt` seed's,
 * a b f g h t (§ 16.4). Sounds go through the fake tap-sound player.
 */
import { setKeyValueStore } from '@marian/core'
import { progressAtStep } from '@marian/core/debug/stepProgress'
import { critterWordLine } from '@marian/core/emmasPath/guidanceLines'
import {
  freshHuntRecord,
  HUNT_STORAGE_KEY,
  huntBoardOrder,
  huntFind,
  huntOpenLengths,
  huntRoundOf,
  loadHuntRecord,
  saveHuntRecord,
  type HuntLength,
  type HuntRound,
} from '@marian/core/games/critterHunt'
import {
  CRITTER_PICTURE_WORDS,
  CRITTER_SOUND_SOURCE,
} from '@marian/core/games/playPlace'
import { saveProgress } from '@marian/core/progress'
import { act, fireEvent, screen, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import * as Reanimated from 'react-native-reanimated'
import { letterWindow, wordWindow } from '../../audio/blendMarks'
import { audioForWebPath } from '../../audio/bundledAudio'
import { mathLayout } from '../../layout/mathLayout'
import {
  activate,
  advance,
  byId,
  dragRelease,
  dragStart,
  fakeSounds,
  has,
  LINE_MS,
  mountGame,
  PHONE_L,
  PHONE_P,
  seeded,
  tap,
} from '../../../test/playHarness'
import { blendClipPath, blendSegments } from './critterModel'
import { FILL_LAND_FOUR_MS, FILL_LAND_MS } from './HuntBoard'
import {
  PICK_AFTER_MS,
  PICK_DIM_MS,
  PICK_HOP_MS,
  PICK_WAVE_GAP_MS,
  PICK_WAVE_STAGGER_MS,
  ROLL_DONE_MS,
  ROLL_FLY_AT_MS,
  ROLL_GLIDE_MS,
} from './HuntLengths'
import {
  CRITTERS_OPEN_DELAY_MS,
  EMPTY_SEAT_REST_MS,
  JOY_HOLD_MS,
  PICTURE_HOLD_MS,
  PRAISE_AFTER_MS,
  SHELF_DROP_MS,
  SHELF_HOLD_MS,
  SING_AFTER_MS,
  SOUND_GAP_MS,
} from './LetterCritters'
import { backRect, doorRect, pickerScene, playArea } from './playGeometry'

const FOUR = ['a', 'c', 'd', 'l', 'm', 'p', 's']
const FOUR_BOARD = ['caps', 'clap', 'lamp', 'maps']
/** The `critters-hunt-four` seed's round (critters-four-letter.md F28, F29). */
const SEED_FOUR = ['a', 'b', 'c', 'd', 'n', 's', 't']
/** The `critters-hunt` seed's round (critters-word-hunt.md § 16.4). */
const THREE = ['a', 'b', 'f', 'g', 'h', 't']
/**
 * Q30: a four-letter round stored under the old rule (build 24), with its
 * listen slots camp and damp: it reopens as stored.
 */
const OLD_FOUR: HuntRound = {
  letters: ['a', 'b', 'c', 'd', 'l', 'm', 'p'],
  targets: ['camp', 'clap', 'damp', 'lamp'],
  extras: [],
}

// --- Sounds ------------------------------------------------------------------

const clipOf = (word: string) => audioForWebPath(blendClipPath(word)) as number
const BLEND = new Map(CRITTER_PICTURE_WORDS.map((w) => [clipOf(w), w]))
const WHOLE_TAIL = 200
const SAID_MS = 500
const wholeMs = (uri: string | number) => {
  const w = BLEND.get(uri as number)
  return w === undefined ? SAID_MS : blendSegments(w)![3]![1] + WHOLE_TAIL
}
const saidClipOf = (word: string) =>
  audioForWebPath(critterWordLine(word)!.src!) as number
function letterCall(letter: string) {
  const src = CRITTER_SOUND_SOURCE[letter]!
  const w = letterWindow(blendSegments(src.word)![src.index]!)
  return { uri: clipOf(src.word), from: w.from, to: w.to }
}
const ownMs = (letter: string) => {
  const w = letterCall(letter)
  return w.to - w.from
}
function wordSound(word: string) {
  if (CRITTER_PICTURE_WORDS.includes(word)) {
    const w = wordWindow(blendSegments(word)!)
    return { uri: clipOf(word), from: w.from, to: null }
  }
  return { uri: saidClipOf(word), from: 0, to: null }
}

// --- The learner ---------------------------------------------------------------

let store = new Map<string, string>()
let writes: string[] = []

/**
 * The learner in a fresh store: her rounds of each length and her open
 * lengths. `round` is the four-letter round stored (default `FOUR`'s).
 */
function learner({
  open = [3, 4],
  four,
  round,
  three,
}: {
  open?: HuntLength[]
  four?: string[]
  round?: HuntRound
  three?: { letters: string[]; found: string[] }
} = {}) {
  store = new Map()
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
  saveProgress(progressAtStep('cvc-words-short-o'))
  if (three) {
    const r = huntRoundOf(three.letters)!
    saveHuntRecord(three.found.reduce(huntFind, freshHuntRecord(r)))
  }
  if (four) {
    const r = round ?? huntRoundOf(FOUR, { length: 4 })!
    saveHuntRecord(four.reduce(huntFind, freshHuntRecord(r)), 4)
  }
  if (open.includes(4)) {
    const all = JSON.parse(store.get(HUNT_STORAGE_KEY) ?? '{}') as object
    store.set(HUNT_STORAGE_KEY, JSON.stringify({ ...all, open: [3, 4] }))
  }
  writes = []
}

async function mount(opts: { viewport?: typeof PHONE_P } = {}) {
  const s = fakeSounds(wholeMs)
  const g = await mountGame('critters', {
    sounds: s.sounds,
    rng: seeded(5),
    ...opts,
  })
  return { ...g, ...s }
}
/** The picker's slab for `length`, then its round's entry. */
async function pick(length: 3 | 4) {
  await fireEvent.press(byId(`hunt-pick-${length}`))
  await advance(PICK_AFTER_MS + CRITTERS_OPEN_DELAY_MS + LINE_MS)
}
async function mountFour(found = ['clap', 'lamp']) {
  learner({ four: found })
  const g = await mount()
  await pick(4)
  return g
}

const seated = () => [0, 1, 2, 3].filter((i) => has(`critter-seat-${i}`))
const meadow = () =>
  screen
    .queryAllByTestId(/^critter-[a-z]$/)
    .map((el) => String(el.props.testID).slice(-1))
const locked = () =>
  screen.queryAllByTestId(/^critter-[a-z]$/).at(-1)?.props.accessibilityState
    ?.disabled === true
const tilesOf = (i: number) =>
  [0, 1, 2, 3]
    .filter((k) => has(`hunt-slot-${i}-tile-${k}`))
    .map((k) => {
      const el = byId(`hunt-slot-${i}-tile-${k}`)
      return within(el).getByText(/^[a-z]$/).props.children as string
    })
    .join('')
const flat = (el: ReturnType<typeof byId>) => StyleSheet.flatten(el.props.style)

async function seat(...letters: string[]) {
  for (const l of letters) await activate(byId(`critter-${l}`))
}
/** Seats `word` and plays it out until the board is free again. */
async function build(word: string, cap = 30000) {
  await seat(...word)
  await advance(SING_AFTER_MS)
  for (let t = 0; t < cap; t += 50) {
    if (!locked() && seated().length === 0) return
    await advance(50)
  }
  throw new Error(`the board never freed after ${word}`)
}
/** Advances until `pred` holds; the ms it took. */
async function until(pred: () => boolean, cap = 60000) {
  for (let t = 0; t <= cap; t += 10) {
    if (pred()) return t
    await advance(10)
  }
  throw new Error('never')
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

describe('F11: the four-letter log', () => {
  it('4 seats and 4 sockets, "4" on the log, "Log, four letters"; 7 critters 4 + 3', async () => {
    await mountFour()
    expect(meadow()).toEqual(FOUR)
    expect([0, 1, 2, 3].every((i) => has(`critter-log-socket-${i}`))).toBe(true)
    expect(has('critter-log-socket-4')).toBe(false)
    expect(within(byId('critter-log-numeral')).getByText('4')).toBeTruthy()
    expect(byId('critter-log').props.accessibilityLabel).toBe(
      'Log, four letters',
    )
    await seat('d', 'a', 'm')
    expect(seated()).toEqual([0, 1, 2])
  })

  it('no rendered text but the length has a digit; no label states a count', async () => {
    await mountFour()
    const texts = byId('play-game')
      .queryAll((n) => n.type === 'Text')
      .map((n) => [n.props.children].flat().join(''))
    expect(texts.filter((t) => /\d/.test(t))).toEqual(['4'])
    const labels = byId('play-game')
      .queryAll((n) => typeof n.props.accessibilityLabel === 'string')
      .map((n) => n.props.accessibilityLabel as string)
    expect(labels.filter((l) => /\d/.test(l))).toEqual([])
  })
})

describe('F12: runs of four', () => {
  it('1-3 seated make no sound for 5 s; neighbours lean; nothing is written', async () => {
    const g = await mountFour()
    const calls = g.calls.length
    const lines = g.lines.length
    await seat('c', 'a', 'p')
    await advance(5000)
    expect(g.calls).toHaveLength(calls)
    expect(g.lines).toHaveLength(lines)
    expect(seated()).toEqual([0, 1, 2])
    expect(writes).toEqual([])
  })

  it('a log tap sings them left to right, 300 ms apart; no outcome, clear or write', async () => {
    const g = await mountFour()
    await seat('c', 'a', 'p')
    await advance(1000)
    const from = g.calls.length
    await fireEvent.press(byId('critter-log'))
    expect(g.poses.at(-1)).toBe('listening')
    expect(g.calls.slice(from)).toEqual([letterCall('c')])
    await advance(ownMs('c') + SOUND_GAP_MS - 10)
    expect(g.calls.slice(from)).toHaveLength(1)
    await advance(10)
    expect(g.calls.slice(from)).toEqual([letterCall('c'), letterCall('a')])
    await advance(ownMs('a') + SOUND_GAP_MS)
    expect(g.calls.slice(from)).toEqual([
      letterCall('c'),
      letterCall('a'),
      letterCall('p'),
    ])
    await advance(ownMs('p'))
    expect(g.poses.at(-1)).toBe('idle')
    await advance(5000)
    expect(g.calls.slice(from)).toHaveLength(3)
    expect(seated()).toEqual([0, 1, 2])
    expect(locked()).toBe(false)
    expect(writes).toEqual([])
  })

  it('the gap across one empty middle seat is 900 ms; across two, 1500 ms', async () => {
    const g = await mountFour()
    // c _ a p: seat four, then send seat 2's critter (s) home at once.
    await seat('c', 's', 'a', 'p')
    await activate(byId('critter-seat-1'))
    await advance(1000)
    let from = g.calls.length
    await fireEvent.press(byId('critter-log'))
    await advance(ownMs('c') + SOUND_GAP_MS + EMPTY_SEAT_REST_MS - 10)
    expect(g.calls.slice(from)).toEqual([letterCall('c')])
    await advance(10)
    expect(g.calls.slice(from)).toEqual([letterCall('c'), letterCall('a')])
    await advance(ownMs('a') + SOUND_GAP_MS)
    expect(g.calls.slice(from)).toHaveLength(3)
    await advance(2000)

    // c _ _ p.
    await activate(byId('critter-seat-2'))
    await advance(1000)
    from = g.calls.length
    await fireEvent.press(byId('critter-log'))
    await advance(ownMs('c') + SOUND_GAP_MS + 2 * EMPTY_SEAT_REST_MS - 10)
    expect(g.calls.slice(from)).toEqual([letterCall('c')])
    await advance(10)
    expect(g.calls.slice(from)).toEqual([letterCall('c'), letterCall('p')])
  })

  it('a drag start or a seat change cuts the song; Emma idles', async () => {
    const g = await mountFour()
    await seat('c', 'a')
    await advance(1000)
    let from = g.calls.length
    await fireEvent.press(byId('critter-log'))
    await dragStart(byId('critter-m'), { x: 5, y: 5 })
    expect(g.poses.at(-1)).toBe('idle')
    await advance(3000)
    expect(g.calls.slice(from)).toEqual([letterCall('c')])
    await dragRelease(byId('critter-m'), { x: 5, y: 5 })
    await advance(1000)

    from = g.calls.length
    await fireEvent.press(byId('critter-log'))
    await activate(byId('critter-seat-1'))
    expect(g.poses.at(-1)).toBe('idle')
    await advance(3000)
    expect(g.calls.slice(from)).toEqual([letterCall('c')])
    expect(g.poses.at(-1)).toBe('idle')
  })

  it('a critter tap mid-song cuts it: her own sound plays out, nothing follows; Emma idles', async () => {
    const g = await mountFour()
    await seat('c', 'a', 'p')
    await advance(1000)
    // In the meadow: before the fix the song carried on, c m a p.
    let from = g.calls.length
    await fireEvent.press(byId('critter-log'))
    await advance(50)
    await tap(byId('critter-m'))
    const atTap = g.poses.at(-1)
    await advance(5000)
    expect(g.calls.slice(from)).toEqual([letterCall('c'), letterCall('m')])
    expect(atTap).toBe('idle')
    expect(g.poses.at(-1)).toBe('idle')

    // On a seat.
    from = g.calls.length
    await fireEvent.press(byId('critter-log'))
    await advance(50)
    await tap(byId('critter-seat-2'))
    await advance(5000)
    expect(g.calls.slice(from)).toEqual([letterCall('c'), letterCall('p')])
    expect(g.poses.at(-1)).toBe('idle')

    // VoiceOver's Hear on a meadow critter.
    from = g.calls.length
    await fireEvent.press(byId('critter-log'))
    await advance(50)
    await activate(byId('critter-d'), 'hear')
    await advance(5000)
    expect(g.calls.slice(from)).toEqual([letterCall('c'), letterCall('d')])
    expect(g.poses.at(-1)).toBe('idle')
  })

  it('a slot tap or the app going to the background cuts it too; Emma idles', async () => {
    const g = await mountFour()
    await seat('c', 'a', 'p')
    await advance(1000)
    let from = g.calls.length
    await fireEvent.press(byId('critter-log'))
    await advance(50)
    await fireEvent.press(byId('hunt-slot-3'))
    await advance(5000)
    expect(g.calls.slice(from)).toEqual([
      letterCall('c'),
      { uri: saidClipOf('maps'), from: 0, to: null },
    ])
    expect(g.poses.at(-1)).toBe('idle')

    from = g.calls.length
    await fireEvent.press(byId('critter-log'))
    await advance(50)
    await act(async () => g.visibility.set(true))
    expect(g.poses.at(-1)).toBe('idle')
    await act(async () => g.visibility.set(false))
    await advance(5000)
    expect(g.calls.slice(from)).toEqual([letterCall('c')])
    expect(g.poses.at(-1)).toBe('idle')
  })

  it('four seated sing 400 ms after the last seat change', async () => {
    const g = await mountFour()
    await seat('c', 'a', 'm', 'p')
    const from = g.calls.length
    await advance(SING_AFTER_MS - 10)
    expect(g.calls.slice(from)).toEqual([])
    await advance(10)
    expect(g.calls.slice(from)).toEqual([letterCall('c')])
  })

  it('Q30, a round stored before the pictured-only boards: its unpictured target, Emma says it with its caption; the joy beat; 1200 ms on, four tiles into its own (listen) slot; the shelf clears 400 ms after the last lands', async () => {
    learner({ four: ['clap', 'lamp'], round: OLD_FOUR })
    const g = await mount()
    await pick(4)
    expect(meadow()).toEqual(OLD_FOUR.letters)
    expect(has('hunt-slot-2-listen')).toBe(true)
    await seat('c', 'a', 'm', 'p')
    await advance(SING_AFTER_MS)
    const sung = ['c', 'a', 'm', 'p'].reduce(
      (t, l) => t + ownMs(l) + SOUND_GAP_MS,
      0,
    )
    await advance(sung)
    expect(g.lines.at(-1)).toBe('guide.play.critters.word.camp')
    expect(g.poses.at(-1)).toBe('attentive-pointing')
    expect(byId('play-game-ribbon').props.accessibilityLabel).toBe('Camp.')
    const cheers = g.sfx.cheer.play.mock.calls.length
    await advance(LINE_MS)
    expect(g.poses.at(-1)).toBe('cheering')
    expect(g.sfx.cheer.play).toHaveBeenCalledTimes(cheers + 1)
    expect(has('critter-burst')).toBe(true)
    expect(has('critter-picture')).toBe(false)
    await advance(JOY_HOLD_MS - 10)
    expect(has('hunt-fly-0')).toBe(false)
    await advance(10)
    expect([0, 1, 2, 3].map((i) => has(`hunt-fly-${i}`))).toEqual([
      true,
      true,
      true,
      true,
    ])
    expect(g.poses.at(-1)).toBe('idle')
    await advance(FILL_LAND_FOUR_MS + SHELF_HOLD_MS - 10)
    expect(seated()).toEqual([0, 1, 2, 3])
    await advance(10 + SHELF_DROP_MS)
    expect(seated()).toEqual([])
    expect(tilesOf(2)).toBe('camp')
    expect(loadHuntRecord(4)!.found).toEqual(['clap', 'lamp', 'camp'])
  })

  it('a pictured lesson word: its picture at the joy beat, its praise 1200 ms on, once a visit; the fill at 2400 ms', async () => {
    const g = await mountFour([])
    await seat('l', 'a', 'm', 'p')
    await advance(SING_AFTER_MS)
    await until(() => g.lines.at(-1) === 'guide.play.critters.word.lamp')
    await advance(LINE_MS)
    expect(g.poses.at(-1)).toBe('cheering')
    expect(has('critter-picture-lamp')).toBe(true)
    await advance(PRAISE_AFTER_MS - 10)
    expect(g.lines.at(-1)).toBe('guide.play.critters.word.lamp')
    await advance(10)
    expect(g.lines.at(-1)).toBe('guide.play.critters.praise.lamp')
    await advance(PICTURE_HOLD_MS - PRAISE_AFTER_MS - 10)
    expect(has('hunt-fly-0')).toBe(false)
    await advance(10)
    expect(has('hunt-fly-0')).toBe(true)
    await advance(5000)
    expect(tilesOf(2)).toBe('lamp')
    // Again this visit: no praise, its slot wiggles.
    await build('lamp')
    expect(
      g.lines.filter((l) => l === 'guide.play.critters.praise.lamp'),
    ).toHaveLength(1)
    // Back to the picker and in again: still none (the visit's).
    await fireEvent.press(byId('play-game-back'))
    await pick(4)
    await build('lamp')
    expect(
      g.lines.filter((l) => l === 'guide.play.critters.praise.lamp'),
    ).toHaveLength(1)
  })

  it('a pictured word that is no lesson word has no praise', async () => {
    const g = await mountFour([])
    await build('clap')
    expect(g.lines).toContain('guide.play.critters.word.clap')
    expect(g.lines.filter((l) => l.includes('praise'))).toEqual([])
    expect(tilesOf(1)).toBe('clap')
  })

  it('a non-target sings, then sits: no line, no boing; the shelf clears', async () => {
    const g = await mountFour()
    const lines = g.lines.length
    await build('clam')
    expect(g.lines).toHaveLength(lines)
    expect(g.sfx.boing.play).not.toHaveBeenCalled()
    expect(has('critter-tumble')).toBe(false)
    expect(loadHuntRecord(4)!.found).toEqual(['clap', 'lamp'])
  })
})

describe('F13: never a bonus chip, boing, tumble or non-word line', () => {
  it('over quiet runs, partial runs, a three-letter word, an extra and a target', async () => {
    const g = await mountFour()
    for (const w of ['clam', 'slam', 'pasd', 'dcma']) await build(w)
    await seat('c', 'a', 'p')
    await fireEvent.press(byId('critter-log'))
    await advance(3000)
    await activate(byId('critter-seat-0'))
    await activate(byId('critter-seat-1'))
    await activate(byId('critter-seat-2'))
    await build('damp')
    await build('maps')
    expect(loadHuntRecord(4)!.found).toEqual(['clap', 'lamp', 'damp', 'maps'])
    expect(has('hunt-bonus')).toBe(false)
    expect(g.sfx.boing.play).not.toHaveBeenCalled()
    expect(g.lines.filter((l) => l.includes('funny'))).toEqual([])
  })
})

describe('F28: an extra in a four-letter round (critters-four-letter.md § 15.3)', () => {
  /** The `critters-hunt-four` seed's learner: ants and bats found. */
  async function mountSeed() {
    learner({
      four: ['ants', 'bats'],
      round: huntRoundOf(SEED_FOUR, { length: 4 })!,
    })
    const g = await mount()
    await pick(4)
    expect(meadow()).toEqual(SEED_FOUR)
    return g
  }
  const sung = ['b', 'a', 'n', 'd'].reduce(
    (t, l) => t + ownMs(l) + SOUND_GAP_MS,
    0,
  )

  it('band: Emma’s line and caption, the joy beat, no picture and no praise; no tile in any slot, no chip; the shelf holds 400 ms from her line’s end + 1200, then drops; a repeat does the same', async () => {
    const g = await mountSeed()
    for (const time of ['first', 'repeat']) {
      const cheers = g.sfx.cheer.play.mock.calls.length
      await seat('b', 'a', 'n', 'd')
      await advance(SING_AFTER_MS + sung)
      expect([time, g.lines.at(-1)]).toEqual([
        time,
        'guide.play.critters.word.band',
      ])
      expect(g.poses.at(-1)).toBe('attentive-pointing')
      expect(byId('play-game-ribbon').props.accessibilityLabel).toBe('Band.')
      await advance(LINE_MS)
      expect(g.poses.at(-1)).toBe('cheering')
      expect(g.sfx.cheer.play).toHaveBeenCalledTimes(cheers + 1)
      expect(has('critter-burst')).toBe(true)
      let shown = false
      for (let t = 0; t < JOY_HOLD_MS + SHELF_HOLD_MS - 10; t += 10) {
        shown ||=
          has('critter-picture') ||
          has('hunt-bonus') ||
          screen.queryAllByTestId(/^hunt-fly-/).length > 0
        await advance(10)
      }
      expect(shown).toBe(false)
      expect(seated()).toEqual([0, 1, 2, 3])
      await advance(10)
      expect(seated()).toEqual([])
      await advance(SHELF_DROP_MS)
      expect(locked()).toBe(false)
      expect([0, 1, 2, 3].map(tilesOf)).toEqual(['ants', 'bats', '', ''])
      expect(has('hunt-bonus')).toBe(false)
    }
    expect(g.lines.filter((l) => l.includes('praise'))).toEqual([])
    const r = loadHuntRecord(4)!
    expect(r.found).toEqual(['ants', 'bats', 'band'])
    expect(r.complete).toBe(false)
  })

  it('an extra is a run without a new target: band twice and three quiet runs, and cats’ slot glows', async () => {
    await mountSeed()
    for (const w of ['band', 'band', 'stab', 'dcna', 'tans']) await build(w)
    expect(has('hunt-slot-2-glow')).toBe(true)
    expect(loadHuntRecord(4)!.complete).toBe(false)
  })
})

describe('F14: slots and the hint', () => {
  it('an empty slot plays its word clip, sound only', async () => {
    const g = await mountFour()
    const lines = g.lines.length
    const from = g.calls.length
    await fireEvent.press(byId('hunt-slot-3'))
    expect(g.calls.slice(from)).toEqual([
      { uri: saidClipOf('maps'), from: 0, to: null },
    ])
    expect(g.lines).toHaveLength(lines)
    expect(has('play-game-ribbon')).toBe(false)
  })

  it('after 5 runs of four with no new target, the first empty slot glows; its tap: the four sounds in order, then the word', async () => {
    const g = await mountFour()
    // Three quiet runs and an extra (F28: a run without a new target).
    for (const w of ['clam', 'slam', 'camp', 'dcma']) await build(w)
    // A partial run is no run: still no glow.
    await seat('c', 'a')
    await fireEvent.press(byId('critter-log'))
    await advance(3000)
    await activate(byId('critter-seat-0'))
    await activate(byId('critter-seat-1'))
    await advance(1000)
    expect(has('hunt-slot-0-glow')).toBe(false)
    await build('mlas')
    expect(has('hunt-slot-0-glow')).toBe(true)
    expect(byId('hunt-slot-0').props.accessibilityLabel).toBe('Hint')
    const from = g.calls.length
    await fireEvent.press(byId('hunt-slot-0'))
    expect(g.poses.at(-1)).toBe('attentive-pointing')
    let at = 0
    for (const l of ['c', 'a', 'p']) {
      at += ownMs(l) + SOUND_GAP_MS
    }
    await advance(at)
    expect(g.calls.slice(from)).toEqual(['c', 'a', 'p', 's'].map(letterCall))
    await advance(ownMs('s') + SOUND_GAP_MS - 10)
    expect(g.calls.slice(from)).toHaveLength(4)
    await advance(10)
    expect(g.calls.slice(from).at(-1)).toEqual(wordSound('caps'))
    expect(seated()).toEqual([])
    expect(screen.queryAllByTestId(/^critter-twin-/)).toEqual([])
    await advance(wholeMs(saidClipOf('caps')) + 10)
    expect(g.poses.at(-1)).toBe('idle')
  })
})

describe('F15: completion', () => {
  it('at 3 of 4: the phase-1 beat in board order, no roll-in, no door; New letters deals a fresh four-letter round', async () => {
    const g = await mountFour()
    await build('caps')
    await until(() => has('hunt-new-letters'))
    expect(
      g.lines.filter((l) => l === 'guide.play.critters.done'),
    ).toHaveLength(1)
    expect(has('hunt-roll-in')).toBe(false)
    expect(has('hunt-open-four')).toBe(false)
    expect(loadHuntRecord(4)!.complete).toBe(true)
    // maps stays findable.
    await build('maps')
    expect(tilesOf(3)).toBe('maps')
    await fireEvent.press(byId('hunt-new-letters'))
    await advance(1000)
    const fresh = loadHuntRecord(4)!
    expect(fresh.letters).toHaveLength(7)
    expect(fresh.letters).not.toEqual(FOUR)
    expect(fresh.found).toEqual([])
    expect(meadow()).toEqual(fresh.letters)
    expect(within(byId('critter-log-numeral')).getByText('4')).toBeTruthy()
  })
})

describe('F16: the length picker', () => {
  it('absent with [3]: the three-letter round, and Back goes to the Play place', async () => {
    learner({ open: [3] })
    const g = await mount()
    expect(has('hunt-picker')).toBe(false)
    expect(within(byId('critter-log-numeral')).getByText('3')).toBeTruthy()
    await fireEvent.press(byId('play-game-back'))
    expect(g.onExit).toHaveBeenCalledTimes(1)
  })

  it('with [3, 4] the game opens on it at § 5.2’s rects; it plays nothing but the plink', async () => {
    learner({ four: ['clap'] })
    const g = await mount()
    expect(has('hunt-picker')).toBe(true)
    expect(meadow()).toEqual([])
    const l = mathLayout(PHONE_P)
    const p = pickerScene(playArea(l), l.tablet, l.landscape)
    for (const { length, hit } of p.logs) {
      expect(flat(byId(`hunt-pick-${length}`))).toMatchObject({
        left: hit.x,
        top: hit.y,
        width: hit.width,
        height: hit.height,
      })
    }
    expect(flat(byId('hunt-pick-meadow'))).toMatchObject({
      left: p.meadow.x,
      top: p.meadow.y,
      width: p.meadow.width,
      height: p.meadow.height,
    })
    // The wave runs in these 5 s, silent.
    await advance(5000)
    expect(g.lines).toEqual([])
    expect(g.calls).toEqual([])
    expect(g.poses.filter((x) => x !== 'idle')).toEqual([])
    const played = () =>
      Object.values(g.sfx).reduce((n, s) => n + s.play.mock.calls.length, 0)
    expect(played()).toBe(0)
    await fireEvent.press(byId('hunt-pick-4'))
    expect(g.sfx.plink.play).toHaveBeenCalledTimes(1)
    expect(played()).toBe(1)
    expect(g.lines).toEqual([])
  })

  it('no slab: two logs, n sockets on log n, no text but the discs’ numerals', async () => {
    learner({ four: ['clap'] })
    await mount()
    for (const n of [3, 4]) {
      expect(has(`hunt-pick-${n}-face`)).toBe(false)
      expect(has(`hunt-pick-${n}-log`)).toBe(true)
      expect(has(`hunt-pick-${n}-shadow`)).toBe(true)
      const sockets = [0, 1, 2, 3, 4].filter((i) =>
        has(`hunt-pick-${n}-log-socket-${i}`),
      )
      expect(sockets).toEqual([0, 1, 2, 3].slice(0, n))
    }
    const texts = within(byId('hunt-picker'))
      .queryAllByText(/./)
      .map((t) => t.props.children as string)
    expect(texts).toEqual(['3', '4'])
  })

  it('a tap on the meadow opens nothing and plays nothing', async () => {
    learner({ four: ['clap'] })
    const g = await mount()
    for (const event of ['pressIn', 'pressOut', 'press']) {
      await fireEvent(byId('hunt-pick-meadow'), event)
    }
    await advance(PICK_AFTER_MS + CRITTERS_OPEN_DELAY_MS + LINE_MS)
    expect(has('hunt-picker')).toBe(true)
    expect(meadow()).toEqual([])
    expect(g.lines).toEqual([])
    expect(g.calls).toEqual([])
    expect(g.sfx.plink.play).not.toHaveBeenCalled()
  })

  describe('the wave (§ 5.3)', () => {
    /** § 5.3: 300 ms after the picker's 200 ms fade-in. */
    const WAVE_AT = 500
    let hops: () => number
    beforeEach(() => {
      const timing = jest.spyOn(Reanimated, 'withTiming')
      // A hop's rise: 3 pt on a phone, over half of the 480 ms.
      hops = () =>
        timing.mock.calls.filter(
          ([v, cfg]) => v === 3 && cfg?.duration === PICK_HOP_MS / 2,
        ).length
    })

    it('500 ms after the picker mounts, "3" then "4" 120 ms on; then nothing moves with no touch for 30 s', async () => {
      learner({ four: [] })
      await mount()
      await advance(WAVE_AT - 10)
      expect(hops()).toBe(0)
      await advance(10)
      expect(hops()).toBe(1)
      await advance(PICK_WAVE_STAGGER_MS - 10)
      expect(hops()).toBe(1)
      await advance(10)
      expect(hops()).toBe(2)
      await advance(30000)
      expect(hops()).toBe(2)
    })

    it('again on a meadow press-in, but not twice within 1200 ms', async () => {
      learner({ four: [] })
      await mount()
      await advance(WAVE_AT + PICK_WAVE_STAGGER_MS)
      expect(hops()).toBe(2)
      // 120 ms after the last wave began: too soon.
      await fireEvent(byId('hunt-pick-meadow'), 'pressIn')
      await advance(PICK_HOP_MS)
      expect(hops()).toBe(2)
      // 1200 ms after it began: a wave, "3" at once, "4" 120 ms on.
      await advance(PICK_WAVE_GAP_MS - PICK_WAVE_STAGGER_MS - PICK_HOP_MS)
      await fireEvent(byId('hunt-pick-meadow'), 'pressIn')
      await advance(10)
      expect(hops()).toBe(3)
      await advance(PICK_WAVE_STAGGER_MS)
      expect(hops()).toBe(4)
      // And again only 1200 ms after that one.
      await advance(PICK_WAVE_GAP_MS - PICK_WAVE_STAGGER_MS - 20)
      await fireEvent(byId('hunt-pick-meadow'), 'pressIn')
      await advance(PICK_HOP_MS)
      expect(hops()).toBe(4)
      await fireEvent(byId('hunt-pick-meadow'), 'pressIn')
      await advance(PICK_WAVE_STAGGER_MS + 10)
      expect(hops()).toBe(6)
      await advance(30000)
      expect(hops()).toBe(6)
    })

    it('a log’s press-in cuts it: the hop under way stops, the next never starts', async () => {
      learner({ four: [] })
      await mount()
      const cancel = jest.spyOn(Reanimated, 'cancelAnimation')
      await advance(WAVE_AT)
      expect(hops()).toBe(1)
      await fireEvent(byId('hunt-pick-4'), 'pressIn')
      expect(cancel).toHaveBeenCalledTimes(2)
      await advance(PICK_WAVE_STAGGER_MS + PICK_HOP_MS)
      expect(hops()).toBe(1)
    })

    it('a log’s press-in before the wave: no wave', async () => {
      learner({ four: [] })
      await mount()
      await advance(WAVE_AT - 100)
      await fireEvent(byId('hunt-pick-3'), 'pressIn')
      await fireEvent(byId('hunt-pick-3'), 'pressOut')
      await advance(PICK_WAVE_GAP_MS)
      expect(hops()).toBe(0)
      expect(has('hunt-picker')).toBe(true)
    })

    it('rotation lays it out again without a wave', async () => {
      learner({ four: [] })
      const g = await mount()
      await advance(WAVE_AT + PICK_WAVE_STAGGER_MS)
      expect(hops()).toBe(2)
      await g.relayout(PHONE_L)
      await advance(5000)
      expect(hops()).toBe(2)
      const l = mathLayout(PHONE_L)
      const p = pickerScene(playArea(l), l.tablet, l.landscape)
      expect(flat(byId('hunt-pick-4'))).toMatchObject({
        left: p.logs[1]!.hit.x,
        top: p.logs[1]!.hit.y,
      })
    })
  })

  it('a log opens its round (in progress, else fresh); the open line on the first entry only; Back to the picker, then the Play place', async () => {
    learner({ four: ['clap'] })
    const g = await mount()
    await fireEvent.press(byId('hunt-pick-4'))
    await advance(PICK_AFTER_MS - 10)
    expect(has('hunt-picker')).toBe(true)
    await advance(10)
    expect(meadow()).toEqual(FOUR)
    await advance(CRITTERS_OPEN_DELAY_MS + LINE_MS)
    expect(g.lines).toEqual(['guide.play.critters.open.four'])
    expect(tilesOf(1)).toBe('clap')
    // Back: the picker, silent, the round kept.
    await fireEvent.press(byId('play-game-back'))
    expect(g.onExit).not.toHaveBeenCalled()
    expect(has('hunt-picker')).toBe(true)
    expect(loadHuntRecord(4)!.found).toEqual(['clap'])
    // Again: no open line the second time.
    await pick(4)
    await advance(5000)
    expect(
      g.lines.filter((x) => x === 'guide.play.critters.open.four'),
    ).toHaveLength(1)
    // "3": a fresh deal (none stored), with its own open line once.
    await fireEvent.press(byId('play-game-back'))
    await pick(3)
    expect(meadow()).toHaveLength(6)
    expect(within(byId('critter-log-numeral')).getByText('3')).toBeTruthy()
    expect(g.lines.at(-1)).toBe('guide.play.critters.open')
    await fireEvent.press(byId('play-game-back'))
    await fireEvent.press(byId('play-game-back'))
    expect(g.onExit).toHaveBeenCalledTimes(1)
  })

  it('a complete round is replaced by a fresh deal', async () => {
    learner({ four: ['clap', 'lamp', 'caps'] })
    await mount()
    await pick(4)
    expect(loadHuntRecord(4)!.found).toEqual([])
    expect(meadow()).not.toEqual(FOUR)
  })
})

/** The `critters-hunt` round completed by t-a-g (3 of 4): C0 reached. */
async function toBeat(open: HuntLength[] = [3]) {
  learner({
    open,
    three: { letters: THREE, found: ['bag', 'hat'] },
  })
  const g = await mount()
  if (open.includes(4)) await pick(3)
  else await advance(CRITTERS_OPEN_DELAY_MS + LINE_MS)
  await seat('t', 'a', 'g')
  await advance(SING_AFTER_MS)
  const fillAt = wholeMs(clipOf('tag')) + PICTURE_HOLD_MS
  await advance(fillAt + FILL_LAND_MS + SHELF_HOLD_MS + SHELF_DROP_MS)
  return g
}

describe('F17: the roll-in', () => {
  it('her first complete three-letter round: § 6.1’s steps at their times, the door at § 6.2’s rect, then New letters', async () => {
    const g = await toBeat()
    expect(huntOpenLengths()).toEqual([3, 4])
    await until(() => has('hunt-roll-in'))
    // U0: the arrival glides in; Emma idle; the board stays locked.
    expect(g.poses.at(-1)).toBe('idle')
    expect(locked()).toBe(true)
    expect(has('hunt-new-letters')).toBe(false)
    expect(has('hunt-open-four')).toBe(false)
    const sparkles = g.sfx.sparkle.play.mock.calls.length
    await advance(ROLL_GLIDE_MS - 20)
    expect(g.sfx.sparkle.play).toHaveBeenCalledTimes(sparkles)
    await advance(20)
    expect(g.sfx.sparkle.play).toHaveBeenCalledTimes(sparkles + 1)
    expect(g.poses.at(-1)).toBe('celebration')
    await advance(ROLL_FLY_AT_MS - ROLL_GLIDE_MS)
    expect(g.poses.at(-1)).toBe('idle')
    expect(has('hunt-open-four')).toBe(false)
    await advance(ROLL_DONE_MS - ROLL_FLY_AT_MS)
    expect(has('hunt-roll-in')).toBe(false)
    expect(has('hunt-new-letters')).toBe(true)
    expect(locked()).toBe(false)
    const l = mathLayout(PHONE_P)
    expect(flat(byId('hunt-open-four'))).toMatchObject({
      left: 160,
      top: 8,
      width: 56,
      height: 56,
    })
    expect(doorRect(backRect(l), l.ribbon, l.tablet)).toMatchObject({
      x: 160,
      y: 8,
    })
    // The door: a fresh four-letter round, its open line.
    const plinks = g.sfx.plink.play.mock.calls.length
    await fireEvent.press(byId('hunt-open-four'))
    expect(g.sfx.plink.play).toHaveBeenCalledTimes(plinks + 1)
    await advance(CRITTERS_OPEN_DELAY_MS + LINE_MS)
    expect(meadow()).toHaveLength(7)
    expect(within(byId('critter-log-numeral')).getByText('4')).toBeTruthy()
    expect(g.lines.at(-1)).toBe('guide.play.critters.open.four')
    expect(has('hunt-open-four')).toBe(false)
    // Back: the picker, both logs; no door on any later screen.
    await fireEvent.press(byId('play-game-back'))
    expect(has('hunt-picker')).toBe(true)
    await pick(3)
    expect(has('hunt-open-four')).toBe(false)
  })

  it('the door stays through New letters; the next completion plays no roll-in', async () => {
    const g = await toBeat()
    await until(() => has('hunt-new-letters'))
    await fireEvent.press(byId('hunt-new-letters'))
    await advance(1000)
    expect(has('hunt-open-four')).toBe(true)
    const r = loadHuntRecord(3)!
    const order = huntBoardOrder(r)
    for (const w of order.slice(0, order.length - 1)) await build(w)
    await until(() => has('hunt-new-letters'))
    expect(
      g.lines.filter((x) => x === 'guide.play.critters.done'),
    ).toHaveLength(2)
    expect(g.sfx.sparkle.play.mock.calls.length).toBeGreaterThan(0)
    expect(has('hunt-roll-in')).toBe(false)
  }, 60000)

  it('Back mid-roll-in goes to the picker; the roll-in never replays', async () => {
    const g = await toBeat()
    await until(() => has('hunt-roll-in'))
    await advance(500)
    await fireEvent.press(byId('play-game-back'))
    expect(g.onExit).not.toHaveBeenCalled()
    expect(has('hunt-picker')).toBe(true)
    expect(has('hunt-roll-in')).toBe(false)
    const sparkles = g.sfx.sparkle.play.mock.calls.length
    await advance(5000)
    expect(g.sfx.sparkle.play).toHaveBeenCalledTimes(sparkles)
    expect(g.poses.at(-1)).toBe('idle')
    await pick(3)
    await advance(10000)
    expect(has('hunt-roll-in')).toBe(false)
    expect(has('hunt-open-four')).toBe(false)
  })

  it('with "4" already open, a completion plays the phase-1 beat alone', async () => {
    await toBeat([3, 4])
    await until(() => has('hunt-new-letters'))
    expect(has('hunt-open-four')).toBe(false)
  })

  it('rotation mid-roll-in jumps to its end', async () => {
    const g = await toBeat()
    await until(() => has('hunt-roll-in'))
    await advance(300)
    await g.relayout({ width: 667, height: 375, insets: PHONE_P.insets })
    expect(has('hunt-roll-in')).toBe(false)
    expect(has('hunt-open-four')).toBe(true)
    expect(has('hunt-new-letters')).toBe(true)
    expect(locked()).toBe(false)
    expect(flat(byId('hunt-open-four'))).toMatchObject({
      left: 160,
      top: 8,
      width: 44,
    })
  })
})

describe('F18: Reduce Motion', () => {
  beforeEach(() => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
  })

  it('the picker’s press dims instead of sinking', async () => {
    learner({ four: [] })
    await mount()
    const timing = jest.spyOn(Reanimated, 'withTiming')
    await fireEvent(byId('hunt-pick-4'), 'pressIn')
    const dims = timing.mock.calls.filter(
      ([v, cfg]) => v === 0.85 && cfg?.duration === PICK_DIM_MS / 2,
    )
    expect(dims.length).toBeGreaterThan(0)
    expect(
      timing.mock.calls.filter(
        ([v, cfg]) => typeof v === 'number' && v > 3 && cfg?.duration === 120,
      ),
    ).toEqual([])
  })

  it('the picker: no wave on arrival or on a meadow press-in', async () => {
    learner({ four: [] })
    const timing = jest.spyOn(Reanimated, 'withTiming')
    await mount()
    await advance(2000)
    await fireEvent(byId('hunt-pick-meadow'), 'pressIn')
    await advance(2000)
    expect(
      timing.mock.calls.filter(([, cfg]) => cfg?.duration === PICK_HOP_MS / 2),
    ).toEqual([])
    expect(has('hunt-picker')).toBe(true)
  })

  it('the roll-in: no slab; the door fades in at U0 + 1200 with the sparkle; idle at 2300; New letters and the unlock at 2800', async () => {
    const g = await toBeat()
    const sparkles = g.sfx.sparkle.play.mock.calls.length
    await until(() => g.sfx.sparkle.play.mock.calls.length > sparkles)
    expect(has('hunt-roll-in')).toBe(false)
    expect(has('hunt-open-four')).toBe(true)
    expect(byId('hunt-open-four').props.accessibilityState?.disabled).toBe(true)
    expect(g.poses.at(-1)).toBe('celebration')
    await advance(ROLL_FLY_AT_MS - ROLL_GLIDE_MS)
    expect(g.poses.at(-1)).toBe('idle')
    expect(has('hunt-new-letters')).toBe(false)
    await advance(ROLL_DONE_MS - ROLL_FLY_AT_MS)
    expect(has('hunt-new-letters')).toBe(true)
    expect(locked()).toBe(false)
    expect(byId('hunt-open-four').props.accessibilityState?.disabled).toBe(
      false,
    )
    expect(has('hunt-roll-in')).toBe(false)
  })

  it('the fill: no flight, the tiles fade in at the word’s slot; no burst; the lines keep their times', async () => {
    const g = await mountFour()
    await seat('c', 'a', 'p', 's')
    await advance(SING_AFTER_MS)
    const sung = ['c', 'a', 'p', 's'].reduce(
      (t, l) => t + ownMs(l) + SOUND_GAP_MS,
      0,
    )
    await advance(sung)
    expect(g.lines.at(-1)).toBe('guide.play.critters.word.caps')
    await advance(LINE_MS)
    expect(has('critter-burst')).toBe(false)
    // A pictured word fills at 2400 ms (§ 4.1): never a flight.
    let flew = false
    for (let t = 0; t < PICTURE_HOLD_MS + 1000; t += 50) {
      flew ||= has('hunt-fly-0')
      await advance(50)
    }
    expect(flew).toBe(false)
    expect(has('critter-burst')).toBe(false)
    expect(tilesOf(0)).toBe('caps')
  })
})

describe('F19: VoiceOver', () => {
  it('the picker: two buttons, top then bottom; its logs, their shadows and the meadow are not elements', async () => {
    learner({ four: [] })
    await mount()
    const rows = byId('play-game').queryAll(
      (n) =>
        typeof n.type === 'string' &&
        /^hunt-pick-[34]$/.test(String(n.props.testID ?? '')),
    )
    expect(rows.map((n) => n.props.accessibilityLabel)).toEqual([
      'Log, three letters',
      'Log, four letters',
    ])
    expect(rows.every((n) => n.props.accessibilityRole === 'button')).toBe(true)
    for (const l of [3, 4]) {
      expect(byId(`hunt-pick-${l}-log`).props.accessible).toBe(false)
      expect(byId(`hunt-pick-${l}-shadow`).props.accessible).toBe(false)
    }
    const meadowEl = byId('hunt-pick-meadow')
    expect(meadowEl.props.accessible).toBe(false)
    expect(meadowEl.props.accessibilityLabel).toBeUndefined()
    expect(meadowEl.props.accessibilityRole).toBeUndefined()
  })

  it('the round’s log and slots; the door', async () => {
    const g = await mountFour()
    expect(byId('critter-log').props.accessibilityRole).toBe('button')
    expect(byId('hunt-slot-1').props.accessibilityLabel).toBe('Clap')
    expect(byId('hunt-slot-0').props.accessibilityLabel).toBe('Word to find')
    await g.unmount()
    await toBeat()
    await until(() => has('hunt-new-letters'))
    const door = byId('hunt-open-four')
    expect(door.props.accessibilityLabel).toBe('Log, four letters')
    expect(door.props.accessibilityRole).toBe('button')
  })
})

it('the roll-in’s first completion writes "4" open with the find, before the beat', async () => {
  learner({
    open: [3],
    three: { letters: THREE, found: ['bag', 'hat'] },
  })
  await mount()
  await advance(CRITTERS_OPEN_DELAY_MS + LINE_MS)
  expect(huntOpenLengths()).toEqual([3])
  await seat('t', 'a', 'g')
  await advance(SING_AFTER_MS)
  await act(async () => {})
  expect(huntOpenLengths()).toEqual([3, 4])
  expect(FOUR_BOARD).toEqual(huntBoardOrder(huntRoundOf(FOUR, { length: 4 })!))
})
