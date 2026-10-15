/**
 * Emma's in-session guidance lines: a review's opener, "Your flower is
 * sleeping. Let's play the ones you know!", and "Remember this one?" before
 * each warm-up problem (native spec
 * `design/native/review-mode-and-warmup-native.md` § 4); "You just knew
 * that one!" after a quick warm-up answer, and the Map peek's per-step
 * opener "Let's look at <name>!" and closer "<Name> is for later. You will
 * learn it!" (`design/native/fast-track-native.md` §§ 6.3, 7, 8). All are
 * core `GUIDANCE_LINES` Lily recordings
 * (`/assets/audio/path/guide-session-*.mp3`), played through one manifest
 * line player (`session-guide`) with word ticks for the ribbon. The player
 * never rejects; without a clip (a line awaiting its render) it walks the
 * caption at 165 wpm. Math and Word Song share the one player.
 */
import { GUIDANCE_LINES, peekLines } from '@marian/core/emmasPath/guidanceLines'
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

export type SessionGuideLineId =
  | 'guide.session.review'
  | 'guide.session.warmup'
  | 'guide.session.knew'
  | PeekGuideLineId

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
