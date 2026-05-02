/**
 * Hardcoded short-a CVC session plans for the Word Song screen v1.
 *
 * Why hardcoded — and not calling Claude (yet)
 * --------------------------------------------
 * Same architecture as Math's `sessionPlans.ts` (parent file). Production
 * pipeline is "Claude is the brain, not the mouth": session-start Claude
 * call returns a JSON plan + inline TTS bundle. The pipeline is real
 * (`api/claude.ts` + `api/_tts.ts`), but to develop and QA-test Word Song
 * end-to-end without a network dependency, we ship deterministic plans
 * here. When Claude prompt wiring lands, `pickStaticWordSongPlan()` gets
 * replaced (or wrapped) with a fetch — the {@link WordSongSessionPlan}
 * shape is the contract that survives the swap.
 *
 * Wire shape & adapter
 * --------------------
 * Same wire-shape adapter pattern as Math: nested `WordSongSessionPlan`
 * for the screen, flat `{ id, text }[]` for `/api/claude`. Adapter
 * functions translate between them.
 *
 * Plan content
 * ------------
 * Each plan is 8 problems of CVC short-a. Per Kyle's spec, problems 1-3
 * use gentle-tier distractors (banked wins) and 4-8 use trap-tier
 * (rhyme/alliteration). The session generator draws target words from
 * `TARGET_WORDS` such that:
 *   - Easier-to-recognise words sit in the gentle window (problems 1-3).
 *   - Trap-tier-friendly words (rich /æt/, /æn/, /æg/ rhyme density) sit
 *     in the trap window (4-8).
 *   - Each plan picks 8 of the 14 targets, no repeats within a plan.
 *
 * Audio
 * -----
 * Per spec §"Audio integration contract" — 4 utterances per problem
 * (read, correct, reprompt, hint) + the optional giveAnswer for the 3rd-
 * strike guided completion. Pre-rendered server-side; bytes live OUT of
 * the plan and are wired in by App.tsx via `wordSongPathA.ts`.
 */

import type { Utterance } from '../../../api/_types'
import { TARGET_WORDS, getWordEntry, type WordEntry } from './wordPack'

/** Wire-shape source row — one entry per problem × slot. Mirrors Math. */
export interface WordSongUtteranceSource {
  id: string
  text: string
}

/** Slot names matching the per-problem utterance set. Matches Kyle's spec
 *  §"Audio integration contract" → "Per-problem utterances". */
export type WordSongUtteranceSlot =
  | 'read'
  | 'correct'
  | 'reprompt'
  | 'hint'
  | 'giveAnswer'

/**
 * Build the canonical utterance id for a problem + slot.
 *
 * Source of truth: spec §"Audio integration contract" → utterance ids
 * `word.p{N}.{slot}`. Mirrors Math's `math.p{N}.{slot}` pattern.
 */
export function wordSongUtteranceId(
  problemIndex: number,
  slot: WordSongUtteranceSlot,
): string {
  return `word.p${problemIndex}.${slot}`
}

/** Slots emitted in canonical render order. */
const ALL_SLOTS: readonly WordSongUtteranceSlot[] = [
  'read',
  'correct',
  'reprompt',
  'hint',
  'giveAnswer',
]

/** Per-problem audio set — lines map 1:1 to spec §Audio integration. */
export interface WordSongProblemUtterances {
  /** "Tap the cat." — read on problem reveal. */
  read: string
  /** "Yes! Cat." — fired on correct first-or-later tap. */
  correct: string
  /** "Hmm... try again?" — fired on wrong tap (1st or 2nd attempt). */
  reprompt: string
  /** "Let's look. Cat." — fires after 2 wrongs. */
  hint: string
  /** "This one is cat." — fires after 3 wrongs (guided completion). */
  giveAnswer: string
}

/**
 * Content-type discriminant on a WordSong problem.
 *
 * `blending-cv` — the v1 default. Read line is "Tap the <word>.";
 *   Marian taps the matching picture chip from a trio. Targets drawn
 *   from `TARGET_WORDS` (the 14 CVC short-a words).
 *
 * `cvc-word` — next progression beat (ticket 86c9kxp08, planner-parser
 *   contract step 1). Read line is "Read the <word>.". Same target pool
 *   for now (the 14 CVC short-a words); when the planner widens in step
 *   2 it can draw from a broader CVC list. Step 1 (this PR) only widens
 *   the BROWSER PARSER — the planner does not emit this content yet,
 *   the picker is still hard-clamped to `blending-cv`, so existing
 *   sessions continue to parse as `blending-cv`.
 *
 * The field is optional on the public type for back-compat: callers that
 * predate the widening (e.g. `STATIC_WORD_SONG_PLANS`) don't set it, and
 * downstream code treats the absence as `blending-cv`. The parser always
 * sets it explicitly so plans rebuilt from the wire always carry the
 * discriminant.
 */
