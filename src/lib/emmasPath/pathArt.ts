/**
 * Emma's Path clay art manifest (Redesign R1, ClickUp 123jpnbc68y).
 *
 * Maps every SkillNode stage icon, land emblem and UI piece of the clay
 * "Toy Box" redesign (team/DECISIONS.md 2026-10-05/06, quality bars 9-13 in
 * .claude/quality-bars.md) to its WebP under `public/assets/path/`. Each
 * piece ships at two sizes, `{id}-256.webp` and `{id}-512.webp`, written by
 * `scripts/build-path-art.ts` from PNG sources that are not in git.
 *
 * `pathArt.test.ts` checks every `ready` entry has both files on disk, so a
 * new SkillNode without art fails CI (the Record type already fails tsc).
 * A `pending` entry has no file yet: `pathArtSrc` returns `undefined` for it
 * and the screen falls back.
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

/** `pending` = art not made yet, no file shipped. */
export type PathArtStatus = 'ready' | 'pending'

export const PATH_ART: Readonly<Record<PathArtId, PathArtStatus>> = {
  // Number Garden stages
  'number-recog': 'ready',
  'add-to-10': 'ready',
  'add-to-20': 'ready',
  'sub-to-10': 'ready',
  'sub-to-20': 'ready',
  'two-digit-addsub-no-regroup': 'ready',
  'two-digit-addsub-with-regroup': 'ready',
  'skip-counting': 'ready',
  'mult-2-5-10': 'ready',
  'mult-3-4': 'ready',
  'mult-6-9': 'ready',
  // Word Song stages
  'letter-names': 'ready',
  'letter-sounds': 'ready',
  'blending-cv': 'ready',
  'cvc-words': 'ready',
  'cvc-words-short-o': 'ready',
  'cvc-words-short-u': 'ready',
  'cvc-words-short-i': 'ready',
  'cvc-words-short-e': 'ready',
  'digraphs-sh': 'ready',
  'digraphs-ch': 'ready',
  'digraphs-th-voiceless': 'ready',
  'sight-words': 'ready',
  'simple-sentences': 'ready',
  // Land emblems
  'land-ng-1': 'ready',
  'land-ng-2': 'ready',
  'land-ng-3': 'ready',
  'land-ng-4': 'ready',
  'land-ws-1': 'ready',
  'land-ws-2': 'ready',
  'land-ws-3': 'ready',
  'land-ws-4': 'ready',
  'land-ws-5': 'ready',
  // UI pieces
  'ui-map': 'ready',
  'ui-house': 'ready',
  'ui-padlock': 'ready',
  'ui-bloom': 'ready',
  'ui-bud-open': 'ready',
  'ui-bud-closed': 'ready',
  'ui-arch-open': 'ready',
  // Thomas makes this one in Midjourney later.
  'ui-arch-closed': 'pending',
}

/** The emblem id of a land. */
export function landArtId(land: Pick<Land, 'world' | 'number'>): LandArtId {
  const world = land.world === 'math' ? 'ng' : 'ws'
  return `land-${world}-${land.number}` as LandArtId
}

/** Site-root URL of a piece at one size; `undefined` while it is pending. */
export function pathArtSrc(
  id: PathArtId,
  size: PathArtSize,
): string | undefined {
  if (PATH_ART[id] === 'pending') return undefined
  return `/${PATH_ART_DIR}/${id}-${size}.webp`
}
