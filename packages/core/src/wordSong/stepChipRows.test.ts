/**
 * Per-step chip rows (`design/native/content-wave-4.md` § 5, K4, D7, AC 5).
 *
 * _sheep_ and _shark_ are sh-step targets with their own `TARGET_PAIRINGS`
 * rows, and also bee-words and car-words targets with Dave's rows. A
 * big-words problem carries its own step's row (`chipRow`, attached by the
 * plan adapter from the step the plan or the block came from), and
 * `pickDistractors` uses it instead of the by-word matrix, with every check
 * unchanged. The sh step keeps its rows, and a review block keeps its own
 * step's row.
 */
import { describe, expect, it } from 'vitest'
import { BIG_WORDS_STEPS, bigWordRowOf } from './bigWordsSteps'
import {
  wordSongSessionPlanFromServer,
  wordSongWarmupFromServer,
} from './planFromServer'
import { getWordEntry } from './wordPack'
import { pickDistractors } from './wordDistractors'
import { buildWordRound } from './wordRound'
import type { WordSongProblem } from './wordSessionPlans'

/** A land-6-format block for `word` (`bigWordsCanonCheck.ts`'s lines). */
function block(n: number, word: string, prefix = 'p') {
  const cap = word.charAt(0).toUpperCase() + word.slice(1)
  return [
    { id: `word.${prefix}${n}.read`, text: `Read the ${word}.` },
    { id: `word.${prefix}${n}.correct`, text: `Yes! That's a ${word}.` },
    { id: `word.${prefix}${n}.reprompt`, text: 'Hmm... try again?' },
    { id: `word.${prefix}${n}.hint`, text: `Let's look. ${cap}.` },
    { id: `word.${prefix}${n}.giveAnswer`, text: `This one is ${word}.` },
  ]
}

const planOf = (words: readonly string[], id = 'x-level-1') => ({
  id,
  label: 'X',
  utterances: words.flatMap((w, i) => block(i + 1, w)),
})

/** The sh step's canon order (`digraphs-sh.json`). */
const SH = ['ship', 'shell', 'shoe', 'shed', 'sheep', 'shark', 'shop', 'ship']
const BEE = BIG_WORDS_STEPS['bee-words'].map((r) => r.word)
const CAR = BIG_WORDS_STEPS['car-words'].map((r) => r.word)

const chips = (p: WordSongProblem) =>
  buildWordRound(p, { crossVowel: false })
    .chips.map((e) => e.word)
    .sort()

describe('a big-words problem deals its own step’s row (§ 5, AC 5)', () => {
  it('bee words P4 deals sheep, ship, jeep; car words P5 deals shark, ship, star', () => {
    const bee = wordSongSessionPlanFromServer(planOf(BEE), {
      step: 'bee-words',
    })
    expect(bee.problems[3]!.target.word).toBe('sheep')
    expect(chips(bee.problems[3]!)).toEqual(['jeep', 'sheep', 'ship'])
    const car = wordSongSessionPlanFromServer(planOf(CAR), {
      step: 'car-words',
    })
    expect(car.problems[4]!.target.word).toBe('shark')
    expect(chips(car.problems[4]!)).toEqual(['shark', 'ship', 'star'])
  })

  it('every bee-words and car-words problem deals § 3.2 / § 4.2 (gentle P1–P3, trap P4–P8)', () => {
    for (const step of ['bee-words', 'car-words'] as const) {
      const rows = BIG_WORDS_STEPS[step]
      const plan = wordSongSessionPlanFromServer(
        planOf(rows.map((r) => r.word)),
        { step },
      )
      plan.problems.forEach((p, i) => {
        const row = rows[i]!
        expect(p.chipRow, row.word).toEqual({
          gentle: row.gentle,
          trap: row.trap,
        })
        expect(chips(p), row.word).toEqual(
          [row.word, ...(i < 3 ? row.gentle : row.trap)].sort(),
        )
      })
    }
  })

  it('the sh step still deals its own: P5 sheep, ship, shell; P6 shark, shoe, shell', () => {
    for (const options of [{ step: 'digraphs-sh' as const }, undefined]) {
      const sh = wordSongSessionPlanFromServer(planOf(SH), options)
      expect(sh.problems[4]!.chipRow).toBeUndefined()
      expect(chips(sh.problems[4]!)).toEqual(['sheep', 'shell', 'ship'])
      expect(chips(sh.problems[5]!)).toEqual(['shark', 'shell', 'shoe'])
    }
  })

  it('a review keeps each block’s step row: bee P4 and sh P5 in one plan', () => {
    const review = wordSongSessionPlanFromServer(
      planOf(['sheep', 'sheep', 'shark', 'shark'], 'review-x'),
      {
        step: ['bee-words', 'digraphs-sh', 'car-words', 'digraphs-sh'],
        problemCount: 4,
      },
    )
    // Review positions 1–3 deal the gentle pair, 4 the trap pair.
    expect(chips(review.problems[0]!)).toEqual(['map', 'pot', 'sheep'])
    expect(chips(review.problems[1]!)).toEqual(['shark', 'sheep', 'shoe'])
    expect(chips(review.problems[2]!)).toEqual(['bed', 'pot', 'shark'])
    expect(chips(review.problems[3]!)).toEqual(['shark', 'shell', 'shoe'])
  })

  it('a warm-up block takes the row of its ref (w<N> = ref N)', () => {
    const plan = {
      id: 'bee-words-level-1',
      label: 'X',
      utterances: [...block(1, 'seal', 'w'), ...block(2, 'sheep', 'w')],
    }
    const warm = wordSongWarmupFromServer(plan, {
      step: ['bee-words', 'bee-words'],
    })
    expect(warm.map((w) => w.problem.chipRow)).toEqual([
      { gentle: ['mop', 'cap'], trap: ['sun', 'seed'] },
      { gentle: ['pot', 'map'], trap: ['ship', 'jeep'] },
    ])
    expect(chips(warm[1]!.problem)).toEqual(['map', 'pot', 'sheep'])
  })

  it('a step without big-words rows, or a word not in the step, attaches no row', () => {
    expect(bigWordRowOf('digraphs-sh', 'sheep')).toBeUndefined()
    expect(bigWordRowOf('bee-words', 'shark')).toBeUndefined()
    expect(bigWordRowOf('car-words', 'shark')?.trap).toEqual(['ship', 'star'])
    const plan = wordSongSessionPlanFromServer(planOf(['cat']), {
      step: 'cvc-words',
      problemCount: 1,
    })
    expect(plan.problems[0]!.chipRow).toBeUndefined()
  })
})

