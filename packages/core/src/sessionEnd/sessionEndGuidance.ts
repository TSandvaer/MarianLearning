/**
 * Session-end guidance — Guidance G2 (ClickUp 123jpnbca4t).
 *
 * Reference: `design/emmas-path/redesign/guidance-mockup.html` screens
 * b (good day), e (3rd good day), f (not-yet day), Dave's
 * `design/research/guidance-layer-2026-10-06.md` §1/§4/§5 and quality
 * bar 14 ("the app carries the child"), approved in team/DECISIONS.md
 * "2026-10-06 — Guidance layer approved".
 *
 * Pure: what kind of day the session was, the flower tray before and
 * after, and Emma's lines in order. Every per-step fact comes from
 * `nodeProgress()` and the mastery rule's own day keys, so the tray
 * cannot drift from the rule. Stars are not an input: they are
 * in-session feedback only and never collect into the flower.
 */

import { GUIDANCE_LINES, guidanceLine } from '../emmasPath/guidanceLines'
import {
  getSettings,
  type LetterSoundsVowel,
  type MasteryTrack,
  type Progress,
  type SkillNode,
} from '../progress'
import { goodDayKeysFromHistory, nextNode, trackOf } from '../progress/mastery'
import { nodeProgress } from '../progress/nodeProgress'
import type { SessionEndBeat } from '../progress/pathBeats'

/**
 * `good-day`: a new flower that does not finish the step.
 * `unlock`: the flower that opens the next step (the map plays the unlock).
 * `world-done`: the flower that finishes the world's last step.
 * `not-yet`: under the good-day score and no flower today yet.
 * `practice`: today's flower was already earned (same-day replay), or
 *   the step is already grown.
 */
export type EndDay =
  | 'good-day'
  | 'unlock'
  | 'world-done'
  | 'not-yet'
  | 'practice'

/** `grown` = an earlier day, `sleeping` = earned today, `empty` = to come. */
export type FlowerSlot = 'grown' | 'sleeping' | 'empty'

/** Which beat a line belongs to; drives the screen's phase. */
export type EndBeat = 'praise' | 'flower' | 'count' | 'next'

export type EndLineId = (typeof GUIDANCE_LINES)[number]['id']

export interface EndLine {
  id: EndLineId
  text: string
  /** Bundled MP3 path relative to `public/`; null = caption only. */
  src: string | null
  beat: EndBeat
  /** Clip length in seconds; the beat waits at least this long. */
  seconds: number
}

/**
 * Real clip lengths (ffprobe, PR #512's render run). The sequence waits
 * for each clip to end; these are the floor when a clip ends early or
 * fails to load, so a caption never flashes past.
 */
export const END_CLIP_SECONDS: Readonly<Record<string, number>> = {
  'guide.end.right.7': 3.12,
  'guide.end.right.8': 2.96,
  'guide.end.flower': 1.52,
  'guide.end.count.1': 1.36,
  'guide.end.count.2': 1.36,
  'guide.end.count.3': 1.44,
  'guide.end.sleeps': 3.6,
  'guide.end.path-opens': 2.64,
  'guide.end.not-yet.praise': 2.88,
  'guide.end.not-yet.again': 2.48,
  // PR #514's render run (ffprobe 2.400 s).
  'guide.end.world-done': 2.4,
}

/** Caption-only lines read at ~165 wpm plus a breath. */
function captionSeconds(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.round((words * 60) / 165 + 1)
}

function line(id: string, beat: EndBeat): EndLine | null {
  const g = guidanceLine(id)
  if (g === undefined) return null
  return {
    id: g.id as EndLineId,
    text: g.text,
    src: g.src,
    beat,
    seconds: END_CLIP_SECONDS[g.id] ?? captionSeconds(g.text),
  }
}

export interface SessionEndGuidance {
  day: EndDay
  world: MasteryTrack
  node: SkillNode
  /** The tray as the screen opens. */
  slotsBefore: FlowerSlot[]
  /** The tray once today's flower has landed (same as before without one). */
  slotsAfter: FlowerSlot[]
  /** Slot the new flower flies into; null when no flower today. */
  newSlot: number | null
  /** "2 of 3" / "3 of 3!" once the flower lands; null without one. */
  countText: string | null
  /** Emma's lines, in order. */
  lines: EndLine[]
}

export interface SessionEndGuidanceInput {
  /** The doc the session started from. */
  before: Progress
  /** The doc the session-end write saved. */
  after: Progress
  node: SkillNode
  /** Letter-sounds vowel the session targeted, when per-vowel tracking runs. */
  vowel?: LetterSoundsVowel
  beat: SessionEndBeat
  totalCorrect: number
  /** Local `YYYY-MM-DD` of the session (the progress clock). */
  today: string
  /** "Play again to get today's flower." was already said today in this world. */
  nudgeSaidToday: boolean
}

interface Row {
  was: number
  now: number
  required: number
  /** Key into `progress.goodDays` and the history filter. */
  vowel: LetterSoundsVowel | null
}

