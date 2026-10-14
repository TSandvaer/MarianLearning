/**
 * Emma's two in-session guidance lines (native spec
 * `design/native/review-mode-and-warmup-native.md` § 4): a review's opener,
 * "Your flower is sleeping. Let's play the ones you know!", and "Remember
 * this one?" before each warm-up problem. Both are core `GUIDANCE_LINES`
 * Lily recordings (`/assets/audio/path/guide-session-*.mp3`), played through
 * one manifest line player (`session-guide`) with word ticks for the
 * ribbon. The player never rejects; without a clip it walks the caption at
 * 165 wpm. Math and Word Song share the one player.
 */
import { guidanceLine } from '@marian/core/emmasPath/guidanceLines'
import {
  createManifestLinePlayer,
  type ManifestLine,
  type ManifestLinePlayer,
} from './manifestLines'

export type SessionGuideLineId = 'guide.session.review' | 'guide.session.warmup'

/** The line ends → this long → the problem's read line starts (§ 4). */
export const SESSION_GUIDE_GAP_MS = 400

function line(id: SessionGuideLineId): ManifestLine {
  const g = guidanceLine(id)
  if (g === undefined) throw new Error(`no guidance line ${id}`)
  return { src: g.src, text: g.text }
}

export const SESSION_GUIDE_MANIFEST: Readonly<
  Record<SessionGuideLineId, ManifestLine>
> = {
  'guide.session.review': line('guide.session.review'),
  'guide.session.warmup': line('guide.session.warmup'),
}

export type SessionGuidePlayer = ManifestLinePlayer<SessionGuideLineId>

let player: SessionGuidePlayer | null = null

/** The app's session-guide player (made on first use). */
export function sessionGuidePlayer(): SessionGuidePlayer {
  player ??= createManifestLinePlayer<SessionGuideLineId>(
    'session-guide',
    SESSION_GUIDE_MANIFEST,
  )
  return player
}
