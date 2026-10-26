/**
 * Letter critters' word hunt on screen (`design/native/critters-word-hunt.md`
 * § 2-§ 8, § 15, ACs H8-H25 and P2-P10), for a learner past cvc-words with
 * short o current (Marian, 2026-10-25), on a seeded round: a b g h p t,
 * whose targets are bag, bat, hat, tag (picture words), tap (a said word
 * with a picture) and pat (familiar, no picture); its extras gab-free:
 * gag, gap and tab; and hag, a never-say word. In board order (§ 15.2) its
 * slots hold bag, bat, hat, tag, tap, pat. Sounds go through the fake
 * tap-sound player.
 */
import { setKeyValueStore } from '@marian/core'
import { progressAtStep } from '@marian/core/debug/stepProgress'
import {
  freshHuntRecord,
  HUNT_STORAGE_KEY,
  huntBoardOrder,
  huntFind,
  huntRoundOf,
  loadHuntRecord,
  saveHuntRecord,
} from '@marian/core/games/critterHunt'
import { critterWordLine } from '@marian/core/emmasPath/guidanceLines'
import {
  critterHasPicture,
  critterPictureKey,
  CRITTER_PICTURE_WORDS,
  CRITTER_SOUND_SOURCE,
} from '@marian/core/games/playPlace'
import {
  loadProgress,
  saveProgress,
  STORAGE_KEY,
  type SkillNode,
} from '@marian/core/progress'
import { act, fireEvent, screen, within } from '@testing-library/react-native'
import { useRef } from 'react'
import { processColor, StyleSheet } from 'react-native'
import * as Reanimated from 'react-native-reanimated'
import { letterWindow, wordWindow } from '../../audio/blendMarks'
import { audioForWebPath } from '../../audio/bundledAudio'
import type { Viewport } from '../../layout/layout'
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
} from '../../../test/playHarness'
import { PRESS_MS } from '../hub/clay'
import { blendClipPath, blendSegments } from './critterModel'
import {
  BOX_PULSE_MS,
  FILL_LAND_MS,
  FILL_SETTLE_MS,
  SLOT_SINK_PHONE,
  SLOT_SINK_TABLET,
  WIGGLE_STEP_MS,
} from './HuntBoard'
import {
  BEAT_DONE_AFTER_MS,
  BEAT_LAP_AFTER_MS,
  BEAT_LAP_GAP_MS,
  BEAT_TAIL_MS,
  CRITTERS_OPEN_DELAY_MS,
  HUNT_HINT_IDLE_MS,
  HUNT_HINT_RUNS,
  JOY_HOLD_MS,
  PICTURE_HOLD_MS,
  SHELF_DROP_MS,
  SHELF_HOLD_MS,
  PICTURE_LEAVE_MS,
  SING_AFTER_MS,
  SOUND_GAP_MS,
} from './LetterCritters'
import {
  backRect,
  centre,
  grow,
  huntScene,
  playArea,
  type HuntScene,
} from './playGeometry'

const ROUND = ['a', 'b', 'g', 'h', 'p', 't']
const TARGETS = ['bag', 'bat', 'hat', 'pat', 'tag', 'tap']
/** The seeded round's slots, in board order (§ 15.2). */
const BOARD = ['bag', 'bat', 'hat', 'tag', 'tap', 'pat']

// --- Sounds ------------------------------------------------------------------

const clipOf = (word: string) => audioForWebPath(blendClipPath(word)) as number
const BLEND = new Map(CRITTER_PICTURE_WORDS.map((w) => [clipOf(w), w]))
const WHOLE_TAIL = 200
/** A said word's clip, as the fake times it. */
const SAID_MS = 500
const wholeMs = (uri: string | number) => {
  const w = BLEND.get(uri as number)
  return w === undefined ? SAID_MS : blendSegments(w)![3]![1] + WHOLE_TAIL
}
const saidClipOf = (word: string) =>
  audioForWebPath(critterWordLine(word)!.src!) as number
/** A found word's own sound, as a slot tap or the lap plays it (§ 4.3). */
function wordSound(word: string) {
  if (CRITTER_PICTURE_WORDS.includes(word)) {
    const w = wordWindow(blendSegments(word)!)
    return { uri: clipOf(word), from: w.from, to: null }
  }
  return { uri: saidClipOf(word), from: 0, to: null }
}
const wordMs = (word: string) => {
  const s = wordSound(word)
  return wholeMs(s.uri) - s.from
}
/** A letter's own sound: its critter's shipped window (`play-place.md` § 3.4). */
function letterCall(letter: string) {
  const src = CRITTER_SOUND_SOURCE[letter]!
  const w = letterWindow(blendSegments(src.word)![src.index]!)
  return { uri: clipOf(src.word), from: w.from, to: w.to }
}
/** A letter's own sound's length. */
function ownMs(letter: string) {
  const w = letterCall(letter)
  return w.to - w.from
}

// --- The learner and her round -------------------------------------------------

let writes: string[] = []

/** The playing learner at `step` in a fresh store; optionally a round. */
function learnerAt(
  step: SkillNode,
  round?: { letters: string[]; found: string[] },
) {
  const map = new Map<string, string>()
  setKeyValueStore({
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      writes.push(k)
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  })
  saveProgress(progressAtStep(step))
  if (round) {
    const r = huntRoundOf(round.letters)!
    saveHuntRecord(round.found.reduce(huntFind, freshHuntRecord(r)))
  }
  writes = []
}

async function mount(opts: { viewport?: Viewport; rng?: () => number } = {}) {
  const s = fakeSounds(wholeMs)
  const g = await mountGame('critters', { sounds: s.sounds, ...opts })
  await advance(CRITTERS_OPEN_DELAY_MS + LINE_MS)
  return { ...g, ...s }
}

const seated = () => [0, 1, 2].filter((i) => has(`critter-seat-${i}`))
const meadow = () =>
  screen
    .queryAllByTestId(/^critter-[a-z]$/)
    .map((el) => String(el.props.testID).slice(-1))
/** The board waits: a meadow consonant (the last critter) takes no drag. */
const locked = () =>
  screen.queryAllByTestId(/^critter-[a-z]$/).at(-1)?.props.accessibilityState
    ?.disabled === true
const tilesOf = (i: number) =>
  [0, 1, 2]
    .filter((k) => has(`hunt-slot-${i}-tile-${k}`))
    .map((k) => {
      const el = byId(`hunt-slot-${i}-tile-${k}`)
      return within(el).getByText(/^[a-z]$/).props.children as string
    })
    .join('')
const glowing = () =>
  screen
    .queryAllByTestId(/^hunt-slot-\d-glow$/)
    .map((el) => Number(String(el.props.testID).split('-')[2]))
const flat = (el: ReturnType<typeof byId>) => StyleSheet.flatten(el.props.style)
/**
 * Counts the picture box's lit pulse (and a tile's: the same 1 → 1.15 → 1),
 * with shared values held so each effect runs once per change.
 */
