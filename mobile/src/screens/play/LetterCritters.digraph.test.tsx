/**
 * Letter critters' digraph critters on screen (`design/native/critters-digraph.md`
 * § 2-§ 9, ACs D14-D22), and Dave's Q38 ruling (D28): "Two letters, one
 * sound!" once per learner. The learner is on digraphs-sh (every CVC step
 * mastered, so all five vowels deal). Her round is Dave's sh-i fallback,
 * i sh b c n p: bib bin pin ship, shin among the extras (the
 * `critters-hunt-sh` seed's, D23). The four-letter round is his ch-e
 * fallback, e ch c j n s t: chest jets nest tent. Sounds go through the fake
 * tap-sound player; the pair's metrics are § 2.2's, and its baseline is
 * checked against the bundled Fredoka file's own line metrics.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setKeyValueStore } from '@marian/core'
import { progressAtStep } from '@marian/core/debug/stepProgress'
import { critterWordLine } from '@marian/core/emmasPath/guidanceLines'
import * as CritterHunt from '@marian/core/games/critterHunt'
import {
  freshHuntRecord,
  HUNT_STORAGE_KEY,
  huntDigraphLineSaid,
  huntFind,
  huntRoundOf,
  markHuntDigraphLineSaid,
  saveHuntRecord,
  type HuntLength,
} from '@marian/core/games/critterHunt'
import {
  CRITTER_PICTURE_WORDS,
  CRITTER_SOUND_SOURCE,
} from '@marian/core/games/playPlace'
import { saveProgress, type SkillNode } from '@marian/core/progress'
import { fireEvent, screen, within } from '@testing-library/react-native'
import { useRef } from 'react'
import { StyleSheet } from 'react-native'
import * as Reanimated from 'react-native-reanimated'
import { letterWindow } from '../../audio/blendMarks'
import * as BundledAudio from '../../audio/bundledAudio'
import { audioForWebPath } from '../../audio/bundledAudio'
import type { Viewport } from '../../layout/layout'
import { mathLayout } from '../../layout/mathLayout'
import { fonts } from '../../theme'
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
import { FILL_LAND_MS, FILL_SETTLE_MS } from './HuntBoard'
import { PICK_AFTER_MS } from './HuntLengths'
import {
  CRITTERS_OPEN_DELAY_MS,
  HUNT_HINT_IDLE_MS,
  PRAISE_AFTER_MS,
  SING_AFTER_MS,
  SOUND_GAP_MS,
} from './LetterCritters'
import { centre, huntScene, playArea } from './playGeometry'
import { critterLabel, PLAY_LABELS } from './playLines'

const words = (s: string) => s.split(' ')
/** Dave's sh-i fallback: bib bin pin ship; extras nib nip shin. */
const SH = words('i sh b c n p')
/** Dave's ch-e four-letter fallback: chest jets nest tent. */
const CH_FOUR = words('e ch c j n s t')
/** Rounds with fish (slot 2: bib sip fish ship) and sing (bib wig sing wing). */
const FISH = words('i sh b f p s')
const SING = words('i ng b g s w')
/** A sh-i round of five: bib fig pig fish ship (a digraph word to hint). */
const SH_FIVE = words('i sh b f g p')
/** The other fallbacks: one of each pair. */
const FALLBACKS: Record<string, string[]> = {
  sh: SH,
  ch: words('i ch b f g p'),
  th: words('o th c d m t'),
  ng: words('i ng b f g w'),
}
/** Plain rounds of the same N (4) for D22: bib fig pig wig; jets nest tent vest. */
const PLAIN = words('i b f g p w')
const PLAIN_FOUR = words('e c j n s t v')

/** The pair's ink per 1000 em, as § 2.2 prints it (width, descent, ascent). */
const INK: Record<string, { width: number; descent: number; ascent: number }> =
  {
    sh: { width: 897, descent: 14, ascent: 676 },
    ch: { width: 956, descent: 15, ascent: 676 },
    th: { width: 850, descent: 13, ascent: 676 },
    ng: { width: 1018, descent: 208, ascent: 472 },
  }
const LETTER = '#6b3f1f'
const HONEY = '#f2c27a'
const DIGRAPH_LINE = 'guide.play.critters.digraph'

/** The bundled Fredoka 700's hhea metrics, per em, read from the file. */
const FONT = (() => {
  const d = readFileSync(
    join(
      __dirname,
      '../../../node_modules/@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf',
    ),
  )
  const table = new Map<string, number>()
  for (let i = 0; i < d.readUInt16BE(4); i++) {
    const at = 12 + 16 * i
    table.set(d.toString('latin1', at, at + 4), d.readUInt32BE(at + 8))
  }
  const upm = d.readUInt16BE(table.get('head')! + 18)
  const h = table.get('hhea')!
  const ascent = d.readInt16BE(h + 4) / upm
  const descent = -d.readInt16BE(h + 6) / upm
  const gap = d.readInt16BE(h + 8) / upm
  return { ascent, line: ascent + descent + gap }
})()

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
/** A critter's own sound: its window of its sound source (§ 4.1). */
function unitCall(unit: string) {
  const src = CRITTER_SOUND_SOURCE[unit]!
  const w = letterWindow(blendSegments(src.word)![src.index]!)
  return { uri: clipOf(src.word), from: w.from, to: w.to }
}
const ownMs = (unit: string) => {
  const w = unitCall(unit)
  return w.to - w.from
}
/** The four sound-source blends (D9): ship, chip, thin, ring. */
const SOURCES = ['sh', 'ch', 'th', 'ng'].map(
  (g) => CRITTER_SOUND_SOURCE[g]!.word,
)

// --- The learner and her round -------------------------------------------------

