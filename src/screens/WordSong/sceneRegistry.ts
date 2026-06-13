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
 * sceneId → on-disk scene SVG URL. Populated with Thomas's Wave-13
 * gentle-phase scene pack (8 scenes; PNG-in-SVG embeds via the picture-pack
 * pipeline). One row per gentle `sceneId` the parser may emit (per the
 * gentle rows of `WORD_SONG_SIMPLE_SENTENCES`). A `sceneId` absent here →
 * text-only render (graceful fallback).
 */
export const SCENE_PICTURES: Readonly<Record<string, string>> = {
  'cat-sat-mat': '/assets/scenes/scene-cat-sat-mat.svg',
  'dog-ran': '/assets/scenes/scene-dog-ran.svg',
  'man-ran': '/assets/scenes/scene-man-ran.svg',
  'see-dog': '/assets/scenes/scene-see-dog.svg',
  'she-has-bag': '/assets/scenes/scene-she-has-bag.svg',
  'cat-sat-prep': '/assets/scenes/scene-cat-sat-prep.svg',
  'dog-ran-in': '/assets/scenes/scene-dog-ran-in.svg',
  'he-can-see': '/assets/scenes/scene-he-can-see.svg',
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
