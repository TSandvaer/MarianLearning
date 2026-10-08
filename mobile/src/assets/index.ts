/**
 * Bundled images, looked up by the URL path the web app renders.
 *
 * Core already computes those paths (`pathArtSrc`, `sceneSrc`), so native
 * screens pass the same value here instead of keeping a second id → file
 * mapping. Every lookup returns `undefined` for an unknown path; screens
 * keep the web's graceful fallbacks (e.g. a text-only sentence when a
 * scene has no picture).
 *
 * The images are WebP exports of the web assets (`npm run export-assets`).
 */
import type { EmmaPose } from '@marian/core/character/emmaPose'
import {
  pathArtSrc,
  type PathArtId,
  type PathArtSize,
} from '@marian/core/emmasPath/pathArt'
import { sceneSrc } from '@marian/core/wordSong/sceneRegistry'
import { WEB_ASSET_MODULES } from './registry'

/** A bundled image module (`require('…webp')`), for expo-image's `source`. */
export type NativeImage = number

/** Emma's poses plus the Splash logo and the `th` mouth close-up. */
export type EmmaArt = EmmaPose | 'logo' | 'th-mouth'

export function assetForWebPath(webPath: string): NativeImage | undefined {
  return Object.prototype.hasOwnProperty.call(WEB_ASSET_MODULES, webPath)
    ? WEB_ASSET_MODULES[webPath]
    : undefined
}

export function emmaAsset(art: EmmaArt): NativeImage | undefined {
  return assetForWebPath(`/assets/emma-${art}.svg`)
}

/** A Word Song picture-pack key (`cat`, `bus`, ...). */
export function pictureAsset(key: string): NativeImage | undefined {
  return assetForWebPath(`/assets/pictures/picture-${key}.svg`)
}

/** A simple-sentences scene, by the planner's `sceneId`. */
export function sceneAsset(
  sceneId: string | undefined,
): NativeImage | undefined {
  const src = sceneSrc(sceneId)
  return src === undefined ? undefined : assetForWebPath(src)
}

/** Emma's Path clay art at one of its two shipped sizes. */
export function pathArtAsset(
  id: PathArtId,
  size: PathArtSize,
): NativeImage | undefined {
  return assetForWebPath(pathArtSrc(id, size))
}