let writes: string[] = []

function learner({
  step = 'digraphs-sh',
  three,
  four,
  open = [3],
  said = false,
}: {
  step?: SkillNode
  three?: { letters: string[]; found?: string[] }
  four?: { letters: string[]; found?: string[] }
  open?: HuntLength[]
  said?: boolean
} = {}) {
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
  const keep = (letters: string[], found: string[], length: HuntLength) => {
    const r = huntRoundOf(letters, { length })!
    saveHuntRecord(found.reduce(huntFind, freshHuntRecord(r)), length)
  }
  if (three) keep(three.letters, three.found ?? [], 3)
  if (four) keep(four.letters, four.found ?? [], 4)
  if (open.includes(4)) {
    const all = JSON.parse(map.get(HUNT_STORAGE_KEY) ?? '{}') as object
    map.set(HUNT_STORAGE_KEY, JSON.stringify({ ...all, open: [3, 4] }))
  }
  if (said) markHuntDigraphLineSaid()
  writes = []
  return map
}

async function mount(
  opts: { viewport?: Viewport; rng?: () => number; lineMs?: number } = {},
) {
  const s = fakeSounds(wholeMs)
  const g = await mountGame('critters', { sounds: s.sounds, ...opts })
  await advance(CRITTERS_OPEN_DELAY_MS + LINE_MS)
  return { ...g, ...s }
}
/** The picker's "4" log, then its round's entry. */
async function pickFour() {
  await fireEvent.press(byId('hunt-pick-4'))
  await advance(PICK_AFTER_MS + CRITTERS_OPEN_DELAY_MS + LINE_MS)
}

const sceneOf = (v: Viewport, n: number, length: HuntLength = 3) => {
  const l = mathLayout(v)
  return huntScene(playArea(l), l.tablet, l.landscape, n, length)
}
const seated = () => [0, 1, 2, 3].filter((i) => has(`critter-seat-${i}`))
const meadow = () =>
  screen
    .queryAllByTestId(/^critter-[a-z]{1,2}$/)
    .map((el) => String(el.props.testID).slice('critter-'.length))
const locked = () =>
  screen.queryAllByTestId(/^critter-[a-z]{1,2}$/).at(-1)?.props
    .accessibilityState?.disabled === true
const flat = (el: ReturnType<typeof byId>) => StyleSheet.flatten(el.props.style)
/** A tile's critter: its one text element (a letter or a pair). */
const unitOf = (id: string) =>
  within(byId(id)).getByText(/^[a-z]{1,2}$/).props.children as string
const tilesOf = (i: number) =>
  [0, 1, 2, 3, 4]
    .filter((k) => has(`hunt-slot-${i}-tile-${k}`))
    .map((k) => unitOf(`hunt-slot-${i}-tile-${k}`))

async function seat(...units: string[]) {
  for (const u of units) await activate(byId(`critter-${u}`))
}
/** Seats `units` and plays the run out until the board is free again. */
async function build(units: string[], cap = 30000) {
  await seat(...units)
  await advance(SING_AFTER_MS)
  for (let t = 0; t < cap; t += 50) {
    if (!locked() && seated().length === 0) return
    await advance(50)
  }
  throw new Error(`the board never freed after ${units.join('-')}`)
}

/** Held shared values: each animation effect runs once per change. */
function holdSharedValues() {
  const make = Reanimated.useSharedValue
  function useHeldSharedValue(init: unknown) {
    const held = useRef<ReturnType<typeof make> | null>(null)
    held.current ??= make(init)
    // A test stand-in for a hook: the held value is the render's output.
    return held.current
  }
  jest
    .spyOn(Reanimated, 'useSharedValue')
    .mockImplementation(useHeldSharedValue as typeof make)
}

/** The pair's text and bar in `root`, and their flattened styles. */
function pairIn(root: ReturnType<typeof byId>, pair: string) {
  const text = within(root).getByText(pair)
  const bar = within(root).getAllByTestId(/-bar$/)
  expect(bar).toHaveLength(1)
  return {
    text,
    bar: bar[0]!,
    t: StyleSheet.flatten(text.props.style),
    b: StyleSheet.flatten(bar[0]!.props.style),
  }
}

/**
 * § 2.2 / § 3 for `pair` in a box of side `side`: font `k` × side,
 * baseline `base` × side; the text's line box is the font's own line, so
 * its baseline is its top + the font's ascent.
 */
function expectPair(
  root: ReturnType<typeof byId>,
  pair: string,
  side: number,
  k: number,
  base: number,
) {
  const { t, b } = pairIn(root, pair)
  const f = k * side
  // One text element, both letters; never the two letters apart.
  expect(within(root).queryByText(pair[0]!)).toBeNull()
  expect(within(root).queryByText(pair[1]!)).toBeNull()
  expect(t.fontSize).toBeCloseTo(f, 6)
  expect(t.fontFamily).toBe(fonts.bold)
  expect(t.color).toBe(LETTER)
  expect(t.lineHeight).toBeCloseTo(FONT.line * f, 6)
  expect((t.top as number) + FONT.ascent * f).toBeCloseTo(base * side, 6)
  // Centred by its advance across the whole box.
  expect(t.left).toBe(0)
  expect(t.width).toBeCloseTo(side, 6)
  expect(t.textAlign).toBe('center')
  // The bar: under the pair's lowest ink, as wide as its ink, centred.
  const ink = INK[pair]!
  const width = (ink.width / 1000) * f
  const thick = Math.max(1.5, 0.11 * f)
  expect(b.backgroundColor).toBe(LETTER)
  expect(b.width).toBeCloseTo(width, 6)
  expect(b.height).toBeCloseTo(thick, 6)
  expect(b.borderRadius).toBeCloseTo(thick / 2, 6)
  expect(b.left).toBeCloseTo((side - width) / 2, 6)
  expect(b.top).toBeCloseTo(
    base * side + (ink.descent / 1000) * f + 0.085 * f,
    6,
  )
  return { f, t, b, ink }
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  learner({ three: { letters: SH }, said: true })
})
afterEach(() => {
  setKeyValueStore(null)
  jest.useRealTimers()
  jest.restoreAllMocks()
})

