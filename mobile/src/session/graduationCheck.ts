/**
 * The cvc-words graduation check on the device (Thomas 2026-10-23, "App
 * builds the check itself"): the probe lines bundled with the app, and the
 * session audio that plays them.
 *
 * `assets/canon/cvc-words-probe.json` is `public/canon/word-song/level-1/
 * cvc-words-probe.json`, copied byte for byte by `npm run export-audio`
 * (Lily, ear-tested on the voice-QA page like every canon line). Core's
 * `withGraduationProbes` swaps its blocks into the canon plan; this module
 * loads its audio beside the session's, so a probe line plays from its own
 * file and every other line from the server's.
 */
import type { Utterance } from '@marian/core/wire/types'
import probeCanon from '../../assets/canon/cvc-words-probe.json'
import { loadSessionAudio, type LoadedSessionAudio } from '../audio'

/** The probe lines' server-plan shape, for `withGraduationProbes`. */
export const GRADUATION_PROBE_PLAN: unknown = probeCanon.plan

/** What Word Song plays a round with (the snapshot's player and files). */
export type RoundAudio = Pick<
  LoadedSessionAudio,
  'playUtterance' | 'fileFor' | 'unload'
>

/** The probe lines' audio, loaded beside the session's (its owner unloads it). */
export function loadGraduationProbeAudio(
  sessionId: string,
): LoadedSessionAudio {
  return loadSessionAudio(
    `${sessionId}-graduation`,
    probeCanon.utterances as unknown as readonly Utterance[],
    { alongside: true },
  )
}

/** `main`, with the lines `probe` holds played from `probe`'s files. */
export function withProbeAudio(
  main: RoundAudio,
  probe: LoadedSessionAudio,
): RoundAudio {
  const of = (text: string) => (probe.textToId.has(text) ? probe : main)
  return {
    playUtterance: (text, opts) => of(text).playUtterance(text, opts),
    fileFor: (text) => of(text).fileFor(text),
    unload: () => {
      probe.unload()
      main.unload()
    },
  }
}
