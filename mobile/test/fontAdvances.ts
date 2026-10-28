/**
 * Text widths from a TrueType font's advances (cmap format 4 + hmtx), no
 * kerning: the measure `design/native/content-wave-3.md` § 4.3 used for
 * its line counts, so a layout test can pin them without a renderer.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Fredoka 600, the story card's face (`fonts.semibold`). */
export const FREDOKA_600 = resolve(
  __dirname,
  '..',
  'node_modules/@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf',
)

/** Fredoka 700, the games' type (`fonts.bold`). */
export const FREDOKA_700 = resolve(
  __dirname,
  '..',
  'node_modules/@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf',
)

/** `text`'s width at `size` pt, in pt. */
export type MeasureText = (text: string, size: number) => number

export function fontMeasure(file: string): MeasureText {
  const d = readFileSync(file)
  const tables = new Map<string, number>()
  for (let i = 0; i < d.readUInt16BE(4); i++) {
    const at = 12 + 16 * i
    tables.set(d.toString('latin1', at, at + 4), d.readUInt32BE(at + 8))
  }
  const table = (tag: string) => {
    const at = tables.get(tag)
    if (at === undefined) throw new Error(`${file}: no ${tag} table`)
    return at
  }
  const unitsPerEm = d.readUInt16BE(table('head') + 18)
  const longMetrics = d.readUInt16BE(table('hhea') + 34)
  const hmtx = table('hmtx')
  const advance = (glyph: number) =>
    d.readUInt16BE(hmtx + 4 * Math.min(glyph, longMetrics - 1))

  // The Unicode BMP subtable (3,1), format 4.
  const cmap = table('cmap')
  let sub = -1
  for (let i = 0; i < d.readUInt16BE(cmap + 2); i++) {
    const at = cmap + 4 + 8 * i
    if (d.readUInt16BE(at) === 3 && d.readUInt16BE(at + 2) === 1)
      sub = cmap + d.readUInt32BE(at + 4)
  }
  if (sub < 0 || d.readUInt16BE(sub) !== 4)
    throw new Error(`${file}: no format-4 (3,1) cmap`)
  const segments = d.readUInt16BE(sub + 6) / 2
  const ends = sub + 14
  const starts = ends + 2 * segments + 2
  const deltas = starts + 2 * segments
  const offsets = deltas + 2 * segments
  const glyphOf = (code: number): number => {
    for (let s = 0; s < segments; s++) {
      if (code > d.readUInt16BE(ends + 2 * s)) continue
      const start = d.readUInt16BE(starts + 2 * s)
      if (code < start) return 0
      const delta = d.readInt16BE(deltas + 2 * s)
      const offset = d.readUInt16BE(offsets + 2 * s)
      if (offset === 0) return (code + delta) & 0xffff
      const g = d.readUInt16BE(offsets + 2 * s + offset + 2 * (code - start))
      return g === 0 ? 0 : (g + delta) & 0xffff
    }
    return 0
  }

  return (text, size) => {
    let units = 0
    for (const ch of text) {
      const glyph = glyphOf(ch.codePointAt(0) ?? 0)
      if (glyph === 0) throw new Error(`${file}: no glyph for "${ch}"`)
      units += advance(glyph)
    }
    return (units * size) / unitsPerEm
  }
}
