/**
 * Core's round (`buildWordRound`) as the native stage draws it. The one
 * native rule (`design/native/word-song-native.md` § 7): when the target
 * or a distractor has no picture (the ch, sh and th words, until their
 * art lands), the problem draws as a written-word problem: written-word
 * chips and the letter row alone on the stage (no picture to tap), instead
 * of the web's pink squares.
 */
import {
  buildWordRound,
  type ChipFace,
  type WordRound,
} from '@marian/core/wordSong/wordRound'
import type { WordSongProblem } from '@marian/core/wordSong/wordSessionPlans'
import { pictureAsset } from '../../assets'

/** Core's cards, plus `letters`: the letter row without a picture. */
export type StageCard =
  | 'picture'
  | 'letters'
  | 'letter'
  | 'letter-sound'
  | 'sentence'
  | 'none'

export interface NativeRound extends Omit<WordRound, 'card' | 'chipFace'> {
  card: StageCard
  chipFace: ChipFace
  /** The written-word fallback applied (a word without art). */
  noArt: boolean
}

export function nativeRound(
  problem: WordSongProblem,
  crossVowel: boolean,
  hasPicture: (key: string) => boolean = (k) => pictureAsset(k) !== undefined,
): NativeRound {
  const round = buildWordRound(problem, { crossVowel })
  const noArt =
    round.chipFace === 'picture' &&
    round.chips.some((e) => !hasPicture(e.pictureKey))
  if (noArt) {
    return { ...round, card: 'letters', chipFace: 'written-word', noArt }
  }
  return { ...round, noArt }
}