/**
 * The flower row this session counts toward: the step's row, or for
 * per-vowel letter sounds the session's vowel (else the vowel that grew,
 * else the first vowel still filling — the row the Hub shows).
 */
function rowOf(input: SessionEndGuidanceInput): Row {
  const was = nodeProgress(input.before, input.node)
  const now = nodeProgress(input.after, input.node)
  if (now.vowels !== undefined && now.vowels.length > 0) {
    const pick =
      now.vowels.find((v) => v.vowel === input.vowel) ??
      now.vowels.find(
        (v) =>
          v.goodDays >
          (was.vowels?.find((b) => b.vowel === v.vowel)?.goodDays ?? 0),
      ) ??
      now.vowels.find((v) => v.goodDays < v.requiredDays) ??
      now.vowels[now.vowels.length - 1]!
    const before = was.vowels?.find((b) => b.vowel === pick.vowel)
    return {
      was: Math.min(before?.goodDays ?? 0, pick.goodDays),
      now: pick.goodDays,
      required: pick.requiredDays,
      vowel: pick.vowel,
    }
  }
  return {
    was: Math.min(was.goodDays, now.goodDays),
    now: now.goodDays,
    required: now.requiredDays,
    vowel: null,
  }
}

/** Did the row already bank a good day today, before this session? */
function earnedTodayBefore(
  input: SessionEndGuidanceInput,
  world: MasteryTrack,
  row: Row,
): boolean {
  const p = input.before
  const percent = getSettings(p).masteryThreshold[world].percent
  const focused = p.history.filter(
    (entry) =>
      entry.skillFocus.includes(input.node) &&
      (row.vowel === null || entry.currentTargetVowel === row.vowel),
  )
  const banked = p.goodDays?.[row.vowel ?? input.node] ?? []
  return (
    banked.includes(input.today) ||
    goodDayKeysFromHistory(focused, percent).includes(input.today)
  )
}

function tray(
  required: number,
  grown: number,
  sleepingAt: number | null,
): FlowerSlot[] {
  return Array.from({ length: required }, (_, i) =>
    i === sleepingAt ? 'sleeping' : i < grown ? 'grown' : 'empty',
  )
}

function praiseFor(totalCorrect: number): EndLine {
  return (
    line(`guide.end.right.${totalCorrect}`, 'praise') ??
    line('guide.end.not-yet.praise', 'praise')!
  )
}

export function sessionEndGuidance(
  input: SessionEndGuidanceInput,
): SessionEndGuidance {
  const world = trackOf(input.node) ?? 'math'
  const row = rowOf(input)
  const crossDay = getSettings(input.after).crossDayEnforcement
  const base = { world, node: input.node }

  // A new flower today.
  if (row.now > row.was) {
    const full = row.now >= row.required
    const lastStep = nextNode(world, input.node) === null
    const day: EndDay =
      input.beat.kind === 'unlock'
        ? 'unlock'
        : full && lastStep && input.after.skillLevels[input.node] === 'mastered'
          ? 'world-done'
          : 'good-day'
    const newSlot = row.now - 1
    // The flower that fills the row is the climax: it lands grown. Any
    // other new flower sleeps until tomorrow (with the separate-days rule
    // on — without it there is no "tomorrow" to wait for).
    const sleeping = !full && crossDay ? newSlot : null
    const counted = row.required === 3 && row.now <= 3
    const lines: EndLine[] = [
      praiseFor(input.totalCorrect),
      line('guide.end.flower', 'flower')!,
    ]
    if (counted) lines.push(line(`guide.end.count.${row.now}`, 'count')!)
    if (day === 'unlock') lines.push(line('guide.end.path-opens', 'next')!)
    else if (day === 'world-done')
      lines.push(line('guide.end.world-done', 'next')!)
    else if (!full && crossDay) lines.push(line('guide.end.sleeps', 'next')!)
    return {
      ...base,
      day,
      slotsBefore: tray(row.required, row.was, null),
      slotsAfter: tray(row.required, row.now, sleeping),
      newSlot,
      countText: `${row.now} of ${row.required}${full ? '!' : ''}`,
      lines,
    }
  }

  // No new flower: already grown, or today's flower already earned.
  const mastered = input.before.skillLevels[input.node] === 'mastered'
  const earnedToday = !mastered && earnedTodayBefore(input, world, row)
  const praise = line('guide.end.not-yet.praise', 'praise')!
  if (mastered || earnedToday) {
    const slots = tray(
      row.required,
      row.now,
      earnedToday && crossDay && row.now > 0 ? row.now - 1 : null,
    )
    return {
      ...base,
      day: 'practice',
      slotsBefore: slots,
      slotsAfter: slots,
      newSlot: null,
      countText: null,
      lines: [praise],
    }
  }

  // Not yet: warm praise, the tray untouched, and — once a day per
  // world — how today's flower can still come.
  const slots = tray(row.required, row.now, null)
  return {
    ...base,
    day: 'not-yet',
    slotsBefore: slots,
    slotsAfter: slots,
    newSlot: null,
    countText: null,
    lines: input.nudgeSaidToday
      ? [praise]
      : [praise, line('guide.end.not-yet.again', 'next')!],
  }
}