describe('land 9: snail and moon words deal their rows (content wave 5 § 6, AC 5)', () => {
  const SNAIL = BIG_WORDS_STEPS['snail-words'].map((r) => r.word)
  const MOON = BIG_WORDS_STEPS['moon-words'].map((r) => r.word)

  it('a snail-words P4 deals coat, cot, goat; a moon-words P1 deals moon, hen, cup', () => {
    const snail = wordSongSessionPlanFromServer(planOf(SNAIL), {
      step: 'snail-words',
    })
    expect(snail.problems[3]!.target.word).toBe('coat')
    expect(chips(snail.problems[3]!)).toEqual(['coat', 'cot', 'goat'])
    const moon = wordSongSessionPlanFromServer(planOf(MOON), {
      step: 'moon-words',
    })
    expect(moon.problems[0]!.target.word).toBe('moon')
    expect(chips(moon.problems[0]!)).toEqual(['cup', 'hen', 'moon'])
  })

  it('every problem deals § 4.2 / § 5.2, with the step row on the problem or without it (no word collides, K4)', () => {
    for (const step of ['snail-words', 'moon-words'] as const) {
      const rows = BIG_WORDS_STEPS[step]
      for (const options of [{ step }, undefined]) {
        const plan = wordSongSessionPlanFromServer(
          planOf(rows.map((r) => r.word)),
          options,
        )
        plan.problems.forEach((p, i) => {
          const row = rows[i]!
          expect(chips(p), row.word).toEqual(
            [row.word, ...(i < 3 ? row.gentle : row.trap)].sort(),
          )
        })
      }
    }
  })

  it('a review block keeps its step’s row: a snail-words goat at review P4', () => {
    const review = wordSongSessionPlanFromServer(
      planOf(['tray', 'moon', 'chain', 'goat'], 'review-x'),
      {
        step: ['snail-words', 'moon-words', 'snail-words', 'snail-words'],
        problemCount: 4,
      },
    )
    expect(review.problems[3]!.chipRow).toEqual({
      gentle: ['cup', 'net'],
      trap: ['gum', 'coat'],
    })
    expect(chips(review.problems[3]!)).toEqual(['coat', 'goat', 'gum'])
    expect(chips(review.problems[1]!)).toEqual(['cup', 'hen', 'moon'])
  })
})

describe('pickDistractors with a supplied row (§ 5: every check unchanged)', () => {
  it('uses the row instead of the matrix', () => {
    const sheep = getWordEntry('sheep')
    expect(
      pickDistractors(sheep, 4, {
        row: { gentle: ['pot', 'map'], trap: ['ship', 'jeep'] },
      }).map((d) => d.word),
    ).toEqual(['ship', 'jeep'])
    expect(pickDistractors(sheep, 4).map((d) => d.word)).toEqual([
      'ship',
      'shell',
    ])
  })

  it('still throws on a forbidden pair, a repeat or another phoneme', () => {
    const sheep = getWordEntry('sheep')
    expect(() =>
      pickDistractors(sheep, 1, {
        row: { gentle: ['dog', 'pot'], trap: ['ship', 'jeep'] },
      }),
    ).toThrow(/forbidden pair/)
    expect(() =>
      pickDistractors(sheep, 1, {
        row: { gentle: ['pot', 'pot'], trap: ['ship', 'jeep'] },
      }),
    ).toThrow(/distinctness/)
    expect(() =>
      pickDistractors(sheep, 1, {
        row: { gentle: ['thin', 'pot'], trap: ['ship', 'jeep'] },
      }),
    ).toThrow(/phoneme mismatch/)
  })

  it('getWordEntry("sheep") keeps the sh step’s /ʃ/ tag (AC 5)', () => {
    expect(getWordEntry('sheep').phoneme).toBe('/ʃ/')
    expect(getWordEntry('shark').phoneme).toBe('/ʃ/')
  })
})
