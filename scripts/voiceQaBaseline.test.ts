/**
 * Voice-QA "New / changed" diff logic.
 *
 * baselineDiffOf / initialFilterOf / canonicalItemIdOf are evaluated out of
 * public/voice-qa.html itself (the "Pure helpers" block), so these tests run
 * the exact code the page runs, not a copy.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  assertAssetGroupsKnown,
  buildBaselineFile,
  computeItems,
  diffAgainstBaseline,
  loadPageDefinitions,
  sha256Hex,
  type PageDefinitions,
} from './voiceQaBaseline'

const html = readFileSync(
  join(process.cwd(), 'public', 'voice-qa.html'),
  'utf8',
)
const defs = loadPageDefinitions(html)

describe('baselineDiffOf (page code)', () => {
  const baseline = { 'add-to-10#a': 'h1', 'hub#x.mp3': 'h2' }

  it('flags a key missing from the baseline as new', () => {
    expect(
      defs.baselineDiffOf({ itemId: 'add-to-10#b', audioHash: 'h9' }, baseline),
    ).toBe('new')
  })

  it('flags a key whose audio hash differs as changed', () => {
    expect(
      defs.baselineDiffOf({ itemId: 'add-to-10#a', audioHash: 'h9' }, baseline),
    ).toBe('changed')
  })

  it('does not list a key with the same audio hash', () => {
    expect(
      defs.baselineDiffOf({ itemId: 'add-to-10#a', audioHash: 'h1' }, baseline),
    ).toBeNull()
  })

  it('lists nothing when there is no baseline', () => {
    expect(
      defs.baselineDiffOf({ itemId: 'add-to-10#b', audioHash: 'h9' }, null),
    ).toBeNull()
  })

  it('does not mistake inherited object keys for baseline entries', () => {
    expect(
      defs.baselineDiffOf({ itemId: 'constructor', audioHash: 'h' }, baseline),
    ).toBe('new')
  })
})

describe('diffAgainstBaseline', () => {
  it('lists exactly the new and changed ids, never the unchanged ones', () => {
    const current = { same: 'h1', changedOne: 'h2-new', brandNew: 'h3' }
    const baseline = { same: 'h1', changedOne: 'h2', removed: 'h4' }
    expect(diffAgainstBaseline(defs, current, baseline)).toEqual({
      added: ['brandNew'],
      changed: ['changedOne'],
    })
  })

  it('is empty when the tree matches the baseline', () => {
    const current = { a: 'h1', b: 'h2' }
    expect(diffAgainstBaseline(defs, current, { ...current })).toEqual({
      added: [],
      changed: [],
    })
  })
})

describe('initialFilterOf (page code)', () => {
  it('opens on New / changed when there is at least one', () => {
    expect(defs.initialFilterOf('', 3)).toBe('new')
  })

  it('opens on All when nothing is new or changed', () => {
    expect(defs.initialFilterOf('', 0)).toBe('all')
  })

  it('lets an explicit ?filter= win', () => {
    expect(defs.initialFilterOf('?filter=untested', 3)).toBe('untested')
    expect(defs.initialFilterOf('?filter=all', 5)).toBe('all')
    expect(defs.initialFilterOf('?filter=new', 0)).toBe('new')
  })

  it('ignores an unknown ?filter= value', () => {
    expect(defs.initialFilterOf('?filter=bogus', 2)).toBe('new')
    expect(defs.initialFilterOf('?filter=bogus', 0)).toBe('all')
  })
})

describe('canonicalItemIdOf (page code)', () => {
  it('keys a dedup group by its alphabetically-first (file, id) member', () => {
    const members = [
      { file: 'sub-to-10', id: 'math.p1.read' },
      { file: 'add-to-20', id: 'math.p2.read' },
      { file: 'add-to-20', id: 'math.p1.read' },
    ]
    expect(defs.canonicalItemIdOf(members)).toBe('add-to-20#math.p1.read')
    expect(members.map((m) => m.file + '#' + m.id)).toEqual([
      'add-to-20#math.p1.read',
      'add-to-20#math.p2.read',
      'sub-to-10#math.p1.read',
    ])
  })
})

describe('computeItems', () => {
  const canon = (utterances: unknown[]): Uint8Array =>
    Buffer.from(JSON.stringify({ utterances }))
  const small: PageDefinitions = {
    ...defs,
    CANON_FILES: [
      ['math', 'sub-to-10'],
      ['math', 'add-to-10'],
    ],
    GREET_FILES: [['greet-01-hi.mp3', 'Hi!']],
    HUB_FILES: [],
    PATH_GROUPS: [['Path', [['path-a.mp3', 'A']]]],
    GUIDANCE_FILES: [['guide-gone.mp3', 'Gone']],
  }
  const files: Record<string, Uint8Array> = {
    'canon/math/level-1/sub-to-10.json': canon([
      { id: 'math.p1.read', audio: { base64: 'SAME' } },
      { id: 'math.p2.read', audio: { base64: 'ONLY-SUB' } },
      { id: 'math.p3.read', text: 'no audio' },
    ]),
    'canon/math/level-1/add-to-10.json': canon([
      { id: 'math.p9.read', audio: { base64: 'SAME' } },
    ]),
    'assets/audio/greet/greet-01-hi.mp3': Buffer.from([1, 2, 3]),
    'assets/audio/path/path-a.mp3': Buffer.from([4, 5]),
  }
  const result = computeItems(small, (p) => files[p] ?? null)

  it('dedups canon by audio hash, keyed like the page', () => {
    expect(result.items['add-to-10#math.p9.read']).toBe(sha256Hex('SAME'))
    expect(result.items['sub-to-10#math.p2.read']).toBe(sha256Hex('ONLY-SUB'))
    expect(result.items['sub-to-10#math.p1.read']).toBeUndefined()
  })

  it('hashes asset bytes under <prefix>#<filename>', () => {
    expect(result.items['greet#greet-01-hi.mp3']).toBe(
      sha256Hex(Buffer.from([1, 2, 3])),
    )
    expect(result.items['path#path-a.mp3']).toBe(sha256Hex(Buffer.from([4, 5])))
  })

  it("records a missing asset as '' (the page's hash for a failed fetch)", () => {
    expect(result.items['guide#guide-gone.mp3']).toBe('')
    expect(result.missing).toEqual(['assets/audio/path/guide-gone.mp3'])
  })

  it('lists every item exactly once', () => {
    expect(Object.keys(result.items).sort()).toEqual([
      'add-to-10#math.p9.read',
      'greet#greet-01-hi.mp3',
      'guide#guide-gone.mp3',
      'path#path-a.mp3',
      'sub-to-10#math.p2.read',
    ])
    expect(result.collisions).toEqual([])
  })
})

describe('page and script stay in step', () => {
  it('knows every asset group the page loads', () => {
    expect(() => assertAssetGroupsKnown(html)).not.toThrow()
  })

  it('fails loudly on an asset group it does not know', () => {
    const extra = html.replace(
      "loadAssetGroup('hub', HUB_FILES)",
      "loadAssetGroup('hub', HUB_FILES); loadAssetGroup('sfx', [])",
    )
    expect(extra).not.toBe(html)
    expect(() => assertAssetGroupsKnown(extra)).toThrow(/page-only: sfx/)
  })
})

describe('baseline file', () => {
  it('sorts items and records count, sha and date', () => {
    const file = buildBaselineFile(
      { b: 'h2', a: 'h1' },
      'abc',
      '2026-10-16T00:00:00.000Z',
    )
    expect(Object.keys(file.items)).toEqual(['a', 'b'])
    expect(file.itemCount).toBe(2)
    expect(file.sourceSha).toBe('abc')
    expect(file.generatedAt).toBe('2026-10-16T00:00:00.000Z')
  })

  it('the committed baseline has the shape the page reads', () => {
    const committed = JSON.parse(
      readFileSync(
        join(process.cwd(), 'public', 'voice-qa-baseline.json'),
        'utf8',
      ),
    ) as {
      generatedAt: string
      sourceSha: string
      itemCount: number
      items: Record<string, string>
    }
    expect(committed.sourceSha).toMatch(/^[0-9a-f]{40}$/)
    expect(Number.isNaN(Date.parse(committed.generatedAt))).toBe(false)
    const hashes = Object.values(committed.items)
    expect(hashes.length).toBe(committed.itemCount)
    expect(hashes.filter((h) => !/^([0-9a-f]{64})?$/.test(h))).toEqual([])
  })
})
