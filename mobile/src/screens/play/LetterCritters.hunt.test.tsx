/**
 * Letter critters' word hunt on screen (`design/native/critters-word-hunt.md`
 * § 2-§ 8, ACs H8-H25), for a learner past cvc-words with short o current
 * (Marian, 2026-10-25), on a seeded round: a b g h p t, whose targets are
 * bag, bat, hat, tag (picture words), tap (a said word with a picture) and
 * pat (familiar, no picture); its extras gab-free: gag, gap and tab; and
 * hag, a never-say word. Sounds go through the fake tap-sound player.
 */
import { setKeyValueStore } from '@marian/core'
import { progressAtStep } from '@marian/core/debug/stepProgress'
import {
  freshHuntRecord,
  HUNT_STORAGE_KEY,
  huntFind,
  huntRoundOf,
  loadHuntRecord,
  saveHuntRecord,
} from '@marian/core/games/critterHunt'
import { critterWordLine } from '@marian/core/emmasPath/guidanceLines'
import {
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
import { StyleSheet } from 'react-native'
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
import { blendClipPath, blendSegments } from './critterModel'
import { FILL_LAND_MS, FILL_SETTLE_MS, WIGGLE_STEP_MS } from './HuntBoard'
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
  SING_AFTER_MS,
  SOUND_GAP_MS,
} from './LetterCritters'
import { backRect, centre, huntScene, playArea } from './playGeometry'

const ROUND = ['a', 'b', 'g', 'h', 'p', 't']
const TARGETS = ['bag', 'bat', 'hat', 'pat', 'tag', 'tap']

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
/** A letter's own sound's length. */
function ownMs(letter: string) {
  const src = CRITTER_SOUND_SOURCE[letter]!
  const w = letterWindow(blendSegments(src.word)![src.index]!)
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
const locked = () =>
  byId(`critter-${ROUND[1]}`).props.accessibilityState?.disabled === true
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
 * Counts animation starts: the jest mock's `useSharedValue` makes a new
 * value every render, which re-runs every effect on any render; held per
 * component, as on a device, each effect runs once per change.
 */
function wiggleStarts() {
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

  it('a familiar word without a picture (pat): its tiles in the next slot, the picture box blank', async () => {
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag'] })
    const g = await mount()
    expect(tilesOf(0)).toBe('bag')
    await build('pat')
    expect(g.lines).toContain('guide.play.critters.word.pat')
    expect(tilesOf(1)).toBe('pat')
    expect(screen.queryAllByTestId(/^hunt-slot-1-picture-/).length).toBe(0)
  })

  it('a said word with a picture (tap): its picture goes into the slot', async () => {
    await mount()
    await build('tap')
    expect(tilesOf(0)).toBe('tap')
    expect(has('hunt-slot-0-picture-tap')).toBe(true)
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

  it('45 s with no drag start: the glow; a tap plays the hint’s word whole, no caption, its picture ghosted; a new target ends it', async () => {
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag'] })
    const g = await mount()
    await build('hag')
    await advance(HUNT_HINT_IDLE_MS - 3000)
    await advance(4000)
    expect(glowing()).toEqual([1])
    expect(has('hunt-slot-1-ghost-bat')).toBe(false)
    await fireEvent.press(byId('hunt-slot-1'))
    // bat: the first unfound picture word, its whole blend clip.
    expect(g.calls.at(-1)).toEqual({ uri: clipOf('bat'), from: 0, to: null })
    expect(g.poses.at(-1)).toBe('attentive-pointing')
    expect(has('play-game-ribbon')).toBe(false)
    expect(has('hunt-slot-1-ghost-bat')).toBe(true)
    await advance(wholeMs(clipOf('bat')) + 10)
    expect(g.poses.at(-1)).toBe('idle')
    // A new target (any) fills this slot; the glow goes.
    await build('hat')
    expect(glowing()).toEqual([])
    expect(tilesOf(1)).toBe('hat')
  })

  it('no glow after completion', async () => {
    await throughBeat()
    for (let n = 0; n < HUNT_HINT_RUNS; n++) await build('hag')
    await advance(HUNT_HINT_IDLE_MS + 1000)
    expect(glowing()).toEqual([])
  })
})

describe('H16: tapping a slot', () => {
  it('a filled slot plays its word (picture word: its word part; said word: its clip), no caption; an empty slot does nothing', async () => {
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag', 'tap'] })
    const g = await mount()
    await fireEvent.press(byId('hunt-slot-0'))
    expect(g.calls.at(-1)).toEqual(wordSound('bag'))
    await fireEvent.press(byId('hunt-slot-1'))
    expect(g.calls.at(-1)).toEqual(wordSound('tap'))
    expect(has('play-game-ribbon')).toBe(false)
    expect(byId('hunt-slot-1').props.accessibilityRole).toBe('button')
    const calls = g.calls.length
    await fireEvent.press(byId('hunt-slot-2'))
    expect(g.calls).toHaveLength(calls)
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
  it('at the 5th of 6, after its shelf clears: the lap in find order, "You did it!", the cheer and burst, then New letters; the board ignores touches until then; Back works', async () => {
    const g = await toC0()
    // C0: the board locks, Emma celebrates.
    expect(g.poses.at(-1)).toBe('celebration')
    expect(loadHuntRecord()!.complete).toBe(true)
    expect(has('hunt-new-letters')).toBe(false)
    const order = ['bag', 'hat', 'bat', 'tap', 'tag']
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
  it('Back mid-round: the same letters, slots in find order and chip, drawn at once; only the open line', async () => {
    const first = await mount()
    await build('hat')
    await build('tab')
    await build('bag')
    await first.unmount()
    const g = await mount({ rng: seeded(99) })
    expect(meadow()).toEqual(ROUND)
    expect([tilesOf(0), tilesOf(1)]).toEqual(['hat', 'bag'])
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

  it.each(['bag', 'pat'])(
    'a new target (%s) lands in its slot once she is back; the next takes the next slot',
    async (word) => {
      const g = await mount()
      await cutByBackground(g, word)
      await advance(10000)
      expect(loadHuntRecord()!.found).toEqual([word])
      expect(tilesOf(0)).toBe(word)
      expect(seated()).toEqual([])
      expect(locked()).toBe(false)
      await build('hat')
      expect([tilesOf(0), tilesOf(1)]).toEqual([word, 'hat'])
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
    expect(tilesOf(4)).toBe('tag')
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
    expect(tilesOf(3)).toBe('tap')
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

describe('H24: VoiceOver', () => {
  it('§ 6.3’s labels and roles; activating a filled slot plays it', async () => {
    learnerAt('cvc-words-short-o', { letters: ROUND, found: ['bag', 'tab'] })
    const g = await mount()
    expect(byId('hunt-slot-0').props.accessibilityLabel).toBe('Bag')
    expect(byId('hunt-slot-0').props.accessibilityRole).toBe('button')
    expect(byId('hunt-slot-1').props.accessibilityLabel).toBe('Empty word')
    expect(byId('hunt-slot-1').props.accessibilityRole).toBeUndefined()
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