function pulseStarts() {
  holdSharedValues()
  const timing = jest.spyOn(Reanimated, 'withTiming')
  return () =>
    timing.mock.calls.filter(
      ([v, cfg]) => v === 1.15 && cfg?.duration === BOX_PULSE_MS / 2,
    ).length
}
/** react-native-svg's host nodes of one kind under `root`, e.g. `RNSVGPath`. */
const svg = (kind: string, root: ReturnType<typeof byId>) =>
  root.queryAll((n) => n.type === `RNSVG${kind}`)
/** A colour as react-native-svg hands it to the host. */
const paint = (hex: string) => ({ type: 0, payload: processColor(hex) })

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

/**
 * For counting animation starts: the jest mock's `useSharedValue` makes a
 * new value every render, which re-runs every effect on any render; held
 * per component, as on a device, each effect runs once per change.
 */
function holdSharedValues() {
  const make = Reanimated.useSharedValue
  function useHeldSharedValue(init: unknown) {
    const held = useRef<ReturnType<typeof make> | null>(null)
    held.current ??= make(init)
    // A test stand-in for a hook: the held value is the render's output.
    // eslint-disable-next-line react-hooks/refs
    return held.current
  }
  jest
    .spyOn(Reanimated, 'useSharedValue')
    .mockImplementation(useHeldSharedValue as typeof make)
}
function wiggleStarts() {
  holdSharedValues()
  // A wiggle's first step turns to −5° over 100 ms (§ 4.2).
  const timing = jest.spyOn(Reanimated, 'withTiming')
  return {
    count: () =>
      timing.mock.calls.filter(
        ([v, cfg]) => v === -5 && cfg?.duration === WIGGLE_STEP_MS,
      ).length,
  }
}

