/**
 * Hub guidance — Guidance G1 (ClickUp 123jpnbca4r).
 *
 * Reference: `design/emmas-path/redesign/guidance-mockup.html` screens
 * a / c / d / a2, Dave's `design/research/guidance-layer-2026-10-06.md`
 * and quality bar 14 ("the app carries the child"). Emma names ONE next
 * action, the card she names glows, and a flower earned today sleeps
 * until tomorrow, when it wakes once with Emma's line.
 *
 * Pure helpers plus the line player. Emma's lines play the Lily
 * recordings from Guidance G3 (`lib/emmasPath/guidanceLines.ts`, PR
 * #512) through the Hub's Howler line player (`playHubLine.ts`), with
 * the caption walking alongside; the Hub waits for the iOS first-gesture
 * unlock on app-open (`guidanceNeedsGesture`). A line with no recording
 * (`audioSrc: null`) walks its caption at 165 wpm.
 */

import type { MasteryTrack } from '../../lib/progress'
import { guidanceLine as guidanceClip } from '../../lib/emmasPath/guidanceLines'
import type { StorageAdapter } from '../Math/stardust'
import type { SkillTreeId } from '../SessionEnd/sessionHistory'
import type { HubCardModel } from './hubCardModel'
import { createHubLinePlayer } from './playHubLine'

// ── Emma's lines ─────────────────────────────────────────────────────

export type GuidanceLineId =
  | 'guide.grow.number-garden'
  | 'guide.grow.word-song'
  | 'guide.sleeping.number-garden'
  | 'guide.sleeping.word-song'
  | 'guide.both-sleeping'
  | 'guide.woke-up'
  | 'guide.woke-up.one'
  | 'guide.one-more'

export interface GuidanceLine {
  text: string
  /** Recorded Lily line (G3); null = caption only. */
  audioSrc: string | null
}

/**
 * The G3 recording for each Hub line: the id in
 * `lib/emmasPath/guidanceLines.ts`, or null when G3 recorded none.
 * `guide.woke-up.one` ("Your flower woke up!") has no recording; it
 * shows its caption only.
 */
export const GUIDANCE_CLIP_IDS: Record<GuidanceLineId, string | null> = {
  'guide.grow.number-garden': 'guide.hub.suggest.math',
  'guide.grow.word-song': 'guide.hub.suggest.word-song',
  'guide.sleeping.number-garden': 'guide.hub.sleeping.math',
  'guide.sleeping.word-song': 'guide.hub.sleeping.word-song',
  'guide.both-sleeping': 'guide.hub.both-sleeping',
  'guide.woke-up': 'guide.hub.woke',
  'guide.woke-up.one': null,
  'guide.one-more': 'guide.hub.one-more',
}

function clipSrc(id: GuidanceLineId): string | null {
  const clipId = GUIDANCE_CLIP_IDS[id]
  return clipId === null ? null : (guidanceClip(clipId)?.src ?? null)
}

/**
 * Texts are the mockup's, word for word. Each world gets its own copy
 * of the suggestion lines (the mockup shows one direction of each), and
 * `guide.woke-up.one` is the singular of "Your flowers woke up!" for a
 * morning when only one world had a flower asleep.
 */
export const GUIDANCE_LINES: Record<GuidanceLineId, GuidanceLine> = {
  'guide.grow.number-garden': {
    text: "Let's grow a flower in Number Garden! Or pick Word Song.",
    audioSrc: clipSrc('guide.grow.number-garden'),
  },
  'guide.grow.word-song': {
    text: "Let's grow a flower in Word Song! Or pick Number Garden.",
    audioSrc: clipSrc('guide.grow.word-song'),
  },
  // "Your flower is sleeping" names the OTHER world's flower; the line
  // suggests the world it names.
  'guide.sleeping.number-garden': {
    text: "Your flower is sleeping. Let's play Number Garden!",
    audioSrc: clipSrc('guide.sleeping.number-garden'),
  },
  'guide.sleeping.word-song': {
    text: "Your flower is sleeping. Let's play Word Song!",
    audioSrc: clipSrc('guide.sleeping.word-song'),
  },
  'guide.both-sleeping': {
    text: 'Both flowers are sleeping. Want to practise more?',
    audioSrc: clipSrc('guide.both-sleeping'),
  },
  'guide.woke-up': {
    text: 'Your flowers woke up!',
    audioSrc: clipSrc('guide.woke-up'),
  },
  'guide.woke-up.one': {
    text: 'Your flower woke up!',
    audioSrc: clipSrc('guide.woke-up.one'),
  },
  'guide.one-more': {
    text: 'One more flower, and a new path opens!',
    audioSrc: clipSrc('guide.one-more'),
  },
}

