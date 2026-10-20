/**
 * Word Song test harness: a fake of Emma's voice (the test starts, ticks,
 * clocks and ends each line), fake effects, tap player and visibility, the
 * plans, and the render. Silent: no player exists in these tests.
 */
import type { StorageAdapter } from '@marian/core/shared/stardust'
import { getWordEntry } from '@marian/core/wordSong/wordPack'
import {
  STATIC_WORD_SONG_PLANS,
  type WordSongContentType,
  type WordSongSessionPlan,
} from '@marian/core/wordSong/wordSessionPlans'
import { act, render } from '@testing-library/react-native'
import type { Sfx, TapClipPlayer } from '../src/audio'
import { BLEND_MARKS } from '../src/audio/blendMarks.generated'
import type { Viewport } from '../src/layout/layout'
import { wordSongLayout } from '../src/layout/wordSongLayout'
import type { AppVisibility } from '../src/lifecycle/appVisibility'
import {
  WordSong,
  type WordSongProps,
  type WordSongSfx,
} from '../src/screens/wordSong/WordSong'
import type { PlayWordSongUtteranceOptions } from '../src/screens/wordSong/wordSongTypes'

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 }
export const PORTRAIT: Viewport = { width: 375, height: 667, insets: NO_INSETS }

export interface Line {
  text: string
  opts: PlayWordSongUtteranceOptions
  resolve: () => void
}

export function fakeVoice() {
  const lines: Line[] = []
  const play = jest.fn(
    (text: string, opts: PlayWordSongUtteranceOptions = {}) =>
      new Promise<void>((resolve) => {
        lines.push({ text, opts, resolve })
      }),
  )
  return { lines, play, texts: () => lines.map((l) => l.text) }
}

export function fakeSfx(): WordSongSfx &
  Record<keyof WordSongSfx, Sfx & { play: jest.Mock }> {
  const one = () => ({
    play: jest.fn(() => true),
    unload: jest.fn(),
    missedPlays: 0,
    loadFailed: false,
  })
  return { sparkle: one(), poof: one(), plink: one() }
}

export function fakeTap() {
  const calls: { uri: string | number; from: number; to: number | null }[] = []
  let onEnd: (() => void) | undefined
  const player: TapClipPlayer & { cuts: number } = {
    cuts: 0,
    play(uri, from, to, end) {
      player.cut()
      calls.push({ uri, from, to })
      onEnd = end
    },
    cut() {
      player.cuts += 1
      const e = onEnd
      onEnd = undefined
      e?.()
    },
    release() {
      player.cut()
    },
    get playing() {
      return onEnd !== undefined
    },
  }
  return { player, calls, end: () => player.cut() }
}

export function memoryStorage(): StorageAdapter {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
  }
}

export function fakeVisibility() {
  let hidden = false
  const listeners = new Set<() => void>()
  const store: AppVisibility = {
    getIsHidden: () => hidden,
    subscribe(l) {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
  }
  return {
    store,
    set(next: boolean) {
      hidden = next
      for (const l of Array.from(listeners)) l()
    },
  }
}

export async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  })
}

export async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
  await flush()
}

/**
 * The line starts and ticks every word (and its clock); optionally ends.
 * A clock at or past the line's `endAtMs` ends it there, as the engine
 * does (real blending's cut).
 */
export async function say(
  line: Line,
  { end = true, ms }: { end?: boolean; ms?: number[] } = {},
) {
  const words = line.text.split(/\s+/).filter(Boolean)
  await act(async () => {
    line.opts.onPlay?.()
    for (let i = 0; i < words.length; i++) line.opts.onWordTick?.(i)
    for (const t of ms ?? []) {
      line.opts.onTime?.(t)
      if (line.opts.endAtMs !== undefined && t >= line.opts.endAtMs) {
        line.resolve()
        break
      }
    }
    if (end) line.resolve()
  })
  await flush()
}

/** Blending-cv: cat bag jam fan pan man tag cap ("Tap the cat."). */
export const BLENDING: WordSongSessionPlan = STATIC_WORD_SONG_PLANS[0]!

const CVC_WORDS = ['cat', 'bag', 'fan', 'pan', 'man', 'tag', 'hat', 'van']

/** A plan of `words` as `contentType`, with the canon blend line on cvc. */
export function planOf(
  contentType: WordSongContentType,
  words: readonly string[] = CVC_WORDS,
  { blend = true } = {},
): WordSongSessionPlan {
  return {
    id: `test-${contentType}`,
    label: 'test',
    problems: words.map((word, i) => {
      const W = word[0]!.toUpperCase() + word.slice(1)
      const blendText = `${word.split('').join(' - ')} ... ${word}`
      return {
        index: i + 1,
        target: getWordEntry(word),
        contentType,
        utterances: {
          read: `Read the ${word}.`,
          correct: `Yes! ${W}.`,
          reprompt: 'Hmm... try again?',
          hint: `Let's look. ${W}.`,
          giveAnswer: `This one is ${word}.`,
          ...(blend && contentType === 'cvc-word' ? { blend: blendText } : {}),
        },
      }
    }),
  }
}

/** The session's clip files: the canon byte lengths, so the marks match. */
export function canonClips(text: string) {
  const mark = BLEND_MARKS[text]
  return mark
    ? { uri: `file:///${encodeURIComponent(text)}.mp3`, bytes: mark.bytes }
    : undefined
}

export async function renderWordSong(props: Partial<WordSongProps> = {}) {
  const voice = fakeVoice()
  const sfx = fakeSfx()
  const tap = fakeTap()
  const vis = fakeVisibility()
  const onRequestExit = jest.fn()
  const onSessionComplete = jest.fn()
  const poses: string[] = []
  const cancelLine = jest.fn()
  const storage = memoryStorage()
  const element = (next: Partial<WordSongProps>) => (
    <WordSong
      layout={wordSongLayout(PORTRAIT)}
      plan={BLENDING}
      playUtterance={voice.play}
      audioReady
      onRequestExit={onRequestExit}
      onSessionComplete={onSessionComplete}
      onPoseChange={(p) => poses.push(p)}
      cancelLine={cancelLine}
      sfx={sfx}
      tapPlayer={tap.player}
      storage={storage}
      visibility={vis.store}
      {...next}
    />
  )
  const utils = await render(element(props))
  await flush()
  return {
    ...utils,
    /** The same mount, new props (App's session snapshot changing). */
    async update(next: Partial<WordSongProps>) {
      await utils.rerender(element({ ...props, ...next }))
      await flush()
    },
    voice,
    sfx,
    tap,
    vis,
    onRequestExit,
    onSessionComplete,
    poses,
    cancelLine,
  }
}