const PHONE_SCENE = () => {
  const l = mathLayout(PHONE_P)
  return huntScene(playArea(l), l.tablet, l.landscape, TARGETS.length)
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  learnerAt('cvc-words-short-o', { letters: ROUND, found: [] })
})
afterEach(() => {
  setKeyValueStore(null)
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('H8: the hunt’s meadow', () => {
  it('6 critters, 3 a row in 2 rows, in round order (the vowel first)', async () => {
    await mount()
    expect(meadow()).toEqual(ROUND)
    const scene = PHONE_SCENE()
    ROUND.forEach((l, i) => {
      expect(flat(byId(`critter-${l}`))).toMatchObject({
        left: scene.cells[i]!.x,
        top: scene.cells[i]!.y,
      })
    })
    expect(new Set(scene.cells.map((r) => r.y)).size).toBe(2)
  })

  it('the vowel pops no twin and its burrow is ringed until it lands home; a consonant still pops its twin', async () => {
    await mount()
    const to = centre(PHONE_SCENE().seats[0]!)
    await dragStart(byId('critter-a'), to)
    expect(has('critter-twin-a')).toBe(false)
    expect(has('critter-burrow-empty-a')).toBe(true)
    await dragRelease(byId('critter-a'), to)
    expect(has('critter-seat-0')).toBe(true)
    expect(has('critter-burrow-empty-a')).toBe(true)
    // The meadow's vowel is out of VoiceOver (and the queries) while out.
    expect(has('critter-a')).toBe(false)
    expect(
      screen.getByTestId('critter-a', { includeHiddenElements: true }).props
        .accessibilityElementsHidden,
    ).toBe(true)
    // Home again (VoiceOver activate on the seat sends it home).
    await activate(byId('critter-seat-0'))
    expect(has('critter-burrow-empty-a')).toBe(false)
    expect(has('critter-a')).toBe(true)

    await dragStart(byId('critter-b'), to)
    expect(has('critter-twin-b')).toBe(true)
    expect(has('critter-burrow-empty-b')).toBe(false)
  })
})

describe('H9: the numeral and the log', () => {
  it('"3" on the log in a hunt round; the log is "Log, three letters"', async () => {
    await mount()
    expect(within(byId('critter-log-numeral')).getByText('3')).toBeTruthy()
    expect(byId('critter-log').props.accessibilityLabel).toBe(
      'Log, three letters',
    )
  })

  it('no numeral in the free meadow, and the log is "Log"', async () => {
    learnerAt('letter-sounds')
    await mount()
    expect(has('critter-log-numeral')).toBe(false)
    expect(byId('critter-log').props.accessibilityLabel).toBe('Log')
  })
})

describe('H10: a new target fills the next empty slot', () => {
  it('a picture word: its outcome, then at the fill its tiles fly up and land in slot 0 with its picture; the shelf clears 400 ms after they land; no sound at the fill', async () => {
    const g = await mount()
    await seat('b', 'a', 'g')
    await advance(SING_AFTER_MS)
    expect(g.calls.at(-1)).toEqual({ uri: clipOf('bag'), from: 0, to: null })
    // The reward ruling's outcome: the clip, the joy beat, the praise.
    await advance(wholeMs(clipOf('bag')) + PICTURE_HOLD_MS - 10)
    expect(has('hunt-fly-0')).toBe(false)
    expect(has('critter-picture-bag')).toBe(true)
    expect(g.lines).toContain('guide.play.critters.praise.bag')
    const calls = g.calls.length
    await advance(10)
    // The fill: three tiles in flight, the slot still empty.
    expect(has('hunt-fly-0')).toBe(true)
    expect(has('hunt-fly-2')).toBe(true)
    expect(tilesOf(0)).toBe('')
    expect(g.poses.at(-1)).toBe('idle')
    await advance(FILL_LAND_MS + FILL_SETTLE_MS)
    expect(has('hunt-fly-0')).toBe(false)
    expect(tilesOf(0)).toBe('bag')
    expect(has('hunt-slot-0-picture-bag')).toBe(true)
    expect(byId('hunt-slot-0').props.accessibilityLabel).toBe('Bag')
    // The vowel is pink, the consonants honey, letters #6b3f1f.
    expect(flat(byId('hunt-slot-0-tile-1')).backgroundColor).toBe('#FFC0CB')
    expect(flat(byId('hunt-slot-0-tile-0')).backgroundColor).toBe('#f2c27a')
    expect(
      StyleSheet.flatten(
        within(byId('hunt-slot-0-tile-0')).getByText('b').props.style,
      ).color,
    ).toBe('#6b3f1f')
    // The shelf drops 400 ms after the last tile lands (620 ms in).
    expect(seated()).toHaveLength(3)
    await advance(SHELF_HOLD_MS - FILL_SETTLE_MS - 10)
    expect(seated()).toHaveLength(3)
    await advance(20)
    expect(seated()).toHaveLength(0)
    // No sound and no line at the fill.
    expect(g.calls).toHaveLength(calls)
    expect(g.sfx.sparkle.play).toHaveBeenCalledTimes(1)
  })

  it('a familiar word without a picture (pat): its tiles in its own slot (5), under the listen mark', async () => {
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag'] })
    const g = await mount()
    expect(tilesOf(0)).toBe('bag')
    await build('pat')
    expect(g.lines).toContain('guide.play.critters.word.pat')
    expect(tilesOf(5)).toBe('pat')
    expect([1, 2, 3, 4].map(tilesOf)).toEqual(['', '', '', ''])
    expect(has('hunt-slot-5-listen')).toBe(true)
    expect(screen.queryAllByTestId(/^hunt-slot-5-picture-/).length).toBe(0)
  })

  it('a said word with a picture (tap): its tiles in its own slot (4), its picture there from the deal', async () => {
    await mount()
    expect(has('hunt-slot-4-picture-tap')).toBe(true)
    await build('tap')
    expect(tilesOf(4)).toBe('tap')
    expect(has('hunt-slot-4-picture-tap')).toBe(true)
  })
})

describe('H11: no count anywhere', () => {
  it('no rendered text holds a digit but the numeral "3"; no label states a count', async () => {
    learnerAt('cvc-words-short-o', {
      letters: ROUND,
      found: ['bag', 'tab', 'hat'],
    })
    await mount()
    const digits = screen
      .queryAllByText(/\d/)
      .map((el) => String(el.props.children))
    expect(digits).toEqual(['3'])
    const labels = screen
      .queryAllByLabelText(/./)
      .map((el) => String(el.props.accessibilityLabel))
    expect(labels.filter((l) => /\d/.test(l))).toEqual([])
  })
})

describe('H12: a repeat find', () => {
  it('the joy beat, no praise; its slot wiggles; no tile is added anywhere', async () => {
    const { count } = wiggleStarts()
    const g = await mount()
    await build('bag')
    expect(g.lines.filter((l) => l.endsWith('praise.bag'))).toHaveLength(1)
    const tiles = screen.queryAllByTestId(/^hunt-slot-\d-tile-\d$/).length
    const cheers = g.sfx.cheer.play.mock.calls.length
    const before = count()
    await build('bag')
    expect(g.sfx.cheer.play).toHaveBeenCalledTimes(cheers + 1)
    expect(g.lines.filter((l) => l.endsWith('praise.bag'))).toHaveLength(1)
    expect(count()).toBe(before + 1)
    expect(screen.queryAllByTestId(/^hunt-slot-\d-tile-\d$/)).toHaveLength(
      tiles,
    )
    expect(has('hunt-bonus')).toBe(false)
  })
})

describe('H13: an extra', () => {
  it('Emma says it with the joy beat; the bonus chip appears with it, then lists extras in find order; no slot changes; the chip is no button', async () => {
    const g = await mount()
    expect(has('hunt-bonus')).toBe(false)
    await seat('t', 'a', 'b')
    await advance(SING_AFTER_MS)
    const sounds =
      ownMs('t') + ownMs('a') + ownMs('b') + 3 * SOUND_GAP_MS + LINE_MS
    await advance(sounds)
    expect(g.lines.at(-1)).toBe('guide.play.critters.word.tab')
    expect(g.poses).toContain('cheering')
    await advance(JOY_HOLD_MS - 20)
    expect(has('hunt-bonus')).toBe(false)
    await advance(40)
    expect(byId('hunt-bonus').props.accessibilityLabel).toBe('Bonus words, tab')
    await advance(SHELF_HOLD_MS + SHELF_DROP_MS + 20)
    await build('gap')
    expect(byId('hunt-bonus').props.accessibilityLabel).toBe(
      'Bonus words, tab, gap',
    )
    expect(has('hunt-bonus-gap-2')).toBe(true)
    expect(screen.queryAllByTestId(/^hunt-slot-\d-tile-\d$/)).toHaveLength(0)
    expect(byId('hunt-bonus').props.accessibilityRole).toBeUndefined()
    expect(loadHuntRecord()!.found).toEqual(['tab', 'gap'])
  })
})

describe('H14: runs that never fill a slot', () => {
  it('a never-say word, a non-word and a pair keep their outcomes and fill nothing', async () => {
    const g = await mount()
    await build('hag')
    expect(g.lines.some((l) => l.includes('word.hag'))).toBe(false)
    await build('bpt')
    expect(g.sfx.boing.play).toHaveBeenCalledTimes(1)
    await seat('b', 'a')
    await advance(SING_AFTER_MS + 3000)
    expect(seated()).toHaveLength(2)
    expect(screen.queryAllByTestId(/^hunt-slot-\d-tile-\d$/)).toHaveLength(0)
    expect(has('hunt-bonus')).toBe(false)
    expect(loadHuntRecord()!.found).toEqual([])
  })
})

describe('H15: the hint', () => {
  it('no glow while the drag hint stands; after 5 runs with no new target, one silent glow on the first empty slot', async () => {
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag'] })
    const g = await mount()
    await advance(HUNT_HINT_IDLE_MS + 1000)
    expect(glowing()).toEqual([])
    for (let n = 1; n < HUNT_HINT_RUNS; n++) await build(n % 2 ? 'hag' : 'bag')
    expect(glowing()).toEqual([])
    const lines = g.lines.length
    const calls = g.calls.length
    await build('hag')
    expect(glowing()).toEqual([1])
    expect(byId('hunt-slot-1').props.accessibilityState.selected).toBe(true)
    expect(byId('hunt-slot-1').props.accessibilityLabel).toBe('Hint')
    // hag is never said: nothing but its sounds played.
    expect(g.lines).toHaveLength(lines)
    expect(g.calls.length - calls).toBe(3)
  })

  it('45 s with no drag start: the glow; a tap plays a picture word’s whole blend clip, no caption, no ghost; a new target in another slot ends it', async () => {
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag'] })
    const g = await mount()
    await build('hag')
    await advance(HUNT_HINT_IDLE_MS - 3000)
    await advance(4000)
    expect(glowing()).toEqual([1])
    await fireEvent.press(byId('hunt-slot-1'))
    // bat: the first empty slot's word, its whole blend clip from 0.
    expect(g.calls.at(-1)).toEqual({ uri: clipOf('bat'), from: 0, to: null })
    expect(g.poses.at(-1)).toBe('attentive-pointing')
    expect(has('play-game-ribbon')).toBe(false)
    expect(screen.queryAllByTestId(/-ghost-/)).toHaveLength(0)
    await advance(wholeMs(clipOf('bat')) + 10)
    expect(g.poses.at(-1)).toBe('idle')
    // A new target in another slot (hat, slot 2) ends the glow.
    await build('hat')
    expect(glowing()).toEqual([])
    expect(tilesOf(2)).toBe('hat')
    expect(tilesOf(1)).toBe('')
  })

  it('no glow after completion', async () => {
    await throughBeat()
    for (let n = 0; n < HUNT_HINT_RUNS; n++) await build('hag')
    await advance(HUNT_HINT_IDLE_MS + 1000)
    expect(glowing()).toEqual([])
  })
})

describe('H16: tapping a slot', () => {
  it('a filled slot plays its word (picture word: its word part; said word: its clip), no caption', async () => {
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag', 'tap'] })
    const g = await mount()
    await fireEvent.press(byId('hunt-slot-0'))
    expect(g.calls.at(-1)).toEqual(wordSound('bag'))
    await fireEvent.press(byId('hunt-slot-4'))
    expect(g.calls.at(-1)).toEqual(wordSound('tap'))
    expect(has('play-game-ribbon')).toBe(false)
    expect(byId('hunt-slot-4').props.accessibilityRole).toBe('button')
  })

  it('ignored while the board waits', async () => {
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag'] })
    const g = await mount()
    await seat('h', 'a', 'g')
    await advance(SING_AFTER_MS + 50)
    const calls = g.calls.length
    await fireEvent.press(byId('hunt-slot-0'))
    expect(g.calls).toHaveLength(calls)
  })
})

/** Mount on the seeded 4-of-6 round and build tag, the completing find. */
async function toC0() {
  learnerAt('cvc-words-short-o', {
    letters: ROUND,
    found: ['bag', 'hat', 'bat', 'tap'],
  })
  const g = await mount()
  await seat('t', 'a', 'g')
  await advance(SING_AFTER_MS)
  const fillAt = wholeMs(clipOf('tag')) + PICTURE_HOLD_MS
  await advance(fillAt + FILL_LAND_MS + SHELF_HOLD_MS + SHELF_DROP_MS)
  return g
}

describe('H17: completion', () => {
  it('at the 5th of 6, after its shelf clears: the lap in board order, "You did it!", the cheer and burst, then New letters; the board ignores touches until then; Back works', async () => {
    const g = await toC0()
    // C0: the board locks, Emma celebrates.
    expect(g.poses.at(-1)).toBe('celebration')
    expect(loadHuntRecord()!.complete).toBe(true)
    expect(has('hunt-new-letters')).toBe(false)
    // Found bag, hat, bat, tap, then tag: the lap is the board's order.
    const order = ['bag', 'bat', 'hat', 'tag', 'tap']
    let calls = g.calls.length
    await advance(BEAT_LAP_AFTER_MS)
    for (let i = 0; i < order.length; i++) {
      expect(has(`hunt-slot-${i}-lap`)).toBe(true)
      expect(g.calls.slice(calls)).toEqual([wordSound(order[i]!)])
      calls = g.calls.length
      // Touches are ignored: a slot, a critter.
      await fireEvent.press(byId('hunt-slot-0'))
      await activate(byId('critter-b'))
      expect(g.calls).toHaveLength(calls)
      expect(seated()).toEqual([])
      const last = i === order.length - 1
      await advance(wordMs(order[i]!) + (last ? 0 : BEAT_LAP_GAP_MS))
    }
    expect(g.lines.at(-1)).not.toBe('guide.play.critters.done')
    await advance(BEAT_DONE_AFTER_MS)
    expect(g.poses.at(-1)).toBe('cheering')
    expect(g.lines.at(-1)).toBe('guide.play.critters.done')
    expect(byId('play-game-ribbon').props.accessibilityLabel).toBe(
      'You did it!',
    )
    const cheers = g.sfx.cheer.play.mock.calls.length
    await advance(LINE_MS)
    expect(g.sfx.cheer.play).toHaveBeenCalledTimes(cheers + 1)
    expect(has('hunt-burst')).toBe(true)
    await advance(BEAT_TAIL_MS - 20)
    expect(has('hunt-new-letters')).toBe(false)
    await advance(20)
    expect(g.poses.at(-1)).toBe('idle')
    expect(has('hunt-new-letters')).toBe(true)
    expect(locked()).toBe(false)
    // The beat played once; nothing in it but "You did it!".
    expect(
      g.lines.filter((l) => l === 'guide.play.critters.done'),
    ).toHaveLength(1)
  })

  it('Back works during the beat', async () => {
    const g = await toC0()
    await advance(BEAT_LAP_AFTER_MS + 100)
    await fireEvent.press(byId('play-game-back'))
    expect(g.onExit).toHaveBeenCalledTimes(1)
  })
})

/** Through the beat to New letters. */
async function throughBeat() {
  const g = await toC0()
  await advance(20000)
  expect(has('hunt-new-letters')).toBe(true)
  return g
}

describe('H18: after the beat', () => {
  it('the last target fills its slot with its usual outcome, no second beat; then nothing starts', async () => {
    const g = await throughBeat()
    await build('pat')
    expect(tilesOf(5)).toBe('pat')
    expect(
      g.lines.filter((l) => l === 'guide.play.critters.done'),
    ).toHaveLength(1)
    const lines = g.lines.length
    const calls = g.calls.length
    await advance(60000)
    expect(g.lines).toHaveLength(lines)
    expect(g.calls).toHaveLength(calls)
    expect(meadow()).toEqual(ROUND)
  })
})

describe('H19: New letters', () => {
  it('absent before completion; after it, beside Back; a tap plinks and deals fresh letters with empty slots, no line, and goes', async () => {
    const g = await throughBeat()
    const back = backRect(mathLayout(PHONE_P))
    expect(flat(byId('hunt-new-letters'))).toMatchObject({
      left: back.x + back.width + 16,
      top: back.y,
      width: back.width,
    })
    expect(byId('hunt-new-letters').props.accessibilityLabel).toBe(
      'New letters',
    )
    const lines = g.lines.length
    await fireEvent.press(byId('hunt-new-letters'))
    await advance(500)
    expect(g.sfx.plink.play).toHaveBeenCalledTimes(1)
    expect(has('hunt-new-letters')).toBe(false)
    expect(meadow()).not.toEqual(ROUND)
    const fresh = loadHuntRecord()!
    expect(meadow()).toEqual(fresh.letters)
    expect(fresh.found).toEqual([])
    expect(screen.queryAllByTestId(/^hunt-slot-\d-tile-\d$/)).toHaveLength(0)
    expect(screen.queryAllByTestId(/^hunt-slot-\d$/)).toHaveLength(
      fresh.targets.length,
    )
    expect(g.lines).toHaveLength(lines)
  })
})

describe('H20: leaving and coming back', () => {
  it('Back mid-round: the same letters, every find in its own slot, every slot’s picture or mark, and the chip, drawn at once; only the open line', async () => {
    const first = await mount()
    await build('hat')
    await build('tab')
    await build('bag')
    await first.unmount()
    const g = await mount({ rng: seeded(99) })
    expect(meadow()).toEqual(ROUND)
    expect(BOARD.map((_, i) => tilesOf(i))).toEqual([
      'bag',
      '',
      'hat',
      '',
      '',
      '',
    ])
    expect(has('hunt-slot-1-picture-bat')).toBe(true)
    expect(has('hunt-slot-5-listen')).toBe(true)
    expect(byId('hunt-bonus').props.accessibilityLabel).toBe('Bonus words, tab')
    expect(has('hunt-fly-0')).toBe(false)
    expect(g.lines).toEqual(['guide.play.critters.open'])
  })

  it('Back during the beat: the next visit deals a fresh round', async () => {
    const first = await toC0()
    await advance(BEAT_LAP_AFTER_MS + 100)
    await first.unmount()
    await mount({ rng: seeded(7) })
    expect(meadow()).not.toEqual(ROUND)
    expect(loadHuntRecord()!.found).toEqual([])
    expect(has('hunt-new-letters')).toBe(false)
  })
})

describe('the background mid-outcome (§ 6.4)', () => {
  /**
   * Seats `word` and sends the app to the background 300 ms into its run;
   * 5 s later she is back. The cut run clears once she is back
   * (`play-place.md` § 3.3), and its find is never lost (Dave (3)).
   */
  async function cutByBackground(
    g: Awaited<ReturnType<typeof mount>>,
    word: string,
  ) {
    await seat(...word)
    await advance(SING_AFTER_MS + 300)
    await act(async () => g.visibility.set(true))
    await advance(5000)
    await act(async () => g.visibility.set(false))
  }

  it.each([
    ['bag', 0],
    ['pat', 5],
  ])(
    'a new target (%s) lands in its own slot (%i) once she is back; the next takes its own',
    async (word, slot) => {
      const g = await mount()
      await cutByBackground(g, word)
      await advance(10000)
      expect(loadHuntRecord()!.found).toEqual([word])
      expect(tilesOf(slot)).toBe(word)
      expect(seated()).toEqual([])
      expect(locked()).toBe(false)
      await build('hat')
      expect([tilesOf(slot), tilesOf(2)]).toEqual([word, 'hat'])
    },
  )

  it('an extra (tab) joins the bonus chip once she is back; no slot changes', async () => {
    const g = await mount()
    await cutByBackground(g, 'tab')
    await advance(10000)
    expect(byId('hunt-bonus').props.accessibilityLabel).toBe('Bonus words, tab')
    expect(screen.queryAllByTestId(/^hunt-slot-\d-tile-\d$/)).toHaveLength(0)
  })

  it('the completing find: its slot fills, then the beat laps every found slot', async () => {
    learnerAt('cvc-words-short-o', {
      letters: ROUND,
      found: ['bag', 'hat', 'bat', 'tap'],
    })
    const g = await mount()
    await cutByBackground(g, 'tag')
    const calls = g.calls.length
    await advance(SHELF_DROP_MS)
    expect(tilesOf(3)).toBe('tag')
    await advance(20000)
    expect(g.calls.slice(calls)).toContainEqual(wordSound('tag'))
    expect(has('hunt-new-letters')).toBe(true)
  })
})

describe('H21: writes', () => {
  it('a hunt visit writes the hunt key at a deal and at each new find, and the seen-record for words Emma says; nothing else; no fetch', async () => {
    learnerAt('cvc-words-short-o')
    const fetchSpy = jest.fn()
    const realFetch = globalThis.fetch
    globalThis.fetch = fetchSpy
    const before = loadProgress()!
    await mount()
    expect(writes).toEqual([HUNT_STORAGE_KEY])
    const round = loadHuntRecord()!
    const target = round.targets.find((w) => w !== 'tap')!
    writes = []
    await build(target)
    expect(writes.filter((k) => k === HUNT_STORAGE_KEY)).toHaveLength(1)
    expect(
      writes.filter((k) => k !== HUNT_STORAGE_KEY && k !== STORAGE_KEY),
    ).toEqual([])
    writes = []
    await build(target)
    expect(writes.filter((k) => k === HUNT_STORAGE_KEY)).toHaveLength(0)
    // Progress: only the seen-record changed.
    const after = loadProgress()!
    expect({ ...after, seenItems: before.seenItems }).toEqual(before)
    expect(fetchSpy).not.toHaveBeenCalled()
    globalThis.fetch = realFetch
  })

  it('a free-meadow visit (before blending sounds) with a non-word and a pair writes nothing', async () => {
    learnerAt('letter-sounds')
    await mount()
    const letters = meadow().filter((l) => !'aeiou'.includes(l))
    await seat(letters[0]!, letters[1]!, letters[2]!)
    await advance(10000)
    for (const i of seated()) await activate(byId(`critter-seat-${i}`))
    await seat(letters[0]!, 'a')
    await advance(3000)
    expect(writes).toEqual([])
  })
})

describe('H22: before blending sounds, the free meadow as it was', () => {
  it('letter names: 16 critters, twins for every letter, no numeral, board, chip, glow or New letters', async () => {
    learnerAt('letter-names')
    await mount()
    expect(meadow()).toHaveLength(16)
    expect(has('critter-log-numeral')).toBe(false)
    expect(screen.queryAllByTestId(/^hunt-/)).toHaveLength(0)
    await dragStart(byId('critter-a'), { x: 10, y: 10 })
    expect(has('critter-twin-a')).toBe(true)
  })
})

describe('H23: Reduce Motion', () => {
  it('no flight, wiggle or burst; the slot fades in; lines and sounds at their times', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    const { count } = wiggleStarts()
    learnerAt('cvc-words-short-o', {
      letters: ROUND,
      found: ['bag', 'hat', 'bat'],
    })
    const g = await mount()
    await seat('t', 'a', 'p')
    await advance(SING_AFTER_MS)
    for (let t = 0; t < 12000; t += 50) {
      expect(has('hunt-fly-0')).toBe(false)
      await advance(50)
    }
    expect(tilesOf(4)).toBe('tap')
    await build('bag')
    expect(count()).toBe(0)
    await build('tag')
    await advance(20000)
    expect(has('hunt-new-letters')).toBe(true)
    expect(g.lines).toContain('guide.play.critters.done')
    expect(g.sfx.cheer.play).toHaveBeenCalled()
    expect(has('hunt-burst')).toBe(false)
  })
})

describe('§ 6.3: VoiceOver beside the slots (P10 has the slots)', () => {
  it('the chip, the log, the critters and the numeral; activating a filled slot plays it', async () => {
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag', 'tab'] })
    const g = await mount()
    expect(byId('hunt-bonus').props.accessibilityLabel).toBe('Bonus words, tab')
    expect(byId('critter-log').props.accessibilityLabel).toBe(
      'Log, three letters',
    )
    expect(byId('critter-b').props.accessibilityLabel).toBe('Letter b')
    expect(byId('critter-log-numeral').props.accessible).toBe(false)
    await fireEvent.press(byId('hunt-slot-0'))
    expect(g.calls.at(-1)).toEqual(wordSound('bag'))
  })
})

describe('H25: a new layout mid-round', () => {
  it('re-lays the scene with landscape’s board and keeps found slots, chip, glow and seated critters', async () => {
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag', 'tab'] })
    const g = await mount()
    for (let n = 0; n < HUNT_HINT_RUNS; n++) await build('hag')
    expect(glowing()).toEqual([1])
    await seat('h', 'a')
    await g.relayout(PHONE_L)
    const l = mathLayout(PHONE_L)
    const scene = huntScene(playArea(l), l.tablet, l.landscape, 6)
    expect(flat(byId('critter-b'))).toMatchObject({
      left: scene.cells[1]!.x,
      top: scene.cells[1]!.y,
    })
    expect(flat(byId('hunt-slot-0-card'))).toMatchObject({
      left: scene.slots[0]!.card.x,
      top: scene.slots[0]!.card.y,
    })
    expect(tilesOf(0)).toBe('bag')
    expect(byId('hunt-bonus').props.accessibilityLabel).toBe('Bonus words, tab')
    expect(glowing()).toEqual([1])
    expect(seated()).toEqual([0, 1])
  })
})

// --- Pictures in the word boxes (critters-word-hunt.md § 15, P2-P10) -----------

describe('P2: the board from the deal', () => {
  it('slot i is board word i (its picture and its sound); the picture at opacity 1 exactly when it has one, else the listen mark, never both; no tile until found', async () => {
    const g = await mount()
    const r = huntRoundOf(ROUND)!
    expect(huntBoardOrder(r)).toEqual(BOARD)
    for (const [i, word] of BOARD.entries()) {
      await fireEvent.press(byId(`hunt-slot-${i}`))
      expect(g.calls.at(-1)).toEqual(wordSound(word))
    }
    BOARD.forEach((word, i) => {
      const pictures = screen.queryAllByTestId(
        new RegExp(`^hunt-slot-${i}-picture-`),
      )
      const listen = screen.queryAllByTestId(`hunt-slot-${i}-listen`)
      if (critterHasPicture(word)) {
        expect(pictures.map((el) => el.props.testID)).toEqual([
          `hunt-slot-${i}-picture-${critterPictureKey(word)}`,
        ])
        expect(flat(pictures[0]!).opacity ?? 1).toBe(1)
        expect(listen).toHaveLength(0)
      } else {
        expect(pictures).toHaveLength(0)
        expect(listen).toHaveLength(1)
      }
      expect(tilesOf(i)).toBe('')
    })
    expect(critterHasPicture('pat')).toBe(false)
    expect(has('hunt-slot-5-listen')).toBe(true)
  })

  it('a record stored in find order (as build 23 wrote it) reopens with each find in its own slot', async () => {
    learnerAt('cvc-words-short-o', {
      letters: ROUND,
      found: ['tap', 'pat', 'bag', 'hat'],
    })
    await mount()
    expect(BOARD.map((_, i) => tilesOf(i))).toEqual([
      'bag',
      '',
      'hat',
      '',
      'tap',
      'pat',
    ])
    expect(loadHuntRecord()!.found).toEqual(['tap', 'pat', 'bag', 'hat'])
  })
})

describe('P3: the picture box', () => {
  /** Slot i's picture box, relative to its card. */
  const boxOf = (s: HuntScene, i: number) => {
    const { card, picture } = s.slots[i]!
    return { ...picture, x: picture.x - card.x, y: picture.y - card.y }
  }
  it.each([
    ['phone S4', PHONE_P],
    ['tablet', { width: 820, height: 1180, insets: PHONE_P.insets }],
  ])(
    '%s: the picture is drawn to the whole box, clipped to 0.18 T; the listen mark’s stroke is #b27b37, 9 %% of the box',
    async (_, viewport) => {
      await mount({ viewport })
      const l = mathLayout(viewport)
      const s = huntScene(playArea(l), l.tablet, l.landscape, 6)
      const T = s.step.T
      for (const i of [0, 4]) {
        const box = boxOf(s, i)
        expect(flat(byId(`hunt-slot-${i}-box`))).toMatchObject({
          left: box.x,
          top: box.y,
          width: T,
          height: T,
          borderRadius: 0.18 * T,
        })
        const pic = byId(
          `hunt-slot-${i}-picture-${critterPictureKey(BOARD[i]!)}`,
        )
        expect(flat(pic)).toMatchObject({
          left: 0,
          top: 0,
          width: T,
          height: T,
          borderRadius: 0.18 * T,
          overflow: 'hidden',
        })
      }
      const mark = byId('hunt-slot-5-listen')
      expect(flat(mark)).toMatchObject({ left: 0, top: 0, width: T, height: T })
      const waves = svg('Path', mark).filter((n) => n.props.strokeWidth)
      expect(waves).toHaveLength(2)
      for (const w of waves) {
        expect(w.props).toMatchObject({
          stroke: paint('#b27b37'),
          strokeWidth: 9,
        })
      }
      expect(mark.props.accessible).toBe(false)
    },
  )

  it('S4: the box is 36 × 36 at (card.x + 20, card.y + 3) on a 76 × 67 card', async () => {
    const s = PHONE_SCENE()
    expect(s.step).toMatchObject({ name: 'S4', pad: 3, T: 36 })
    for (const { card, picture } of s.slots) {
      expect([card.width, card.height]).toEqual([76, 67])
      expect(picture).toEqual({
        x: card.x + 20,
        y: card.y + 3,
        width: 36,
        height: 36,
      })
    }
  })
})

describe('P4: the fill into its own slot', () => {
  const UB = ['u', 'b', 'g', 'm', 's', 't']
  it('u b g m s t with bug found: mug fills slot 4, slots 1-3 stay empty; its card lands on the slot’s picture grown to T / 0.86, the picture drawn throughout', async () => {
    learnerAt('cvc-words-short-o', { letters: UB, found: ['bug'] })
    await mount()
    const l = mathLayout(PHONE_P)
    const s = huntScene(playArea(l), l.tablet, l.landscape, 8)
    const box = s.slots[4]!.picture
    const timing = jest.spyOn(Reanimated, 'withTiming')
    await seat('m', 'u', 'g')
    await advance(SING_AFTER_MS)
    for (let t = 0; t < 15000 && !has('hunt-fly-0'); t += 50) {
      expect(has('hunt-slot-4-picture-mug')).toBe(true)
      await advance(50)
    }
    // In flight: the card heads for the slot's picture box grown to
    // T / 0.86 about its centre, so its 0.86 picture lands on the slot's.
    expect(has('hunt-fly-0')).toBe(true)
    const T = box.width
    const into = grow(box, (T / 0.86 - T) / 2)
    expect(centre(into)).toEqual(centre(box))
    const card = s.picture
    const move = expect.objectContaining({ duration: PICTURE_LEAVE_MS })
    expect(timing.mock.calls).toEqual(
      expect.arrayContaining([
        [centre(into).x - centre(card).x, move],
        [centre(into).y - centre(card).y, move],
        [into.width / card.width, move],
      ]),
    )
    expect(has('hunt-slot-4-picture-mug')).toBe(true)
    await advance(FILL_LAND_MS + FILL_SETTLE_MS)
    expect(tilesOf(4)).toBe('mug')
    expect([1, 2, 3].map(tilesOf)).toEqual(['', '', ''])
    expect(tilesOf(0)).toBe('bug')
    expect(has('hunt-slot-4-picture-mug')).toBe(true)
  })

  it('a listen slot’s fill shows no card, and its mark stays after the tiles land', async () => {
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag'] })
    await mount()
    await seat('p', 'a', 't')
    await advance(SING_AFTER_MS)
    for (let t = 0; t < 15000 && seated().length > 0; t += 50) {
      expect(has('critter-picture')).toBe(false)
      expect(has('hunt-slot-5-listen')).toBe(true)
      await advance(50)
    }
    expect(tilesOf(5)).toBe('pat')
    expect(has('hunt-slot-5-listen')).toBe(true)
  })

  it('a repeat wiggles one slot once (the slot that holds its word, P2) and fills nothing', async () => {
    const { count } = wiggleStarts()
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag', 'tap'] })
    await mount()
    const before = count()
    await build('tap')
    expect(count()).toBe(before + 1)
    expect(BOARD.map((_, i) => tilesOf(i))).toEqual([
      'bag',
      '',
      '',
      '',
      'tap',
      '',
    ])
  })
})

describe('P5: tapping an empty slot', () => {
  it('cuts any line, plays exactly what a filled slot plays, no caption, pose unchanged; the box pulses (400 ms) and a second tap restarts it; no write', async () => {
    const pulses = pulseStarts()
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag'] })
    const g = await mount()
    const poses = g.poses.length
    const record = JSON.stringify(loadHuntRecord())
    writes = []
    // A picture word: the word part of its blend clip.
    const before = pulses()
    await fireEvent.press(byId('hunt-slot-3'))
    expect(g.calls.at(-1)).toEqual(wordSound('tag'))
    expect(pulses()).toBe(before + 1)
    expect(has('play-game-ribbon')).toBe(false)
    expect(g.poses).toHaveLength(poses)
    // Again: it restarts.
    await fireEvent.press(byId('hunt-slot-3'))
    expect(g.calls.slice(-2)).toEqual([wordSound('tag'), wordSound('tag')])
    expect(pulses()).toBe(before + 2)
    // A said word with a picture, and a word with none: their word clips.
    await fireEvent.press(byId('hunt-slot-4'))
    expect(g.calls.at(-1)).toEqual(wordSound('tap'))
    await fireEvent.press(byId('hunt-slot-5'))
    expect(g.calls.at(-1)).toEqual(wordSound('pat'))
    expect(g.lines).toEqual(['guide.play.critters.open'])
    expect(g.poses).toHaveLength(poses)
    expect(writes).toEqual([])
    expect(JSON.stringify(loadHuntRecord())).toBe(record)
  })

  it('a tap cuts Emma’s line', async () => {
    const s = fakeSounds(wholeMs)
    const g = await mountGame('critters', { sounds: s.sounds })
    await advance(CRITTERS_OPEN_DELAY_MS)
    expect(g.lines).toEqual(['guide.play.critters.open'])
    expect(has('play-game-ribbon')).toBe(true)
    await fireEvent.press(byId('hunt-slot-1'))
    expect(has('play-game-ribbon')).toBe(false)
    expect(s.calls.at(-1)).toEqual(wordSound('bat'))
  })

  it('ignored while the board waits and during the beat; after completion the empty slot still plays its word', async () => {
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag'] })
    let g = await mount()
    await seat('h', 'a', 'g')
    await advance(SING_AFTER_MS + 50)
    let calls = g.calls.length
    await fireEvent.press(byId('hunt-slot-1'))
    expect(g.calls).toHaveLength(calls)
    await g.unmount()
    g = await toC0()
    await advance(BEAT_LAP_AFTER_MS + 100)
    calls = g.calls.length
    await fireEvent.press(byId('hunt-slot-5'))
    expect(g.calls).toHaveLength(calls)
    await advance(20000)
    expect(has('hunt-new-letters')).toBe(true)
    await fireEvent.press(byId('hunt-slot-5'))
    expect(g.calls.at(-1)).toEqual(wordSound('pat'))
    expect(glowing()).toEqual([])
  })

  it('press-in sinks the card by 2 on a phone and 3 on a tablet over 120 ms; release lifts it', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming')
    const sinks = (d: number) =>
      timing.mock.calls.filter(
        ([v, cfg]) => v === d && cfg?.duration === PRESS_MS,
      ).length
    const g = await mount()
    expect([SLOT_SINK_PHONE, SLOT_SINK_TABLET]).toEqual([2, 3])
    const before = sinks(2)
    await fireEvent(byId('hunt-slot-2'), 'pressIn')
    expect(sinks(2)).toBeGreaterThan(before)
    await fireEvent(byId('hunt-slot-2'), 'pressOut')
    expect(timing.mock.calls.at(-1)).toEqual([0, { duration: PRESS_MS }])
    await g.unmount()
    await mount({
      viewport: { width: 820, height: 1180, insets: PHONE_P.insets },
    })
    const tablet = sinks(3)
    await fireEvent(byId('hunt-slot-2'), 'pressIn')
    expect(sinks(3)).toBeGreaterThan(tablet)
  })
})

