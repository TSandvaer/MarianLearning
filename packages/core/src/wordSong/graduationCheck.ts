/**
 * The cvc-words graduation check, built in the app (Thomas 2026-10-23, "App
 * builds the check itself"). A check used to be the live planner's job: the
 * session start sent `isGraduationSession`, the server skipped canon, and
 * Haiku mixed 2–3 novel probe words into the plan. That run takes ~15 s, so
 * the 5 s visible-wait fallback re-requested without the hint and served
 * canon, and the check never ran (build 20).
 *
 * Now the app asks for the plain cvc-words plan (canon, fast) and swaps
 * {@link GRADUATION_PROBE_PROBLEMS} of its problems for probe-word blocks
 * from the bundled probe canon (`public/canon/word-song/level-1/
 * cvc-words-probe.json`, cvc-words' own slot texts). The swap happens on
 * the server-plan wire shape, so a probe problem goes through the same
 * parser as a canon one (`wordSongSessionPlanFromServer`), and its chips
 * are dealt from `TARGET_PAIRINGS` by position like any other target.
 * Session End's split (`computeGraduationSplit`) then scores the
 * probe words apart.
 *
 * Two checks share this swap. Today's: 3 of `NOVEL_PROBE_WORDS` in one
 * session ({@link graduationProbeWords}). The reserve's (Dave 2026-10-24,
 * `probeReserve.ts`): 6 of `PROBE_RESERVE_WORDS` across two sessions. The
 * device serves the reserve's only once every reserve word's lines have
 * their audio in the bundled probe canon ({@link renderedProbeWords}).
 */
import type { Progress, SkillNode } from '../progress/types'
import { GRADUATION_PROBE_WORDS, NOVEL_PROBE_WORDS } from './novelProbeWords'
import {
  isServerPlan,
  parseReadTarget,
  type ServerPlan,
} from './planFromServer'

/**
 * The problems a check swaps for probe words: the planner directive's upper
 * bound of 3 ("mix 2 or 3 problems", `api/_planner.ts`
 * `buildGraduationDirective`), spread rather than clustered at the end, as
 * the directive asks. Problem 2 deals gentle chips, 5 and 7 trap chips.
 */
export const GRADUATION_PROBE_PROBLEMS: readonly number[] = [2, 5, 7]

/** The slots a probe block replaces; the reprompt stays the session's. */
const PROBE_SLOTS = ['read', 'correct', 'hint', 'giveAnswer', 'blend']

const PROBLEM_ID = /^word\.p(\d+)\.([A-Za-z]+)$/

/**
 * The words of a check: three of `NOVEL_PROBE_WORDS`, starting at the
 * `attempt`-th, so a re-check after a miss does not repeat the same three.
 */
export function graduationProbeWords(attempt: number): string[] {
  const n = NOVEL_PROBE_WORDS.length
  return GRADUATION_PROBE_PROBLEMS.map(
    (_, i) => NOVEL_PROBE_WORDS[(attempt + i) % n]!,
  )
}

/** How many checks `node` has had: its entries with a novel-pool score. */
export function graduationAttempts(
  progress: Progress,
  node: SkillNode,
): number {
  return progress.history.filter(
    (e) => e.skillFocus.includes(node) && e.novelPoolSuccessRate !== undefined,
  ).length
}

/** The probe plan's blocks, by the word their read line names. */
function probeBlocks(probePlan: ServerPlan): Map<string, Map<string, string>> {
  const byProblem = new Map<string, Map<string, string>>()
  for (const u of probePlan.utterances) {
    const m = PROBLEM_ID.exec(u.id)
    if (m === null) continue
    const slots = byProblem.get(m[1]!) ?? new Map<string, string>()
    slots.set(m[2]!, u.text)
    byProblem.set(m[1]!, slots)
  }
  const byWord = new Map<string, Map<string, string>>()
  for (const slots of byProblem.values()) {
    const read = slots.get('read')
    if (read === undefined) continue
    try {
      byWord.set(parseReadTarget(read).word, slots)
    } catch {
      // Not a "Read the <word>." block: not a probe.
    }
  }
  return byWord
}

