/**
 * Letter critters on screen (play-place § 3; ACs N9, N10, N11, N14, N17),
 * for a learner on blending sounds (11 letters, 8 picture words), with a
 * fake tap-sound player whose sounds end after their window; and, for a
 * learner before blending sounds, Dave's safeguard (non-words sit quietly).
 *
 * From blending sounds the word hunt replaces this meadow
 * (critters-word-hunt.md § 8; `LetterCritters.hunt.test.tsx`). These tests
 * keep the free meadow with the `hunt: false` seam: its outcomes, moves,
 * joy beat and praise are the hunt's too, unchanged (§ 3.1, § 4.1).
 */
import { setKeyValueStore } from '@marian/core'
import { progressAtStep } from '@marian/core/debug/stepProgress'
import {
  CRITTER_CAP,
  CRITTER_SAID_PICTURE_WORDS,
  CRITTER_SAID_WORDS,
  CRITTER_SOUND_SOURCE,
  CRITTER_PRAISE_WORDS,
  CRITTER_WORDS_BY_STEP,
  critterPictureKey,
  critterPraise,
  critterRun,
} from '@marian/core/games/playPlace'
import {
  loadProgress,
  saveProgress,
  type SkillNode,
} from '@marian/core/progress'
import { act, fireEvent, screen } from '@testing-library/react-native'
import { useRef } from 'react'
import { StyleSheet } from 'react-native'
import * as Reanimated from 'react-native-reanimated'
import { pictureAsset } from '../../assets'
import { letterWindow, MARK_LEAD_MS } from '../../audio/blendMarks'
import * as bundledAudio from '../../audio/bundledAudio'
import { audioForWebPath, canonClipFor } from '../../audio/bundledAudio'
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
  seeded,
  tap,
} from '../../../test/playHarness'
import { STORY_TAP_CUE_CANCEL_OUT_MS } from '../wordSong/storyTapCueMotion'
import { SPARKLE_BURST_MS } from '../wordSong/WordChip'
import { blendClipPath, blendSegments } from './critterModel'
import { DRAG_HINT_MS } from './DragHintHand'
import {
  BOUNCE_MS,
  CRITTERS_OPEN_DELAY_MS,
  HINT_IDLE_MS,
  JOY_AFTER_MS,
  JOY_HOLD_MS,
  PICTURE_HOLD_MS,
  PICTURE_LEAVE_MS,
  PRAISE_AFTER_MS,
  PRAISE_TAIL_MS,
  SHELF_DROP_MS,
  SHELF_HOLD_MS,
  SING_AFTER_MS,
  SOUND_GAP_MS,
  TUMBLE_MS,
} from './LetterCritters'
import { centre, critterScene, playArea } from './playGeometry'
import { crittersPraiseLine, PLAY_LINE_MANIFEST } from './playLines'

/** A run's outcome is over → the shelf has dropped and the log is ready. */
const CLEAR_MS = SHELF_HOLD_MS + SHELF_DROP_MS + 10

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

const ribbon = () => screen.queryByTestId('play-game-ribbon')
const seated = () => [0, 1, 2].filter((i) => has(`critter-seat-${i}`))
const dropping = () => screen.queryAllByTestId(/^critter-drop-\d$/).length
const meadow = () =>
  screen
    .queryAllByTestId(/^critter-[a-z]$/)
    .map((el) => String(el.props.testID).slice(-1))

/**
 * Counts bounce starts: each critter bounce starts its hop and its letter's
 * pulse (`withSequence` twice). The jest mock's `useSharedValue` makes a
 * new value every render, which re-runs every bounce effect on any render;
 * held per critter, as on a device, the effect runs once per bounce. Call
 * before mounting; `from()` starts the count.
 */
function bounceStarts() {
  const make = Reanimated.useSharedValue
  function useHeldSharedValue(init: unknown) {
    const held = useRef<ReturnType<typeof make> | null>(null)
    held.current ??= make(init)
    return held.current
  }
  jest
    .spyOn(Reanimated, 'useSharedValue')
    .mockImplementation(useHeldSharedValue as typeof make)
  const seq = jest.spyOn(Reanimated, 'withSequence')
  return {
    from: () => seq.mockClear(),
    count: () => seq.mock.calls.length / 2,
  }
}

const seatCentre = (i: number) => {
  const l = mathLayout(PHONE_P)
  return centre(critterScene(playArea(l), l.tablet, l.landscape, 11).seats[i]!)
}

