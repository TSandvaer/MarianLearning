/**
 * The learners module's state for this JS runtime: the raw store the
 * native host installed, the list in use, and whether that list may be
 * written back (a newer build's list is used in memory only, § 4.3 step 2).
 *
 * A leaf module (types only), so the readers that rebuild a missing doc
 * (`./startDoc.ts`, the 12 fallbacks) can ask who is playing without
 * pulling in the cloud and storage graph.
 */
import type { KeyValueStore } from '../platform/keyValueStore'
import type { LearnerEntry, LearnerList } from './types'

interface LearnersState {
  raw: KeyValueStore
  list: LearnerList
  writable: boolean
}

let state: LearnersState | null = null

export function getLearnersState(): LearnersState | null {
  return state
}

export function setLearnersState(next: LearnersState | null): void {
  state = next
}

/** The list in use, or `null` with none installed (the web, a failed boot). */
export function installedLearnerList(): LearnerList | null {
  return state?.list ?? null
}

/** The learner playing now, or `null` with no list installed (the web). */
export function activeLearner(): LearnerEntry | null {
  const list = state?.list
  if (!list) return null
  return list.learners.find((l) => l.id === list.activeLearnerId) ?? null
}

/** The current entry for `id` (after renames and moves), if listed. */
export function listedLearner(id: string): LearnerEntry | null {
  return state?.list.learners.find((l) => l.id === id) ?? null
}