// --- § 7: the deal -----------------------------------------------------------

describe('§ 7: a digraph deals once its step is open', () => {
  it('the deal and New letters pass her open digraphs; before digraphs-sh, none', async () => {
    const deal = jest.spyOn(CritterHunt, 'huntDeal')
    learner({ step: 'digraphs-sh' })
    const g = await mount({ rng: seeded(7) })
    expect(deal).toHaveBeenCalledTimes(1)
    expect(deal.mock.calls[0]![2]).toMatchObject({ digraphs: ['sh'] })
    await g.unmount()
    learner({ step: 'cvc-words-short-o' })
    await mount({ rng: seeded(7) })
    expect(deal.mock.calls[1]![2]).toMatchObject({ digraphs: [] })
  })

  it('over seeds, a digraphs-sh learner meets an sh board (and never a pair she has not opened)', async () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 12; seed++) {
      learner({ step: 'digraphs-sh' })
      const g = await mount({ rng: seeded(seed) })
      for (const u of meadow()) if (u.length === 2) seen.add(u)
      await g.unmount()
    }
    expect([...seen]).toEqual(['sh'])
  })
})

// --- D14: the critter ----------------------------------------------------------

describe('D14: the digraph critter', () => {
  it('the meadow (c 56): one text element "sh", Fredoka 700 #6b3f1f at 0.46 c on a 0.70 c baseline; one bar at § 2.2’s rect; a single letter unchanged', async () => {
    await mount()
    expect(meadow()).toEqual(SH)
    const c = sceneOf(PHONE_P, 4).c
    expect(c).toBe(56)
    expectPair(byId('critter-sh'), 'sh', c, 0.46, 0.7)
    expect(byId('critter-sh-bar')).toBeTruthy()
    // § 2.2's fractions: the bar's top at 0.746 c, its bottom at 0.796 c.
    const { b } = pairIn(byId('critter-sh'), 'sh')
    expect((b.top as number) / c).toBeCloseTo(0.746, 2)
    expect(((b.top as number) + (b.height as number)) / c).toBeCloseTo(0.796, 2)
    // A single letter: one letter at 0.5 c, no bar.
    const single = StyleSheet.flatten(
      within(byId('critter-b')).getByText('b').props.style,
    )
    expect(single.fontSize).toBe(0.5 * c)
    expect(within(byId('critter-b')).queryAllByTestId(/-bar$/)).toEqual([])
  })

  it('seated (1.25 c = 70): the pair and bar at the seat’s size', async () => {
    await mount()
    await seat('sh')
    expectPair(byId('critter-seat-0'), 'sh', 70, 0.46, 0.7)
  })

  it.each(Object.keys(FALLBACKS))(
    'phone landscape, c 48 (the smallest): %s’s ink starts below the eyes and its bar lies inside the body',
    async (pair) => {
      learner({ three: { letters: FALLBACKS[pair]! }, said: true })
      await mount({ viewport: PHONE_L })
      const c = sceneOf(PHONE_L, 4).c
      expect(c).toBe(48)
      const { f, b, ink } = expectPair(
        byId(`critter-${pair}`),
        pair,
        c,
        0.46,
        0.7,
      )
      // The eyes end at 0.34 c (0.16 + 0.18).
      expect(0.7 * c - (ink.ascent / 1000) * f).toBeGreaterThan(0.34 * c + 2)
      // Both bottom corners of the bar inside the round body.
      const bottom = (b.top as number) + (b.height as number)
      for (const x of [
        b.left as number,
        (b.left as number) + (b.width as number),
      ]) {
        expect(Math.hypot(x - c / 2, bottom - c / 2)).toBeLessThan(c / 2 - 2)
      }
    },
  )

  it('a digraph critter is a consonant: honey on the consonant ledge, a twin when lifted', async () => {
    await mount()
    const body = screen
      .getByTestId('critter-sh')
      .queryAll(
        (n) =>
          StyleSheet.flatten(n.props.style)?.backgroundColor === HONEY &&
          StyleSheet.flatten(n.props.style)?.borderRadius === 28,
      )
    expect(body.length).toBeGreaterThan(0)
    await dragStart(byId('critter-sh'), centre(sceneOf(PHONE_P, 4).seats[0]!))
    expect(has('critter-twin-sh')).toBe(true)
    expectPair(byId('critter-twin-sh'), 'sh', 56, 0.46, 0.7)
  })
})

// --- D15: the tile -------------------------------------------------------------

