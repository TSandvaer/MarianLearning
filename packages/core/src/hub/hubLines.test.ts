import { describe, expect, it } from 'vitest'
import { HUB_LINES, HUB_LINE_WORD_COUNTS } from './hubLines'
import type { HubLineId } from './hubLines'

describe('HUB_LINES manifest', () => {
  it("has exactly 18 welcome/enter entries (9 anchor + 7 rotation + 2 enter — first-ever / pick-again / pick-next anchors don't rotate)", () => {
    // Spec says 20 MP3s; 7 rotation per the variants table + 11 anchor lines = 18 distinct ids.
    // (Three 'first-ever' / 'session-end' / 'mid-skill-back' anchors have no rotation pool.)
    expect(Object.keys(HUB_LINES)).toHaveLength(18)
  })

  it('every line has a unique src URL', () => {
    const srcs = Object.values(HUB_LINES).map((e) => e.src)
    expect(new Set(srcs).size).toBe(srcs.length)
  })

  it('every line src lives under /assets/audio/hub/', () => {
    for (const entry of Object.values(HUB_LINES)) {
      expect(entry.src.startsWith('/assets/audio/hub/')).toBe(true)
      expect(entry.src.endsWith('.mp3')).toBe(true)
    }
  })

  it('caption text never contains "Melody" — Phase 3b character pivot', () => {
    for (const entry of Object.values(HUB_LINES)) {
      expect(entry.text).not.toMatch(/melody/i)
    }
  })

  it('word-count map matches the actual line text', () => {
    for (const id of Object.keys(HUB_LINES) as HubLineId[]) {
      const expected = HUB_LINES[id].text.split(/\s+/).filter(Boolean).length
      expect(HUB_LINE_WORD_COUNTS[id]).toBe(expected)
    }
  })
})
