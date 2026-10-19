/**
 * The take-away picture's pure rules (`design/native/take-away-picture.md`
 * § 1, § 4, § 7, § 8, AC 1, AC 2): which ten-frame slots a take-away
 * problem fills and which it lifts, in lift order, and the word of a line
 * whose tick lifts them.
 *
 * Failing-first: written before `takeAway.ts` existed.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  TAKE_AWAY_TICK_WORDS,
  takeAwaySlots,
  takeAwayTickIndex,
} from './takeAway'

describe('takeAwaySlots (AC 1)', () => {
  it('6 − 3: one frame, 6 filled, the last three placed lift first', () => {
    expect(takeAwaySlots(6, 3)).toEqual({
      frames: 1,
      filled: 6,
      taken: [6, 5, 4],
    })
  })

  it('5 − 5: all five lift', () => {
    expect(takeAwaySlots(5, 5)).toEqual({
      frames: 1,
      filled: 5,
      taken: [5, 4, 3, 2, 1],
    })
  })

  it('7 − 0: nothing lifts', () => {
    expect(takeAwaySlots(7, 0)).toEqual({ frames: 1, filled: 7, taken: [] })
  })

  it('10 − 3: one full frame', () => {
    expect(takeAwaySlots(10, 3)).toEqual({
      frames: 1,
      filled: 10,
      taken: [10, 9, 8],
    })
  })

  it('18 − 6: two frames, the right one holds 8 and lifts 6 of them', () => {
    expect(takeAwaySlots(18, 6)).toEqual({
      frames: 2,
      filled: 8,
      taken: [8, 7, 6, 5, 4, 3],
    })
  })

  it('15 − 5: the right frame’s 5 all lift, exactly a ten is left', () => {
    expect(takeAwaySlots(15, 5)).toEqual({
      frames: 2,
      filled: 5,
      taken: [5, 4, 3, 2, 1],
    })
  })

  it('11 − 1: the right frame’s one flower lifts', () => {
    expect(takeAwaySlots(11, 1)).toEqual({ frames: 2, filled: 1, taken: [1] })
  })

  it('a borrow (14 − 7) or a minuend over 19 (21 − 4) draws nothing', () => {
    expect(takeAwaySlots(14, 7)).toBeNull()
    expect(takeAwaySlots(21, 4)).toBeNull()
  })

  it('nonsense draws nothing: a negative answer, negatives, fractions', () => {
    expect(takeAwaySlots(3, 5)).toBeNull()
    expect(takeAwaySlots(-1, 0)).toBeNull()
    expect(takeAwaySlots(6, -1)).toBeNull()
    expect(takeAwaySlots(6.5, 1)).toBeNull()
  })
})

describe('takeAwayTickIndex (AC 2)', () => {
  it('finds "away" in sub-to-10’s read', () => {
    expect(takeAwayTickIndex('Six take away three. How many are left?')).toBe(2)
  })

  it('finds "minus" in sub-to-20’s read, and in a sub-to-10 "minus" read', () => {
    expect(takeAwayTickIndex('Fifteen minus three. How many are left?')).toBe(1)
    expect(takeAwayTickIndex('Seven minus three. How many are left?')).toBe(1)
  })

  it('finds "away" in hint 3', () => {
    expect(takeAwayTickIndex('Take away three. How many now?')).toBe(1)
  })

  it('a line with neither word: its last word', () => {
    expect(takeAwayTickIndex('Look at the flowers.')).toBe(3)
    expect(takeAwayTickIndex('Seks fratrukket tre.')).toBe(2)
  })

  it('the words are one exported table, English away / minus', () => {
    expect([...TAKE_AWAY_TICK_WORDS]).toEqual(['away', 'minus'])
  })

  it.each(['sub-to-10', 'sub-to-20'])(
    'every read and hint 3 in %s.json finds a trigger word',
    (stem) => {
      const file = join(
        process.cwd(),
        'public',
        'canon',
        'math',
        'level-1',
        `${stem}.json`,
      )
      const doc = JSON.parse(readFileSync(file, 'utf8')) as {
        plan: { utterances: { id: string; text: string }[] }
      }
      const lines = doc.plan.utterances.filter((u) =>
        /\.(read|hint3)$/.test(u.id),
      )
      expect(lines).toHaveLength(16)
      for (const { text } of lines) {
        const words = text.split(/\s+/).filter(Boolean)
        const word = words[takeAwayTickIndex(text)]!.toLowerCase().replace(
          /[^a-z]/g,
          '',
        )
        expect(TAKE_AWAY_TICK_WORDS).toContain(word)
      }
    },
  )
})
