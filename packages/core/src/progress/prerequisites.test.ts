import { describe, expect, it } from 'vitest'
import { defaultProgress } from './defaults'
import { LITERACY_TREE, MATH_TREE, nextNode } from './mastery'
import { PREREQUISITES } from './prerequisites'
import type { SkillNode } from './types'

const ALL_NODES = Object.keys(defaultProgress().skillLevels) as SkillNode[]

describe('PREREQUISITES', () => {
  it('has exactly one entry per SkillNode', () => {
    expect(Object.keys(PREREQUISITES)).toHaveLength(ALL_NODES.length)
    expect(new Set(Object.keys(PREREQUISITES))).toEqual(new Set(ALL_NODES))
  })

  it('the first step of each tree has no prerequisite', () => {
    expect(PREREQUISITES['number-recog']).toEqual([])
    expect(PREREQUISITES['letter-names']).toEqual([])
    expect(
      ALL_NODES.filter((n) => PREREQUISITES[n].length === 0).sort(),
    ).toEqual(['letter-names', 'number-recog'])
  })

  it('every other step needs exactly its tree predecessor', () => {
    expect(PREREQUISITES['mult-2-5-10']).toEqual(['skip-counting'])
    expect(PREREQUISITES['sub-to-10']).toEqual(['add-to-20'])
    expect(PREREQUISITES['cvc-words-short-o']).toEqual(['cvc-words'])
    expect(PREREQUISITES['digraphs-sh']).toEqual(['cvc-words-short-e'])
  })

  it('agrees with the mastery rule unlock edge (nextNode) for every step', () => {
    let edges = 0
    for (const [track, tree] of [
      ['math', MATH_TREE],
      ['word-song', LITERACY_TREE],
    ] as const) {
      for (const node of tree) {
        const next = nextNode(track, node)
        if (next === null) continue
        expect(PREREQUISITES[next]).toEqual([node])
        edges++
      }
    }
    expect(edges).toBe(ALL_NODES.length - 2)
  })
})
