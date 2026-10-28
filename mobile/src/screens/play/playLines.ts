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
  CRITTER_PRAISE_WORDS,
  critterPraise,
  type PlayGameId,
  type RaftTarget,
  type RaftWeight,
} from '@marian/core/games/playPlace'
import { canonClipFor } from '../../audio/bundledAudio'
import {
  createManifestLinePlayer,
  type ManifestLine,
  type ManifestLinePlayer,
} from '../../audio/manifestLines'

/** The 20 raft's totals past nine (raft-island-goal § 12.1). */
type RaftTeen = 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19

export type PlayLineId =
  | 'guide.play.open'
  | 'guide.play.raft.open'
  | 'guide.play.raft.open.20'
  | `guide.play.raft.total.${RaftWeight | RaftTeen}`
  | 'guide.play.raft.go'
  | 'guide.play.raft.go.20'
  | 'guide.play.raft.splash'
  | 'guide.play.raft.silly'
  | 'guide.play.raft.party'
  | 'guide.play.raft.close'
  | 'guide.play.critters.open'
  | 'guide.play.critters.open.four'
  | 'guide.play.critters.funny.1'
  | 'guide.play.critters.funny.2'
  | 'guide.play.critters.funny.3'
  | `guide.play.critters.word.${string}`
  | `guide.play.critters.praise.${string}`
  | 'guide.play.critters.done'

/**
 * "You did it!", Word Song's session-end opener (no new audio): the word
 * hunt's completion and the raft island's party (raft-island-goal § 3.1).
 */
export const CRITTERS_DONE_TEXT = 'You did it!'

const praiseId = (word: string) =>
  `guide.play.critters.praise.${word}` as PlayLineId

export const PLAY_LINE_MANIFEST: Readonly<Record<PlayLineId, ManifestLine>> =
  Object.fromEntries([
    ...GUIDANCE_LINES.filter(
      (l) => l.kind === 'play' || l.kind === 'play-word',
    ).map((l) => [l.id, { src: l.src, text: l.text }]),
    // The picture words' praise and, for four-letter rounds, the 11 lesson
    // words' (critters four-letter F9): the lessons' canon clips, by text.
    ...CRITTER_PRAISE_WORDS.map((w) => {
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
    // The raft island's party (raft-island-goal § 3.1): the same clip.
    [
      'guide.play.raft.party',
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

/** The raft's running total, "<N>!" (t 1-9; on the 20 raft 1-19). */
export const raftTotalLine = (t: number) =>
  `guide.play.raft.total.${t}` as PlayLineId

/** The raft's open line (§ 4.1; the 20 raft's, raft-island-goal § 4.5). */
export const raftOpenLine = (target: RaftTarget): PlayLineId =>
  target === 10 ? 'guide.play.raft.open' : 'guide.play.raft.open.20'

/** Exactly the target: "Ten! Off we go!", "Twenty! Off we go!". */
export const raftGoLine = (target: RaftTarget): PlayLineId =>
  target === 10 ? 'guide.play.raft.go' : 'guide.play.raft.go.20'

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
  // The raft island (raft-island-goal § 10): rows a language version swaps.
  raftFor: 'Raft for',
  homeFilled: 'home',
  homeEmpty: 'empty home',
  log: 'Log',
  // The word hunt (critters-word-hunt.md § 6.3, § 15.9). One label for
  // every empty slot, whatever its word: a label that held the word would
  // be the answer (VoiceOver speaks it, a braille display spells it).
  huntLog: 'Log, three letters',
  // The four-letter rounds (critters-four-letter.md § 8.2): the picker's
  // bottom slab, the door and the four-seat log.
  huntLogFour: 'Log, four letters',
  // The picker's printed titles (critters-four-letter.md § 5.4): the words
  // Emma says when that round opens. Shown, never spoken.
  huntTitle: 'Three letters',
  huntTitleFour: 'Four letters',
  emptySlot: 'Word to find',
  hint: 'Hint',
  bonus: 'Bonus words',
  newLetters: 'New letters',
} as const

/** § 4.2: each tile's label, per game. */
export const PLAY_TILE_LABELS: Readonly<Record<PlayGameId, string>> = {
  raft: 'Raft crossing',
  critters: 'Letter critters',
}

/** The number words the labels use ("Dog, seven"; "Raft for twenty, seven"). */
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
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
] as const

const capitalised = (word: string) => word[0]!.toUpperCase() + word.slice(1)

/** A raft animal: "<Animal>, <weight>" ("Dog, seven"). */
export const animalLabel = (animal: string, weight: number) =>
  `${capitalised(animal)}, ${NUMBER_WORDS[weight]}`

/** A raft: "Raft for <target>" ("Raft for twenty"): a pond in the picker. */
export const raftForLabel = (target: RaftTarget) =>
  `${PLAY_LABELS.raftFor} ${NUMBER_WORDS[target]}`

/**
 * The raft in a trip (raft-island-goal § 10): "Raft for <target>,
 * <total>" ("Raft for twenty, seven"); at 0 "Raft for twenty".
 */
export const raftLabel = (target: RaftTarget, total: number) =>
  total === 0
    ? raftForLabel(target)
    : `${raftForLabel(target)}, ${NUMBER_WORDS[total]}`

/**
 * An island home (§ 10): "<Animal>, <number>, home" ("Pig, nine, home"),
 * or "<Animal>, <number>, empty home".
 */
export const homeLabel = (animal: string, weight: number, filled: boolean) =>
  `${animalLabel(animal, weight)}, ${filled ? PLAY_LABELS.homeFilled : PLAY_LABELS.homeEmpty}`

/** A filled slot: the word, capitalised ("Fan"). */
export const slotLabel = (word: string) => capitalised(word)

/** The bonus chip: "Bonus words, <w>, <w>" ("Bonus words, tan"). */
export const bonusLabel = (words: readonly string[]) =>
  [PLAY_LABELS.bonus, ...words].join(', ')

/** A critter: "Letter <x>"; seated, "Letter <x>, on the log". */
export const critterLabel = (letter: string, seated: boolean) =>
  seated ? `Letter ${letter}, on the log` : `Letter ${letter}`
