/**
 * The story word-tap cue's timeline and motion (Kyle's call on PR #599):
 * WordSong runs the clock and the fire from these; `./StoryTapCue.tsx`
 * draws the hand. t = 0 is the reading beat's start.
 */
import { ICON_SIZE } from '../greet/WakeNudgeIcon'

/** The reading beat's start → the hand mounts. */
export const STORY_TAP_CUE_DELAY_MS = 600
export const STORY_TAP_CUE_IN_MS = 300
export const STORY_TAP_CUE_PRESS_MS = 100
export const STORY_TAP_CUE_RELEASE_MS = 150
/** The fire → the fade-out. */
export const STORY_TAP_CUE_HOLD_MS = 1_000
export const STORY_TAP_CUE_OUT_MS = 400
/** Her tap → the hand is gone. */
export const STORY_TAP_CUE_CANCEL_OUT_MS = 200
/** The mount → the fire (word 0 plays through the tap path). */
export const STORY_TAP_CUE_FIRE_MS =
  STORY_TAP_CUE_IN_MS + STORY_TAP_CUE_PRESS_MS
/** The mount → the unmount. */
export const STORY_TAP_CUE_TOTAL_MS =
  STORY_TAP_CUE_FIRE_MS + STORY_TAP_CUE_HOLD_MS + STORY_TAP_CUE_OUT_MS
/** The hand mounts this far below its point and rises to it. */
export const STORY_TAP_CUE_RISE = 8
/** The fingertip in the hand's box, as fractions of its size. */
export const STORY_TAP_CUE_TIP = { x: 0.5, y: 0.28 }
const PHONE_SIZE = 48

/** Size S: 48 pt on phones, Greet's 64 on a tablet. */
export function storyTapCueSize(tablet: boolean): number {
  return tablet ? ICON_SIZE : PHONE_SIZE
}

/** Full motion rises and presses; Reduce Motion keeps the fades only. */
export function storyTapCueMotion(reducedMotion: boolean): {
  riseFrom: number
  press: boolean
} {
  return reducedMotion
    ? { riseFrom: 0, press: false }
    : { riseFrom: STORY_TAP_CUE_RISE, press: true }
}