describe('D15: the digraph tile', () => {
  it('found ship: its sh tile holds one text "sh" at 0.62 b on a 0.64 b baseline, and a bar at § 3’s rect; consonant paint', async () => {
    learner({ three: { letters: SH, found: ['ship'] }, said: true })
    await mount()
    const b = sceneOf(PHONE_P, 4).slots[3]!.boxes[0]!.width
    expect(b).toBe(22)
    expectPair(byId('hunt-slot-3-tile-0'), 'sh', b, 0.62, 0.64)
    expect(byId('hunt-slot-3-tile-0-bar')).toBeTruthy()
    expect(flat(byId('hunt-slot-3-tile-0')).backgroundColor).toBe(HONEY)
    // A single tile beside it is unchanged: one letter at 0.62 b, no bar.
    const i = StyleSheet.flatten(
      within(byId('hunt-slot-3-tile-1')).getByText('i').props.style,
    )
    expect(i.fontSize).toBeCloseTo(0.62 * b, 6)
    expect(i.lineHeight).toBeCloseTo(0.8 * b, 6)
    expect(has('hunt-slot-3-tile-1-bar')).toBe(false)
  })

  it('the chip (bx 16, the tightest): shin’s sh tile, the bar 1.5 pt and above the tile’s bottom', async () => {
    learner({ three: { letters: SH, found: ['shin'] }, said: true })
    await mount()
    const tile = byId('hunt-bonus-shin-0')
    const bx = flat(tile).width as number
    expect(bx).toBe(16)
    const { b } = expectPair(tile, 'sh', bx, 0.62, 0.64)
    expect(b.height).toBe(1.5)
    expect((b.top as number) + (b.height as number)).toBeLessThan(bx - 1)
  })

  it('S5, the four-letter slot at b 20 on phone landscape: chest’s ch tile', async () => {
    learner({
      step: 'digraphs-ch',
      four: { letters: CH_FOUR, found: ['chest'] },
      open: [3, 4],
      said: true,
    })
    await mount({ viewport: PHONE_L })
    await pickFour()
    const b = sceneOf(PHONE_L, 4, 4).slots[0]!.boxes[0]!.width
    expect(b).toBe(20)
    expectPair(byId('hunt-slot-0-tile-0'), 'ch', b, 0.62, 0.64)
  })
})

// --- D16: tiles are critters -----------------------------------------------------

describe('D16: everything that lists a word’s tiles lists its critters', () => {
  it('found ship: tiles 0-2 are sh i p, no tile 3; the chip’s shin is sh i n', async () => {
    learner({ three: { letters: SH, found: ['ship', 'shin'] }, said: true })
    await mount()
    expect(tilesOf(3)).toEqual(['sh', 'i', 'p'])
    expect(has('hunt-slot-3-tile-3')).toBe(false)
    expect(['0', '1', '2'].map((k) => unitOf(`hunt-bonus-shin-${k}`))).toEqual([
      'sh',
      'i',
      'n',
    ])
    expect(has('hunt-bonus-shin-3')).toBe(false)
  })

  it('found chest (four seats): tiles 0-3 are ch e s t, no tile 4', async () => {
    learner({
      step: 'digraphs-ch',
      four: { letters: CH_FOUR, found: ['chest'] },
      open: [3, 4],
      said: true,
    })
    await mount()
    await pickFour()
    expect(tilesOf(0)).toEqual(['ch', 'e', 's', 't'])
    expect(has('hunt-slot-0-tile-4')).toBe(false)
  })

  it('the fill flies three tiles, sh i p, into ship’s slot', async () => {
    await mount()
    await seat('sh', 'i', 'p')
    await advance(SING_AFTER_MS)
    for (let t = 0; t < 20000 && !has('hunt-fly-0'); t += 10) await advance(10)
    expect([0, 1, 2].map((i) => unitOf(`hunt-fly-${i}`))).toEqual([
      'sh',
      'i',
      'p',
    ])
    expect(has('hunt-fly-3')).toBe(false)
    await advance(FILL_LAND_MS + FILL_SETTLE_MS)
    expect(tilesOf(3)).toEqual(['sh', 'i', 'p'])
  })

  it('the hint on fish plays f, i, sh (sh from the ship blend’s sound 0), each 300 ms after the one before, then fish’s word clip', async () => {
    learner({
      three: { letters: SH_FIVE, found: ['bib', 'fig', 'pig'] },
      said: true,
    })
    const g = await mount()
    await build(['p', 'i', 'g'])
    await advance(HUNT_HINT_IDLE_MS + 1000)
    expect(has('hunt-slot-3-glow')).toBe(true)
    const from = g.calls.length
    await fireEvent.press(byId('hunt-slot-3'))
    await advance(ownMs('f') + SOUND_GAP_MS - 10)
    expect(g.calls.slice(from)).toEqual([unitCall('f')])
    await advance(20)
    expect(g.calls.at(-1)).toEqual(unitCall('i'))
    await advance(ownMs('i') + SOUND_GAP_MS)
    expect(g.calls.at(-1)).toEqual(unitCall('sh'))
    expect(unitCall('sh').uri).toBe(clipOf('ship'))
    await advance(ownMs('sh') + SOUND_GAP_MS + 10)
    expect(g.calls.slice(from)).toEqual([
      unitCall('f'),
      unitCall('i'),
      unitCall('sh'),
      { uri: saidClipOf('fish'), from: 0, to: null },
    ])
  })
})

// --- D17: runs by critters ---------------------------------------------------------

