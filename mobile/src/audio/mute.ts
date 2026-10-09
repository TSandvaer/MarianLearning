/**
 * Global mute for automated runs (`EXPO_PUBLIC_MUTE=1`): every player the
 * engine creates (voice, session, SFX) starts muted. Local simulator and
 * emulator checks must stay silent; Emma's voice from a test run is noise
 * to whoever is at the Mac.
 */
import { readBuildEnv } from '../platform/buildEnv'

let override: boolean | null = null

export function isAudioMuted(): boolean {
  if (override !== null) return override
  return readBuildEnv().mute === '1'
}

/** Test seam. `null` restores the env flag. */
export function setAudioMutedForTests(muted: boolean | null): void {
  override = muted
}
