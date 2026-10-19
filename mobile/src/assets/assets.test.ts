/**
 * The bundled images cover everything core and the web app can ask for.
 * A new pose, scene, picture or path-art piece without a native export
 * fails here: run `npm run export-assets`.
 */
import { TILT_BY_POSE, type EmmaPose } from '@marian/core/character/emmaPose'
import { PATH_ART_IDS, PATH_ART_SIZES } from '@marian/core/emmasPath/pathArt'
import { SCENE_PICTURES } from '@marian/core/wordSong/sceneRegistry'
import { LITTLE_STORIES } from '@marian/core/wordSong/littleStories'
import { NOVEL_PROBE_WORDS } from '@marian/core/wordSong/novelProbeWords'
import { BIG_WORDS_STEPS } from '@marian/core/wordSong/bigWordsSteps'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  assetForWebPath,
  emmaAsset,
  emmaIdleShadowAsset,
  pathArtAsset,
  pathArtLockedAsset,
  pathArtMutedAsset,
  pictureAsset,
  sceneAsset,
  storySceneAsset,
} from './index'
import { LANDS } from '@marian/core/progress/lands'
import { LITERACY_TREE, MATH_TREE } from '@marian/core/progress/mastery'
import { WEB_ASSET_MODULES } from './registry'

const WEB_ASSETS = join(__dirname, '..', '..', '..', 'public', 'assets')
const SCENES = join(__dirname, '..', '..', 'assets', 'scenes')

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

  it("has each wave-3 little story's own scene, so none falls back to the answer's picture", () => {
    const wave3 = LITTLE_STORIES.filter((s) =>
      ['fox-stories', 'hen-stories', 'bug-stories'].includes(s.node),
    )
    expect(wave3).toHaveLength(24)
    for (const { id } of wave3) {
      const key = `/native/scenes/story-${id}.webp`
      expect([id, existsSync(join(SCENES, `story-${id}.webp`))]).toEqual([
        id,
        true,
      ])
      expect([id, key in WEB_ASSET_MODULES]).toEqual([id, true])
      expect(storySceneAsset(id)).toBe(WEB_ASSET_MODULES[key])
    }
    // Each its own file: 24 different modules.
    const modules = wave3.map(({ id }) => storySceneAsset(id))
    expect(new Set(modules.map((m) => JSON.stringify(m))).size).toBe(24)
    expect(storySceneAsset(undefined)).toBeUndefined()
    expect(storySceneAsset('no-such-story')).toBeUndefined()
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

  it('has the four novel-probe pictures baked, and none for a word without art', () => {
    for (const key of NOVEL_PROBE_WORDS) {
      expect([key, pictureAsset(key) !== undefined]).toEqual([key, true])
    }
    expect(pictureAsset('shell')).toBeUndefined()
  })

  // Content wave 1 (design/native/content-wave-1.md § 3.5, § 4.4, AC 8)
  // and content wave 2 (content-wave-2.md § 7, AC 14): the 32 land-6 words
  // draw as pictures, so every chip is a picture. Red
  // until Thomas's picture pack is embedded and `npm run export-assets`
  // bakes it (without them the problems fall back to written-word chips).
  it('has a picture for every land-6 word (duck, crab, tent and cake words)', () => {
    const keys = (
      ['duck-words', 'crab-words', 'tent-words', 'cake-words'] as const
    ).flatMap((step) => BIG_WORDS_STEPS[step].map((r) => r.word))
    expect(keys).toHaveLength(32)
    expect(keys.filter((key) => pictureAsset(key) === undefined)).toEqual([])
  })

  // Content wave 4 (content-wave-4.md § 9.1, AC 4): the 16 bee and car
  // words and ship draw as pictures (Thomas's 17 picks; a missing one
  // would draw its problem as written words, the shipped fallback).
  it('has a picture for every bee-words and car-words word and ship (AC 4)', () => {
    const keys = [
      ...(['bee-words', 'car-words'] as const).flatMap((step) =>
        BIG_WORDS_STEPS[step].map((r) => r.word),
      ),
      'ship',
    ]
    expect(keys).toHaveLength(17)
    expect(keys.filter((key) => pictureAsset(key) === undefined)).toEqual([])
  })

  // Content wave 4 § 9.2: the 8 sheep-story scenes (Thomas's picks; a
  // missing one would reveal the answer's picture, the shipped fallback).
  it("has each sheep story's own scene (content wave 4 § 9.2)", () => {
    const sheep = LITTLE_STORIES.filter((s) => s.node === 'sheep-stories')
    expect(sheep).toHaveLength(8)
    for (const { id } of sheep)
      expect([id, storySceneAsset(id) !== undefined]).toEqual([id, true])
  })

  // Content wave 5 (content-wave-5.md § 10.1, AC 4): the 16 snail and moon
  // words draw as pictures (Thomas's picks of 2026-10-19; a missing one
  // would draw its problem as written words, the shipped fallback, § 11).
  it('has a picture for every snail-words and moon-words word (AC 4)', () => {
    const keys = (['snail-words', 'moon-words'] as const).flatMap((step) =>
      BIG_WORDS_STEPS[step].map((r) => r.word),
    )
    expect(keys).toHaveLength(16)
    expect(keys.filter((key) => pictureAsset(key) === undefined)).toEqual([])
  })

  // Content wave 5 § 10.2: the 8 goat-story scenes (Thomas's picks of
  // 2026-10-19; a missing one would reveal the answer's picture, § 11).
  it("has each goat story's own scene (content wave 5 § 10.2)", () => {
    const goat = LITTLE_STORIES.filter((s) => s.node === 'goat-stories')
    expect(goat).toHaveLength(8)
    for (const { id } of goat)
      expect([id, storySceneAsset(id) !== undefined]).toEqual([id, true])
  })

  it("has the Hub bakes: idle Emma's shadow and a muted copy of every 256 px path art", () => {
    expect(emmaIdleShadowAsset()).toBeDefined()
    for (const id of PATH_ART_IDS) {
      expect([id, pathArtMutedAsset(id) !== undefined]).toEqual([id, true])
    }
  })

  it("has the map's bake: a locked copy of every step's sticker, and nothing else", () => {
    // Every step of both trees, from the tree data (the count grows with
    // each content wave).
    const steps = LANDS.flatMap((land) => land.nodes)
    expect(steps).toEqual([...MATH_TREE, ...LITERACY_TREE])
    for (const node of steps) {
      expect([node, pathArtLockedAsset(node) !== undefined]).toEqual([
        node,
        true,
      ])
    }
    const locked = Object.keys(WEB_ASSET_MODULES).filter((k) =>
      k.endsWith('-locked.webp'),
    )
    expect(locked.sort()).toEqual(
      steps.map((node) => `/native/path/${node}-256-locked.webp`).sort(),
    )
  })

  it('every registry entry is a web asset that still exists', () => {
    // Native-only bakes (`/native/...`) come from a web asset that exists.
    const source = (key: string) =>
      key === '/native/emma/idle-shadow.webp'
        ? '/assets/emma-idle.svg'
        : key.replace(
            /^\/native\/path\/(.+)-(muted|locked)\.webp$/,
            '/assets/path/$1.webp',
          )
    // The probe pictures are baked from the web's inline SVG
    // (`src/screens/WordSong/wordPictures.tsx`), not from a file, unless a
    // pack picture (`picture-<key>.svg`) exists for them: then only that one
    // is exported (export-assets.mjs), so each probe word has exactly one.
    const probes = Object.keys(WEB_ASSET_MODULES).filter((k) =>
      k.startsWith('/native/pictures/'),
    )
    const baked = probes.map((k) => k.slice('/native/pictures/'.length))
    expect(baked.filter((key) => !NOVEL_PROBE_WORDS.includes(key))).toEqual([])
    for (const key of NOVEL_PROBE_WORDS) {
      const packed = `/assets/pictures/picture-${key}.svg` in WEB_ASSET_MODULES
      expect([key, packed !== baked.includes(key)]).toEqual([key, true])
    }
    for (const key of Object.keys(WEB_ASSET_MODULES)) {
      if (key.startsWith('/native/pictures/')) continue
      // The little stories' scenes have no web source (native only; the
      // test above checks each file).
      if (key.startsWith('/native/scenes/story-')) continue
      const webPath = key.startsWith('/native/') ? source(key) : key
      expect(webPath.startsWith('/assets/')).toBe(true)
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
