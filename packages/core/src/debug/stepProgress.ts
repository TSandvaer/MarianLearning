/**
 * Debug "jump to any step": the progress a child would have on arriving
 * at one step of a world, and the write that puts a device there.
 *
 * Two hosts use it, both behind the debug gate that guards the seeds in
 * `./seeds.ts` (this module checks no gate itself):
 *
 *   - the native `-qaStep <node>` launch argument / `EXPO_PUBLIC_QA_STEP`
 *     (`mobile/src/platform/launchFlags.ts`), applied at boot where the
 *     seeds are, and
 *   - the native QA step picker at the bottom of Parent Settings.
 *
 * `progressAtStep(node)` is pure and starts from Marian's defaults
 * (`defaultProgress()`). In `node`'s world, every earlier step is
 * mastered, `node` is open at `'intro'` and every later step is locked.
 * `'intro'` is the level the mastery rule gives a step when the step
 * before it masters (`applyMasteryRule`'s unlock), so a jump is
 * indistinguishable from arriving there by play. That includes the
 * first-encounter cues that key on `'intro'` (the digraphs-th mouth
 * cue). The other world keeps its defaults.
 *
 * Per-step detail the gates read, beyond `skillLevels`:
 *
 *   - letter-sounds per-vowel mastery: for a step after `letter-sounds`
 *     all four short vowels are `'mastered'` (the composite only masters
 *     once all four have). At `letter-sounds` and before, they keep
 *     their default `'intro'`.
 *   - cvc-words graduation: a mastered `cvc-words` needs nothing more
 *     (the novel-word check only gates a `'practicing'` cvc-words). The
 *     CVC graduation-review latch stays `false`: a forward learner has
 *     not fired it yet, and the picker only consults it once the whole
 *     Word Song tree is mastered (`focusNode.ts`).
 *   - cross-vowel mixing: its prerequisite is the three CVC tiers
 *     mastered, which the earlier-steps rule already gives.
 *   - first encounters: the earlier Word Song steps are listed as met
 *     (she played them); `node` is not, so its first-encounter
 *     scaffolding fires.
 *
 * History, good days, the Leitner box and the unlock seen-marker start
 * empty, as in the defaults: no flower is banked on the new step, and
 * no unlock is waiting to be celebrated (an absent seen-marker means
 * "nothing pending", `pathBeats.ts`).
 *
 * `writeStepProgress()` is the write both hosts share. It stamps
 * `profile.lastPlayedISO` with the progress clock so the jump is this
 * device's newest progress: with the progress secret set, the next
 * launch reconcile pushes it, like any session's progress
 * (`cloudSync.ts` is last-write-wins on that stamp; unstamped, an older
 * cloud blob would win and undo the jump). It also clears today's part
 * of the session history and makes sure Splash routes to the Hub. The
 * device ID is a separate key and is never touched.
 */

import {
  capitalizeSpokenName,
  STAGE_SPOKEN_NAMES,
} from '../sessionEnd/friendlyNodeName'
import {
  readSessionHistory,
  writeSessionHistory,
  type SessionHistoryV2,
} from '../sessionEnd/sessionHistory'
import {
  LETTER_SOUNDS_VOWELS,
  LITERACY_TREE,
  MATH_TREE,
  defaultProgress,
  saveProgress,
  type MasteryTrack,
  type Progress,
  type SkillNode,
  type WordSongNode,
} from '../progress'
import { now as progressNow } from '../progress/clock'
import { landOf } from '../progress/lands'
import { trackOf } from '../progress/mastery'

/** One row of the step picker. */
export interface QaStep {
  node: SkillNode
  world: MasteryTrack
  /** 1-based position in its world's tree. */
  position: number
  /** The step's spoken name, sentence case ("Dog words"). */
  name: string
  /** 1-based land number (the level shown to Marian). */
  land: number
}

function treeOf(world: MasteryTrack): readonly SkillNode[] {
  return world === 'math' ? MATH_TREE : LITERACY_TREE
}

function stepsOf(world: MasteryTrack): QaStep[] {
  return treeOf(world).map((node, i) => ({
    node,
    world,
    position: i + 1,
    name: capitalizeSpokenName(STAGE_SPOKEN_NAMES[node]),
    land: landOf(node).number,
  }))
}

/** Every step of both worlds: Number Garden, then Word Song, in tree order. */
export const QA_STEPS: readonly QaStep[] = [
  ...stepsOf('math'),
  ...stepsOf('word-song'),
]

/** True when `value` is a step of either tree. */
export function isStepNode(value: string): value is SkillNode {
  return trackOf(value as SkillNode) !== null
}

/** The progress of a child who has just arrived at `node`. Pure. */
export function progressAtStep(node: SkillNode): Progress {
  const world = trackOf(node)
  if (world === null) {
    throw new Error(`progressAtStep: '${node}' is not a step of either tree`)
  }
  const base = defaultProgress()
  const tree = treeOf(world)
  const at = tree.indexOf(node)

  const skillLevels = { ...base.skillLevels }
  tree.forEach((step, i) => {
    skillLevels[step] = i < at ? 'mastered' : i === at ? 'intro' : 'locked'
  })
  const out: Progress = { ...base, skillLevels }

  if (world === 'word-song') {
    const pastLetterSounds = at > LITERACY_TREE.indexOf('letter-sounds')
    if (pastLetterSounds) {
      const states = { ...base.literacy!.letterSoundsVowelStates! }
      for (const vowel of LETTER_SOUNDS_VOWELS) states[vowel] = 'mastered'
      out.literacy = { ...base.literacy, letterSoundsVowelStates: states }
    }
    out.lifetimeFirstEncounters = LITERACY_TREE.slice(0, at) as WordSongNode[]
  }
  return out
}

/**
 * Save `progress` as a jump: stamped as this device's newest progress,
 * today's session history cleared and Splash routed to the Hub. The
 * device ID is left alone.
 */
export function writeStepProgress(progress: Progress): void {
  const now = progressNow()
  saveProgress({
    ...progress,
    profile: { ...progress.profile, lastPlayedISO: now.toISOString() },
  })
  const prev = readSessionHistory()
  const next: SessionHistoryV2 = {
    ...prev,
    // A returning child: Splash goes to the Hub, not Greet.
    sessionCount: Math.max(prev.sessionCount, 1),
    todayTreesTouched: { date: '', trees: [] },
    lastSuggestion: null,
    consecutiveOverrides: 0,
    suggestionCooldownUntil: null,
  }
  writeSessionHistory(next)
}

/** Put this device on `node` (the picker's jump, the `qaStep` flag). */
export function jumpToStep(node: SkillNode): void {
  writeStepProgress(progressAtStep(node))
}

/** The picker's "Back to Marian's real start": `defaultProgress()`. */
export function jumpToRealStart(): void {
  writeStepProgress(defaultProgress())
}

/**
 * The `qaStep` launch flag's value, applied: `true` when it named a step,
 * `false` (with a warning listing the steps, and nothing written) when
 * it did not. The host has already checked its debug gate.
 */
export function applyQaStep(value: string): boolean {
  if (!isStepNode(value)) {
    console.warn(
      `[qaStep] Unknown step: "${value}". Steps: ${QA_STEPS.map((s) => s.node).join(', ')}`,
    )
    return false
  }
  jumpToStep(value)
  return true
}