describe('P6: the hint', () => {
  const OG = ['o', 'g', 'h', 'j', 'p', 't']
  it('a word with no picture: its three critter sounds, each 300 ms after the last, then its word clip; Emma points, then idle; no caption, no ghost, no critter moves', async () => {
    holdSharedValues()
    // hot, pot, pop, top found: the first empty slot is got (slot 4).
    learnerAt('cvc-words-short-o', {
      letters: OG,
      found: ['hot', 'pot', 'pop', 'top'],
    })
    const g = await mount()
    expect(has('hunt-slot-4-listen')).toBe(true)
    for (let n = 0; n < HUNT_HINT_RUNS; n++) await build('hgp')
    expect(glowing()).toEqual([4])
    expect(byId('hunt-slot-4').props.accessibilityLabel).toBe('Hint')
    const sequence = jest.spyOn(Reanimated, 'withSequence')
    const moves = sequence.mock.calls.length
    const calls = g.calls.length
    await fireEvent.press(byId('hunt-slot-4'))
    expect(g.poses.at(-1)).toBe('attentive-pointing')
    const want = [...'got'].map(letterCall)
    for (let k = 0; k < 3; k++) {
      expect(g.calls.slice(calls)).toEqual(want.slice(0, k + 1))
      await advance(ownMs('got'[k]!) + SOUND_GAP_MS - 1)
      expect(g.calls.slice(calls)).toHaveLength(k + 1)
      await advance(1)
    }
    expect(g.calls.slice(calls)).toEqual([...want, wordSound('got')])
    expect(g.poses.at(-1)).toBe('attentive-pointing')
    expect(has('play-game-ribbon')).toBe(false)
    expect(screen.queryAllByTestId(/-ghost-/)).toHaveLength(0)
    await advance(wordMs('got') - 10)
    expect(g.poses.at(-1)).toBe('attentive-pointing')
    await advance(20)
    expect(g.poses.at(-1)).toBe('idle')
    // The box pulsed once; no critter lit or bounced.
    expect(sequence.mock.calls.length - moves).toBe(1)
  })

  it('a tap mid-hint cuts and replays it from the first sound', async () => {
    learnerAt('cvc-words-short-o', {
      letters: OG,
      found: ['hot', 'pot', 'pop', 'top'],
    })
    const g = await mount()
    for (let n = 0; n < HUNT_HINT_RUNS; n++) await build('hgp')
    await fireEvent.press(byId('hunt-slot-4'))
    await advance(ownMs('g') + SOUND_GAP_MS + 10)
    const calls = g.calls.length
    await fireEvent.press(byId('hunt-slot-4'))
    expect(g.calls.slice(calls)).toEqual([letterCall('g')])
    expect(g.poses.at(-1)).toBe('attentive-pointing')
    const sounds = [...'got'].reduce((ms, l) => ms + ownMs(l), 0)
    await advance(sounds + 3 * SOUND_GAP_MS + wordMs('got') + 10)
    expect(g.calls.slice(calls)).toEqual([
      ...[...'got'].map(letterCall),
      wordSound('got'),
    ])
    expect(g.poses.at(-1)).toBe('idle')
  })

  it('another slot’s tap cuts the hint; Emma stops pointing', async () => {
    learnerAt('cvc-words-short-o', {
      letters: OG,
      found: ['hot', 'pot', 'pop', 'top'],
    })
    const g = await mount()
    for (let n = 0; n < HUNT_HINT_RUNS; n++) await build('hgp')
    await fireEvent.press(byId('hunt-slot-4'))
    await fireEvent.press(byId('hunt-slot-5'))
    expect(g.calls.at(-1)).toEqual(wordSound('hog'))
    expect(g.poses.at(-1)).toBe('idle')
    const calls = g.calls.length
    await advance(5000)
    expect(g.calls).toHaveLength(calls)
  })
})

