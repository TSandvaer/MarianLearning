/**
 * The side mini-games (`design/native/mini-game-flower-bed.md` § 1.1, § 2.1):
 * which are open for a learner, and the content of one round.
 *
 * A game is open in its world when its `opensAt` step is the world's current
 * step or a mastered one, read from the playing learner's progress. Nothing
 * here is persisted: no `Progress` field, no storage key, no migration. A
 * round reads no Leitner state.
 *
 * Dave's guard rails (`design/research/engagement-and-mini-games-2026-10-19.md`
 * § 3): content from current or mastered steps only, short fixed rounds, and
 * the game counts toward nothing.
 */
import { currentStepOf } from '../hub/hubCardModel'
import { CANON_MATH_FACTS } from '../progress/canonMathFacts.generated'
import type { MasteryTrack } from '../progress/mastery'
import type { Progress, SkillNode } from '../progress/types'
import {
  MISSING_NUMBER_RANGES,
  MISSING_NUMBER_SLOTS,
} from '../wire/missingNumbers'

/** B adds `'mirror-bugs'`, C `'robot-talk'`. */
export type GameId = 'flower-bed'

export interface GameInfo {
  world: MasteryTrack
  /** The game opens when this step is current or mastered. */
  opensAt: SkillNode
}

export const GAMES: Readonly<Record<GameId, GameInfo>> = {
  'flower-bed': { world: 'math', opensAt: 'add-to-10' },
}

/** The world's open games, in `GAMES` order; `null` progress gives `[]`. */
export function openGames(
  progress: Progress | null,
  world: MasteryTrack,
): GameId[] {
  if (progress === null) return []
  return (Object.keys(GAMES) as GameId[]).filter((id) => {
    const game = GAMES[id]
    if (game.world !== world) return false
    return (
      progress.skillLevels[game.opensAt] === 'mastered' ||
      currentStepOf(progress, world) === game.opensAt
    )
  })
}

/** One bed: `given` flowers already in it, `missing` empty slots to ten. */
export interface FlowerBedBed {
  given: number
  missing: number
}

/** Beds per round (§ 1.5: inside the concept's 4-6 and Dave's 6-10 moves). */
export const FLOWER_BED_COUNT = 6

const BED_TOTAL = 10

/**
 * The givens of adding to ten's canon missing numbers (P4, P6, P8: 7 + 3,
 * 6 + 4, 8 + 2). Every round holds them, so the game echoes the lesson.
 */
const CANON_GIVENS: readonly number[] = MISSING_NUMBER_SLOTS.map(
  (slot) => CANON_MATH_FACTS['add-to-10'][slot - 1],
).flatMap((fact) =>
  fact !== null && fact.a + fact.b === BED_TOTAL ? [fact.a] : [],
)

/** Every other given that adding to ten's bonds allow (1-9, missing 1-9). */
const OTHER_GIVENS: readonly number[] = (() => {
  const r = MISSING_NUMBER_RANGES['add-to-10']
  const out: number[] = []
  for (let g = r.givenMin; g <= r.givenMax; g++) {
    const m = BED_TOTAL - g
    if (m >= r.missingMin && m <= r.missingMax && !CANON_GIVENS.includes(g)) {
      out.push(g)
    }
  }
  return out
})()

/** Fisher-Yates over a copy, with `rng`. */
function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * One round (§ 2.1): the three canon givens plus 3 of the others, picked and
 * then shuffled with `rng`; no given twice. App passes `Math.random`, tests a
 * seeded generator.
 */
export function flowerBedRound(rng: () => number): FlowerBedBed[] {
  const extra = shuffled(OTHER_GIVENS, rng).slice(
    0,
    FLOWER_BED_COUNT - CANON_GIVENS.length,
  )
  return shuffled([...CANON_GIVENS, ...extra], rng).map((given) => ({
    given,
    missing: BED_TOTAL - given,
  }))
}
