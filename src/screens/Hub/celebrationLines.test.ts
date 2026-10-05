import { describe, expect, it } from 'vitest'
import { LITERACY_TREE, MATH_TREE } from '../../lib/progress/mastery'
import {
  CELEBRATE_LINE_TEXT,
  UNLOCKED_STAGE_NAMES,
  celebrateLineSrc,
  unlockCelebrationFor,
} from './celebrationLines'
import { HUB_LINES } from './hubLines'

describe('unlockCelebrationFor (ticket 123jpnbc3dn)', () => {
  it('names the NEXT stage in the tree, never the mastered one', () => {
    for (const tree of [MATH_TREE, LITERACY_TREE]) {
      for (let i = 0; i < tree.length - 1; i++) {
        const mastered = tree[i]!
        const next = tree[i + 1]!
        const c = unlockCelebrationFor(mastered)
        expect(c.unlocked).toBe(next)
        expect(c.lineId).toBe(`hub.celebrate.${next}`)
        expect(c.name).toBe(
          UNLOCKED_STAGE_NAMES[next as keyof typeof UNLOCKED_STAGE_NAMES],
        )
      }
    }
  })

  it('returns the you-did-it line for each tree’s last stage', () => {
    for (const last of [MATH_TREE.at(-1)!, LITERACY_TREE.at(-1)!]) {
      expect(unlockCelebrationFor(last)).toEqual({
        unlocked: null,
        name: '',
        lineId: 'hub.celebrate.you-did-it',
      })
    }
  })

  it('has exactly one name per unlockable stage (every node except each tree’s first)', () => {
    const unlockable = [...MATH_TREE.slice(1), ...LITERACY_TREE.slice(1)]
    expect(Object.keys(UNLOCKED_STAGE_NAMES).sort()).toEqual(
      [...unlockable].sort(),
    )
    expect(Object.keys(UNLOCKED_STAGE_NAMES)).toHaveLength(22)
  })

  it('every celebrate line is in the Hub manifest with its spoken text and a unique bundled MP3', () => {
    const ids = Object.keys(CELEBRATE_LINE_TEXT) as Array<
      keyof typeof CELEBRATE_LINE_TEXT
    >
    expect(ids).toHaveLength(23)
    for (const id of ids) {
      expect(HUB_LINES[id]).toEqual({
        src: celebrateLineSrc(id),
        text: CELEBRATE_LINE_TEXT[id],
      })
    }
    expect(new Set(ids.map(celebrateLineSrc)).size).toBe(23)
    expect(CELEBRATE_LINE_TEXT['hub.celebrate.add-to-20']).toBe(
      'Something new! Adding to twenty!',
    )
    expect(celebrateLineSrc('hub.celebrate.add-to-20')).toBe(
      '/assets/audio/hub/hub-celebrate-add-to-20.mp3',
    )
  })
})
