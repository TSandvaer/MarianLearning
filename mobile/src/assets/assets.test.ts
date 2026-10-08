/**
 * The bundled images cover everything core and the web app can ask for.
 * A new pose, scene, picture or path-art piece without a native export
 * fails here: run `npm run export-assets`.
 */
import { TILT_BY_POSE, type EmmaPose } from '@marian/core/character/emmaPose'
import { PATH_ART_IDS, PATH_ART_SIZES } from '@marian/core/emmasPath/pathArt'
import { SCENE_PICTURES } from '@marian/core/wordSong/sceneRegistry'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  assetForWebPath,
  emmaAsset,
  pathArtAsset,
  pictureAsset,
  sceneAsset,
} from './index'
import { WEB_ASSET_MODULES } from './registry'

const WEB_ASSETS = join(__dirname, '..', '..', '..', 'public', 'assets')

describe('native asset registry', () => {
  it('has every Emma pose, the logo and the th mouth', () => {
    const poses = Object.keys(TILT_BY_POSE) as EmmaPose[]
    expect(poses.length).toBeGreaterThanOrEqual(8)
    for (const pose of poses) expect(emmaAsset(pose)).toBeDefined()
    expect(emmaAsset('logo')).toBeDefined()
    expect(emmaAsset('th-mouth')).toBeDefined()
  })

  it('has every Emma’s Path art piece at both sizes', () => {
    for (const id of PATH_ART_IDS) {
      for (const size of PATH_ART_SIZES) {
        expect([id, size, pathArtAsset(id, size) !== undefined]).toEqual([
          id,
          size,
          true,
        ])
      }
    }
  })

  it('has every registered simple-sentences scene', () => {
    const ids = Object.keys(SCENE_PICTURES)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids)
      expect([id, sceneAsset(id) !== undefined]).toEqual([id, true])
    expect(sceneAsset(undefined)).toBeUndefined()
    expect(sceneAsset('no-such-scene')).toBeUndefined()
  })

  it('has every picture the web ships', () => {
    const files = readdirSync(join(WEB_ASSETS, 'pictures')).filter((f) =>
      /^picture-.+\.svg$/.test(f),
    )
    expect(files.length).toBeGreaterThan(40)
    for (const file of files) {
      const key = file.slice('picture-'.length, -'.svg'.length)
      expect([key, pictureAsset(key) !== undefined]).toEqual([key, true])
    }
  })

  it('every registry entry is a web asset that still exists', () => {
    for (const webPath of Object.keys(WEB_ASSET_MODULES)) {
      expect([webPath, existsSync(join(WEB_ASSETS, '..', webPath))]).toEqual([
        webPath,
        true,
      ])
    }
  })

  it('unknown paths (and Object.prototype keys) are undefined', () => {
    expect(assetForWebPath('/assets/nope.svg')).toBeUndefined()
    expect(assetForWebPath('constructor')).toBeUndefined()
  })
})
