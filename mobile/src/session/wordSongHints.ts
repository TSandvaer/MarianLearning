/**
 * What a Word Song session start reads from the persisted progress, the
 * request it sends, and the session-start state the screen freezes. Web
 * source: `src/App.tsx` (`readProgressHintsForTrack('word-song')` and the
 * Word Song kick-effect) + `src/lib/audio/wordSongPathA.ts` (the payload).
 *
 * The audio is the baked canon, served by `/api/claude`: letter sounds,
 * blends, words and Emma's lines all arrive as the response's utterances.
 * The payload is exactly the web's, with no render options. That keeps the
 * runtime-safe split (`.claude/docs/planner-and-canon.md`, blend pass-5):
 * a request that bypasses canon (a graduation session, the letter-sounds
 * vowel map) is rendered live with the safe blend, and the full-fidelity
 * blend only ever comes from the bake.
 */
import {
  crossVowelMixingActive,
  getSettings,
  isGraduationSessionPending,
  loadProgress,
  pickFocusNode,
  pickRecentSuccessRate,
  type FocusMode,
  type LetterSoundsVowel,
  type SkillLevel,
  type SkillNode,
  type VowelSubMasteryState,
} from '@marian/core/progress'
import { readSessionHistory } from '@marian/core/sessionEnd/sessionHistory'
import type { PrefetchKey, SessionStartPayload } from '../audio'

/** The progress hints the Word Song request carries. */
export interface WordSongProgressHints {
  focusNode: SkillNode | undefined
  focusMode: FocusMode | undefined
  recentSuccessRate: number | null | undefined
  isGraduationSession: boolean | undefined
  lifetimeFirstEncounters: readonly string[] | undefined
  letterSoundsVowelStates:
    | Record<LetterSoundsVowel, VowelSubMasteryState>
    | undefined
}

const NO_HINTS: WordSongProgressHints = {
  focusNode: undefined,
  focusMode: undefined,
  recentSuccessRate: undefined,
  isGraduationSession: undefined,
  lifetimeFirstEncounters: undefined,
  letterSoundsVowelStates: undefined,
}

/** Read the hints from the persisted progress, exactly as the web does. */
export function readWordSongProgressHints(): WordSongProgressHints {
  const progress = loadProgress()
  if (progress === null) return NO_HINTS
  const sessionCount = readSessionHistory().sessionCount
  const { node, mode } = pickFocusNode(progress, 'word-song', sessionCount)
  return {
    focusNode: node,
    focusMode: mode,
    recentSuccessRate: pickRecentSuccessRate(progress, 'word-song'),
    isGraduationSession: isGraduationSessionPending(
      progress,
      node,
      'word-song',
    ),
    lifetimeFirstEncounters: progress.lifetimeFirstEncounters ?? [],
    letterSoundsVowelStates:
      node === 'letter-sounds'
        ? progress.literacy?.letterSoundsVowelStates
        : undefined,
  }
}

/** The graduation probe and the vowel map bypass canon (live planner, slow). */
export function hasCanonBypassingHints(hints: WordSongProgressHints): boolean {
  return (
    hints.isGraduationSession === true ||
    hints.letterSoundsVowelStates !== undefined
  )
}

/**
 * The `session-start` payload (web `prepareWordSongPathA`). `withHints:
 * false` strips the canon-bypassing hints (the visible-wait fallback).
 */
export function buildWordSongSessionPayload(
  hints: WordSongProgressHints,
  withHints: boolean,
): SessionStartPayload {
  const graduation = withHints ? hints.isGraduationSession : undefined
  const vowels = withHints ? hints.letterSoundsVowelStates : undefined
  const hasProgress =
    hints.focusNode !== undefined ||
    hints.recentSuccessRate !== undefined ||
    graduation !== undefined ||
    hints.lifetimeFirstEncounters !== undefined ||
    vowels !== undefined
  const progressBlock = hasProgress
    ? {
        progress: {
          ...(hints.focusNode !== undefined
            ? { focusNode: hints.focusNode }
            : {}),
          ...(hints.recentSuccessRate !== undefined
            ? { recentSuccessRate: hints.recentSuccessRate }
            : {}),
          ...(graduation !== undefined
            ? { isGraduationSession: graduation }
            : {}),
          ...(hints.lifetimeFirstEncounters !== undefined
            ? { lifetimeFirstEncounters: [...hints.lifetimeFirstEncounters] }
            : {}),
          ...(vowels !== undefined
            ? { letterSoundsVowelStates: { ...vowels } }
            : {}),
        },
      }
    : {}
  return {
    track: 'word-song',
    level: 1,
    childName: 'Marian',
    ...progressBlock,
  }
}

/** A Word Song session's prefetch identity: its focus node and mode. */
export function wordSongPrefetchKey(hints: WordSongProgressHints): PrefetchKey {
  return { track: 'word-song', node: hints.focusNode, mode: hints.focusMode }
}

/**
 * Session-start state the screen gets as props, frozen for the session
 * (web kick-effect): cross-vowel mixing (uniform per session) and the
 * digraphs-th mouth cue.
 */
export interface WordSongSessionExtras {
  crossVowel: boolean
  thLevel: SkillLevel
  thFirstEncounter: boolean
}

export const NO_EXTRAS: WordSongSessionExtras = {
  crossVowel: false,
  thLevel: 'locked',
  thFirstEncounter: false,
}

const CVC_TIERS: ReadonlySet<string> = new Set([
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
])

export function readWordSongSessionExtras(
  hints: WordSongProgressHints,
): WordSongSessionExtras {
  const progress = loadProgress()
  if (progress === null) return NO_EXTRAS
  const eligible =
    (hints.focusNode !== undefined && CVC_TIERS.has(hints.focusNode)) ||
    hints.focusMode === 'cvc-review'
  const thLevel = progress.skillLevels['digraphs-th-voiceless']
  const met = hints.lifetimeFirstEncounters ?? []
  return {
    crossVowel:
      eligible && crossVowelMixingActive(progress, getSettings(progress)),
    thLevel,
    thFirstEncounter:
      thLevel === 'intro' && !met.includes('digraphs-th-voiceless'),
  }
}

/** The server's letter-sounds target vowel, validated (web `wordSongPathA`). */
export type TargetVowel = '/o/' | '/u/' | '/i/' | '/e/'

export function narrowTargetVowel(raw: unknown): TargetVowel | undefined {
  return raw === '/o/' || raw === '/u/' || raw === '/i/' || raw === '/e/'
    ? raw
    : undefined
}
