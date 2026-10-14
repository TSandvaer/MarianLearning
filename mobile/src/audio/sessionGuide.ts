/**
 * Emma's in-session guidance lines: a review's opener, "Your flower is
 * sleeping. Let's play the ones you know!", and "Remember this one?" before
 * each warm-up problem (native spec
 * `design/native/review-mode-and-warmup-native.md` § 4); "You just knew
 * that one!" after a quick warm-up answer, and the Map peek's opener "Let's
 * look at this one!" and closer "This one is for later. You will learn
 * it!" (`design/native/fast-track-native.md` §§ 6.3, 7, 8). All are core
 * `GUIDANCE_LINES` Lily recordings (`/assets/audio/path/guide-session-*.mp3`),
 * played through one manifest line player (`session-guide`) with word ticks
 * for the ribbon. The player never rejects; without a clip (the fast-track
 * lines until their render) it walks the caption at 165 wpm. Math and Word
 * Song share the one player.
 */
import { guidanceLine } from '@marian/core/emmasPath/guidanceLines'
import {
  createManifestLinePlayer,
  type ManifestLine,
  type ManifestLinePlayer,
} from './manifestLines'

export type SessionGuideLineId =
  | 'guide.session.review'
  | 'guide.session.warmup'
  | 'guide.session.knew'
  | 'guide.session.peek-open'
  | 'guide.session.peek-close'

/** The line ends → this long → the problem's read line starts (§ 4). */
export const SESSION_GUIDE_GAP_MS = 400

/**
 * A peek's close (fast-track spec § 6.3): problem 3 done → this long → the
 * closer; the closer ends → this long → back to the Map.
 */
export const PEEK_CLOSE_GAP_MS = 400

/** A quick warm-up answer (§ 7): the correct line ends → this long → "knew". */
export const KNEW_GAP_MS = 300

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
  'guide.session.knew': line('guide.session.knew'),
  'guide.session.peek-open': line('guide.session.peek-open'),
  'guide.session.peek-close': line('guide.session.peek-close'),
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
