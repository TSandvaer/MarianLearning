/**
 * Hub card model — the data behind one world's clay Hub card (Redesign
 * R2, ClickUp 123jpnbc68z): the current step, the padlocked next step,
 * the land, and the seed holes. The full all-steps overview lives on the
 * map, not the Hub (quality bar 9), so this model carries no bead row.
 *
 * Pure. Every per-step fact comes from `nodeProgress()` so the card
 * cannot drift from the mastery rule; this module never reads raw
 * mastery history. The current-step rule (first not-mastered step in
 * tree order; last step when all mastered) is
 * `design/emmas-path/emmas-path-spec.md` §1.
 */

import {
  LITERACY_TREE,
  MATH_TREE,
  defaultProgress,
  getSettings,
  type LetterSoundsVowel,
  type MasteryTrack,
  type Progress,
  type SkillNode,
} from '../progress'
import { landOf } from '../progress/lands'
import { nodeProgress } from '../progress/nodeProgress'
import { goodDayKeysFromHistory } from '../progress/mastery'
import { landArtId, type LandArtId } from '../emmasPath/pathArt'
import { todayKey } from '../progress/clock'

/**
 * One flower slot (Guidance G1): `grown` = a good day from an earlier
 * day, `sleeping` = the good day earned today (closed bud + moon + "z"
 * until tomorrow), `empty` = still to come.
 */
export type FlowerSlot = 'grown' | 'sleeping' | 'empty'

export interface HubCardModel {
  world: MasteryTrack
  /** `landOf(current).number`. */
  landNumber: number
  /** Clay emblem of the current step's land. */
  landArt: LandArtId
  /** `getSettings(p).showLevelToMarian` — gates the land pill only. */
  showLandNumber: boolean
  current: SkillNode
  /** `nodeProgress(p, current).unlocksNext` — null on a tree's last step. */
  unlocksNext: SkillNode | null
  /**
   * Flower slots, one per required good day, oldest first. Letter sounds
   * with per-vowel tracking shows the vowel being worked on (the first
   * not-yet-full vowel), so the Hub keeps one row of 3 instead of the
   * spec's 12 per-vowel buds (redesign README).
   */
  slots: FlowerSlot[]
  /**
   * The local day key (`YYYY-MM-DD`) behind each `grown` slot, same
   * index as `slots`; null for sleeping / empty slots and when the
   * parent has switched off the separate-days rule. Drives the morning
   * wake-up (`hubGuidance.ts`).
   */
  slotDays: (string | null)[]
  /** The current step already banked today's good day (a sleeping flower). */
  earnedToday: boolean
  /** Good days still needed before the next step opens; 0 when complete. */
  flowersToUnlock: number
  /** True when every step of the world is mastered. */
  complete: boolean
}

function treeOf(world: MasteryTrack): readonly SkillNode[] {
  return world === 'math' ? MATH_TREE : LITERACY_TREE
}

export function currentStepOf(
  progress: Progress,
  world: MasteryTrack,
): SkillNode {
  const tree = treeOf(world)
  const first = tree.find((node) => progress.skillLevels[node] !== 'mastered')
  return first ?? tree[tree.length - 1]!
}

/**
 * The distinct local day keys on which the step (or letter-sounds vowel)
 * banked a good day: `progress.goodDays` unioned with the qualifying
 * history days — the same two sources `goodDayCount` counts, keyed by
 * the mastery rule's own local-day logic. Sorted ascending.
 */
function goodDayKeysOf(
  p: Progress,
  world: MasteryTrack,
  node: SkillNode,
  vowel: LetterSoundsVowel | null,
): string[] {
  const percent = getSettings(p).masteryThreshold[world].percent
  const focused = p.history.filter(
    (entry) =>
      entry.skillFocus.includes(node) &&
      (vowel === null || entry.currentTargetVowel === vowel),
  )
  const banked = p.goodDays?.[vowel ?? node] ?? []
  return [
    ...new Set([...banked, ...goodDayKeysFromHistory(focused, percent)]),
  ].sort()
}

/**
 * @param today local day key (`isoDate`) the sleeping check compares
 *   against; defaults to the device clock. Ticket G4 centralises the
 *   clock later.
 */
export function buildHubCardModel(
  progress: Progress | null,
  world: MasteryTrack,
  today: string = todayKey(),
): HubCardModel {
  const p = progress ?? defaultProgress()
  const current = currentStepOf(p, world)
  const cur = nodeProgress(p, current)
  const complete = treeOf(world).every(
    (node) => p.skillLevels[node] === 'mastered',
  )
  const land = landOf(current)

  let good: number
  let required: number
  let vowel: LetterSoundsVowel | null = null
  if (cur.vowels !== undefined && cur.vowels.length > 0) {
    const working =
      cur.vowels.find((v) => v.goodDays < v.requiredDays) ??
      cur.vowels[cur.vowels.length - 1]!
    good = working.goodDays
    required = working.requiredDays
    vowel = working.vowel
  } else {
    good = cur.goodDays
    required = cur.requiredDays
  }
  if (complete) good = required

  // With the separate-days rule switched off (parent setting) there is
  // no "come back tomorrow", so nothing sleeps.
  const days =
    !complete && getSettings(p).crossDayEnforcement && good > 0
      ? goodDayKeysOf(p, world, current, vowel)
      : []
  const earnedToday = days.includes(today)

  const slots: FlowerSlot[] = Array.from({ length: required }, (_, i) =>
    i >= good ? 'empty' : earnedToday && i === good - 1 ? 'sleeping' : 'grown',
  )
  const pastDays = days.filter((d) => d < today)
  const slotDays = slots.map((slot, i) =>
    slot === 'grown' ? (pastDays[i] ?? null) : null,
  )

  return {
    world,
    landNumber: land.number,
    landArt: landArtId(land),
    showLandNumber: getSettings(p).showLevelToMarian,
    current,
    unlocksNext: complete ? null : cur.unlocksNext,
    slots,
    slotDays,
    earnedToday,
    flowersToUnlock: complete ? 0 : Math.max(0, required - good),
    complete,
  }
}
