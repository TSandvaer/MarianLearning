import { describe, expect, it } from 'vitest'
import { LANDS, landOf, landsOf } from './lands'
import { LITERACY_TREE, MATH_TREE } from './mastery'
import { defaultProgress } from './defaults'
import type { SkillNode } from './types'

const ALL_NODES = Object.keys(defaultProgress().skillLevels) as SkillNode[]

describe('LANDS', () => {
  it('Number Garden has 4 lands and Word Song has 6, numbered 1..n', () => {
    expect(landsOf('math').map((l) => l.number)).toEqual([1, 2, 3, 4])
    expect(landsOf('word-song').map((l) => l.number)).toEqual([
      1, 2, 3, 4, 5, 6,
    ])
    expect(LANDS).toHaveLength(10)
  })

  it('names the lands per the 2026-10-04 decision', () => {
    expect(landsOf('math').map((l) => l.name)).toEqual([
      'Counting',
      'Adding & taking away',
      'Big numbers',
      'Groups',
    ])
    expect(landsOf('word-song').map((l) => l.name)).toEqual([
      'Letters',
      'Blending',
      'Words',
      'Sound pairs',
      'Sentences',
      // Content wave 1 (design/native/content-wave-1.md § 5.1).
      'Big words',
    ])
  })

  it('flattened lands equal each mastery tree, in order', () => {
    expect(landsOf('math').flatMap((l) => l.nodes)).toEqual([...MATH_TREE])
    expect(landsOf('word-song').flatMap((l) => l.nodes)).toEqual([
      ...LITERACY_TREE,
    ])
  })

  it('places every SkillNode in exactly one land', () => {
    const all = LANDS.flatMap((l) => l.nodes)
    expect(all).toHaveLength(ALL_NODES.length)
    expect(new Set(all).size).toBe(ALL_NODES.length)
    for (const node of ALL_NODES) {
      expect(LANDS.filter((l) => l.nodes.includes(node))).toHaveLength(1)
    }
  })

  it('landOf resolves a node to its land', () => {
    expect(landOf('mult-2-5-10')).toMatchObject({ world: 'math', number: 4 })
    expect(landOf('sub-to-20')).toMatchObject({ world: 'math', number: 2 })
    expect(landOf('cvc-words-short-e')).toMatchObject({
      world: 'word-song',
      number: 3,
    })
    expect(landOf('letter-sounds')).toMatchObject({
      world: 'word-song',
      number: 1,
    })
    expect(landsOf('word-song')[5]).toEqual({
      world: 'word-song',
      number: 6,
      name: 'Big words',
      nodes: ['duck-words', 'crab-words', 'tent-words', 'cake-words'],
    })
  })
})
