import { describe, expect, it } from 'vitest'

import { SCENE_PICTURES, sceneSrc } from './sceneRegistry'
import { SIMPLE_SENTENCE_SCENES } from './wordPack'

/**
 * The 8 gentle-phase sceneIds Thomas's Wave-13 MJ scene pack ships
 * (per `design/word-song/simple-sentences-content.md` §8 + the gentle rows
 * of `WORD_SONG_SIMPLE_SENTENCES`). These are the ids the parser
 * (`planFromServer.ts`) can emit onto a gentle `WordSongProblem.sceneId`.
 */
const GENTLE_SCENE_IDS = [
  'cat-sat-mat',
  'dog-ran',
  'man-ran',
  'see-dog',
  'she-has-bag',
  'cat-sat-prep',
  'dog-ran-in',
  'he-can-see',
] as const

describe('sceneRegistry — SCENE_PICTURES coverage', () => {
  it('registers all 8 gentle sceneIds', () => {
    expect(Object.keys(SCENE_PICTURES).sort()).toEqual(
      [...GENTLE_SCENE_IDS].sort(),
    )
  })

  it.each(GENTLE_SCENE_IDS)(
    'sceneSrc(%s) resolves to the conventional scene SVG URL',
    (sceneId) => {
      const src = sceneSrc(sceneId)
      expect(src).toBe(`/assets/scenes/scene-${sceneId}.svg`)
    },
  )

  it.each(GENTLE_SCENE_IDS)(
    'sceneSrc(%s) is a non-empty /assets/scenes/ URL',
    (sceneId) => {
      const src = sceneSrc(sceneId)
      expect(src).toBeDefined()
      expect(src).not.toBe('')
      expect(src!.startsWith('/assets/scenes/')).toBe(true)
    },
  )

  it('every value points at a distinct on-disk scene asset', () => {
    const urls = Object.values(SCENE_PICTURES)
    expect(new Set(urls).size).toBe(urls.length)
  })
})

describe('sceneRegistry — drift guard against the parser sceneId set', () => {
  // The parser DERIVES `sceneId` from the displayed frame via
  // `SIMPLE_SENTENCE_SCENES` (wordPack.ts). Every sceneId the parser can
  // emit MUST have a registered asset here, or a gentle problem would fall
  // back to text-only despite the scene pack having shipped. This pins the
  // render registry to the parser's emitted set so they never drift.
  it('every parser-emittable sceneId resolves to a scene asset', () => {
    for (const sceneId of Object.values(SIMPLE_SENTENCE_SCENES)) {
      const src = sceneSrc(sceneId)
      expect(src, `no scene asset registered for sceneId "${sceneId}"`).toBe(
        `/assets/scenes/scene-${sceneId}.svg`,
      )
    }
  })

  it('SCENE_PICTURES has no orphan keys the parser never emits', () => {
    const emittable = new Set(Object.values(SIMPLE_SENTENCE_SCENES))
    for (const sceneId of Object.keys(SCENE_PICTURES)) {
      expect(emittable.has(sceneId), `orphan registry key "${sceneId}"`).toBe(
        true,
      )
    }
  })
})

describe('sceneRegistry — absent / trap-phase fallback', () => {
  it('sceneSrc(undefined) → undefined (trap phase, no scene)', () => {
    expect(sceneSrc(undefined)).toBeUndefined()
  })

  it('sceneSrc(unknown id) → undefined (graceful text-only fallback)', () => {
    expect(sceneSrc('zzz-not-a-scene')).toBeUndefined()
  })

  it('sceneSrc empty string → undefined', () => {
    expect(sceneSrc('')).toBeUndefined()
  })
})