describe('D17: runs by critters', () => {
  it('sh i p: three windows 300 ms apart, Emma’s "Ship.", the joy beat, its picture and praise, then three tiles at 0, 60, 120 ms', async () => {
    holdSharedValues()
    const delay = jest.spyOn(Reanimated, 'withDelay')
    learner({ three: { letters: SH, found: ['bin', 'pin'] }, said: true })
    const g = await mount()
    await seat('sh', 'i', 'p')
    await advance(SING_AFTER_MS)
    expect(g.calls.at(-1)).toEqual(unitCall('sh'))
    await advance(ownMs('sh') + SOUND_GAP_MS - 10)
    expect(g.calls.at(-1)).toEqual(unitCall('sh'))
    await advance(20)
    expect(g.calls.at(-1)).toEqual(unitCall('i'))
    await advance(ownMs('i') + SOUND_GAP_MS - 20)
    expect(g.calls.at(-1)).toEqual(unitCall('i'))
    await advance(20)
    expect(g.calls.at(-1)).toEqual(unitCall('p'))
    expect(g.lines).not.toContain('guide.play.critters.word.ship')
    await advance(ownMs('p') + SOUND_GAP_MS + 10)
    expect(g.lines.at(-1)).toBe('guide.play.critters.word.ship')
    // Emma says it pointing, then the joy beat's cheer.
    expect(g.poses.slice(g.poses.lastIndexOf('listening'))).toEqual([
      'listening',
      'attentive-pointing',
      'cheering',
    ])
    await advance(LINE_MS + 10)
    expect(g.sfx.cheer.play).toHaveBeenCalledTimes(1)
    expect(has('critter-picture-ship')).toBe(true)
    await advance(PRAISE_AFTER_MS)
    expect(g.lines.at(-1)).toBe('guide.play.critters.praise.ship')
    const fills = delay.mock.calls.length
    for (let t = 0; t < 20000 && !has('hunt-fly-0'); t += 10) await advance(10)
    expect(has('critter-picture-ship')).toBe(true)
    expect(
      delay.mock.calls
        .slice(fills)
        .map(([ms]) => ms)
        .filter((ms) => ms !== FILL_LAND_MS),
    ).toEqual([0, 60, 120])
    await advance(FILL_LAND_MS + FILL_SETTLE_MS)
    expect(tilesOf(3)).toEqual(['sh', 'i', 'p'])
    // Only the round's own sounds: three windows, no blend played whole.
    expect(g.calls).toEqual([unitCall('sh'), unitCall('i'), unitCall('p')])
  })

  it('the praise is once a visit: a repeat of ship has the beat and its picture, no praise', async () => {
    const g = await mount()
    await build(['sh', 'i', 'p'])
    expect(
      g.lines.filter((l) => l === 'guide.play.critters.praise.ship'),
    ).toHaveLength(1)
    await build(['sh', 'i', 'p'])
    expect(
      g.lines.filter((l) => l === 'guide.play.critters.word.ship'),
    ).toHaveLength(2)
    expect(
      g.lines.filter((l) => l === 'guide.play.critters.praise.ship'),
    ).toHaveLength(1)
    expect(g.sfx.cheer.play).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['fish', FISH, ['f', 'i', 'sh'], 2],
    ['sing', SING, ['s', 'i', 'ng'], 2],
  ] as const)(
    '%s: said, its picture, no praise; its tiles in its own slot',
    async (word, letters, units, slot) => {
      learner({ three: { letters: [...letters] }, said: true })
      const g = await mount()
      await build([...units])
      expect(g.lines).toContain(`guide.play.critters.word.${word}`)
      expect(g.lines.filter((l) => l.includes('.praise.'))).toEqual([])
      expect(tilesOf(slot)).toEqual(units)
    },
  )

  it('an extra (shin): said, the joy beat, then its three tiles join the chip', async () => {
    const g = await mount()
    await build(['sh', 'i', 'n'])
    expect(g.lines).toContain('guide.play.critters.word.shin')
    expect(g.sfx.cheer.play).toHaveBeenCalledTimes(1)
    expect(has('hunt-bonus-shin-2')).toBe(true)
    expect([0, 1, 2, 3].map(tilesOf)).toEqual([[], [], [], []])
  })

  it('sh i b (on no list): the boing, the tumble and a non-word line', async () => {
    const g = await mount()
    await build(['sh', 'i', 'b'])
    expect(g.sfx.boing.play).toHaveBeenCalledTimes(1)
    expect(
      g.lines.filter((l) => l.startsWith('guide.play.critters.funny')),
    ).toHaveLength(1)
    expect(g.lines.filter((l) => l.includes('.word.'))).toEqual([])
  })

  it('ch e s t (four seats): sings four windows, then "Chest.", its picture and praise, and fills slot 0', async () => {
    learner({
      step: 'digraphs-ch',
      four: { letters: CH_FOUR, found: ['jets', 'nest'] },
      open: [3, 4],
      said: true,
    })
    const g = await mount()
    await pickFour()
    await build(['ch', 'e', 's', 't'])
    expect(g.calls.slice(0, 4)).toEqual(['ch', 'e', 's', 't'].map(unitCall))
    expect(unitCall('ch').uri).toBe(clipOf('chip'))
    expect(g.lines).toContain('guide.play.critters.word.chest')
    expect(g.lines).toContain('guide.play.critters.praise.chest')
    expect(tilesOf(0)).toEqual(['ch', 'e', 's', 't'])
  })
})

// --- D18: the sound sources are never played whole ---------------------------------