/** True when any line has a recording, so the app-open path must wait
 *  for the first tap (iOS audio unlock) before Emma speaks. */
export function guidanceNeedsGesture(
  lines: readonly GuidanceLineId[],
): boolean {
  return lines.some((id) => GUIDANCE_LINES[id].audioSrc !== null)
}

// ── Suggestion ───────────────────────────────────────────────────────

const TREE_OF: Record<MasteryTrack, SkillTreeId> = {
  math: 'number-garden',
  'word-song': 'word-song',
}

/** The world can still earn today's flower. */
export function canEarnToday(card: HubCardModel): boolean {
  return !card.complete && !card.earnedToday
}

/**
 * The world Emma suggests: the one that can still earn today's flower;
 * if both can, the one closer to its unlock; on a tie, the other world
 * from `lastSuggestion` (Word Song when there is none). Null when
 * neither can earn a flower today.
 */
export function suggestWorld(
  numberGarden: HubCardModel,
  wordSong: HubCardModel,
  lastSuggestion: SkillTreeId | null,
): SkillTreeId | null {
  const open = [numberGarden, wordSong].filter(canEarnToday)
  if (open.length === 0) return null
  if (open.length === 1) return TREE_OF[open[0]!.world]
  if (numberGarden.flowersToUnlock !== wordSong.flowersToUnlock) {
    return numberGarden.flowersToUnlock < wordSong.flowersToUnlock
      ? 'number-garden'
      : 'word-song'
  }
  return lastSuggestion === 'word-song' ? 'number-garden' : 'word-song'
}

// ── Lines for this Hub visit ─────────────────────────────────────────

/**
 * Emma's lines for this Hub mount, in order:
 *  - morning wake-up first ("Your flowers woke up!"), when a flower
 *    slept since the last visit;
 *  - then one next action: "One more flower, and a new path opens!"
 *    after a wake-up when the suggested world is one flower from its
 *    unlock; "Your flower is sleeping. Let's play <other>!" when one
 *    world already has today's flower; "Let's grow a flower in <world>!
 *    Or pick <other>." otherwise;
 *  - "Both flowers are sleeping. Want to practise more?" when both
 *    worlds have today's flower (no suggestion).
 */
export function pickGuidanceLines(opts: {
  numberGarden: HubCardModel
  wordSong: HubCardModel
  suggestion: SkillTreeId | null
  wakeWorlds: readonly MasteryTrack[]
}): GuidanceLineId[] {
  const { numberGarden, wordSong, suggestion, wakeWorlds } = opts
  const lines: GuidanceLineId[] = []
  if (wakeWorlds.length > 0) {
    lines.push(wakeWorlds.length > 1 ? 'guide.woke-up' : 'guide.woke-up.one')
  }
  if (suggestion !== null) {
    const [sug, other] =
      suggestion === 'number-garden'
        ? [numberGarden, wordSong]
        : [wordSong, numberGarden]
    if (
      wakeWorlds.length > 0 &&
      sug.flowersToUnlock === 1 &&
      sug.unlocksNext !== null
    ) {
      lines.push('guide.one-more')
    } else if (other.earnedToday) {
      lines.push(`guide.sleeping.${suggestion}`)
    } else {
      lines.push(`guide.grow.${suggestion}`)
    }
  } else if (numberGarden.earnedToday && wordSong.earnedToday) {
    lines.push('guide.both-sleeping')
  }
  return lines
}

// ── Morning wake-up (once) ───────────────────────────────────────────

/** localStorage key: per world, the newest good day already shown awake. */
export const FLOWER_WAKE_STORAGE_KEY = 'hub-flower-wake.v1'

export type FlowerWakeRecord = Partial<Record<MasteryTrack, string>>

