/**
 * The Hub's sound (design/native/hub-native.md § 5).
 *
 * - Emma's guidance lines play through one manifest line player
 *   (`hub-guide`) over the G3 Lily recordings (core `GUIDANCE_LINES`,
 *   bundled from `mobile/assets/audio/path/`). A line without a clip walks
 *   its caption at 165 wpm (the player contract).
 * - The map button's plink: one effect for the app session, made on the
 *   first map tap (web `HubPathCard.tsx` `playPlink`): the tap flips the
 *   route at once, so a per-mount effect unloaded with the Hub would cut it.
 * - Rapid remount (web `useRapidRemountSuppression`, Dave's 30 s rule): an
 *   in-memory timestamp of the last Hub unmount instead of sessionStorage.
 *   Both last as long as the app process, so a cold start greets again.
 */
import {
  GUIDANCE_LINES,
  type GuidanceLineId,
} from '@marian/core/hub/hubGuidance'
import {
  createManifestLinePlayer,
  createSfx,
  SFX_SOURCES,
  type ManifestLine,
  type ManifestLinePlayer,
  type Sfx,
} from '../../audio'

/** Every guidance line, as the line player's manifest. */
export const GUIDANCE_MANIFEST: Readonly<Record<GuidanceLineId, ManifestLine>> =
  Object.fromEntries(
    Object.entries(GUIDANCE_LINES).map(([id, line]) => [
      id,
      { src: line.audioSrc, text: line.text },
    ]),
  ) as Record<GuidanceLineId, ManifestLine>

export type GuidancePlayer = ManifestLinePlayer<GuidanceLineId>

let guidance: GuidancePlayer | null = null

/** The app's guidance player (made on first use). */
export function guidancePlayer(): GuidancePlayer {
  guidance ??= createManifestLinePlayer<GuidanceLineId>(
    'hub-guide',
    GUIDANCE_MANIFEST,
  )
  return guidance
}

/** Web `.hub-mapbtn` click: `sfx-plink` at 0.3. */
export const PLINK_VOLUME = 0.3

let plink: Sfx | null = null

export function playPlink(): void {
  plink ??= createSfx({ src: SFX_SOURCES.plink, volume: PLINK_VOLUME })
  plink.play()
}

/** A Hub mount within this long of the last unmount stays quiet. */
export const RAPID_REMOUNT_MS = 30_000

let lastUnmountAt: number | null = null

export function isRapidRemount(nowMs: number): boolean {
  return lastUnmountAt !== null && nowMs - lastUnmountAt < RAPID_REMOUNT_MS
}

export function markHubUnmount(nowMs: number): void {
  lastUnmountAt = nowMs
}

/**
 * Forget the last unmount (learner profiles § 2.3 step 3, K2): a pick is
 * a new visit, so the next learner's Hub speaks even within 30 s of the
 * last one.
 */
export function clearHubUnmountMark(): void {
  lastUnmountAt = null
}

/** Test seam: forget the last unmount and drop the module players. */
export function resetHubAudioForTests(): void {
  lastUnmountAt = null
  guidance?.unload()
  guidance = null
  plink?.unload()
  plink = null
}