describe('D18: the four sound-source blends are never played whole', () => {
  // Jest resolves every bundled clip to one module id; here each web path
  // gets its own, so a call names its clip.
  beforeEach(() => {
    const real = BundledAudio.audioForWebPath
    const ids = new Map<string, number>()
    jest.spyOn(BundledAudio, 'audioForWebPath').mockImplementation((path) => {
      if (real(path) === undefined) return undefined
      if (!ids.has(path)) ids.set(path, 1000 + ids.size)
      return ids.get(path)
    })
  })
  /**
   * Every call of a sound-source blend is its digraph critter's window of
   * it; returns how many there were.
   */
  function expectWindowsOnly(
    calls: { uri: string | number; from: number; to: number | null }[],
  ) {
    const pairs = ['sh', 'ch', 'th', 'ng']
    const source = new Map(SOURCES.map((w, k) => [clipOf(w), pairs[k]!]))
    let n = 0
    for (const call of calls) {
      const pair = source.get(call.uri as number)
      if (pair === undefined) continue
      expect(call).toEqual(unitCall(pair))
      n += 1
    }
    return n
  }

  it('sh board: targets, an extra, a non-word, slot taps, an empty slot, the hint and the beat', async () => {
    const g = await mount()
    await tap(byId('critter-sh'))
    await advance(1000)
    await build(['sh', 'i', 'p'])
    await build(['sh', 'i', 'n'])
    await build(['sh', 'i', 'b'])
    await fireEvent.press(byId('hunt-slot-3'))
    await advance(1000)
    await fireEvent.press(byId('hunt-slot-0'))
    await advance(1000)
    await advance(HUNT_HINT_IDLE_MS + 1000)
    await fireEvent.press(byId('hunt-slot-0'))
    await advance(4000)
    await build(['b', 'i', 'n'])
    await build(['p', 'i', 'n'])
    // The beat: each found word in board order, "You did it!".
    for (let t = 0; t < 20000 && !has('hunt-new-letters'); t += 50)
      await advance(50)
    expect(g.lines).toContain('guide.play.critters.done')
    expect(g.calls.length).toBeGreaterThan(12)
    // sh's tap, and its sound in each of its runs (ship, shin, sh-i-b).
    expect(expectWindowsOnly(g.calls)).toBe(4)
  })

  it.each([
    ['th', FALLBACKS.th!, ['m', 'o', 'th'], 3],
    ['ng', FALLBACKS.ng!, ['w', 'i', 'ng'], 3],
    ['ch', FALLBACKS.ch!, ['ch', 'i', 'p'], 3],
  ] as const)(
    '%s board: a tap, the target, its slot tap',
    async (_pair, letters, units, slot) => {
      learner({ three: { letters: [...letters] }, said: true })
      const g = await mount()
      await tap(byId(`critter-${units.find((u) => u.length === 2)!}`))
      await advance(1000)
      await build([...units])
      await fireEvent.press(byId(`hunt-slot-${slot}`))
      await advance(2000)
      expect(tilesOf(slot)).toEqual(units)
      // Its tap, and its sound in the run.
      expect(expectWindowsOnly(g.calls)).toBe(2)
    },
  )
})

// --- D19: the pulse and the light --------------------------------------------------

describe('D19: the lit pulse and the bounce move the pair and its bar as one', () => {
  /** The nearest ancestor of `el` (inside `root`) whose style scales. */
  function scaledGroup(
    root: ReturnType<typeof byId>,
    el: ReturnType<typeof byId>,
  ) {
    let n = el.parent
    while (n !== null && n !== root) {
      const t = StyleSheet.flatten(n.props.style)?.transform as
        | Record<string, unknown>[]
        | undefined
      if (t?.some((s) => 'scale' in s)) return n
      n = n.parent
    }
    return null
  }

  it('a tap: one pulse (1 → 1.2) and one hop; the scale is on the group holding the text and the bar, not on the text', async () => {
    holdSharedValues()
    const timing = jest.spyOn(Reanimated, 'withTiming')
    await mount()
    const root = byId('critter-sh')
    const { text, bar, t } = pairIn(root, 'sh')
    expect(t.transform).toBeUndefined()
    const group = scaledGroup(root, text)
    expect(group).not.toBeNull()
    expect(within(group!).getByTestId('critter-sh-bar')).toBe(bar)
    // About the pair's baseline centre.
    expect(StyleSheet.flatten(group!.props.style).transformOrigin).toEqual([
      28,
      0.7 * 56,
      0,
    ])
    const before = timing.mock.calls.length
    await tap(root)
    const calls = timing.mock.calls.slice(before)
    expect(
      calls.filter(([v, c]) => v === 1.2 && c?.duration === 200),
    ).toHaveLength(1)
    expect(
      calls.filter(([v, c]) => v === -0.15 * 56 && c?.duration === 125),
    ).toHaveLength(1)
  })

  it('Reduce Motion: the pair’s text lights; no pulse, no hop; the bar keeps its ink', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    holdSharedValues()
    const timing = jest.spyOn(Reanimated, 'withTiming')
    await mount()
    const root = byId('critter-sh')
    const before = timing.mock.calls.length
    await tap(root)
    const calls = timing.mock.calls.slice(before)
    expect(
      calls.filter(([v, c]) => v === 1 && c?.duration === 120),
    ).toHaveLength(1)
    expect(calls.filter(([v]) => v === 1.2)).toHaveLength(0)
    expect(calls.filter(([v]) => v === -0.15 * 56)).toHaveLength(0)
    const { t, b } = pairIn(root, 'sh')
    expect(t).toHaveProperty('textShadowRadius')
    expect(t.textShadowColor).toBe('#ffffff')
    expect(b.backgroundColor).toBe(LETTER)
    expect(b).not.toHaveProperty('textShadowRadius')
  })
})

// --- D20: labels ---------------------------------------------------------------

