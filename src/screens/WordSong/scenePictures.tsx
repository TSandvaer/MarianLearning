/**
 * Scene illustration renderer for the simple-sentences tier (Wave 13,
 * ticket 86ca8e6fr).
 *
 * What a scene is
 * ---------------
 * The gentle phase (problems 1–3) of the simple-sentences cloze tier shows
 * a small illustration depicting the COMPLETED sentence ("The cat sat on
 * the mat." → a cat sitting on a mat). The scene is comprehension context
 * for an emergent L2 reader (Dave's W13-01 §"Picture role" / Kyle's W13-02
 * §3.2, §8) — it is NOT the answer; Marian taps the written-word chip, not
 * the scene. Trap problems (4–8) render NO scene by Dave's ruling.
 *
 * Asset source + graceful fallback
 * --------------------------------
 * Scenes are a NEW asset class (multi-subject scenes, not single-subject
 * vocabulary cards). Thomas produces the Midjourney pack; each scene ships
 * at `public/assets/scenes/scene-<sceneId>.svg` (Kyle §8.2). Until an
 * asset lands, the registry (`sceneRegistry.ts`) has no entry for that
 * `sceneId`, so `ScenePanel` renders NOTHING (returns `null`) — a graceful
 * text-only fallback. A missing scene NEVER bricks the screen: the
 * sentence panel + chips carry the full mechanic on their own (Dave
 * §"Asset scope note" — scenes are a comprehension scaffold, not a
 * mechanic gate).
 *
 * `sceneId === undefined` (trap problem) ALSO renders nothing — same
 * predicate, no special-casing (Kyle §1.3: "sceneId absence is BOTH the
 * trap-phase signal AND the missing-asset fallback").
 *
 * Registry shape: `SCENE_PICTURES` + `sceneSrc` live in `sceneRegistry.ts`
 * (data + pure helpers — split out so this file exports only components).
 * The Vite PWA `globPatterns` already covers `svg`, so each scene asset is
 * auto-precached without config changes (same as the picture pack). Per
 * Kyle §8.3 each scene SVG is budgeted < 400 KB — well under the 8 MiB
 * workbox per-file cap.
 */

import { sceneSrc } from './sceneRegistry'

interface ScenePanelProps {
  /** The problem's `sceneId` (gentle-phase scene key, or `undefined`). */
  sceneId: string | undefined
  /** Accessible label — the sentence the scene depicts, for screen readers. */
  ariaLabel: string
}

/**
 * Render the gentle-phase scene illustration above the sentence panel, OR
 * nothing when no scene is registered for the `sceneId` (trap phase OR a
 * missing asset — graceful text-only fallback, Kyle §8.2).
 *
 * The panel is 280×210pt (4:3), centered, above the sentence panel
 * (Kyle §3.1, §8.3). The SVG embeds the background-removed PNG via
 * `<image href>` — the same PNG-in-SVG technique as the picture pack.
 */
export function ScenePanel({ sceneId, ariaLabel }: ScenePanelProps) {
  const src = sceneSrc(sceneId)
  // No registered scene → render nothing (trap phase OR missing asset).
  // This is the load-bearing graceful fallback: the screen never shows a
  // broken-image and never crashes on an absent scene.
  if (src === undefined) return null

  return (
    <div
      data-testid="word-song-scene-panel"
      data-scene-id={sceneId}
      className="flex items-center justify-center"
      style={{ width: '280px', height: '210px' }}
    >
      <svg
        data-testid="word-song-scene"
        data-scene-id={sceneId}
        role="img"
        aria-label={ariaLabel}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 280 210"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%' }}
      >
        <image href={src} x="0" y="0" width="280" height="210" />
      </svg>
    </div>
  )
}
