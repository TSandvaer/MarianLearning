/**
 * Scene illustration registry + lookup for the simple-sentences tier
 * (Wave 13, ticket 86ca8e6fr). Data + pure helpers ONLY — the
 * `ScenePanel` component lives in `scenePictures.tsx` (split out so the
 * component file exports only components, per `react-refresh`).
 *
 * See `scenePictures.tsx` for the full doc on what a scene is and the
 * graceful text-only fallback.
 */

/**
 * sceneId → on-disk scene SVG URL. EMPTY until Thomas's MJ scene pack
 * ships (the gentle-phase scenes are an asset dispatch, not code). Add one
 * row per gentle `sceneId` as assets land, e.g.:
 *
 *   'cat-sat-mat': '/assets/scenes/scene-cat-sat-mat.svg',
 *
 * The 8 gentle `sceneId`s the parser may emit (per the gentle rows of
 * `WORD_SONG_SIMPLE_SENTENCES`): cat-sat-mat, dog-ran, man-ran, see-dog,
 * she-has-bag, cat-sat-prep, dog-ran-in, he-can-see. A `sceneId` absent
 * here → text-only render (graceful fallback).
 */
export const SCENE_PICTURES: Readonly<Record<string, string>> = {
  // (intentionally empty — populated as Thomas's MJ scene pack lands)
}

/**
 * Resolve the on-disk SVG URL for a `sceneId`, or `undefined` if no scene
 * is registered (trap phase OR a not-yet-shipped gentle asset → text-only
 * fallback). Pure.
 */
export function sceneSrc(sceneId: string | undefined): string | undefined {
  if (sceneId === undefined) return undefined
  return SCENE_PICTURES[sceneId]
}
