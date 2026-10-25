/**
 * @vitest-environment node
 *
 * Canon integrity gate (replaces the removed `prebuild` net). See
 * `scripts/canonIntegrity.ts` for why each check exists.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  emptyAudioSlots,
  missingCanonFiles,
  unrenderedPoolSlots,
} from './canonIntegrity.ts'
import { activeCombos } from './generateSessionCanon.ts'

const CANON_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'canon',
)

describe('committed canon (public/canon)', () => {
  it('(a) every committed canon utterance the server or the app serves has audio', () => {
    // A failure lists { file, id } for each silent line. Fix: run
    // `npx tsx scripts/revoiceCanonLily.ts --unrendered` before committing.
    expect(emptyAudioSlots(CANON_ROOT)).toEqual([])
  })

  it('(b) every active step has a committed canon file', () => {
    // A failure lists the combos. Fix: bake (text) + Lily render + commit.
    expect(missingCanonFiles(CANON_ROOT, activeCombos())).toEqual([])
  })
})

describe('the checks catch a doctored canon', () => {
  let root: string
  const write = (rel: string, doc: unknown) => {
    const path = join(root, rel)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(doc))
  }
  const audio = (base64: string) => ({
    kind: 'inline',
    base64,
    mime: 'audio/mpeg',
  })

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-integrity-'))
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('(a) names the file and id of every empty or missing audio slot', () => {
    write('math/level-1/add-to-10.json', {
      utterances: [
        { id: 'math.p1.read', text: 'One plus one.', audio: audio('//s=') },
        { id: 'math.p1.correct', text: 'Yes!', audio: audio('') },
      ],
    })
    write('word-song/level-1/cvc-words.json', {
      utterances: [{ id: 'word.p1.read', text: 'Read the cat.' }],
    })
    expect(emptyAudioSlots(root)).toEqual([
      {
        file: join('math', 'level-1', 'add-to-10.json'),
        id: 'math.p1.correct',
      },
      {
        file: join('word-song', 'level-1', 'cvc-words.json'),
        id: 'word.p1.read',
      },
    ])
  })

  it("(a) leaves a step's pool out: a pool line waits for its render, never served", () => {
    // No-Claude plan phase 5a: problems 9+ are the step's pool. The server
    // serves the file without them and the device draws a pool block only
    // once all its clips are bundled, so an empty pool slot is not silent
    // to anyone. `unrenderedPoolSlots` lists them (the render's to-do).
    write('math/level-1/add-to-10.json', {
      utterances: [
        { id: 'math.p8.read', text: 'One plus one.', audio: audio('//s=') },
        { id: 'math.p9.read', text: 'Two plus two.', audio: audio('') },
        { id: 'math.p9.correct', text: 'Yes!', audio: audio('//s=') },
      ],
    })
    expect(emptyAudioSlots(root)).toEqual([])
    expect(unrenderedPoolSlots(root)).toEqual([
      { file: join('math', 'level-1', 'add-to-10.json'), id: 'math.p9.read' },
    ])
  })

  it('(a) passes a canon whose every line has audio', () => {
    write('math/level-1/add-to-10.json', {
      utterances: [{ id: 'math.p1.read', text: 'Hi.', audio: audio('//s=') }],
    })
    expect(emptyAudioSlots(root)).toEqual([])
  })

  it('(b) names each active combo without a file, via the reader mapping', () => {
    // `two-digit-addsub-no-regroup` is served from `two-digit-addsub.json`.
    write('math/level-1/two-digit-addsub.json', { utterances: [] })
    const present = {
      track: 'math' as const,
      level: 1,
      focusNode: 'two-digit-addsub-no-regroup',
    }
    const missing = {
      track: 'word-song' as const,
      level: 1,
      focusNode: 'digraphs-sh',
    }
    expect(missingCanonFiles(root, [present, missing])).toEqual([missing])
  })
})