describe('P7: the lap in board order', () => {
  it('a b h m p t, found tap, bat, map, ham, hat, then mat: the lap plays bat, hat, mat, ham, map, tap; pat’s slot never lights', async () => {
    learnerAt('cvc-words-short-o', {
      letters: ['a', 'b', 'h', 'm', 'p', 't'],
      found: ['tap', 'bat', 'map', 'ham', 'hat'],
    })
    const g = await mount()
    expect(has('hunt-slot-6-listen')).toBe(true)
    await seat('m', 'a', 't')
    await advance(SING_AFTER_MS)
    const lit: number[] = []
    const calls = g.calls.length
    for (let t = 0; t < 40000 && !has('hunt-new-letters'); t += 25) {
      for (let i = 0; i < 7; i++) {
        if (has(`hunt-slot-${i}-lap`) && lit.at(-1) !== i) lit.push(i)
      }
      await advance(25)
    }
    expect(lit).toEqual([0, 1, 2, 3, 4, 5])
    const order = ['bat', 'hat', 'mat', 'ham', 'map', 'tap']
    expect(g.calls.slice(calls).slice(-order.length)).toEqual(
      order.map(wordSound),
    )
  })
})

describe('P9: Reduce Motion', () => {
  it('the tiles fade in at the word’s own slot with no flight; slot and hint taps scale nothing; the press still sinks', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    holdSharedValues()
    const timing = jest.spyOn(Reanimated, 'withTiming')
    const scales = () => timing.mock.calls.filter(([v]) => v === 1.15).length
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag'] })
    const g = await mount()
    await seat('t', 'a', 'g')
    await advance(SING_AFTER_MS)
    for (let t = 0; t < 12000 && (locked() || seated().length > 0); t += 50) {
      expect(has('hunt-fly-0')).toBe(false)
      await advance(50)
    }
    expect(tilesOf(3)).toBe('tag')
    const before = scales()
    await fireEvent.press(byId('hunt-slot-1'))
    expect(g.calls.at(-1)).toEqual(wordSound('bat'))
    for (let n = 0; n < HUNT_HINT_RUNS; n++) await build('hag')
    expect(glowing()).toEqual([1])
    await fireEvent.press(byId('hunt-slot-1'))
    expect(g.calls.at(-1)).toEqual({ uri: clipOf('bat'), from: 0, to: null })
    expect(scales()).toBe(before)
    const sinks = timing.mock.calls.length
    await fireEvent(byId('hunt-slot-2'), 'pressIn')
    expect(timing.mock.calls.slice(sinks)).toContainEqual([
      SLOT_SINK_PHONE,
      { duration: PRESS_MS },
    ])
  })
})

