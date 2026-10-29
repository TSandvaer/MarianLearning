/**
 * Letter critters' visit (critters-four-letter.md § 5.3, `critters-word-hunt.md`
 * § 6.4): what one visit to the game shares across its rounds, and the
 * learner's gate, read once a visit. Never saved.
 */
import {
  huntDigraphs,
  huntProbeGuard,
  huntVowels,
  type HuntLength,
} from '@marian/core/games/critterHunt'
import {
  critterFunnyOpen,
  type HuntDigraph,
} from '@marian/core/games/playPlace'
import { loadProgress } from '@marian/core/progress'

/**
 * A visit: the lengths entered (each length's open line plays on its first
 * entry only, Decision 6), the words praised, whether she has made a full
 * run (the drag hint retires), and Emma's lines with the drag hint.
 */
export interface CrittersVisit {
  /** Marks `length` entered; true on its first entry this visit. */
  enter: (length: HuntLength) => boolean
  isPraised: (word: string) => boolean
  praise: (word: string) => void
  hasRun: () => boolean
  run: () => void
  hintLines: () => number
  hintLine: () => void
}

export function newCrittersVisit(): CrittersVisit {
  const opened = new Set<HuntLength>()
  const praised = new Set<string>()
  let ran = false
  let lines = 0
  return {
    enter: (length) => {
      const first = !opened.has(length)
      opened.add(length)
      return first
    },
    isPraised: (word) => praised.has(word),
    praise: (word) => {
      praised.add(word)
    },
    hasRun: () => ran,
    run: () => {
      ran = true
    },
    hintLines: () => lines,
    hintLine: () => {
      lines += 1
    },
  }
}

export interface CrittersGate {
  /** A non-word boings (blending sounds is current or mastered). */
  funny: boolean
  /**
   * The word hunt's vowels, probe guard and open digraph critters
   * (critters digraph § 7), or null: the free meadow.
   */
  hunt: {
    vowels: string[]
    probeGuard: boolean
    digraphs: HuntDigraph[]
  } | null
}

/**
 * The playing learner's gate, read once a visit (Dave's safeguard; the
 * hunt's gate is the same, critters-word-hunt.md § 8). Unreadable: quiet,
 * the free meadow. `hunt` forces the hunt on or off (a test seam).
 */
export function readCrittersGate(hunt?: boolean): CrittersGate {
  let gate: CrittersGate = { funny: false, hunt: null }
  try {
    const progress = loadProgress()
    const funny = critterFunnyOpen(progress)
    gate = {
      funny,
      hunt: funny
        ? {
            vowels: huntVowels(progress),
            probeGuard: huntProbeGuard(progress),
            digraphs: huntDigraphs(progress),
          }
        : null,
    }
  } catch {
    // Quiet, the free meadow.
  }
  if (hunt === false) return { ...gate, hunt: null }
  if (hunt === true && gate.hunt === null) {
    return {
      ...gate,
      hunt: { vowels: ['a'], probeGuard: false, digraphs: [] },
    }
  }
  return gate
}
