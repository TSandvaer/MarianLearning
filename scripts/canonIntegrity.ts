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
 *
 * A step's pool (problems 9+, no-Claude plan phase 5a,
 * `packages/core/src/wire/canonPool.ts`) is not served: the server serves
 * the file without it (`getCanonEntry`) and the app draws a pool block only
 * once every one of its clips is bundled (`mobile/src/session/
 * localSession.ts`). So (a) checks the served lines, and an empty pool slot
 * is the render's to-do (`unrenderedPoolSlots`), not a silent line.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { canonFilePath, type CanonKey } from '../api/_canon.js'
import { isCanonPoolLineId } from '../packages/core/src/wire/canonPool.js'

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

/** Every utterance in every canon JSON under `canonRoot` whose audio is
 *  missing or empty, served lines or pool lines as `pool` says. */
function silentSlots(canonRoot: string, pool: boolean): EmptyAudioSlot[] {
  const out: EmptyAudioSlot[] = []
  for (const path of canonJsonFiles(canonRoot)) {
    const doc = JSON.parse(readFileSync(path, 'utf8')) as {
      utterances?: Array<{ id?: unknown; audio?: { base64?: unknown } }>
    }
    for (const u of doc.utterances ?? []) {
      const inPool = typeof u.id === 'string' && isCanonPoolLineId(u.id)
      if (inPool !== pool) continue
      const base64 = u.audio?.base64
      if (typeof base64 !== 'string' || base64 === '') {
        out.push({ file: relative(canonRoot, path), id: String(u.id) })
      }
    }
  }
  return out
}

/** (a) Every served utterance (pools left out) in every canon JSON under
 *  `canonRoot` whose audio is missing or empty. `[]` means every served
 *  line has audio. */
export function emptyAudioSlots(canonRoot: string): EmptyAudioSlot[] {
  return silentSlots(canonRoot, false)
}

/** Every pool line (problems 9+) still waiting for its Lily render. */
export function unrenderedPoolSlots(canonRoot: string): EmptyAudioSlot[] {
  return silentSlots(canonRoot, true)
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
