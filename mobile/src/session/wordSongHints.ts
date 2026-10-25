/**
 * What a Word Song session start reads from the persisted progress, the
 * request it sends, and the session-start state the screen freezes. Web
 * source: `src/App.tsx` (`readProgressHintsForTrack('word-song')` and the
 * Word Song kick-effect) + `src/lib/audio/wordSongPathA.ts` (the payload).
 *
 * The audio is the baked canon: letter sounds, blends, words and Emma's
 * lines. The payload is the web's, with no render options, and the app
 * builds the session from it on the device (`./localSession.ts`). The
 * letter-sounds vowel map no longer reaches the server either (no-Claude
 * plan phase 4): the app builds the vowel's session from the canon, with
 * a `seed` that varies its letters, and the server, asked only when a
 * local build fails, gets neither and answers from canon.
 *
 * Unlike the web, the app never asks the server for a cvc-words graduation
 * plan: it builds the check itself from the canon plan
 * (`@marian/core/wordSong/graduationCheck`, Thomas 2026-10-23). Asking ran
 * the live planner (~15 s), and the 5 s fallback then served canon without
 * the probe words, so the check never ran (build 20).
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
import { localDateKey, now as progressNow } from '@marian/core/progress/clock'
import {
  sessionPlanKind,
  type SessionPlanKind,
} from '@marian/core/progress/reviewPlan'
import { readSessionHistory } from '@marian/core/sessionEnd/sessionHistory'
import { graduationCheckWords } from '@marian/core/wordSong/probeReserve'
import {
  lastWordOrder,
  WORD_ORDER_STEPS,
  type WordOrderHint,
} from '@marian/core/wordSong/wordOrder'
import type {
  IntroGuideLineId,
  PrefetchKey,
  SessionStartPayload,
} from '../audio'
import { RENDERED_PROBE_WORDS } from './graduationCheck'
import { planKindFields, planModeOf, sessionIntroFor } from './reviewSession'

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
  /** Review, or forward with its warm-up refs (native spec
   *  review-mode-and-warmup-native.md § 2, core `sessionPlanKind`). */
  planKind: SessionPlanKind
  /** The focus step's intro lead line (content wave 1 § 6.1), if it plays. */
  intro?: IntroGuideLineId | null
  /** A due graduation check's probe words (core `graduationCheckWords`):
   *  the reserve's once every reserve word is rendered, else today's. */
  probeWords?: readonly string[]
  /** With the vowel map: the session count at kick time, which varies the
   *  vowel session's letters (the Hub prefetch and the tap agree). */
  seed?: number
  /** A forward session of a step the device orders (core `wordOrder.ts`):
   *  the seed and the step's last session, which set this session's order. */
  wordOrder?: WordOrderHint
}

const NO_HINTS: WordSongProgressHints = {
  focusNode: undefined,
  focusMode: undefined,
  recentSuccessRate: undefined,
  isGraduationSession: undefined,
  lifetimeFirstEncounters: undefined,
  letterSoundsVowelStates: undefined,
  planKind: { kind: 'forward', warmup: [] },
}

/**
 * Read the hints from the persisted progress, exactly as the web does.
 * `rendered`: the probe words with bundled audio (a test seam).
 */
