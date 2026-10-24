/**
 * @vitest-environment node
 *
 * The voice-QA page and the closed math pools (no-Claude plan phase 5a,
 * `design/native/no-claude-sizing.md` § 2: render, then ear-test on
 * `/voice-qa.html?filter=new`). The page's own code (`computeItems`,
 * `diffAgainstBaseline`, evaluated out of public/voice-qa.html) shows:
 * - every pool file is on the page (`CANON_FILES`);
 * - before the render the pools add no row (a reused clip is an old row,
 *   an empty one is not listed);
 * - after the render "New / changed" lists exactly one row per new
 *   request text, the render bill's line count, and changes no old row.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { servedCanon } from '@marian/core/wire/canonPool'
import { renderElevenLabsText } from '../api/_tts_elevenlabs.js'
import { MATH_POOL_STEPS, poolRenderBill } from './generateMathPools'
import {
  computeItems,
  diffAgainstBaseline,
  loadPageDefinitions,
} from './voiceQaBaseline'

const PUBLIC = join(process.cwd(), 'public')
const defs = loadPageDefinitions(
  readFileSync(join(PUBLIC, 'voice-qa.html'), 'utf8'),
)
const POOL_FILES = new Set(
  MATH_POOL_STEPS.map((s) => `canon/math/level-1/${s}.json`),
)

type Doc = {
  plan?: unknown
  utterances: { id: string; text: string; audio: { base64: string } }[]
}

/** public/ as it is, with `edit` applied to the pool files. */
const tree =
  (edit: (doc: Doc) => Doc) =>
  (path: string): Uint8Array | null => {
    const abs = join(PUBLIC, path)
    if (!existsSync(abs)) return null
    const bytes = readFileSync(abs)
    if (!POOL_FILES.has(path)) return bytes
    return Buffer.from(JSON.stringify(edit(JSON.parse(bytes.toString()))))
  }

/** What `revoiceCanonLily.ts --unrendered` does, with a fake take: one clip
 *  per request text, into every empty line. */
const rendered = (doc: Doc): Doc => ({
  ...doc,
  utterances: doc.utterances.map((u) =>
    u.audio.base64 !== ''
      ? u
      : {
          ...u,
          audio: {
            ...u.audio,
            base64: createHash('sha256')
              .update(`take|${renderElevenLabsText(u.text)}`)
              .digest('base64'),
          },
        },
  ),
})

describe('voice-QA rows for the closed math pools', () => {
  it('lists every canon file, the pool files included', () => {
    const listed = new Set(
      defs.CANON_FILES.map(([g, stem]) => `canon/${g}/level-1/${stem}.json`),
    )
    const onDisk = ['math', 'word-song'].flatMap((g) =>
      readdirSync(join(PUBLIC, 'canon', g, 'level-1'))
        .filter((f) => f.endsWith('.json'))
        .map((f) => `canon/${g}/level-1/${f}`),
    )
    expect(onDisk.filter((p) => !listed.has(p))).toEqual([])
    expect([...POOL_FILES].filter((p) => !listed.has(p))).toEqual([])
  })

  it('before the render the pools add no row; after it, one new row per new line', () => {
    const withoutPools = computeItems(
      defs,
      tree((d) => servedCanon(d)),
    ).items
    const now = computeItems(
      defs,
      tree((d) => d),
    ).items
    expect(diffAgainstBaseline(defs, now, withoutPools)).toEqual({
      added: [],
      changed: [],
    })

    const after = computeItems(defs, tree(rendered)).items
    const diff = diffAgainstBaseline(defs, after, now)
    expect(diff.changed).toEqual([])
    expect(diff.added).toHaveLength(poolRenderBill().total.lines)
    expect(diff.added).toHaveLength(266)
  }, 60_000)
})
