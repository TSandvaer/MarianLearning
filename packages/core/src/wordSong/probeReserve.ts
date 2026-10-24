/**
 * The cvc-words probe reserve's picker (Dave 2026-10-24, run
 * run_3d3d82fb3b65 message msg_135871ebd91e;
 * `design/research/no-claude-variety-2026-10-23.md` § 2.4). A check is 6
 * probe words across two consecutive sessions, 3 each beside 5 practised
 * words, and passes at 5 of 6 (`NOVEL_POOL_THRESHOLD`, 5/6 = 83%).
 *
 * Per learner, from her seen-record (`progress/seenItems.ts`, `word:` keys):
 *
 * 1. never met, first;
 * 2. then met only in Letter Critters;
 * 3. then read right in an earlier check;
 * 4. never a word she missed in a check (Emma read it to her with
 *    giveAnswer and blend), while 6 others remain. With fewer, missed words
 *    come back (`readmitMissedWords`), so a check is always 6 words and
 *    never leaves her on cat words for good (coordinator 2026-10-24; Dave
 *    asked for a ruling).
 *
 * Ties keep Dave's order (`PROBE_RESERVE_WORDS`). A first check takes the
 * best 6 and serves the first 3; its second session serves the best 3 of
 * the rest (`mastery.ts` `graduationCheckFirstHalf` names the first 3). A
 * retake after a check with 2 misses is 2 fresh words plus 4 she read
 * right. Pure: no storage, no clock.
 */
import { graduationCheckFirstHalf } from '../progress/mastery'
import { seenItemsOf, wordSeenKey } from '../progress/seenItems'
import type { Progress, SeenItems, SkillNode } from '../progress/types'
import {
  GRADUATION_PROBE_PROBLEMS,
  graduationAttempts,
  graduationProbeWords,
} from './graduationCheck'
import { PROBE_RESERVE_WORDS } from './novelProbeWords'

/** Probe words in one check, across its two sessions (Dave § 2.4). */
export const GRADUATION_CHECK_WORDS = 6

/** A reserve word's standing for one learner. */
export type ProbeStanding = 'new' | 'met' | 'right' | 'missed'

/** `seen`'s standing for `word`; a check value this build does not know is `'met'`. */
export function probeStanding(seen: SeenItems, word: string): ProbeStanding {
  const record = seen[wordSeenKey(word)]
  if (record === undefined) return 'new'
  if (record.check === 'missed') return 'missed'
  if (record.check === 'right') return 'right'
  return 'met'
}

const RANK: Record<Exclude<ProbeStanding, 'missed'>, number> = {
  new: 0,
  met: 1,
  right: 2,
}

/** `words` best first by standing, missed words left out; ties keep order. */
function rankWords(words: readonly string[], seen: SeenItems): string[] {
  return words
    .map((word, i) => ({ word, i, standing: probeStanding(seen, word) }))
    .filter(
      (w): w is typeof w & { standing: keyof typeof RANK } =>
        w.standing !== 'missed',
    )
    .sort((a, b) => RANK[a.standing] - RANK[b.standing] || a.i - b.i)
    .map((w) => w.word)
}

/** The whole reserve, best first, for this learner (missed words left out). */
export function rankProbeReserve(seen: SeenItems): string[] {
  return rankWords(PROBE_RESERVE_WORDS, seen)
}

/**
 * THE RULE for a reserve that runs short (coordinator 2026-10-24, pending
 * Dave's ruling; change it here): when `ranked` holds fewer than `need`
 * words, the missed words of `candidates` come back after it, the one she
 * met longest ago first (its seen-record day; ties keep order), until
 * there are `need`. Otherwise `ranked` as it is.
 */
export function readmitMissedWords(
  ranked: readonly string[],
  candidates: readonly string[],
  seen: SeenItems,
  need: number,
): string[] {
  if (ranked.length >= need) return [...ranked]
  const missed = candidates
    .map((word, i) => ({ word, i, day: seen[wordSeenKey(word)]?.day ?? '' }))
    .filter((w) => probeStanding(seen, w.word) === 'missed')
    .sort((a, b) => a.day.localeCompare(b.day) || a.i - b.i)
    .map((w) => w.word)
  return [...ranked, ...missed.slice(0, need - ranked.length)]
}

/**
 * The probe words of `node`'s next reserve-check session, or `null` when
 * the reserve cannot fill it. The first session draws the best
 * {@link GRADUATION_CHECK_WORDS} and serves the first 3; the second (the
 * node's last entry holds the first's part record) serves the best 3 of
 * the words the first did not show.
 */
export function reserveCheckWords(
  progress: Progress,
  node: SkillNode,
): string[] | null {
  const seen = seenItemsOf(progress)
  const shown = graduationCheckFirstHalf(progress, node)?.words ?? []
  const candidates = PROBE_RESERVE_WORDS.filter((w) => !shown.includes(w))
  const need = GRADUATION_CHECK_WORDS - shown.length
  const pool = readmitMissedWords(
    rankWords(candidates, seen),
    candidates,
    seen,
    need,
  )
  const perSession = GRADUATION_PROBE_PROBLEMS.length
  if (pool.length < need || pool.length < perSession) return null
  return pool.slice(0, perSession)
}

/**
 * Whether the device serves the reserve check: every reserve word's five
 * lines have audio in the bundled probe canon (`rendered`, core
 * `renderedProbeWords`). Until then it keeps today's check.
 */
export function reserveCheckReady(rendered: ReadonlySet<string>): boolean {
  return PROBE_RESERVE_WORDS.every((w) => rendered.has(w))
}

/**
 * The probe words of a due check on `node`, or `undefined` (no check: the
 * session plays its canon plan). The reserve check's words once
 * {@link reserveCheckReady}, else today's (`graduationProbeWords`, 3 of
 * `NOVEL_PROBE_WORDS` by attempt). Never a word without audio: a pick with
 * an unrendered word is no check.
 */
export function graduationCheckWords(
  progress: Progress,
  node: SkillNode,
  rendered: ReadonlySet<string>,
): string[] | undefined {
  const words = reserveCheckReady(rendered)
    ? reserveCheckWords(progress, node)
    : graduationProbeWords(graduationAttempts(progress, node))
  if (words === null || !words.every((w) => rendered.has(w))) return undefined
  return words
}