export function readWordSongProgressHints(
  rendered: ReadonlySet<string> = RENDERED_PROBE_WORDS,
): WordSongProgressHints {
  const progress = loadProgress()
  if (progress === null) return NO_HINTS
  const sessionCount = readSessionHistory().sessionCount
  const { node, mode } = pickFocusNode(progress, 'word-song', sessionCount)
  const now = progressNow()
  const planKind = sessionPlanKind(
    progress,
    'word-song',
    now.getTime(),
    localDateKey(now),
    sessionCount,
  )
  const isGraduationSession = isGraduationSessionPending(
    progress,
    node,
    'word-song',
  )
  const probeWords = isGraduationSession
    ? graduationCheckWords(progress, node, rendered)
    : undefined
  return {
    intro: sessionIntroFor(progress, node, planKind),
    focusNode: node,
    focusMode: mode,
    recentSuccessRate: pickRecentSuccessRate(progress, 'word-song'),
    isGraduationSession,
    ...(probeWords !== undefined ? { probeWords } : {}),
    lifetimeFirstEncounters: progress.lifetimeFirstEncounters ?? [],
    letterSoundsVowelStates:
      node === 'letter-sounds'
        ? progress.literacy?.letterSoundsVowelStates
        : undefined,
    ...(node === 'letter-sounds' ? { seed: sessionCount } : {}),
    ...(planKind.kind === 'forward' && WORD_ORDER_STEPS.has(node)
      ? {
          wordOrder: {
            seed: sessionCount,
            last: lastWordOrder(progress, node),
          },
        }
      : {}),
    planKind,
  }
}

/**
 * Whether the request carries the vowel map (and its seed): a forward
 * letter-sounds session only. Every other request is the hint-free one,
 * as before. The map no longer sends the session to the planner (the app
 * builds it, no-Claude plan phase 4), so nothing takes the 5 s fallback.
 */
export function carriesVowelMap(hints: WordSongProgressHints): boolean {
  if (hints.planKind.kind === 'review') return false
  return hints.letterSoundsVowelStates !== undefined
}

/**
 * The `session-start` payload (web `prepareWordSongPathA`). `withHints:
 * false` strips the vowel map and its seed; the warm-up refs ride on both.
 * A review sends its 8 blocks and the focus node (the server ignores every
 * other hint for it).
 */
export function buildWordSongSessionPayload(
  hints: WordSongProgressHints,
  withHints: boolean,
): SessionStartPayload {
  if (hints.planKind.kind === 'review') {
    return {
      track: 'word-song',
      level: 1,
      childName: 'friend',
      ...(hints.focusNode !== undefined
        ? { progress: { focusNode: hints.focusNode } }
        : {}),
      ...planKindFields(hints.planKind),
    }
  }
  return {
    ...forwardPayload(hints, withHints),
    ...planKindFields(hints.planKind),
  }
}

function forwardPayload(
  hints: WordSongProgressHints,
  withHints: boolean,
): SessionStartPayload {
  // Never `true`: the app builds a due check itself. `false` keeps a
  // request with hints byte-identical to one with no check due.
  const graduation =
    withHints && hints.isGraduationSession !== undefined ? false : undefined
  const vowels = withHints ? hints.letterSoundsVowelStates : undefined
  const seed = vowels !== undefined ? hints.seed : undefined
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
    childName: 'friend',
    ...progressBlock,
    ...(seed !== undefined ? { seed } : {}),
  }
}

/**
 * A Word Song session's prefetch identity: its focus node and mode
 * (`review` for a review, `<mode>+warmup` with warm-up refs, § 7.4).
 */
export function wordSongPrefetchKey(hints: WordSongProgressHints): PrefetchKey {
  return { track: 'word-song', node: hints.focusNode, mode: planModeOf(hints) }
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
  // A review reads the extras as today with cross-vowel off (native spec
  // review-mode-and-warmup-native.md § 7.4): its problems come from
  // several steps, not from the CVC step the mixing is for.
  const eligible =
    hints.planKind.kind !== 'review' &&
    ((hints.focusNode !== undefined && CVC_TIERS.has(hints.focusNode)) ||
      hints.focusMode === 'cvc-review')
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

/** The session start's letter-sounds target vowel, validated (web
 *  `wordSongPathA`). */
export type TargetVowel = '/o/' | '/u/' | '/i/' | '/e/'

export function narrowTargetVowel(raw: unknown): TargetVowel | undefined {
  return raw === '/o/' || raw === '/u/' || raw === '/i/' || raw === '/e/'
    ? raw
    : undefined
}
