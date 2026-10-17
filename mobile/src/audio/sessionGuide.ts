/**
 * Emma's in-session guidance lines: a review's opener, "Your flower is
 * sleeping. Let's play the ones you know!", and "Remember this one?" before
 * each warm-up problem (native spec
 * `design/native/review-mode-and-warmup-native.md` § 4); "You just knew
 * that one!" after a quick warm-up answer, and the Map peek's per-step
 * opener "Let's look at <name>!" and closer "<Name> is for later. You will
 * learn it!" (`design/native/fast-track-native.md` §§ 6.3, 7, 8); the lead
 * lines of content wave 1 (`design/native/content-wave-1.md` § 6.1): a new
 * step's intro and "Some flowers are hiding!"; and the Map replay's
 * per-step opener "Let's play <name> again!" and closer "You know <name>!"
 * (`design/native/map-tap-to-play.md` § 3). All are
 * core `GUIDANCE_LINES` Lily recordings
 * (`/assets/audio/path/guide-session-*.mp3`), played through one manifest
 * line player (`session-guide`) with word ticks for the ribbon. The player
 * never rejects; without a clip (a line awaiting its render) it walks the
 * caption at 165 wpm. Math and Word Song share the one player.
 */
import {
  GUIDANCE_LINES,
  peekLines,
  replayLines,
  sessionIntroLine,
} from '@marian/core/emmasPath/guidanceLines'
import type { SkillNode } from '@marian/core/progress'
import {
  createManifestLinePlayer,
  type ManifestLine,
  type ManifestLinePlayer,
} from './manifestLines'

/** A peek line of one step (fast-track spec § 8). */
export type PeekGuideLineId =
  | `guide.session.peek-open.${SkillNode}`
  | `guide.session.peek-close.${SkillNode}`

/** A replay line of one step (map-tap-to-play § 6). */
export type ReplayGuideLineId =
  | `guide.session.replay-open.${SkillNode}`
  | `guide.session.replay-close.${SkillNode}`

/** A step's intro lead line (content wave 1 § 6.1). */
export type IntroGuideLineId = `guide.session.intro.${SkillNode}`

export type SessionGuideLineId =
  | 'guide.session.review'
  | 'guide.session.warmup'
  | 'guide.session.knew'
  | 'guide.session.hiding'
  | PeekGuideLineId
  | ReplayGuideLineId
  | IntroGuideLineId

/** The line ends → this long → the problem's read line starts (§ 4). */
export const SESSION_GUIDE_GAP_MS = 400

/**
 * A peek's close (fast-track spec § 6.3): problem 3 done → this long → the
 * closer; the closer ends → this long → back to the Map.
 */
export const PEEK_CLOSE_GAP_MS = 400

/** A quick warm-up answer (§ 7): the correct line ends → this long → "knew". */
export const KNEW_GAP_MS = 300

/**
 * Every in-session line of the catalogue (`guide.session.*`). A world's
 * first step has no peek lines (a peek never reaches it), so the record is
 * partial; `peekGuideLines` hands out only ids that are in it.
 */
export const SESSION_GUIDE_MANIFEST: Readonly<
  Partial<Record<SessionGuideLineId, ManifestLine>>
> = Object.fromEntries(
  GUIDANCE_LINES.filter((l) => l.id.startsWith('guide.session.')).map((l) => [
    l.id,
    { src: l.src, text: l.text },
  ]),
)

/** A catalogued in-session line; throws for an id the catalogue lacks. */
export function sessionGuideLine(id: SessionGuideLineId): ManifestLine {
  const line = SESSION_GUIDE_MANIFEST[id]
  if (line === undefined) throw new Error(`no guidance line ${id}`)
  return line
}

/**
 * The peek's opener and closer ids for `node`, or `null` when the step has
 * none (a world's first step).
 */
export function peekGuideLines(
  node: SkillNode,
): { open: PeekGuideLineId; close: PeekGuideLineId } | null {
  const lines = peekLines(node)
  if (lines === null) return null
  return {
    open: lines.open.id as PeekGuideLineId,
    close: lines.close.id as PeekGuideLineId,
  }
}

/**
 * The replay's opener and closer ids for `node` (map-tap-to-play § 3);
 * every step has both.
 */
export function replayGuideLines(node: SkillNode): {
  open: ReplayGuideLineId
  close: ReplayGuideLineId
} {
  const lines = replayLines(node)
  return {
    open: lines.open.id as ReplayGuideLineId,
    close: lines.close.id as ReplayGuideLineId,
  }
}

/**
 * The step intro's id for `node`, or `null` when the step has none
 * (content wave 1 § 6.1). Whether it plays (forward, not mastered) is the
 * session start's call.
 */
export function introGuideLine(node: SkillNode): IntroGuideLineId | null {
  const line = sessionIntroLine(node)
  return line === undefined ? null : (line.id as IntroGuideLineId)
}

/** What decides a round's lead lines (content wave 1 § 6.1). */
export interface RoundLeadContext {
  /** A review's or a peek's opener (problem 1, over the empty stage). */
  opener: SessionGuideLineId | null
  /** The first `warmupCount` problems are warm-up hearts. */
  warmupCount: number
  /** The step intro for the scored problem 1; `null` = none this session. */
  intro: SessionGuideLineId | null
  /** Per problem: a missing-number problem ("Some flowers are hiding!"). */
  hiding: readonly boolean[]
  /** A Map peek: its opener, and no other lead. */
  peek: boolean
}

/**
 * The line before each problem's read, `null` for none (§ 6.1). At most one
 * per problem, by priority: the opener (problem 1), a warm-up heart's
 * "Remember this one?", the step intro (the scored problem 1), the hiding
 * line. The hiding line goes to the round's first missing-number problem
 * whose slot is free, so a heart or the opener never loses its own line and
 * the round still hears the hiding line once. A peek has its opener only.
 * The screens play it: line end → 400 ms (`SESSION_GUIDE_GAP_MS`) → the read.
 */
export function leadLinesForRound(
  count: number,
  ctx: RoundLeadContext,
): (SessionGuideLineId | null)[] {
  const leads: (SessionGuideLineId | null)[] = Array.from(
    { length: count },
    (_, i) => {
      if (i === 0 && ctx.opener !== null) return ctx.opener
      if (ctx.peek) return null
      if (i < ctx.warmupCount) return 'guide.session.warmup'
      if (i === ctx.warmupCount && ctx.intro !== null) return ctx.intro
      return null
    },
  )
  if (!ctx.peek) {
    const at = leads.findIndex((l, i) => l === null && ctx.hiding[i] === true)
    if (at >= 0) leads[at] = 'guide.session.hiding'
  }
  return leads
}

export type SessionGuidePlayer = ManifestLinePlayer<SessionGuideLineId>

let player: SessionGuidePlayer | null = null

/** The app's session-guide player (made on first use). */
export function sessionGuidePlayer(): SessionGuidePlayer {
  // The record is partial (see above); only catalogued ids are ever played.
  player ??= createManifestLinePlayer<SessionGuideLineId>(
    'session-guide',
    SESSION_GUIDE_MANIFEST as Record<SessionGuideLineId, ManifestLine>,
  )
  return player
}
