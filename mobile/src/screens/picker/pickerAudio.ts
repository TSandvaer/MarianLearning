/**
 * The picker's sound (learner profiles § 1.3, § 1.4, § 2.1).
 *
 * - "Who is playing?" (`guide.picker.who`, T5) through one manifest line
 *   player. Without a playable clip the player walks the caption silently
 *   at 165 wpm (the player contract).
 * - The chime of a pick and of the Hub badge: one effect for the app
 *   session, made on first use (as the Hub's plink): the route changes
 *   400 ms after a pick, and a per-screen effect unloaded with the picker
 *   would cut the 0.57 s chime off.
 */
import { pickerWhoLine } from '@marian/core/emmasPath/guidanceLines'
import {
  createManifestLinePlayer,
  createSfx,
  SFX_SOURCES,
  type ManifestLinePlayer,
  type Sfx,
} from '../../audio'

export const PICKER_LINE_ID = 'guide.picker.who'
export type PickerLineId = typeof PICKER_LINE_ID

export type PickerLinePlayer = ManifestLinePlayer<PickerLineId>

let line: PickerLinePlayer | null = null

/** The app's picker line player (made on first use). */
export function pickerLinePlayer(): PickerLinePlayer {
  const who = pickerWhoLine()
  line ??= createManifestLinePlayer<PickerLineId>('picker', {
    [PICKER_LINE_ID]: { src: who.src, text: who.text },
  })
  return line
}

/** The pick's chime: Session End's soft chime. */
export const PICK_CHIME_VOLUME = 0.85

let chime: Sfx | null = null

export function playPickChime(): void {
  chime ??= createSfx({ src: SFX_SOURCES.chime, volume: PICK_CHIME_VOLUME })
  chime.play()
}

/** Test seam: drop the module players. */
export function resetPickerAudioForTests(): void {
  line?.unload()
  line = null
  chime?.unload()
  chime = null
}