async function mount() {
  const s = fakeSounds(wholeMs)
  const g = await mountGame('critters', {
    hunt: false,
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

/** The playing learner, just arrived at `step`, in a fresh store. */
function learnerAt(step: SkillNode) {
  const map = new Map<string, string>()
  setKeyValueStore({
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  })
  saveProgress(progressAtStep(step))
}

beforeEach(() => {
  jest.useFakeTimers()
  learnerAt('blending-cv')
})
afterEach(() => {
  setKeyValueStore(null)
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
  await mountGame('critters', { hunt: false, sounds: s.sounds })
  const letters = screen
    .queryAllByTestId(/^critter-[a-z]$/)
    .map((el) => String(el.props.testID).slice(-1))
  // 22 letters do not fit: the cap, every vowel first.
  expect(letters).toHaveLength(16)
  expect(letters.slice(0, 5)).toEqual(['a', 'e', 'i', 'o', 'u'])
})

describe('N9: a picture word', () => {
  it('plays the word’s bundled clip from 0, the picture at its mark; then the joy beat and, the first time, the lesson’s praise; meadow closed until it leaves', async () => {
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
    // The joy beat and the lesson's praise (Dave 2026-10-25); no other line.
    expect(g.poses).toContain('cheering')
    expect(g.sfx.cheer.play).toHaveBeenCalledTimes(1)
    expect(g.lines).toEqual([
      'guide.play.critters.open',
      'guide.play.critters.praise.fan',
    ])
    // The meadow opens once the shelf is clear (Thomas 2026-10-23).
    await advance(CLEAR_MS)
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
    // The outcome, then the shelf clears (Thomas 2026-10-23).
    await advance(TUMBLE_MS + CLEAR_MS)
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

  it('a said word (Thomas 2026-10-23, build 20): the sounds one by one, a 300 ms gap, then Emma says it as her own line, her caption and pose, while the three sit still; then the joy beat (Dave 2026-10-25); no boing, sparkle sound, praise or picture without a pack picture', async () => {
    const starts = bounceStarts()
    const bounces = starts.count
    const g = await mount()
    expect(critterRun('tab')).toBe('word')
    expect(CRITTER_SAID_PICTURE_WORDS).not.toContain('tab')
    await seat('t', 'a', 'b')
    starts.from()
    await advance(SING_AFTER_MS)
    expect(g.calls).toEqual([own('t')])
    expect(bounces()).toBe(1)
    await advance(ownMs('t') + SOUND_GAP_MS)
    await advance(ownMs('a') + SOUND_GAP_MS)
    expect(g.calls).toEqual([own('t'), own('a'), own('b')])
    expect(bounces()).toBe(3)
    // At least the blend clips' 300 ms gap after the last sound.
    await advance(ownMs('b') + SOUND_GAP_MS - 10)
    expect(g.lines).toEqual(['guide.play.critters.open'])
    await advance(10)
    expect(g.lines).toEqual([
      'guide.play.critters.open',
      'guide.play.critters.word.tab',
    ])
    expect(ribbon()?.props.accessibilityLabel).toBe('Tab.')
    expect(g.poses.at(-1)).toBe('attentive-pointing')
    // The word is Emma's, not a critter sound, and the three sit still.
    expect(g.calls).toHaveLength(3)
    expect(whole(g.calls)).toEqual([])
    expect(bounces()).toBe(3)
    await advance(LINE_MS)
    expect(ribbon()).toBeNull()
    // Her line ends: the joy beat. Emma cheers with the cheer, the three
    // bounce together, the burst leaves the middle seat.
    expect(g.poses.at(-1)).toBe('cheering')
    expect(g.sfx.cheer.play).toHaveBeenCalledTimes(1)
    expect(bounces()).toBe(6)
    expect(has('critter-sparkle-burst')).toBe(true)
    expect(g.calls).toHaveLength(3)
    await advance(JOY_HOLD_MS - 10)
    expect(g.poses.at(-1)).toBe('cheering')
    await advance(10)
    expect(g.poses.at(-1)).toBe('idle')
    expect(has('critter-sparkle-burst')).toBe(false)
    expect(g.lines).toEqual([
      'guide.play.critters.open',
      'guide.play.critters.word.tab',
    ])
    expect(g.sfx.cheer.play).toHaveBeenCalledTimes(1)
    expect(g.sfx.boing.play).not.toHaveBeenCalled()
    expect(g.sfx.sparkle.play).not.toHaveBeenCalled()
    expect(has('critter-tumble')).toBe(false)
    expect(has('critter-picture')).toBe(false)
  })

  it('a never-say word (sex): the sounds only, no word clip, no boing, line or picture', async () => {
    const asked = jest.spyOn(bundledAudio, 'audioForWebPath')
    const s = fakeSounds(wholeMs)
    const g = await mountGame('critters', {
      hunt: false,
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
    await dragTo(byId('critter-a'), seatCentre(2))
    await advance(SING_AFTER_MS + 1000)
    expect(g.calls).toEqual([])
    // a moves to the middle seat: "f a" is a run of two.
    await dragTo(byId('critter-seat-2'), seatCentre(1))
    await advance(SING_AFTER_MS)
    expect(g.calls).toHaveLength(1)
    await advance(4000)
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

describe('Dave’s safeguard (Thomas 2026-10-22): a learner before blending sounds', () => {
  const runOf = async (word: string) => {
    for (let i = 0; i < 3; i++) {
      if (has(`critter-seat-${i}`)) await activate(byId(`critter-seat-${i}`))
    }
    await seat(...word.split(''))
    await advance(SING_AFTER_MS)
    for (const l of word) await advance(ownMs(l) + SOUND_GAP_MS)
    await advance(WORD_CLIP_MS + PICTURE_HOLD_MS + PICTURE_LEAVE_MS)
  }

  it.each(['letter-names', 'letter-sounds'] as const)(
    'on %s, a non-word sings its sounds and sits: no boing, tumble, line or cheer, every time',
    async (step) => {
      learnerAt(step)
      const g = await mount()
      for (const word of ['bgf', 'ptv', 'vtp', 'bgf']) {
        const before = g.calls.length
        await runOf(word)
        expect(g.calls.slice(before)).toEqual([...word].map(own))
      }
      expect(g.sfx.boing.play).not.toHaveBeenCalled()
      expect(has('critter-tumble')).toBe(false)
      expect(has('critter-picture')).toBe(false)
      expect(g.poses).not.toContain('cheering')
      expect(g.lines).toEqual(['guide.play.critters.open'])
    },
  )

  it('on letter names, a picture word still pops and a said word is still said', async () => {
    learnerAt('letter-names')
    const g = await mount()
    await seat('f', 'a', 'n')
    await advance(SING_AFTER_MS)
    expect(g.calls.at(-1)).toEqual({ uri: clipOf('fan'), from: 0, to: null })
    await advance(blendSegments('fan')![3]![0])
    expect(has('critter-picture-fan')).toBe(true)
    await advance(WORD_CLIP_MS + PICTURE_HOLD_MS + PICTURE_LEAVE_MS)
    await runOf('tab')
    expect(g.lines.at(-1)).toBe('guide.play.critters.word.tab')
    expect(g.sfx.boing.play).not.toHaveBeenCalled()
  })
})

describe('Thomas 2026-10-23 (Marian’s play test)', () => {
  const openText = PLAY_LINE_MANIFEST['guide.play.critters.open'].text
  // The hand is hidden from VoiceOver, like the story cue's.
  const HIDDEN = { includeHiddenElements: true } as const
  const hint = () => screen.queryByTestId('critter-drag-hint', HIDDEN) !== null
  const zOf = (el: ReturnType<typeof byId>) =>
    (StyleSheet.flatten(el.props.style)?.zIndex as number | undefined) ?? 0
  /** The highest zIndex among the critters, the twins, the seats and the log. */
  const topPieceZ = () => {
    const pieces = [
      ...screen.queryAllByTestId(/^critter-([a-z]|seat-\d|twin-[a-z])$/),
      byId('critter-log'),
    ]
    expect(pieces.length).toBeGreaterThan(11)
    return Math.max(...pieces.map(zOf))
  }
  /** Seats `word` by VoiceOver and runs to the end of its last sound + gap. */
  const run = async (word: string) => {
    await seat(...word.split(''))
    await advance(SING_AFTER_MS)
    for (const l of word) await advance(ownMs(l) + SOUND_GAP_MS)
  }
  /** The log is empty and ready: a tap sings, a drag seats. */
  const expectReady = async (g: Awaited<ReturnType<typeof mount>>) => {
    expect(seated()).toEqual([])
    expect(dropping()).toBe(0)
    await tap(byId('critter-b'))
    expect(g.calls.at(-1)).toEqual(own('b'))
    await dragTo(byId('critter-c'), seatCentre(0))
    expect(byId('critter-seat-0').props.accessibilityLabel).toBe(
      'Letter c, on the log',
    )
  }

  describe('1. a line’s caption goes when the line ends or is cut', () => {
    it('the open line: up while it plays, gone when it ends', async () => {
      const s = fakeSounds(wholeMs)
      await mountGame('critters', {
        hunt: false,
        words: BLENDING_WORDS,
        sounds: s.sounds,
      })
      expect(ribbon()).toBeNull()
      await advance(CRITTERS_OPEN_DELAY_MS)
      expect(ribbon()?.props.accessibilityLabel).toBe(openText)
      await advance(LINE_MS)
      expect(ribbon()).toBeNull()
    })

    it('"Is this a word? I don’t know what it means!" goes when it ends', async () => {
      const g = await mount()
      await run('bgf')
      expect(g.lines.at(-1)).toBe('guide.play.critters.funny.1')
      expect(ribbon()?.props.accessibilityLabel).toBe(
        PLAY_LINE_MANIFEST['guide.play.critters.funny.1'].text,
      )
      await advance(LINE_MS)
      expect(ribbon()).toBeNull()
    })

    it('a tap that cuts the open line takes its caption with it', async () => {
      const s = fakeSounds(wholeMs)
      await mountGame('critters', {
        hunt: false,
        words: BLENDING_WORDS,
        sounds: s.sounds,
      })
      await advance(CRITTERS_OPEN_DELAY_MS)
      expect(ribbon()).not.toBeNull()
      await tap(byId('critter-f'))
      expect(ribbon()).toBeNull()
    })

    it('the raft’s lines go too (the frame is shared)', async () => {
      const g = await mountGame('raft', { shore: [7, 3, 6, 4, 8, 2] })
      await advance(CRITTERS_OPEN_DELAY_MS + LINE_MS)
      expect(g.lines).toEqual(['guide.play.raft.open'])
      expect(ribbon()).toBeNull()
    })
  })

  it('2. a picture word’s picture draws over every critter, the log and the drag layer', async () => {
    await mount()
    await seat('f', 'a', 'n')
    await advance(SING_AFTER_MS + blendSegments('fan')![3]![0])
    const card = byId('critter-picture')
    const top = topPieceZ()
    // The drag layer's pieces carry a zIndex, which on iOS lifts them over
    // any overlay without one, wherever it sits in the tree.
    expect(top).toBeGreaterThanOrEqual(1)
    expect(zOf(card)).toBeGreaterThan(top)
  })

  describe('3. every run of three ends with the shelf cleared', () => {
    it('a said word: after Emma says it and the joy beat (Dave 2026-10-25), the three drop home; no other line, no praise', async () => {
      const g = await mount()
      await run('tab')
      await advance(LINE_MS + JOY_HOLD_MS + SHELF_HOLD_MS - 20)
      expect(seated()).toEqual([0, 1, 2])
      expect(dropping()).toBe(0)
      await advance(30)
      expect(seated()).toEqual([])
      expect(dropping()).toBe(3)
      await advance(SHELF_DROP_MS)
      expect(g.lines).toEqual([
        'guide.play.critters.open',
        'guide.play.critters.word.tab',
      ])
      expect(g.sfx.sparkle.play).not.toHaveBeenCalled()
      await expectReady(g)
    })

    it('a picture word: after the picture leaves', async () => {
      const g = await mount()
      await seat('f', 'a', 'n')
      await advance(SING_AFTER_MS)
      const left = wholeMs(clipOf('fan')) + PICTURE_HOLD_MS + PICTURE_LEAVE_MS
      await advance(left + SHELF_HOLD_MS - 20)
      expect(has('critter-picture')).toBe(false)
      expect(seated()).toEqual([0, 1, 2])
      await advance(30)
      expect(seated()).toEqual([])
      expect(dropping()).toBe(3)
      await advance(SHELF_DROP_MS)
      expect(g.sfx.sparkle.play).toHaveBeenCalledTimes(1)
      await expectReady(g)
    })

    it('a non-word: after the tumble and Emma’s line', async () => {
      const g = await mount()
      await run('bgf')
      expect(g.sfx.boing.play).toHaveBeenCalledTimes(1)
      await advance(TUMBLE_MS + SHELF_HOLD_MS - 20)
      expect(seated()).toEqual([0, 1, 2])
      await advance(30)
      expect(seated()).toEqual([])
      expect(dropping()).toBe(3)
      await advance(SHELF_DROP_MS)
      expect(g.lines.filter((l) => l.includes('funny'))).toHaveLength(1)
      await expectReady(g)
    })

    it('a quiet run (sounds only): after the sounds', async () => {
      const g = await mount()
      expect(critterRun('hag')).toBe('quiet')
      await run('hag')
      await advance(BOUNCE_MS + SHELF_HOLD_MS - 20)
      expect(seated()).toEqual([0, 1, 2])
      await advance(30)
      expect(seated()).toEqual([])
      expect(dropping()).toBe(3)
      await advance(SHELF_DROP_MS)
      expect(g.lines).toEqual(['guide.play.critters.open'])
      await expectReady(g)
    })

    it('a drag during the run is ignored until the shelf is clear', async () => {
      const g = await mount()
      await seat('b', 'g', 'f')
      // Mid-song: a meadow critter dragged onto a seat stays home.
      await advance(SING_AFTER_MS + ownMs('b') + 10)
      await dragTo(byId('critter-c'), seatCentre(0))
      expect(byId('critter-seat-0').props.accessibilityLabel).toBe(
        'Letter b, on the log',
      )
      expect(g.calls).toEqual([own('b')])
      await advance(ownMs('g') + ownMs('f') + 3 * SOUND_GAP_MS)
      expect(g.sfx.boing.play).toHaveBeenCalledTimes(1)
      // Mid-tumble: a seated one dragged off stays seated.
      await dragTo(byId('critter-seat-1'), { x: 5, y: 5 })
      expect(seated()).toEqual([0, 1, 2])
      await advance(TUMBLE_MS + CLEAR_MS)
      await expectReady(g)
    })

    it('a run cut short by the background still ends with the log empty once she is back', async () => {
      const g = await mount()
      await seat('m', 'a', 'p')
      await advance(SING_AFTER_MS + 10)
      await act(async () => g.visibility.set(true))
      await advance(5000)
      expect(seated()).toEqual([0, 1, 2])
      await act(async () => g.visibility.set(false))
      await advance(CLEAR_MS)
      await expectReady(g)
    })
  })

  describe('4. the drag hint', () => {
    it('on entry, with the new open line: the hand, see-through, over every piece', async () => {
      const s = fakeSounds(wholeMs)
      const g = await mountGame('critters', {
        hunt: false,
        words: BLENDING_WORDS,
        sounds: s.sounds,
      })
      await advance(CRITTERS_OPEN_DELAY_MS - 10)
      expect(hint()).toBe(false)
      await advance(10)
      expect(hint()).toBe(true)
      expect(g.lines).toEqual(['guide.play.critters.open'])
      expect(openText).toBe(
        "Drag three letters up to the log. If they make a word, I'll say it!",
      )
      const hand = screen.getByTestId('critter-drag-hint', HIDDEN)
      expect(StyleSheet.flatten(hand.props.style).pointerEvents).toBe('none')
      expect(hand.props.accessibilityElementsHidden).toBe(true)
      expect(zOf(hand)).toBeGreaterThan(topPieceZ())
      await advance(DRAG_HINT_MS - 10)
      expect(hint()).toBe(true)
      await advance(10)
      expect(hint()).toBe(false)
    })

    it('again after ~8 s with no drag: the line once more, then the hand alone', async () => {
      const s = fakeSounds(wholeMs)
      const g = await mountGame('critters', {
        hunt: false,
        words: BLENDING_WORDS,
        sounds: s.sounds,
      })
      await advance(CRITTERS_OPEN_DELAY_MS + DRAG_HINT_MS)
      expect(hint()).toBe(false)
      await advance(HINT_IDLE_MS - 10)
      expect(hint()).toBe(false)
      await advance(20)
      expect(hint()).toBe(true)
      expect(g.lines).toEqual([
        'guide.play.critters.open',
        'guide.play.critters.open',
      ])
      for (let k = 0; k < 2; k++) {
        await advance(DRAG_HINT_MS)
        expect(hint()).toBe(false)
        await advance(HINT_IDLE_MS)
        expect(hint()).toBe(true)
      }
      // The coordinator's call (2026-10-23): the line twice a visit at most.
      expect(g.lines).toHaveLength(2)
    })

    it('a tap does not put the hint off; a drag does, and ends the hand', async () => {
      const s = fakeSounds(wholeMs)
      await mountGame('critters', {
        hunt: false,
        words: BLENDING_WORDS,
        sounds: s.sounds,
      })
      await advance(CRITTERS_OPEN_DELAY_MS)
      await dragStart(byId('critter-b'), { x: 5, y: 5 })
      await advance(STORY_TAP_CUE_CANCEL_OUT_MS)
      expect(hint()).toBe(false)
      await dragRelease(byId('critter-b'), { x: 5, y: 5 })
      await advance(HINT_IDLE_MS - 1000)
      await tap(byId('critter-b'))
      await advance(1010)
      expect(hint()).toBe(true)
      await advance(DRAG_HINT_MS + HINT_IDLE_MS - 1000)
      await dragTo(byId('critter-b'), { x: 5, y: 5 })
      await advance(1010)
      expect(hint()).toBe(false)
      await advance(HINT_IDLE_MS - 1010 - 10)
      expect(hint()).toBe(false)
      await advance(20)
      expect(hint()).toBe(true)
    })

    it('never again that visit once she has made her first run of three', async () => {
      const g = await mount()
      expect(hint()).toBe(true)
      await run('hag')
      expect(hint()).toBe(false)
      for (let t = 0; t < 2 * (HINT_IDLE_MS + DRAG_HINT_MS); t += 500) {
        await advance(500)
        expect(hint()).toBe(false)
      }
      expect(g.lines).toEqual(['guide.play.critters.open'])
    })
  })
})

describe('Thomas 2026-10-23 (build 20): "No picture for rat and there is no m"', () => {
  it('the said words with a bundled pack picture are exactly CRITTER_SAID_PICTURE_WORDS (mum shows mom’s, Dave’s word hunt ruling § 6)', () => {
    expect(
      CRITTER_SAID_WORDS.filter(
        (w) => pictureAsset(critterPictureKey(w)) !== undefined,
      ),
    ).toEqual(CRITTER_SAID_PICTURE_WORDS)
    expect(pictureAsset(critterPictureKey('mum'))).toBe(pictureAsset('mom'))
  })

  it.each([
    ['r-a-t', 'rat', 'Rat.'],
    ['m-a-p', 'map', 'Map.'],
  ])(
    '%s: sounds, Emma says it, then its picture pops, then the shelf clears',
    async (_, word, caption) => {
      const starts = bounceStarts()
      const bounces = starts.count
      const s = fakeSounds(wholeMs)
      const g = await mountGame('critters', {
        hunt: false,
        words: ['rug', 'cat', 'mop'],
        sounds: s.sounds,
      })
      await advance(CRITTERS_OPEN_DELAY_MS + LINE_MS)
      expect(critterRun(word)).toBe('word')
      await seat(...word.split(''))
      starts.from()
      await advance(SING_AFTER_MS)
      for (const l of word) await advance(ownMs(l) + SOUND_GAP_MS)
      // The sounds, one by one; then Emma's own line, her caption with it.
      expect(s.calls).toEqual([...word].map(own))
      expect(g.lines.at(-1)).toBe(`guide.play.critters.word.${word}`)
      expect(ribbon()?.props.accessibilityLabel).toBe(caption)
      expect(g.poses.at(-1)).toBe('attentive-pointing')
      expect(bounces()).toBe(3)
      expect(has('critter-picture')).toBe(false)
      // Her line ends: the picture pops with the joy beat (Dave
      // 2026-10-25), and no sparkle sound and no praise.
      await advance(LINE_MS + 10)
      expect(has(`critter-picture-${word}`)).toBe(true)
      expect(g.poses.at(-1)).toBe('cheering')
      expect(g.sfx.cheer.play).toHaveBeenCalledTimes(1)
      expect(g.sfx.sparkle.play).not.toHaveBeenCalled()
      expect(g.poses).not.toContain('celebration')
      expect(bounces()).toBe(6)
      expect(seated()).toEqual([0, 1, 2])
      // It holds and leaves as a picture word's does.
      await advance(PICTURE_HOLD_MS + PICTURE_LEAVE_MS - 30)
      expect(has(`critter-picture-${word}`)).toBe(true)
      await advance(30)
      expect(has('critter-picture')).toBe(false)
      expect(g.poses.at(-1)).toBe('idle')
      expect(seated()).toEqual([0, 1, 2])
      // Then the shelf clears.
      await advance(SHELF_HOLD_MS - 30)
      expect(seated()).toEqual([0, 1, 2])
      await advance(30)
      expect(seated()).toEqual([])
      expect(dropping()).toBe(3)
      await advance(SHELF_DROP_MS)
      expect(g.lines).toEqual([
        'guide.play.critters.open',
        `guide.play.critters.word.${word}`,
      ])
      expect(s.calls).toHaveLength(3)
    },
  )

  it.each(['ham', 'cab', 'pad', 'ram'])(
    'the probe reserve’s pictured said word %s (Thomas 2026-10-24): Emma says it, then its picture pops',
    async (word) => {
      const s = fakeSounds(wholeMs)
      const g = await mountGame('critters', {
        hunt: false,
        words: ['hut', 'cab', 'pad', 'mop', 'rug'],
        sounds: s.sounds,
      })
      await advance(CRITTERS_OPEN_DELAY_MS + LINE_MS)
      expect(critterRun(word)).toBe('word')
      await seat(...word.split(''))
      await advance(SING_AFTER_MS)
      for (const l of word) await advance(ownMs(l) + SOUND_GAP_MS)
      expect(g.lines.at(-1)).toBe(`guide.play.critters.word.${word}`)
      expect(has('critter-picture')).toBe(false)
      await advance(LINE_MS + 10)
      expect(has(`critter-picture-${word}`)).toBe(true)
      expect(
        JSON.stringify(byId(`critter-picture-${word}`).props.source),
      ).toContain(`pictures/${word}.webp`)
    },
  )

  const MEADOW_22 = [...'aeiou', ...'bcdfghjlmnprstvwx']
  const T = { top: 24, bottom: 20, left: 0, right: 0 }

  it.each([3, 11])(
    'an 820×1180 iPad: all 22 letters, vowels first, every visit (rng %i)',
    async (seed) => {
      const s = fakeSounds(wholeMs)
      await mountGame('critters', {
        hunt: false,
        viewport: { width: 820, height: 1180, insets: T },
        rng: seeded(seed),
        sounds: s.sounds,
      })
      expect(meadow()).toEqual(MEADOW_22)
      expect(meadow()).toContain('m')
    },
  )

  it.each([
    ['an iPad mini (744×1133, landscape 1 pt short)', 744, 1133, T],
    ['a phone, portrait', PHONE_P.width, PHONE_P.height, PHONE_P.insets],
    ['a phone, landscape', PHONE_L.width, PHONE_L.height, PHONE_L.insets],
  ])('%s: the 16 rotating, every vowel', async (_, width, height, insets) => {
    const s = fakeSounds(wholeMs)
    await mountGame('critters', {
      hunt: false,
      viewport: { width, height, insets },
      sounds: s.sounds,
    })
    expect(meadow()).toHaveLength(CRITTER_CAP)
    expect(meadow().slice(0, 5)).toEqual([...'aeiou'])
  })
})

describe('Thomas on build 21 (2026-10-25): "mom" tumbled; Dave’s ruling', () => {
  /** mom, egg, car, poo and mup from 11 letters. */
  const WORDS_21 = ['mop', 'leg', 'cat', 'rug']
  async function mount21() {
    const s = fakeSounds(wholeMs)
    const g = await mountGame('critters', {
      hunt: false,
      words: WORDS_21,
      sounds: s.sounds,
    })
    await advance(CRITTERS_OPEN_DELAY_MS + LINE_MS)
    return { ...g, ...s }
  }
  async function sing(word: string) {
    await seat(...word.split(''))
    await advance(SING_AFTER_MS)
    for (const l of word) await advance(ownMs(l) + SOUND_GAP_MS)
  }

  it.each([
    ['m-o-m', 'mom', 'Mom.'],
    ['e-g-g', 'egg', 'Egg.'],
  ])(
    '%s: sounds, then Emma says the word, then its picture pops; no boing or tumble',
    async (_, word, caption) => {
      const g = await mount21()
      expect(critterRun(word)).toBe('word')
      await sing(word)
      expect(g.calls).toEqual([...word].map(own))
      expect(g.lines).toEqual([
        'guide.play.critters.open',
        `guide.play.critters.word.${word}`,
      ])
      expect(ribbon()?.props.accessibilityLabel).toBe(caption)
      expect(g.poses.at(-1)).toBe('attentive-pointing')
      expect(has('critter-picture')).toBe(false)
      await advance(LINE_MS + 10)
      expect(has(`critter-picture-${word}`)).toBe(true)
      expect(
        JSON.stringify(byId(`critter-picture-${word}`).props.source),
      ).toContain(`pictures/${word}.webp`)
      expect(g.sfx.boing.play).not.toHaveBeenCalled()
      expect(g.sfx.sparkle.play).not.toHaveBeenCalled()
      expect(has('critter-tumble')).toBe(false)
      expect(g.calls).toHaveLength(3)
    },
  )

  it.each([
    ['c-a-r', 'car'],
    ['p-o-o', 'poo'],
  ])(
    '%s: the sounds, then the three sit; no word, boing, tumble, line or picture',
    async (_, word) => {
      const asked = jest.spyOn(bundledAudio, 'audioForWebPath')
      const g = await mount21()
      expect(critterRun(word)).toBe('quiet')
      await sing(word)
      await advance(WORD_CLIP_MS + BOUNCE_MS)
      expect(g.calls).toEqual([...word].map(own))
      expect(wordClipsAsked(asked)).toEqual([])
      expect(g.sfx.boing.play).not.toHaveBeenCalled()
      expect(has('critter-tumble')).toBe(false)
      expect(has('critter-picture')).toBe(false)
      expect(g.lines).toEqual(['guide.play.critters.open'])
    },
  )

  it('m-u-p, a non-word, still boings and tumbles with a line', async () => {
    const g = await mount21()
    expect(critterRun('mup')).toBe('funny')
    await sing('mup')
    expect(g.sfx.boing.play).toHaveBeenCalledTimes(1)
    expect(has('critter-tumble')).toBe(true)
    expect(g.lines).toEqual([
      'guide.play.critters.open',
      'guide.play.critters.funny.1',
    ])
    expect(has('critter-picture')).toBe(false)
  })
})

describe('Thomas 2026-10-25 (Dave’s ruling): a real word’s joy beat, and a picture word’s first praise in a visit', () => {
  const fanEnd = () => wholeMs(clipOf('fan'))
  /** Builds f-a-n and runs to `ms` after its clip ended. */
  async function fan(ms: number) {
    await seat('f', 'a', 'n')
    await advance(SING_AFTER_MS + fanEnd() + ms)
  }

  it('f-a-n, first build: the joy beat 300 ms after the clip, the lesson’s praise at 1200 ms with Emma still cheering, the picture leaving at 2400 ms', async () => {
    const starts = bounceStarts()
    const bounces = starts.count
    const g = await mount()
    starts.from()
    await fan(JOY_AFTER_MS - 10)
    expect(g.poses.at(-1)).toBe('celebration')
    expect(g.sfx.cheer.play).not.toHaveBeenCalled()
    const before = bounces()
    await advance(10)
    // The joy beat: the cheer, the three together, the burst.
    expect(g.poses.at(-1)).toBe('cheering')
    expect(g.sfx.cheer.play).toHaveBeenCalledTimes(1)
    expect(bounces() - before).toBe(3)
    expect(has('critter-sparkle-burst')).toBe(true)
    expect(g.sfx.sparkle.play).toHaveBeenCalledTimes(1)
    await advance(SPARKLE_BURST_MS)
    expect(has('critter-sparkle-burst')).toBe(false)
    // The praise, once the cheer is over: her caption, still cheering.
    await advance(PRAISE_AFTER_MS - JOY_AFTER_MS - SPARKLE_BURST_MS - 10)
    expect(g.lines).toEqual(['guide.play.critters.open'])
    await advance(10)
    expect(g.lines.at(-1)).toBe('guide.play.critters.praise.fan')
    expect(ribbon()?.props.accessibilityLabel).toBe("Yes! That's a fan.")
    expect(g.poses.at(-1)).toBe('cheering')
    // A short praise: the picture keeps its 2400 ms hold, then leaves.
    await advance(PICTURE_HOLD_MS - PRAISE_AFTER_MS + PICTURE_LEAVE_MS - 10)
    expect(has('critter-picture-fan')).toBe(true)
    await advance(10)
    expect(has('critter-picture')).toBe(false)
    expect(g.poses.at(-1)).toBe('idle')
    expect(g.lines).toEqual([
      'guide.play.critters.open',
      'guide.play.critters.praise.fan',
    ])
  })

  it('a second build of fan in the visit: the joy beat again, no praise; cat’s first build gets its own', async () => {
    const g = await mount()
    for (const word of ['fan', 'fan', 'cat']) {
      await seat(...word.split(''))
      await advance(SING_AFTER_MS + wholeMs(clipOf(word)))
      await advance(PICTURE_HOLD_MS + PICTURE_LEAVE_MS + CLEAR_MS)
      expect(seated()).toEqual([])
    }
    expect(g.sfx.cheer.play).toHaveBeenCalledTimes(3)
    expect(g.lines).toEqual([
      'guide.play.critters.open',
      'guide.play.critters.praise.fan',
      'guide.play.critters.praise.cat',
    ])
  })

  it('a long praise holds the picture until 400 ms after it ends', async () => {
    const g = await mount()
    const playLine = g.player.playLine as jest.Mock
    const short = playLine.getMockImplementation()!
    const PRAISE_MS = 2000
    playLine.mockImplementation((id: string, opts) => {
      if (!id.includes('.praise.')) return short(id, opts)
      g.lines.push(id)
      return new Promise<void>((resolve) => setTimeout(resolve, PRAISE_MS))
    })
    const praiseEnd = PRAISE_AFTER_MS + PRAISE_MS
    await fan(praiseEnd + PRAISE_TAIL_MS + PICTURE_LEAVE_MS - 10)
    expect(praiseEnd + PRAISE_TAIL_MS).toBeGreaterThan(PICTURE_HOLD_MS)
    expect(has('critter-picture-fan')).toBe(true)
    // A line's end resolves on the harness's next 10 ms step.
    await advance(20)
    expect(has('critter-picture')).toBe(false)
    expect(g.poses.at(-1)).toBe('idle')
  })

  it('a quiet word and a non-word get no cheer and no burst', async () => {
    const g = await mount()
    for (const word of ['hag', 'bgf']) {
      await seat(...word.split(''))
      await advance(SING_AFTER_MS)
      for (const l of word) await advance(ownMs(l) + SOUND_GAP_MS)
      expect(has('critter-sparkle-burst')).toBe(false)
      await advance(TUMBLE_MS + CLEAR_MS)
      expect(has('critter-sparkle-burst')).toBe(false)
    }
    expect(g.sfx.boing.play).toHaveBeenCalledTimes(1)
    expect(g.sfx.cheer.play).not.toHaveBeenCalled()
  })

  it('the 56 praise lines (the 45 and the 11 four-letter lesson words) play the lessons’ bundled canon clips; a said word has none', () => {
    expect(CRITTER_PRAISE_WORDS).toHaveLength(56)
    for (const w of CRITTER_PRAISE_WORDS) {
      const id = crittersPraiseLine(w)!
      const clip = canonClipFor(critterPraise(w)!)
      expect(clip).toBeDefined()
      expect(PLAY_LINE_MANIFEST[id]).toEqual({
        src: null,
        text: critterPraise(w),
        clip: clip!.module,
      })
    }
    for (const w of [...CRITTER_SAID_WORDS, 'sex', 'tup'])
      expect(crittersPraiseLine(w)).toBeUndefined()
  })

  it('Reduce Motion: no burst and no bounce, the three light together; the cheer and the praise at the same times', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true)
    const starts = bounceStarts()
    const g = await mount()
    await fan(JOY_AFTER_MS - 10)
    starts.from()
    await advance(10)
    expect(g.sfx.cheer.play).toHaveBeenCalledTimes(1)
    expect(g.poses.at(-1)).toBe('cheering')
    expect(has('critter-sparkle-burst')).toBe(false)
    // One light (a sequence) per critter, no hop and pulse (two each).
    expect(starts.count() * 2).toBe(3)
    await advance(PRAISE_AFTER_MS - JOY_AFTER_MS)
    expect(g.lines.at(-1)).toBe('guide.play.critters.praise.fan')
    expect(has('critter-sparkle-burst')).toBe(false)
  })
})

describe('the seen-record (Dave 2026-10-24: the probe reserve skips a word she met here)', () => {
  const seen = () => loadProgress()!.seenItems ?? {}

  it('a picture word and a said word go into it as Emma says them; a non-word, a quiet word and a pair do not', async () => {
    const g = await mount()
    await seat('f', 'a', 'n')
    await advance(SING_AFTER_MS)
    expect(Object.keys(seen())).toEqual(['word:fan'])
    await advance(WORD_CLIP_MS + PICTURE_HOLD_MS + PICTURE_LEAVE_MS + CLEAR_MS)
    await seat('t', 'a', 'b')
    await advance(SING_AFTER_MS)
    for (const l of 'tab') await advance(ownMs(l) + SOUND_GAP_MS)
    expect(g.lines.at(-1)).toBe('guide.play.critters.word.tab')
    expect(seen()['word:tab']).toMatchObject({ count: 1, correct: null })
    await advance(LINE_MS + CLEAR_MS)
    for (const word of ['bab', 'hag']) {
      await seat(...word.split(''))
      await advance(SING_AFTER_MS)
      for (const l of word) await advance(ownMs(l) + SOUND_GAP_MS)
      await advance(LINE_MS + TUMBLE_MS + CLEAR_MS)
    }
    expect(Object.keys(seen()).sort()).toEqual(['word:fan', 'word:tab'])
  })

  it('no learner doc: the game still plays and writes nothing', async () => {
    setKeyValueStore(null)
    const g = await mount()
    await seat('f', 'a', 'n')
    await advance(SING_AFTER_MS)
    expect(g.calls.at(-1)).toEqual({ uri: clipOf('fan'), from: 0, to: null })
  })
})
