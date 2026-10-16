/**
 * Canon integrity: the two conventions the text-only bake relies on, as
 * checks CI runs (`scripts/canonIntegrity.test.ts`, fast-gate). They replace
 * the safety net the removed `prebuild` hook gave.
 *
 * (a) Every committed canon utterance has audio. The bake writes empty slots
 *     (`base64: ''`) for `revoiceCanonLily.ts --unrendered` to fill, and
 *     `getCanonEntry` accepts them (the wire guard checks only that base64 is
 *     a string). A file committed between the two steps would be a canon HIT
 *     serving silent lines, not a miss that falls back to a live render.
 * (b) Every active combo has a committed canon file. Without one, every
 *     session of that step is a live Haiku + ElevenLabs render.
 *
 * No exemption for steps a branch still lists in `PENDING_CANON_NODES`:
 * that set gates the BAKE, not what ships. A committed file is served
 * whatever the set says, so an unrendered file must stay red until its
 * Lily render lands.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { canonFilePath, type CanonKey } from '../api/_canon.js'

/** One utterance with no audio: canon file (relative to the root) + id. */
export interface EmptyAudioSlot {
  file: string
  id: string
}

function canonJsonFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? canonJsonFiles(join(dir, e.name))
        : e.name.endsWith('.json')
          ? [join(dir, e.name)]
          : [],
    )
    .sort()
}

/** (a) Every utterance in every canon JSON under `canonRoot` whose audio is
 *  missing or empty. `[]` means every line has audio. */
export function emptyAudioSlots(canonRoot: string): EmptyAudioSlot[] {
  const out: EmptyAudioSlot[] = []
  for (const path of canonJsonFiles(canonRoot)) {
    const doc = JSON.parse(readFileSync(path, 'utf8')) as {
      utterances?: Array<{ id?: unknown; audio?: { base64?: unknown } }>
    }
    for (const u of doc.utterances ?? []) {
      const base64 = u.audio?.base64
      if (typeof base64 !== 'string' || base64 === '') {
        out.push({ file: relative(canonRoot, path), id: String(u.id) })
      }
    }
  }
  return out
}

/** (b) The combos with no committed canon file. Uses `canonFilePath`, so
 *  the wire → disk mapping (`two-digit-addsub-no-regroup` →
 *  `two-digit-addsub.json`) is the reader's. `[]` means all are present. */
export function missingCanonFiles<C extends CanonKey>(
  canonRoot: string,
  combos: readonly C[],
): C[] {
  return combos.filter((combo) => !existsSync(canonFilePath(canonRoot, combo)))
}
