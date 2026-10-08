/**
 * Emma's Path clay art manifest (Redesign R1, ClickUp 123jpnbc68y).
 *
 * Maps every SkillNode stage icon, land emblem and UI piece of the clay
 * "Toy Box" redesign (team/DECISIONS.md 2026-10-05/06, quality bars 9-13 in
 * .claude/quality-bars.md) to its WebP under `public/assets/path/`. Each
 * piece ships at two sizes, `{id}-256.webp` and `{id}-512.webp`, written by
 * `scripts/build-path-art.ts` from PNG sources that are not in git.
 *
 * `pathArt.test.ts` checks every entry has both files on disk, so a new
 * SkillNode without art fails CI (the Record type already fails tsc).
 *
 * Pure data module: type-only imports, so the node-run build script can
 * load it.
 */
import type { Land } from '../progress/lands'
import type { SkillNode } from '../progress/types'

/** Directory under `public/`, and URL path under the site root. */
export const PATH_ART_DIR = 'assets/path'

/** Shipped widths in px (square images). */
export const PATH_ART_SIZES = [256, 512] as const
export type PathArtSize = (typeof PATH_ART_SIZES)[number]

/** Land emblem ids: `ng` = Number Garden (math), `ws` = Word Song. */
export type LandArtId =
  | 'land-ng-1'
  | 'land-ng-2'
  | 'land-ng-3'
  | 'land-ng-4'
  | 'land-ws-1'
  | 'land-ws-2'
  | 'land-ws-3'
  | 'land-ws-4'
  | 'land-ws-5'

export type UiArtId =
  | 'ui-map'
  | 'ui-house'
  | 'ui-padlock'
  | 'ui-bloom'
  | 'ui-bud-open'
  | 'ui-bud-closed'
  | 'ui-arch-open'
  | 'ui-arch-closed'

export type PathArtId = SkillNode | LandArtId | UiArtId

// A Record so tsc fails when a SkillNode (or other id) has no entry.
const PATH_ART_SET: Readonly<Record<PathArtId, true>> = {
  // Number Garden stages
  'number-recog': true,
  'add-to-10': true,
  'add-to-20': true,
  'sub-to-10': true,
  'sub-to-20': true,
  'two-digit-addsub-no-regroup': true,
  'two-digit-addsub-with-regroup': true,
  'skip-counting': true,
  'mult-2-5-10': true,
  'mult-3-4': true,
  'mult-6-9': true,
  // Word Song stages
  'letter-names': true,
  'letter-sounds': true,
  'blending-cv': true,
  'cvc-words': true,
  'cvc-words-short-o': true,
  'cvc-words-short-u': true,
  'cvc-words-short-i': true,
  'cvc-words-short-e': true,
  'digraphs-sh': true,
  'digraphs-ch': true,
  'digraphs-th-voiceless': true,
  'sight-words': true,
  'simple-sentences': true,
  // Land emblems
  'land-ng-1': true,
  'land-ng-2': true,
  'land-ng-3': true,
  'land-ng-4': true,
  'land-ws-1': true,
  'land-ws-2': true,
  'land-ws-3': true,
  'land-ws-4': true,
  'land-ws-5': true,
  // UI pieces
  'ui-map': true,
  'ui-house': true,
  'ui-padlock': true,
  'ui-bloom': true,
  'ui-bud-open': true,
  'ui-bud-closed': true,
  'ui-arch-open': true,
  'ui-arch-closed': true,
}

/** Every art piece, in manifest order. */
export const PATH_ART_IDS = Object.keys(PATH_ART_SET) as readonly PathArtId[]

/** The emblem id of a land. */
export function landArtId(land: Pick<Land, 'world' | 'number'>): LandArtId {
  const world = land.world === 'math' ? 'ng' : 'ws'
  return `land-${world}-${land.number}` as LandArtId
}

/** Site-root URL of a piece at one size. */
export function pathArtSrc(id: PathArtId, size: PathArtSize): string {
  return `/${PATH_ART_DIR}/${id}-${size}.webp`
}