describe('D20: labels', () => {
  it('"Letters s h, one sound" in the meadow, "…, on the log" on a seat; its text and bar are not elements; singles unchanged', async () => {
    await mount()
    expect(byId('critter-sh').props.accessibilityLabel).toBe(
      'Letters s h, one sound',
    )
    expect(byId('critter-sh').props.accessible).toBe(true)
    const { text, bar } = pairIn(byId('critter-sh'), 'sh')
    expect(text.props.accessibilityLabel).toBeUndefined()
    expect(bar.props.accessible).toBeFalsy()
    expect(bar.props.accessibilityLabel).toBeUndefined()
    expect(byId('critter-b').props.accessibilityLabel).toBe('Letter b')
    await seat('sh', 'b')
    expect(byId('critter-seat-0').props.accessibilityLabel).toBe(
      'Letters s h, one sound, on the log',
    )
    expect(byId('critter-seat-1').props.accessibilityLabel).toBe(
      'Letter b, on the log',
    )
  })

  it('so for ch, th and ng; the words are rows of the label table', () => {
    expect(critterLabel('ch', false)).toBe('Letters c h, one sound')
    expect(critterLabel('th', true)).toBe('Letters t h, one sound, on the log')
    expect(critterLabel('ng', false)).toBe('Letters n g, one sound')
    expect(critterLabel('x', false)).toBe('Letter x')
    expect(PLAY_LABELS.letters).toBe('Letters')
    expect(PLAY_LABELS.oneSound).toBe('one sound')
  })

  it('a found ship’s slot and the chip are unchanged: "Ship"; "Bonus words, shin"', async () => {
    learner({ three: { letters: SH, found: ['ship', 'shin'] }, said: true })
    await mount()
    expect(byId('hunt-slot-3').props.accessibilityLabel).toBe('Ship')
    expect(byId('hunt-bonus').props.accessibilityLabel).toBe(
      'Bonus words, shin',
    )
  })
})

// --- D21: nothing new to read or hear ------------------------------------------------

describe('D21: no new text or line (but D28’s)', () => {
  it('a digraph board renders no text but the critters’ letters, the tiles and the numeral "3"', async () => {
    learner({
      three: { letters: SH, found: ['bin', 'ship', 'shin'] },
      said: true,
    })
    await mount()
    const texts = screen
      .queryAllByText(/./)
      .map((el) => String(el.props.children))
    expect(new Set(texts)).toEqual(new Set([...SH, '3']))
    expect(texts.filter((t) => t === 'sh').length).toBe(3)
  })

  it('every line it plays is one a plain board plays, and "Two letters, one sound!" once', async () => {
    learner({ three: { letters: SH, found: ['bin'] } })
    const g = await mount()
    await tap(byId('critter-sh'))
    await advance(2000)
    await build(['sh', 'i', 'p'])
    await build(['sh', 'i', 'n'])
    await build(['sh', 'i', 'b'])
    await build(['sh', 'i', 'p'])
    await tap(byId('critter-sh'))
    await advance(2000)
    await build(['p', 'i', 'n'])
    for (let t = 0; t < 20000 && !has('hunt-new-letters'); t += 50)
      await advance(50)
    const plain =
      /^guide\.play\.critters\.(open|done|funny\.[123]|word\.[a-z]+|praise\.[a-z]+)$/
    expect(g.lines.filter((l) => !plain.test(l))).toEqual([DIGRAPH_LINE])
  })
})

// --- D22: the layout ---------------------------------------------------------------

/** critters-four-letter.md § 5.2's 16 viewports. */
const NONE = { top: 0, bottom: 0, left: 0, right: 0 }
const vp = (
  width: number,
  height: number,
  insets: Partial<typeof NONE> = {},
): Viewport => ({ width, height, insets: { ...NONE, ...insets } })
const IPAD = { top: 24, bottom: 20 }
const SIXTEEN: Viewport[] = [
  vp(375, 667),
  vp(667, 375),
  vp(390, 844, { top: 47, bottom: 34 }),
  vp(844, 390, { left: 47, right: 47, bottom: 21 }),
  vp(820, 1180, IPAD),
  vp(1180, 820, { bottom: 20 }),
  vp(1180, 820, IPAD),
  vp(834, 1194, IPAD),
  vp(1194, 834, IPAD),
  vp(744, 1133, IPAD),
  vp(1133, 744, IPAD),
  vp(810, 1080, IPAD),
  vp(1080, 810, IPAD),
  vp(1080, 810),
  vp(768, 1024, IPAD),
  vp(1024, 768, IPAD),
]

describe('D22: the layout is unchanged', () => {
  /** Every drawn rect of the round: its critters, slots and log. */
  function rects() {
    const ids = [
      ...screen.queryAllByTestId(/^critter-[a-z]{1,2}$/),
      ...screen.queryAllByTestId(/^hunt-slot-\d-card$/),
      byId('critter-log'),
      byId('critter-log-numeral'),
    ]
    return ids.map((el) => {
      const s = flat(el)
      return [s.left, s.top, s.width, s.height]
    })
  }
  async function drawn(
    v: Viewport,
    letters: string[],
    length: HuntLength,
    step: SkillNode,
  ) {
    learner(
      length === 3
        ? { step, three: { letters }, said: true }
        : { step, four: { letters }, open: [3, 4], said: true },
    )
    const g = await mount({ viewport: v })
    if (length === 4) await pickFour()
    const out = rects()
    await g.unmount()
    return out
  }

  it.each(SIXTEEN.map((v) => [`${v.width} × ${v.height}`, v] as const))(
    '%s: a digraph round draws at the plain round’s rects (three seats and four, N 4)',
    async (_name, v) => {
      const three = await drawn(v, SH, 3, 'digraphs-sh')
      expect(three).toEqual(await drawn(v, PLAIN, 3, 'digraphs-sh'))
      const s = sceneOf(v, 4)
      expect(three.slice(0, 6)).toEqual(
        s.cells.map((r) => [r.x, r.y, r.width, r.height]),
      )
      const four = await drawn(v, CH_FOUR, 4, 'digraphs-ch')
      expect(four).toEqual(await drawn(v, PLAIN_FOUR, 4, 'digraphs-ch'))
    },
  )
})

// --- D28: "Two letters, one sound!" ----------------------------------------------------