/**
 * `serverPlan` with {@link GRADUATION_PROBE_PROBLEMS} swapped for the
 * blocks of `words` (in order) from `probePlan`: each problem's read,
 * correct, hint, giveAnswer and blend lines, ids kept. `null` when either
 * plan is malformed, a word has no complete block, or a swapped problem
 * lacks one of those slots; the caller then plays the plan as it is.
 */
export function withGraduationProbes(
  serverPlan: unknown,
  probePlan: unknown,
  words: readonly string[],
): ServerPlan | null {
  if (!isServerPlan(serverPlan) || !isServerPlan(probePlan)) return null
  if (words.length !== GRADUATION_PROBE_PROBLEMS.length) return null
  if (!words.every((w) => GRADUATION_PROBE_WORDS.includes(w))) return null
  const blocks = probeBlocks(probePlan)
  const swaps = new Map<number, Map<string, string>>()
  for (const [i, n] of GRADUATION_PROBE_PROBLEMS.entries()) {
    const block = blocks.get(words[i]!)
    if (block === undefined || !PROBE_SLOTS.every((s) => block.has(s))) {
      return null
    }
    swaps.set(n, block)
  }
  let replaced = 0
  const utterances = serverPlan.utterances.map((u) => {
    const m = PROBLEM_ID.exec(u.id)
    const block = m === null ? undefined : swaps.get(Number(m[1]))
    const text = block?.get(m![2]!)
    if (text === undefined || !PROBE_SLOTS.includes(m![2]!)) return u
    replaced += 1
    return { id: u.id, text }
  })
  if (replaced !== swaps.size * PROBE_SLOTS.length) return null
  return { id: serverPlan.id, label: serverPlan.label, utterances }
}

/**
 * The probe words whose five lines (read, correct, hint, giveAnswer,
 * blend) all have audio in `probeDoc`, the bundled probe canon
 * (`{ plan, utterances: [{ id, text, audio: { base64 } }] }`), each line's
 * audio row matching its plan text. A line still awaiting its Lily render
 * has an empty `base64`
 * (`scripts/spliceGraduationProbeCanon.ts`), so its word is left out.
 * Empty for a malformed doc.
 */
export function renderedProbeWords(probeDoc: unknown): Set<string> {
  const out = new Set<string>()
  if (typeof probeDoc !== 'object' || probeDoc === null) return out
  const { plan, utterances } = probeDoc as {
    plan?: unknown
    utterances?: unknown
  }
  if (!isServerPlan(plan) || !Array.isArray(utterances)) return out
  const audible = new Set<string>()
  for (const u of utterances as unknown[]) {
    const { id, text, audio } = (u ?? {}) as {
      id?: unknown
      text?: unknown
      audio?: { base64?: unknown }
    }
    if (
      typeof id === 'string' &&
      typeof text === 'string' &&
      typeof audio?.base64 === 'string' &&
      audio.base64 !== ''
    ) {
      audible.add(`${id}|${text}`)
    }
  }
  const byProblem = new Map<string, Map<string, { id: string; text: string }>>()
  for (const u of plan.utterances) {
    const m = PROBLEM_ID.exec(u.id)
    if (m === null) continue
    const slots = byProblem.get(m[1]!) ?? new Map()
    slots.set(m[2]!, u)
    byProblem.set(m[1]!, slots)
  }
  for (const slots of byProblem.values()) {
    const read = slots.get('read')
    if (read === undefined) continue
    const heard = (slot: string) => {
      const u = slots.get(slot)
      return u !== undefined && audible.has(`${u.id}|${u.text}`)
    }
    if (!PROBE_SLOTS.every(heard)) continue
    try {
      out.add(parseReadTarget(read.text).word)
    } catch {
      // Not a "Read the <word>." block: not a probe.
    }
  }
  return out
}
