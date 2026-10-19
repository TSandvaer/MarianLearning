/**
 * The generated blend marks match the baked canon clip for clip (spec
 * § 5 acceptance: an entry for each of the 40 blend utterances, `bytes` =
 * the canon MP3's length, 4 segments in order), and the timing helpers.
 *
 * Real blending (`design/native/real-blending.md` § 7, § 11) adds 6 blends
 * (mat, bat, can, cap, dad, jam): 46, measured by `npm run export-assets`
 * after their Lily render; fewer than 6 new entries would mean a retake.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { REPO_ROOT } from '../../test/webSource'
import { BLEND_MARKS } from './blendMarks.generated'
import {
  blendMarksFor,
  blendRevealAt,
  letterWindow,
  litAt,
  wordWindow,
  type Segment,
} from './blendMarks'

/** Each canon blend clip's byte length and content hash, by its text. */
function canonBlends(): Map<string, { bytes: number; sha256: string }> {
  const out = new Map<string, { bytes: number; sha256: string }>()
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (name.endsWith('.json')) {
        const json = JSON.parse(readFileSync(p, 'utf8')) as {
          utterances?: {
            id: string
            text: string
            audio?: { base64: string }
          }[]
        }
        for (const u of json.utterances ?? []) {
          if (/^word\.p\d+\.blend$/.test(u.id) && u.audio) {
            const mp3 = Buffer.from(u.audio.base64, 'base64')
            out.set(u.text, {
              bytes: mp3.length,
              sha256: createHash('sha256')
                .update(mp3)
                .digest('hex')
                .slice(0, 16),
            })
          }
        }
      }
    }
  }
  walk(resolve(REPO_ROOT, 'public', 'canon', 'word-song'))
  return out
}

describe('the generated marks', () => {
  const canon = canonBlends()

  it('cover the 46 canon blend clips: same length, same content', () => {
    expect(canon.size).toBe(46)
    expect(Object.keys(BLEND_MARKS).sort()).toEqual([...canon.keys()].sort())
    for (const [text, clip] of canon) {
      const { bytes, sha256 } = BLEND_MARKS[text]!
      // The hash catches a re-bake that keeps the length (the clips are
      // CBR: 9 different ones are 25494 bytes).
      expect([text, bytes, sha256]).toEqual([text, clip.bytes, clip.sha256])
    }
  })

  it('hold 4 segments each, in order', () => {
    for (const [text, { segments }] of Object.entries(BLEND_MARKS)) {
      expect([text, segments.length]).toEqual([text, 4])
      let last = -1
      for (const [on, off] of segments) {
        expect(on).toBeGreaterThan(last)
        expect(off).toBeGreaterThan(on)
        last = off
      }
    }
  })
})

const SEGS: Segment[] = [
  [43, 337],
  [885, 1164],
  [1628, 1888],
  [2661, 3121],
]

it('a mark is used only on the clip it was measured on', () => {
  const text = 'b - a - g ... bag'
  const bytes = BLEND_MARKS[text]!.bytes
  expect(blendMarksFor(text, bytes)).toEqual(BLEND_MARKS[text]!.segments)
  expect(blendMarksFor(text, bytes + 1)).toBeNull()
  expect(blendMarksFor(text, undefined)).toBeNull()
  expect(blendMarksFor('Tap the cat.', 100)).toBeNull()
})

it('lights each letter 40 ms before its sound, all of them before the word', () => {
  expect(litAt(SEGS, 2, 3)).toBeNull()
  expect(litAt(SEGS, 3, 3)).toBe(0)
  expect(litAt(SEGS, 844, 3)).toBe(0)
  expect(litAt(SEGS, 845, 3)).toBe(1)
  expect(litAt(SEGS, 1588, 3)).toBe(2)
  expect(litAt(SEGS, 2621, 3)).toBe(3)
})

it('shows each caption token at its mark, a separator with the token after it', () => {
  const text = 'b - a - g ... bag'
  expect(blendRevealAt(text, SEGS, 0)).toBe(0)
  expect(blendRevealAt(text, SEGS, 3)).toBe(1) // "b"
  expect(blendRevealAt(text, SEGS, 844)).toBe(1)
  expect(blendRevealAt(text, SEGS, 845)).toBe(3) // "b - a"
  expect(blendRevealAt(text, SEGS, 1588)).toBe(5)
  expect(blendRevealAt(text, SEGS, 2621)).toBe(7)
})

it('tap windows: a letter ±, the word to the end', () => {
  expect(letterWindow([885, 1164])).toEqual({ from: 855, to: 1244 })
  expect(letterWindow([10, 300])).toEqual({ from: 0, to: 380 })
  expect(wordWindow(SEGS)).toEqual({ from: 2631, to: null })
})
