/**
 * One Hub visit, decided once on mount: the two cards, the glowing world,
 * the morning wake-up and Emma's lines. The same composition, in the same
 * order, as the web Hub's mount (`src/screens/Hub/Hub.tsx`: `today` on the
 * progress clock, `buildHubCardModel` per world, `flowerWakeFor` over the
 * stored wake record, `computeSuggestion` over today's session history,
 * `pickGuidanceLines` unless a rapid remount suppresses them). The native
 * Hub calls this; the web keeps its hooks and is checked against it
 * (`src/screens/Hub/hubVisitParity.test.tsx`).
 */

import type { Progress } from '../progress'
import { isoDate, type SessionHistoryV2 } from '../sessionEnd/sessionHistory'
import { buildHubCardModel, type HubCardModel } from './hubCardModel'
import {
  flowerWakeFor,
  pickGuidanceLines,
  type FlowerWake,
  type FlowerWakeRecord,
  type GuidanceLineId,
} from './hubGuidance'
import { computeSuggestion, type SuggestionTarget } from './hubSuggestion'

export interface HubVisitInput {
  /** The Progress doc (null = none stored yet). */
  progress: Progress | null
  /** Today's session history (`readSessionHistoryForToday`). */
  history: SessionHistoryV2
  /** The progress clock's now, read once for the visit. */
  now: Date
  /** The stored wake record (`readFlowerWake`). */
  seenWake: FlowerWakeRecord
  /** A return within 30 s: Emma stays quiet. */
  suppressed: boolean
}

export interface HubVisit {
  /** Local day key the visit is fixed to. */
  today: string
  numberGarden: HubCardModel
  wordSong: HubCardModel
  /** The glowing world, or null when both have today's flower. */
  suggestion: SuggestionTarget
  /** Flowers that wake this visit; `wake.next` is the record to store. */
  wake: FlowerWake
  /** Emma's lines, in order (empty when suppressed or nothing to say). */
  lines: GuidanceLineId[]
}

export function planHubVisit(input: HubVisitInput): HubVisit {
  const today = isoDate(input.now)
  const numberGarden = buildHubCardModel(input.progress, 'math', today)
  const wordSong = buildHubCardModel(input.progress, 'word-song', today)
  const wake = flowerWakeFor([numberGarden, wordSong], input.seenWake)
  const suggestion = computeSuggestion(input.history, input.now, input.progress)
  const lines = input.suppressed
    ? []
    : pickGuidanceLines({
        numberGarden,
        wordSong,
        suggestion,
        wakeWorlds: wake.wakeWorlds,
      })
  return { today, numberGarden, wordSong, suggestion, wake, lines }
}