export type WordSongContentType = 'blending-cv' | 'cvc-word'

/** A single problem in the session. */
export interface WordSongProblem {
  /** 1-based position in the session (1..8). */
  index: number
  /** Target word entry (the correct picture chip). */
  target: WordEntry
  /** Pre-canned utterance lines for this problem. */
  utterances: WordSongProblemUtterances
  /**
   * Content-type discriminant. Optional for back-compat with hand-built
   * static plans; absent === `blending-cv`. The server-plan parser always
   * sets it explicitly.
   */
  contentType?: WordSongContentType
}

/** A full Word Song session plan — exactly 8 problems, all short-a CVC. */
export interface WordSongSessionPlan {
  /** Stable id for the plan (used by the audio cache + audit trail). */
  id: string
  /** Human-readable label for QA / debug overlay. */
  label: string
  /** Exactly 8 problems. */
  problems: readonly WordSongProblem[]
}

/**
 * Capitalize the first letter — used for the celebration line where
 * Kyle's spec sample is "Yes! Cat." (capitalised target after the
 * exclamation). Captions render verbatim, so capitalisation in the
 * plan text drives both the audio script and the on-screen caption.
 */
function capitalize(word: string): string {
  if (!word) return word
  return word[0].toUpperCase() + word.slice(1)
}

/** Build a problem's utterance set from the target word. Templates mirror
 *  Kyle's spec §Audio integration contract sample text exactly. */
function buildUtterances(target: WordEntry): WordSongProblemUtterances {
  const word = target.word
  const Word = capitalize(word)
  return {
    read: `Tap the ${word}.`,
    correct: `Yes! ${Word}.`,
    reprompt: 'Hmm... try again?',
    hint: `Let's look. ${Word}.`,
    giveAnswer: `This one is ${word}.`,
  }
}

/** Build a problem at the given 1-based index from a target word string. */
function makeProblem(index: number, word: string): WordSongProblem {
  const target = getWordEntry(word)
  if (!target.isTarget) {
    throw new Error(
      `[wordSessionPlans] "${word}" is a distractor-only word, cannot be a target`,
    )
  }
  return {
    index,
    target,
    utterances: buildUtterances(target),
  }
}

/**
 * The hardcoded plans. Three rotation slots so two back-to-back sessions
 * don't repeat. Each picks 8 words from the 14 targets, with the easier-
 * to-recognise words in the gentle window (1-3) and richer-rhyme words
 * in the trap window (4-8).
 *
 * Plan A — opens with `cat` (Marian read it cold, per diagnostic). Bridges
 *          to the /æn/ family (fan, man, pan) for the trap window.
 * Plan B — opens with `bag` (universal, Tagalog loanword). Trap window
 *          covers /æt/ rhymes (bat, hat) plus alliteration with cap.
 * Plan C — opens with `hat` (Marian read it correctly in the diagnostic).
 *          Trap window mixes /æg/ and /æn/ for variety.
 */