describe('P10: VoiceOver on the slots', () => {
  it('every empty slot is "Word to find" whatever its word, a button that plays it; the glowing one is "Hint"; a filled one its word; pictures and marks are not elements', async () => {
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag', 'tab'] })
    const g = await mount()
    expect(byId('hunt-slot-0').props.accessibilityLabel).toBe('Bag')
    expect(byId('hunt-slot-0').props.accessibilityRole).toBe('button')
    for (const i of [1, 2, 3, 4, 5]) {
      const label = byId(`hunt-slot-${i}`).props.accessibilityLabel as string
      expect(label).toBe('Word to find')
      expect(label.toLowerCase()).not.toContain(BOARD[i]!)
      expect(byId(`hunt-slot-${i}`).props.accessibilityRole).toBe('button')
    }
    // VoiceOver's double tap is the press.
    await fireEvent.press(byId('hunt-slot-2'))
    expect(g.calls.at(-1)).toEqual(wordSound('hat'))
    for (const el of screen.queryAllByTestId(
      /^hunt-slot-\d-(picture-|listen)/,
    )) {
      expect(el.props.accessible).toBe(false)
    }
    for (let n = 0; n < HUNT_HINT_RUNS; n++) await build('hag')
    expect(byId('hunt-slot-1').props.accessibilityLabel).toBe('Hint')
    expect(byId('hunt-slot-1').props.accessibilityRole).toBe('button')
    expect(byId('hunt-slot-1').props.accessibilityState.selected).toBe(true)
  })
})
