/**
 * Letter critters on screen (play-place § 3; ACs N9, N10, N11, N14, N17),
 * for a learner on blending sounds (11 letters, 8 picture words), with a
 * fake tap-sound player whose sounds end after their window.
 */
import { critterWordLine } from '@marian/core/emmasPath/guidanceLines'
import {
  CRITTER_SOUND_SOURCE,
  CRITTER_WORDS_BY_STEP,
  critterRun,
} from '@marian/core/games/playPlace'
import { fireEvent, screen } from '@testing-library/react-native'
import { letterWindow, MARK_LEAD_MS } from '../../audio/blendMarks'
import * as bundledAudio from '../../audio/bundledAudio'
import { audioForWebPath } from '../../audio/bundledAudio'
import { mathLayout } from '../../layout/mathLayout'
import {
  activate,
  advance,
  byId,
  dragRelease,
  dragStart,
  dragTo,
  fakeSounds,
  has,
  LINE_MS,
  mountGame,
  PHONE_L,
  PHONE_P,
  tap,
} from '../../../test/playHarness'
import { blendClipPath, blendSegments } from './critterModel'
import {
  CRITTERS_OPEN_DELAY_MS,
  PICTURE_HOLD_MS,
  PICTURE_LEAVE_MS,
  SING_AFTER_MS,
  SOUND_GAP_MS,
} from './LetterCritters'
import { centre, critterScene, playArea } from './playGeometry'

/** Blending sounds' 8 words (11 letters), through the words seam. */
const BLENDING_WORDS = CRITTER_WORDS_BY_STEP['blending-cv']!

const WORDS = [...new Set(Object.values(CRITTER_WORDS_BY_STEP).flat())]
const clipOf = (word: string) => audioForWebPath(blendClipPath(word)) as number
const wordOfClip = new Map(WORDS.map((w) => [clipOf(w), w]))
const WHOLE_TAIL = 200
const wholeMs = (uri: string | number) =>
  blendSegments(wordOfClip.get(uri as number)!)![3]![1] + WHOLE_TAIL
/** Time enough for any whole clip (the fake times them all alike) to end. */
const WORD_CLIP_MS = Math.max(...WORDS.map((w) => wholeMs(clipOf(w)))) + 10
/** Whole-clip plays (from 0 to the end): a picture word or a said word. */
const whole = (calls: { from: number; to: number | null }[]) =>
  calls.filter((c) => c.from === 0 && c.to === null)
/** The said-word clips the screen looked up in the bundle. */
const wordClipsAsked = (spy: jest.SpyInstance) =>
  spy.mock.calls
    .map(([path]) => String(path))
    .filter((path) => path.includes('critters-word'))

/** A letter's own sound, as the fake player sees it. */
function own(letter: string) {
  const src = CRITTER_SOUND_SOURCE[letter]!
  const w = letterWindow(blendSegments(src.word)![src.index]!)
  return { uri: clipOf(src.word), from: w.from, to: w.to }
}
const ownMs = (letter: string) => own(letter).to - own(letter).from

const seatCentre = (i: number) => {
  const l = mathLayout(PHONE_P)
  return centre(critterScene(playArea(l), l.tablet, l.landscape, 11).seats[i]!)
}

async function mount() {
  const s = fakeSounds(wholeMs)
  const g = await mountGame('critters', {
    words: BLENDING_WORDS,
    sounds: s.sounds,
  })
  // The open line plays and ends.
  await advance(CRITTERS_OPEN_DELAY_MS + LINE_MS)
  return { ...g, ...s }
}