function defaultStorage(): StorageAdapter | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function readFlowerWake(storage?: StorageAdapter): FlowerWakeRecord {
  try {
    const raw = (storage ?? defaultStorage())?.getItem(FLOWER_WAKE_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return {}
    const out: FlowerWakeRecord = {}
    for (const world of ['math', 'word-song'] as const) {
      const v = (parsed as Record<string, unknown>)[world]
      if (typeof v === 'string') out[world] = v
    }
    return out
  } catch {
    return {}
  }
}

export function writeFlowerWake(
  record: FlowerWakeRecord,
  storage?: StorageAdapter,
): void {
  try {
    ;(storage ?? defaultStorage())?.setItem(
      FLOWER_WAKE_STORAGE_KEY,
      JSON.stringify(record),
    )
  } catch {
    // Private mode / quota: the wake-up may show again; nothing breaks.
  }
}

/** Newest earlier-day flower on the card, or null. */
function newestGrownDay(card: HubCardModel): string | null {
  const days = card.slotDays.filter((d): d is string => d !== null)
  return days.length > 0 ? days[days.length - 1]! : null
}

/**
 * Which slots wake this visit: grown flowers from a day newer than the
 * last one shown awake. A sleeping flower (today) never wakes the same
 * day, so a flower is seen asleep, then awake the next time she comes
 * back, however many days later. `next` is the record to persist.
 */
export function flowerWakeFor(
  cards: readonly HubCardModel[],
  seen: FlowerWakeRecord,
): {
  wakeWorlds: MasteryTrack[]
  wakeSlots: Partial<Record<MasteryTrack, number[]>>
  next: FlowerWakeRecord
} {
  const wakeWorlds: MasteryTrack[] = []
  const wakeSlots: Partial<Record<MasteryTrack, number[]>> = {}
  const next: FlowerWakeRecord = { ...seen }
  for (const card of cards) {
    const newest = newestGrownDay(card)
    if (newest === null) continue
    const last = seen[card.world]
    if (last === undefined || newest > last) {
      wakeWorlds.push(card.world)
      wakeSlots[card.world] = card.slotDays.flatMap((d, i) =>
        d !== null && (last === undefined || d > last) ? [i] : [],
      )
      next[card.world] = newest
    }
  }
  return { wakeWorlds, wakeSlots, next }
}

// ── Line player ──────────────────────────────────────────────────────

/** Same pace as the Hub's silent caption walk (165 wpm). */
export const CAPTION_MS_PER_WORD = Math.round(60_000 / 165)

export interface PlayGuidanceLineOptions {
  onPlay?: () => void
  onWordTick?: (wordIndex: number) => void
}

let activeCancel: (() => void) | null = null

/** Lines with a recording, as the Howler player's manifest. */
const CLIP_MANIFEST = Object.fromEntries(
  Object.entries(GUIDANCE_LINES).flatMap(([id, line]) =>
    line.audioSrc === null
      ? []
      : [[id, { src: line.audioSrc, text: line.text }]],
  ),
) as Record<GuidanceLineId, { src: string; text: string }>

const clipPlayer = createHubLinePlayer<GuidanceLineId>({
  lines: CLIP_MANIFEST,
})

/**
 * Speak one guidance line. A recorded line plays through the Hub's
 * Howler player (pending-resume gate, caption ticks against the clip's
 * duration, caption walk if the clip fails to load); a line without a
 * recording reveals its words at 165 wpm. Resolves when the line ends.
 */
export function playGuidanceLine(
  id: GuidanceLineId,
  opts: PlayGuidanceLineOptions = {},
): Promise<void> {
  cancelGuidanceLine()
  if (GUIDANCE_LINES[id].audioSrc !== null && id in CLIP_MANIFEST) {
    return clipPlayer.playHubLine(id, opts)
  }
  const words = GUIDANCE_LINES[id].text.split(/\s+/).filter(Boolean)
  return new Promise<void>((resolve) => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const cancel = () => {
      timers.forEach(clearTimeout)
      if (activeCancel === cancel) activeCancel = null
      resolve()
    }
    activeCancel = cancel
    opts.onPlay?.()
    words.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          opts.onWordTick?.(i)
          if (i === words.length - 1) cancel()
        }, i * CAPTION_MS_PER_WORD),
      )
    })
    if (words.length === 0) cancel()
  })
}

/** Stop the line in flight (card tap, unmount). Idempotent. */
export function cancelGuidanceLine(): void {
  activeCancel?.()
  clipPlayer.cancelActive()
}

/** Release the recorded lines' Howls (Hub leaves). Idempotent. */
export function unloadGuidanceLines(): void {
  clipPlayer.unload()
}
