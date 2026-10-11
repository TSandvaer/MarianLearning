/**
 * The generated blend marks match the baked canon clip for clip (spec
 * § 5 acceptance: an entry for each of the 40 blend utterances, `bytes` =
 * the canon MP3's length, 4 segments in order), and the timing helpers.
 */
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

function canonBlends(): Map<string, number> {
  const out = new Map<string, number>()
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
            out.set(u.text, Buffer.from(u.audio.base64, 'base64').length)
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

  it('cover the 40 canon blend clips, byte for byte', () => {
    expect(canon.size).toBe(40)
    expect(Object.keys(BLEND_MARKS).sort()).toEqual([...canon.keys()].sort())
    for (const [text, bytes] of canon) {
      expect([text, BLEND_MARKS[text]!.bytes]).toEqual([text, bytes])
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
