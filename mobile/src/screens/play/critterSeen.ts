/**
 * Letter Critters' one write: a word Emma says (a picture word's clip or a
 * said word's line) goes into the playing learner's seen-record (core
 * `withWordsMet`, a `word:` key). The cvc-words check's probe reserve ranks
 * by it, so a word she met here is no longer a fresh probe (Dave
 * 2026-10-24, `design/research/no-claude-variety-2026-10-23.md` § 2.4).
 *
 * Local only: the game makes no network call, and the next session end
 * backs the doc up to the cloud with everything else. No doc (no learner
 * yet) or a storage failure writes nothing; play never waits on it.
 */
import { loadProgress, saveProgress, withWordsMet } from '@marian/core/progress'
import { nowMs } from '@marian/core/progress/clock'

export function recordCritterWord(word: string): void {
  try {
    const progress = loadProgress()
    if (progress === null) return
    saveProgress(withWordsMet(progress, [word], nowMs()))
  } catch (err) {
    console.warn('[Critters] could not save the word she met:', err)
  }
}