async function seat(...letters: string[]) {
  for (const l of letters) await activate(byId(`critter-${l}`))
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it('§ 3.1: the visit’s letters, vowels first, for a learner on blending sounds', async () => {
  const g = await mount()
  expect(g.lines).toEqual(['guide.play.critters.open'])
  const letters = screen
    .queryAllByTestId(/^critter-[a-z]$/)
    .map((el) => String(el.props.testID).slice(-1))
  expect(letters).toEqual('abcfghmnptv'.split(''))
  expect(byId('critter-f').props.accessibilityLabel).toBe('Letter f')
})

it('§ 3.1 (Thomas 2026-10-22): with no words seam, a visit draws on all 45 picture words, for any learner', async () => {
  const s = fakeSounds(wholeMs)
  await mountGame('critters', { sounds: s.sounds })
  const letters = screen
    .queryAllByTestId(/^critter-[a-z]$/)
    .map((el) => String(el.props.testID).slice(-1))
  // 22 letters do not fit: the cap, every vowel first.
  expect(letters).toHaveLength(16)
  expect(letters.slice(0, 5)).toEqual(['a', 'e', 'i', 'o', 'u'])
})

describe('N9: a picture word', () => {
  it('plays the word’s bundled clip from 0, the picture at its mark; no line; meadow closed until it leaves', async () => {
    const g = await mount()
    await seat('f', 'a', 'n')
    expect(byId('critter-seat-2').props.accessibilityLabel).toBe(
      'Letter n, on the log',
    )
    await advance(SING_AFTER_MS)
    expect(g.calls.at(-1)).toEqual({ uri: clipOf('fan'), from: 0, to: null })
    const segs = blendSegments('fan')!
    const pictureAt = segs[3]![0] - MARK_LEAD_MS
    await advance(pictureAt - 10)
    expect(has('critter-picture')).toBe(false)
    await advance(10)
    expect(has('critter-picture-fan')).toBe(true)
    expect(g.sfx.sparkle.play).toHaveBeenCalledTimes(1)
    expect(g.poses.at(-1)).toBe('celebration')
    // Meadow taps are closed: no sound.
    const calls = g.calls.length
    await tap(byId('critter-b'))
    expect(g.calls).toHaveLength(calls)
    await advance(
      wholeMs(clipOf('fan')) - pictureAt + PICTURE_HOLD_MS + PICTURE_LEAVE_MS,
    )
    expect(has('critter-picture')).toBe(false)
    expect(g.poses.at(-1)).toBe('idle')
    // No line was spoken for the word.
    expect(g.lines).toEqual(['guide.play.critters.open'])
    await tap(byId('critter-b'))
    expect(g.calls.at(-1)).toEqual(own('b'))
  })
})

describe('N10: songs that are not picture words', () => {
  it('a pair sings each letter’s window, 300 ms apart, and nothing else', async () => {
    const g = await mount()
    await seat('f', 'a')
    await advance(SING_AFTER_MS)
    expect(g.calls).toEqual([own('f')])
    await advance(ownMs('f') + SOUND_GAP_MS - 10)
    expect(g.calls).toHaveLength(1)
    await advance(10)
    expect(g.calls).toEqual([own('f'), own('a')])
    await advance(ownMs('a') + 2 * SOUND_GAP_MS)
    expect(g.calls).toHaveLength(2)
    expect(g.sfx.boing.play).not.toHaveBeenCalled()
    expect(g.lines).toEqual(['guide.play.critters.open'])
  })

  const sing3 = async (g: Awaited<ReturnType<typeof mount>>, word: string) => {
    for (let i = 0; i < 3; i++) {
      if (has(`critter-seat-${i}`)) await activate(byId(`critter-seat-${i}`))
    }
    await seat(...word.split(''))
    await advance(SING_AFTER_MS)
    for (const l of word) await advance(ownMs(l) + SOUND_GAP_MS)
    await advance(LINE_MS + 10)
    void g
  }

  it('every non-word boings and gets a line, the three in turn; a quiet word sits quietly and does not count', async () => {
    const g = await mount()
    expect(critterRun('hag')).toBe('quiet')
    await sing3(g, 'hag')
    expect(g.calls.slice(-3)).toEqual([own('h'), own('a'), own('g')])
    expect(g.sfx.boing.play).not.toHaveBeenCalled()
    expect(has('critter-tumble')).toBe(false)
    expect(has('critter-picture')).toBe(false)
    expect(g.lines).toEqual(['guide.play.critters.open'])

    await sing3(g, 'bgf')
    expect(g.sfx.boing.play).toHaveBeenCalledTimes(1)
    expect(has('critter-tumble')).toBe(true)
    expect(g.lines.at(-1)).toBe('guide.play.critters.funny.1')
    expect(g.poses).toContain('cheering')

    await sing3(g, 'ptv')
    expect(g.sfx.boing.play).toHaveBeenCalledTimes(2)
    expect(g.lines.at(-1)).toBe('guide.play.critters.funny.2')

    await sing3(g, 'vtp')
    expect(g.sfx.boing.play).toHaveBeenCalledTimes(3)
    expect(g.lines.at(-1)).toBe('guide.play.critters.funny.3')

    await sing3(g, 'bgf')
    expect(g.sfx.boing.play).toHaveBeenCalledTimes(4)
    expect(g.lines.at(-1)).toBe('guide.play.critters.funny.1')
    expect(g.lines.filter((l) => l.includes('funny'))).toHaveLength(4)
  })

  it('a said word (Thomas 2026-10-22): the sounds, a 300 ms gap, then its Lily clip once, the three bounce and sit; no boing, line, sparkle or picture', async () => {
    const mapClip = audioForWebPath(critterWordLine('map')!.src)
    const asked = jest.spyOn(bundledAudio, 'audioForWebPath')
    const g = await mount()
    expect(critterRun('map')).toBe('word')
    await seat('m', 'a', 'p')
    await advance(SING_AFTER_MS)
    expect(g.calls).toEqual([own('m')])
    await advance(ownMs('m') + SOUND_GAP_MS)
    await advance(ownMs('a') + SOUND_GAP_MS)
    expect(g.calls).toEqual([own('m'), own('a'), own('p')])
    // At least the blend clips' 300 ms gap after the last sound.
    await advance(ownMs('p') + SOUND_GAP_MS - 10)
    expect(g.calls).toHaveLength(3)
    await advance(10)
    expect(g.calls.at(-1)).toEqual({
      uri: mapClip,
      from: 0,
      to: null,
    })
    expect(wordClipsAsked(asked)).toEqual([
      '/assets/audio/path/guide-play-critters-word-map.mp3',
    ])
    expect(g.poses.at(-1)).toBe('listening')
    await advance(WORD_CLIP_MS)
    expect(whole(g.calls)).toHaveLength(1)
    expect(g.calls).toHaveLength(4)
    expect(g.poses.at(-1)).toBe('idle')
    expect(g.sfx.boing.play).not.toHaveBeenCalled()
    expect(g.sfx.sparkle.play).not.toHaveBeenCalled()
    expect(has('critter-tumble')).toBe(false)
    expect(has('critter-picture')).toBe(false)
    expect(g.lines).toEqual(['guide.play.critters.open'])
  })

  it('a never-say word (sex): the sounds only, no word clip, no boing, line or picture', async () => {
    const asked = jest.spyOn(bundledAudio, 'audioForWebPath')
    const s = fakeSounds(wholeMs)
    const g = await mountGame('critters', {
      words: ['six', 'bed', 'box'],
      sounds: s.sounds,
    })
    await advance(CRITTERS_OPEN_DELAY_MS + LINE_MS)
    expect(critterRun('sex')).toBe('quiet')
    await seat('s', 'e', 'x')
    await advance(SING_AFTER_MS)
    for (const l of 'sex') await advance(ownMs(l) + SOUND_GAP_MS)
    await advance(WORD_CLIP_MS)
    expect(s.calls).toEqual([own('s'), own('e'), own('x')])
    expect(whole(s.calls)).toEqual([])
    expect(wordClipsAsked(asked)).toEqual([])
    expect(g.sfx.boing.play).not.toHaveBeenCalled()
    expect(g.sfx.sparkle.play).not.toHaveBeenCalled()
    expect(has('critter-tumble')).toBe(false)
    expect(has('critter-picture')).toBe(false)
    expect(g.lines).toEqual(['guide.play.critters.open'])
  })
})

describe('N11: moves', () => {
  it('a drag leaves a twin in the burrow; a drop on an occupied seat sends the one there home', async () => {
    const g = await mount()
    await dragTo(byId('critter-f'), seatCentre(0))
    expect(byId('critter-seat-0').props.accessibilityLabel).toBe(
      'Letter f, on the log',
    )
    await dragStart(byId('critter-a'), seatCentre(0))
    expect(has('critter-twin-a')).toBe(true)
    await dragRelease(byId('critter-a'), seatCentre(0))
    expect(has('critter-twin-a')).toBe(false)
    expect(byId('critter-seat-0').props.accessibilityLabel).toBe(
      'Letter a, on the log',
    )
    expect(has('critter-f')).toBe(true)
    void g
  })

  it('seats 1 and 3 with 2 empty do not sing; the log replays a run', async () => {
    const g = await mount()
    await dragTo(byId('critter-f'), seatCentre(0))
    await dragTo(byId('critter-n'), seatCentre(2))
    await advance(SING_AFTER_MS + 1000)
    expect(g.calls).toEqual([])
    await dragTo(byId('critter-a'), seatCentre(1))
    await advance(SING_AFTER_MS)
    expect(g.calls).toHaveLength(1)
    await advance(8000)
    const before = g.calls.length
    await fireEvent.press(byId('critter-log'))
    expect(g.calls.length).toBe(before + 1)
  })

  it('a seated critter dragged off the log goes home; onto another seat, they swap', async () => {
    await mount()
    await seat('f', 'a')
    await dragTo(byId('critter-seat-0'), seatCentre(1))
    expect(byId('critter-seat-0').props.accessibilityLabel).toBe(
      'Letter a, on the log',
    )
    expect(byId('critter-seat-1').props.accessibilityLabel).toBe(
      'Letter f, on the log',
    )
    await dragTo(byId('critter-seat-1'), { x: 5, y: 5 })
    expect(has('critter-seat-1')).toBe(false)
  })
})

describe('N14: a new layout keeps who sits where', () => {
  it('rotation keeps the seats', async () => {
    const g = await mount()
    await seat('h', 'a')
    await g.relayout(PHONE_L)
    expect(byId('critter-seat-0').props.accessibilityLabel).toBe(
      'Letter h, on the log',
    )
    expect(byId('critter-seat-1').props.accessibilityLabel).toBe(
      'Letter a, on the log',
    )
  })
})

describe('N17: VoiceOver', () => {
  it('activate seats a critter in the first free seat and sends a seated one home; "Hear" sings', async () => {
    const g = await mount()
    expect(byId('critter-log').props.accessibilityLabel).toBe('Log')
    await activate(byId('critter-c'))
    expect(byId('critter-seat-0').props.accessibilityLabel).toBe(
      'Letter c, on the log',
    )
    await activate(byId('critter-seat-0'))
    expect(has('critter-seat-0')).toBe(false)
    await activate(byId('critter-m'), 'hear')
    expect(g.calls.at(-1)).toEqual(own('m'))
  })
})
