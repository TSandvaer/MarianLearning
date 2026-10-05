import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LITERACY_TREE, MATH_TREE } from '../../lib/progress/mastery'
import {
  CELEBRATE_LINE_TEXT,
  UNLOCKED_STAGE_NAMES,
  celebrateLineSrc,
} from './celebrationLines'
import { HUB_LINES } from './hubLines'

describe('Hub celebrate lines (ticket 123jpnbc3dn)', () => {
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

  it('every celebrate line has its bundled MP3 on disk under public/', () => {
    const ids = Object.keys(CELEBRATE_LINE_TEXT) as Array<
      keyof typeof CELEBRATE_LINE_TEXT
    >
    const missing = ids.filter(
      (id) => !existsSync(join(process.cwd(), 'public', celebrateLineSrc(id))),
    )
    expect(missing).toEqual([])
  })
})