export const STATIC_WORD_SONG_PLANS: readonly WordSongSessionPlan[] = [
  {
    id: 'word-song-shorta-A',
    label: 'CVC short-a — opens with cat',
    problems: [
      makeProblem(1, 'cat'), // gentle — Marian read it cold
      makeProblem(2, 'bag'), // gentle — universal
      makeProblem(3, 'jam'), // gentle — distinct silhouette
      makeProblem(4, 'fan'), // trap — /æn/ family
      makeProblem(5, 'pan'), // trap — /æn/ family
      makeProblem(6, 'man'), // trap — /æn/ family
      makeProblem(7, 'tag'), // trap — /æg/ rhymes with bag
      makeProblem(8, 'cap'), // trap — alliteration with cat
    ],
  },
  {
    id: 'word-song-shorta-B',
    label: 'CVC short-a — opens with bag',
    problems: [
      makeProblem(1, 'bag'), // gentle
      makeProblem(2, 'fan'), // gentle (3rd problem still gentle tier)
      makeProblem(3, 'mat'), // gentle
      makeProblem(4, 'cat'), // trap — /æt/ rhymes
      makeProblem(5, 'bat'), // trap — /æt/ rhymes
      makeProblem(6, 'hat'), // trap — /æt/ rhymes
      makeProblem(7, 'can'), // trap — /æn/
      makeProblem(8, 'van'), // trap — /æn/
    ],
  },
  {
    id: 'word-song-shorta-C',
    label: 'CVC short-a — opens with hat',
    problems: [
      makeProblem(1, 'hat'), // gentle — Marian read it
      makeProblem(2, 'pan'), // gentle
      makeProblem(3, 'dad'), // gentle — strongest vocabulary
      makeProblem(4, 'bag'), // trap — /æg/
      makeProblem(5, 'tag'), // trap — /æg/
      makeProblem(6, 'fan'), // trap — /æn/
      makeProblem(7, 'man'), // trap — /æn/
      makeProblem(8, 'cat'), // trap — /æt/
    ],
  },
]

/**
 * Pick a static Word Song plan deterministically from the rotation.
 *
 * Two sessions started in the same minute see the same plan; consecutive
 * minutes advance one slot. Tests pass `now` to pin the choice.
 *
 * Note on rotation offset: we offset by +1 modulo length so a session
 * that picks Math plan A gets Word Song plan B (different minute keys
 * because Word Song plans only have 3 entries — same modulo math, but
 * the offset reduces the chance of a "Math plan A + Word Song plan A"
 * lock for the same minute window).
 */
export function pickStaticWordSongPlan(
  now: () => Date = () => new Date(),
): WordSongSessionPlan {
  const minute = Math.floor(now().getTime() / 60_000)
  const idx =
    ((minute % STATIC_WORD_SONG_PLANS.length) + STATIC_WORD_SONG_PLANS.length) %
    STATIC_WORD_SONG_PLANS.length
  return STATIC_WORD_SONG_PLANS[idx]
}

// ── Wire-shape adapters ──────────────────────────────────────────────────

/**
 * Flatten a WordSongSessionPlan into the wire-shape utterance list — one
 * entry per problem × slot, in canonical (problem-major, slot-order)
 * order. Mirrors `mathSessionPlanToUtteranceSources`.
 */
export function wordSongSessionPlanToUtteranceSources(
  plan: WordSongSessionPlan,
): WordSongUtteranceSource[] {
  const out: WordSongUtteranceSource[] = []
  for (const problem of plan.problems) {
    for (const slot of ALL_SLOTS) {
      out.push({
        id: wordSongUtteranceId(problem.index, slot),
        text: problem.utterances[slot],
      })
    }
  }
  return out
}

/**
 * Rehydrate a WordSongSessionPlan from its skeleton + the server's
 * returned `Utterance[]`. Same rules as
 * `mathSessionPlanFromWire`: every problem × slot must be present;
 * server text wins over skeleton text (server is source of truth for
 * SSML normalization tweaks).
 *
 * @throws if any expected utterance id is missing.
 */
export function wordSongSessionPlanFromWire(
  skeleton: WordSongSessionPlan,
  utterances: readonly Utterance[],
): WordSongSessionPlan {
  const byId = new Map<string, Utterance>()
  for (const u of utterances) byId.set(u.id, u)

  const rebuiltProblems: WordSongProblem[] = skeleton.problems.map(
    (problem) => {
      const slotTexts: Partial<WordSongProblemUtterances> = {}
      for (const slot of ALL_SLOTS) {
        const id = wordSongUtteranceId(problem.index, slot)
        const u = byId.get(id)
        if (!u) {
          throw new Error(
            `[wordSessionPlans] wordSongSessionPlanFromWire: missing utterance "${id}" — ` +
              'wire response is incomplete; cannot rehydrate plan.',
          )
        }
        slotTexts[slot] = u.text
      }
      return {
        ...problem,
        utterances: slotTexts as WordSongProblemUtterances,
      }
    },
  )

  return {
    ...skeleton,
    problems: rebuiltProblems,
  }
}

/** Re-export for callers that don't need the wordPack module surface. */
export { TARGET_WORDS }
