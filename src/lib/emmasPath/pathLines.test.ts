import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LITERACY_TREE, MATH_TREE } from '../progress/mastery'
import { PREREQUISITES } from '../progress/prerequisites'
import { STAGE_SPOKEN_NAMES } from '../../screens/SessionEnd/friendlyNodeName'
import {
  BAKED_PATH_LINES,
  DEFERRED_PATH_LINE_KINDS,
  PATH_LINES,
  pathLine,
  pathStepsOf,
} from './pathLines'

/** Spec §4.5 word list (carrier + name + land-name words), lower-case. */
const SPEC_VOCAB = new Set(
  `here is your path you are on did all of it look at flowers flower a new for
  learned now can do land first then this not yet numbers adding taking away to
  ten twenty big making tens skip counting groups two three four five and letter
  letters names sounds blending words reading sentences cat dog sun pig bed ship
  chick thumb star sound pairs`.split(/\s+/),
)
const NUMERALS = new Set(['1', '2', '3', '4', '5'])

describe('STAGE_SPOKEN_NAMES (spec §4.3)', () => {
  it('gives all 24 stages a name and no two the same', () => {
    const nodes = [...MATH_TREE, ...LITERACY_TREE]
    expect(nodes).toHaveLength(24)
    const names = nodes.map((n) => STAGE_SPOKEN_NAMES[n])
    expect(new Set(names).size).toBe(24)
  })
})

describe('PATH_LINES (Emma’s Path 10/10)', () => {
  it('orders each world like its tree', () => {
    expect(pathStepsOf('math')).toEqual([...MATH_TREE])
    expect(pathStepsOf('word-song')).toEqual([...LITERACY_TREE])
  })

  it('names PREREQUISITES[node][0] in every locked.next line', () => {
    for (const n of [...MATH_TREE.slice(1), ...LITERACY_TREE.slice(1)]) {
      const prereq = PREREQUISITES[n][0]!
      expect(pathLine(`path.locked.next.${n}`)?.text).toContain(
        `First, ${STAGE_SPOKEN_NAMES[prereq]}. Then this!`,
      )
      expect(pathLine(`end.unlock.${n}`)?.text).toBe(
        `You learned ${STAGE_SPOKEN_NAMES[prereq]}! Now you can do ${STAGE_SPOKEN_NAMES[n]}!`,
      )
    }
  })

  it('has exactly the expected line count per kind', () => {
    const counts: Record<string, number> = {}
    for (const l of PATH_LINES) counts[l.kind] = (counts[l.kind] ?? 0) + 1
    expect(counts).toEqual({
      open: 24,
      'open-done': 2,
      stop: 24,
      land: 9,
      'locked-next': 22,
      'locked-later': 111,
      'gate-locked': 38,
      'end-bud': 24,
      'end-unlock': 22,
      'end-land': 7,
      'end-land-no-number': 7,
    })
    expect(new Set(PATH_LINES.map((l) => l.id)).size).toBe(PATH_LINES.length)
  })

  it('spells the spec templates exactly', () => {
    expect(pathLine('path.open.add-to-10')?.text).toBe(
      'Here is your path! You are on adding to ten.',
    )
    expect(pathLine('path.stop.sight-words')?.text).toBe('Star words.')
    expect(pathLine('path.land.math.2')?.text).toBe(
      'Land 2: Adding and taking away.',
    )
    expect(pathLine('path.locked.later.mult-6-9.add-to-10')?.text).toBe(
      'Big groups! Not yet. First, adding to ten.',
    )
    expect(pathLine('path.gate.locked.word-song.4.cvc-words')?.text).toBe(
      'Land 4: Sound pairs! First, cat words.',
    )
    expect(pathLine('end.bud.cvc-words-short-o')?.text).toBe(
      'Look! A new flower for dog words!',
    )
    expect(pathLine('end.land.word-song.5')?.text).toBe(
      'A new land! Land 5: Sentences!',
    )
    expect(pathLine('end.land.word-song.5.no-number')?.text).toBe(
      'A new land: Sentences!',
    )
  })

  it('bakes every non-deferred line and none of the deferred ones', () => {
    for (const l of PATH_LINES)
      expect(l.src === null).toBe(DEFERRED_PATH_LINE_KINDS.has(l.kind))
    expect(BAKED_PATH_LINES).toHaveLength(141)
    expect(new Set(BAKED_PATH_LINES.map((l) => l.text)).size).toBe(140)
  })

  it('has a bundled MP3 for every baked line', () => {
    const missing = BAKED_PATH_LINES.filter(
      (l) => !existsSync(join(process.cwd(), 'public', l.src)),
    ).map((l) => l.src)
    expect(missing).toEqual([])
  })

  it('stays inside the spec §4.5 vocabulary', () => {
    const outside = new Set<string>()
    for (const l of PATH_LINES)
      for (const w of l.text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
        if (!SPEC_VOCAB.has(w) && !NUMERALS.has(w)) outside.add(w)
    expect([...outside]).toEqual([])
  })

  it('lists every baked clip, with its text, on the voice-QA page', () => {
    const html = readFileSync(
      join(process.cwd(), 'public', 'voice-qa.html'),
      'utf8',
    )
    const block = html.slice(
      html.indexOf('const PATH_GROUPS'),
      html.indexOf('const GUIDANCE_FILES'),
    )
    const listed = [...block.matchAll(/\[\s*'([^']+\.mp3)',\s*'([^']*)'/g)].map(
      (m) => `${m[1]}|${m[2]}`,
    )
    const expected = [
      ...new Map(BAKED_PATH_LINES.map((l) => [l.src, l] as const)).values(),
    ].map((l) => `${l.src.split('/').pop()}|${l.text}`)
    expect(listed.sort()).toEqual(expected.sort())
  })
})
