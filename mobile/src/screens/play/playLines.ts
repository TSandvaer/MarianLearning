/**
 * The Play place's words (play-place spec `design/native/play-place.md`
 * § 4): every spoken line is a core `GUIDANCE_LINES` row of kind `'play'`
 * or `'play-word'` (`guide.play.*`, Lily, `/assets/audio/path/guide-play-*.mp3`),
 * or a picture word's praise, the lesson's own canon clip (`critterPraise`,
 * Dave 2026-10-25), played through one manifest line player (`play`) with
 * word ticks for the bubble and the ribbon. The player never rejects; without a clip it walks the
 * caption at 165 wpm, so nothing waits on audio. The labels nobody speaks
 * (VoiceOver only, § 4.2) sit here too, so a language version swaps rows,
 * not screens.
 */
import {
  critterWordLine,
  GUIDANCE_LINES,
} from '@marian/core/emmasPath/guidanceLines'
import {
  CRITTER_PICTURE_WORDS,
  critterPraise,
  type PlayGameId,
  type RaftWeight,
} from '@marian/core/games/playPlace'
import { canonClipFor } from '../../audio/bundledAudio'
import {
  createManifestLinePlayer,
  type ManifestLine,
  type ManifestLinePlayer,
} from '../../audio/manifestLines'

export type PlayLineId =
  | 'guide.play.open'
  | 'guide.play.raft.open'
  | `guide.play.raft.total.${RaftWeight}`
  | 'guide.play.raft.go'
  | 'guide.play.raft.splash'
  | 'guide.play.raft.silly'
  | 'guide.play.raft.close'
  | 'guide.play.critters.open'
  | 'guide.play.critters.funny.1'
  | 'guide.play.critters.funny.2'
  | 'guide.play.critters.funny.3'
  | `guide.play.critters.word.${string}`
  | `guide.play.critters.praise.${string}`
  | 'guide.play.critters.done'

/** "You did it!", Word Song's session-end opener (no new audio). */
export const CRITTERS_DONE_TEXT = 'You did it!'

const praiseId = (word: string) =>
  `guide.play.critters.praise.${word}` as PlayLineId

export const PLAY_LINE_MANIFEST: Readonly<Record<PlayLineId, ManifestLine>> =
  Object.fromEntries([
    ...GUIDANCE_LINES.filter(
      (l) => l.kind === 'play' || l.kind === 'play-word',
    ).map((l) => [l.id, { src: l.src, text: l.text }]),
    // The picture words' praise: the lessons' canon clips, by their text.
    ...CRITTER_PICTURE_WORDS.map((w) => {
      const text = critterPraise(w)!
      return [
        praiseId(w),
        { src: null, text, clip: canonClipFor(text)?.module },
      ]
    }),
    // The word hunt's completion beat (critters-word-hunt.md § 5.1): Word
    // Song's `session.end.opener`, its bundled canon clip.
    [
      'guide.play.critters.done',
      {
        src: null,
        text: CRITTERS_DONE_TEXT,
        clip: canonClipFor(CRITTERS_DONE_TEXT)?.module,
      },
    ],
  ]) as Record<PlayLineId, ManifestLine>

export type PlayLinePlayer = ManifestLinePlayer<PlayLineId>

export function createPlayLinePlayer(): PlayLinePlayer {
  return createManifestLinePlayer<PlayLineId>('play', PLAY_LINE_MANIFEST)
}

/** The raft's running total, "<N>!" (t 1-9). */
export const raftTotalLine = (t: number) =>
  `guide.play.raft.total.${t}` as PlayLineId

/** The three non-word lines, in turn, every time (§ 3.3, Thomas 2026-10-22). */
export const crittersFunnyLine = (n: 1 | 2 | 3) =>
  `guide.play.critters.funny.${n}` as PlayLineId

/**
 * A said word, Emma's own line ("Map.", § 3.3, Thomas 2026-10-23, build
 * 20), or undefined for a word she does not say.
 */
export const crittersWordLine = (word: string) =>
  critterWordLine(word)?.id as PlayLineId | undefined

/**
 * A picture word's praise ("Yes! That's a fan.", Dave 2026-10-25), or
 * undefined for any other run.
 */
export const crittersPraiseLine = (word: string) =>
  critterPraise(word) === undefined ? undefined : praiseId(word)

/** § 4.2: the labels nobody speaks. */
export const PLAY_LABELS = {
  hubPlay: 'Play',
  home: 'Home',
  back: 'Back',
  raft: 'Raft',
  log: 'Log',
  // The word hunt (critters-word-hunt.md § 6.3).
  huntLog: 'Log, three letters',
  emptySlot: 'Empty word',
  hint: 'Hint',
  bonus: 'Bonus words',
  newLetters: 'New letters',
} as const

/** § 4.2: each tile's label, per game. */
export const PLAY_TILE_LABELS: Readonly<Record<PlayGameId, string>> = {
  raft: 'Raft crossing',
  critters: 'Letter critters',
}

/** The number words the labels use ("Dog, seven"; "Raft, seven"). */
const NUMBER_WORDS = [
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
  'ten',
] as const

const capitalised = (word: string) => word[0]!.toUpperCase() + word.slice(1)

/** A raft animal: "<Animal>, <weight>" ("Dog, seven"). */
export const animalLabel = (animal: string, weight: number) =>
  `${capitalised(animal)}, ${NUMBER_WORDS[weight]}`

/** The raft: "Raft, <total>". */
export const raftLabel = (total: number) =>
  `${PLAY_LABELS.raft}, ${NUMBER_WORDS[total]}`

/** A filled slot: the word, capitalised ("Fan"). */
export const slotLabel = (word: string) => capitalised(word)

/** The bonus chip: "Bonus words, <w>, <w>" ("Bonus words, tan"). */
export const bonusLabel = (words: readonly string[]) =>
  [PLAY_LABELS.bonus, ...words].join(', ')

/** A critter: "Letter <x>"; seated, "Letter <x>, on the log". */
export const critterLabel = (letter: string, seated: boolean) =>
  seated ? `Letter ${letter}, on the log` : `Letter ${letter}`