describe('D28 (Dave’s Q38 ruling): "Two letters, one sound!" once per learner', () => {
  beforeEach(() => {
    learner({ three: { letters: SH } })
  })

  it('her first tap on a digraph critter: its sound, then the line 300 ms after it ends; marked said', async () => {
    const g = await mount()
    expect(g.lines).toEqual(['guide.play.critters.open'])
    await tap(byId('critter-sh'))
    expect(g.calls.at(-1)).toEqual(unitCall('sh'))
    await advance(ownMs('sh') + SOUND_GAP_MS - 10)
    expect(g.lines).not.toContain(DIGRAPH_LINE)
    expect(huntDigraphLineSaid()).toBe(false)
    await advance(20)
    expect(g.lines.at(-1)).toBe(DIGRAPH_LINE)
    expect(huntDigraphLineSaid()).toBe(true)
  })

  it('no line on the 2nd tap, nor on a seat tap', async () => {
    const g = await mount()
    await tap(byId('critter-sh'))
    await advance(2000)
    await tap(byId('critter-sh'))
    await advance(2000)
    await seat('sh')
    await tap(byId('critter-seat-0'))
    await advance(2000)
    expect(g.lines.filter((l) => l === DIGRAPH_LINE)).toHaveLength(1)
  })

  it('a second tap before the line: only the last tap’s sound leads to it, once', async () => {
    const g = await mount()
    await tap(byId('critter-sh'))
    await advance(ownMs('sh') + 100)
    await tap(byId('critter-sh'))
    await advance(ownMs('sh') + SOUND_GAP_MS - 10)
    expect(g.lines).not.toContain(DIGRAPH_LINE)
    await advance(20)
    expect(g.lines.filter((l) => l === DIGRAPH_LINE)).toHaveLength(1)
  })

  it('a lift comes first: the line at once, no sound; none at the next tap', async () => {
    const g = await mount()
    const calls = g.calls.length
    await dragStart(byId('critter-sh'), { x: 10, y: 10 })
    expect(g.lines.at(-1)).toBe(DIGRAPH_LINE)
    expect(g.calls).toHaveLength(calls)
    expect(huntDigraphLineSaid()).toBe(true)
    await dragRelease(byId('critter-sh'), { x: 10, y: 10 })
    await advance(1000)
    await tap(byId('critter-sh'))
    await advance(2000)
    expect(g.lines.filter((l) => l === DIGRAPH_LINE)).toHaveLength(1)
  })

  it('never at round open, never on a plain board', async () => {
    learner({ step: 'cvc-words-short-o', three: { letters: PLAIN } })
    const g = await mount()
    await advance(5000)
    await tap(byId('critter-b'))
    await advance(2000)
    await dragStart(byId('critter-f'), { x: 10, y: 10 })
    await dragRelease(byId('critter-f'), { x: 10, y: 10 })
    await build(['b', 'i', 'b'])
    expect(g.lines).not.toContain(DIGRAPH_LINE)
    expect(huntDigraphLineSaid()).toBe(false)
  })

  it('none after a reload once said; one flag for all four digraphs', async () => {
    let g = await mount()
    await tap(byId('critter-sh'))
    await advance(2000)
    expect(g.lines).toContain(DIGRAPH_LINE)
    await g.unmount()
    g = await mount()
    await tap(byId('critter-sh'))
    await advance(2000)
    await dragStart(byId('critter-sh'), { x: 10, y: 10 })
    await dragRelease(byId('critter-sh'), { x: 10, y: 10 })
    expect(g.lines).not.toContain(DIGRAPH_LINE)
    await g.unmount()
    // Her th round, New letters later: still said.
    saveHuntRecord(freshHuntRecord(huntRoundOf(FALLBACKS.th!)!))
    g = await mount()
    expect(meadow()).toEqual(FALLBACKS.th)
    await tap(byId('critter-th'))
    await advance(2000)
    expect(g.lines).not.toContain(DIGRAPH_LINE)
  })

  it('the coordinator’s pin: lift sh and seat it beside two within 1.5 s; the line plays to its end, then the run', async () => {
    const LONG = 1500
    const g = await mount({ lineMs: LONG })
    await advance(LONG)
    const seats = sceneOf(PHONE_P, 4).seats
    // i and p on seats 1 and 2: they sing as a pair and lean.
    await dragStart(byId('critter-i'), centre(seats[1]!))
    await dragRelease(byId('critter-i'), centre(seats[1]!))
    await dragStart(byId('critter-p'), centre(seats[2]!))
    await dragRelease(byId('critter-p'), centre(seats[2]!))
    await advance(4000)
    expect(seated()).toEqual([1, 2])
    expect(g.lines).not.toContain(DIGRAPH_LINE)
    const calls = g.calls.length
    await dragStart(byId('critter-sh'), centre(seats[0]!))
    expect(g.lines.at(-1)).toBe(DIGRAPH_LINE)
    const cuts = (g.player.cancelActive as jest.Mock).mock.calls.length
    await advance(300)
    await dragRelease(byId('critter-sh'), centre(seats[0]!))
    expect(seated()).toEqual([0, 1, 2])
    // The run falls due 400 ms after the seat change and waits for the line:
    // no sound, and the line is not cut.
    await advance(LONG - 300 - 20)
    expect(g.calls).toHaveLength(calls)
    expect((g.player.cancelActive as jest.Mock).mock.calls.length).toBe(cuts)
    await advance(40)
    expect(g.calls.at(-1)).toEqual(unitCall('sh'))
    // Then the run plays on as any run: i, p, Emma's "Ship.".
    for (let t = 0; t < 10000; t += 50) {
      if (g.lines.at(-1) === 'guide.play.critters.word.ship') break
      await advance(50)
    }
    expect(g.lines.at(-1)).toBe('guide.play.critters.word.ship')
    expect(g.calls.slice(calls)).toEqual(['sh', 'i', 'p'].map(unitCall))
  })
})
