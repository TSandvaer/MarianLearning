/**
 * The cvc-words probe reserve's picker (Dave 2026-10-24, run
 * run_3d3d82fb3b65 messages msg_135871ebd91e and msg_cb57033a73c9;
 * `design/research/no-claude-variety-2026-10-23.md` § 2.4). A check
 * attempt is 6 probe words across two consecutive sessions, 3 each beside 5
 * practised words, passed at 5 of 6 first-tap-right words
 * (`NOVEL_POOL_THRESHOLD`, 5/6 = 83%).
 *
 * At the start of each attempt the picker chooses its 6 words once
 * ({@link chooseCheckWords}): the first session serves the first 3, and its
 * part record keeps the other 3 for the second (`NovelPoolPart.next`). The
 * reserve has 8 words, so an attempt can always be built: no wait rule, no
 * smaller check, no promotion without a passing check. Pure: no storage,
 * no clock.
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

/** Probe words in one check attempt, across its two sessions (Dave § 2.4). */
export const GRADUATION_CHECK_WORDS = 6

/**
 * A reserve word's standing for one learner, from her seen-record: never
 * met, met only in Letter Critters, or her most recent check result on it.
 */
export type ProbeStanding = 'new' | 'met' | 'right' | 'missed'

/** `seen`'s standing for `word`; a check value this build does not know is `'met'`. */
export function probeStanding(seen: SeenItems, word: string): ProbeStanding {
  const record = seen[wordSeenKey(word)]
  if (record === undefined) return 'new'
  if (record.check === 'missed') return 'missed'
  if (record.check === 'right') return 'right'
  return 'met'
}

const TIER: Record<ProbeStanding, number> = {
  new: 1,
  met: 2,
  right: 3,
  missed: 4,
}

/**
 * THE RULE (Dave 2026-10-24, msg_cb57033a73c9): a check attempt's 6 probe
 * words from the 8-word reserve, taken in this order until there are 6:
 *
 * 1. never met;
 * 2. met only in Letter Critters;
 * 3. most recent check result right;
 * 4. most recent check result missed, the oldest most-recent miss first
 *    (its `checkDay`).
 *
 * Ties within a tier keep reserve order (map, nap, rat, ham, cab, rag, ram,
 * pad). Tier 4 is reached only when tiers 1-3 hold fewer than 6 words.
 */
export function chooseCheckWords(seen: SeenItems): string[] {
  return PROBE_RESERVE_WORDS.map((word, i) => ({
    word,
    i,
    tier: TIER[probeStanding(seen, word)],
    missDay: seen[wordSeenKey(word)]?.checkDay ?? '',
  }))
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        (a.tier === TIER.missed ? a.missDay.localeCompare(b.missDay) : 0) ||
        a.i - b.i,
    )
    .slice(0, GRADUATION_CHECK_WORDS)
    .map((w) => w.word)
}

/**
 * The probe words of `node`'s next reserve-check session. A new attempt:
 * the first 3 of {@link chooseCheckWords}. Its second session (the node's
 * last entry holds the first's part record): the 3 the attempt chose with
 * them (`next`), or, for a part record without them, the first 3 of a
 * fresh choice that the first session did not show.
 */
export function reserveCheckWords(
  progress: Progress,
  node: SkillNode,
): string[] {
  const perSession = GRADUATION_PROBE_PROBLEMS.length
  const first = graduationCheckFirstHalf(progress, node)
  if (first?.next !== undefined && first.next.length === perSession) {
    return [...first.next]
  }
  const shown = first?.words ?? []
  return chooseCheckWords(seenItemsOf(progress))
    .filter((w) => !shown.includes(w))
    .slice(0, perSession)
}

/**
 * The 3 words a reserve check attempt that showed `shown` in its first
 * session leaves for the second: the attempt's choice (`chooseCheckWords`
 * on the seen-record its first session started from) minus `shown`.
 */
export function remainingCheckWords(
  seen: SeenItems,
  shown: readonly string[],
): string[] {
  return chooseCheckWords(seen)
    .filter((w) => !shown.includes(w))
    .slice(0, GRADUATION_CHECK_WORDS - shown.length)
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
  if (
    words.length !== GRADUATION_PROBE_PROBLEMS.length ||
    !words.every((w) => rendered.has(w))
  ) {
    return undefined
  }
  return words
}
