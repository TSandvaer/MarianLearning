import { describe, expect, it } from 'vitest'
import { LETTER_SOUNDS_POOL } from './letterSoundsPool'
import { getWordEntry, type WordEntry } from './wordPack'
import { buildWordChipOrder } from './wordChips'
import {
  buildWordRound,
  chipFaceFor,
  chipLabel,
  countsAsCorrect,
  filledSentence,
  isCleanWin,
  isCorrectChip,
  letterHighlighted,
  readAloudDelayMs,
  secondWrongPrompt,
  sentenceTokens,
  SILENT_TEXT_WINDOW_MS,
  wordCardFor,
  wrongTapOutcome,
} from './wordRound'
import {
  STATIC_WORD_SONG_PLANS,
  type WordSongContentType,
  type WordSongProblem,
} from './wordSessionPlans'

function problem(
  word: string,
  contentType?: WordSongContentType,
  extra: Partial<WordSongProblem> = {},
): WordSongProblem {
  const target: WordEntry =
    contentType === 'letter-names' || contentType === 'letter-sounds'
      ? {
          word,
          pictureKey: `letter:${word}`,
          category: 'object',
          isTarget: true,
        }
      : getWordEntry(word)
  return {
    index: 4,
    target,
    contentType,
    utterances: {
      read: `Read the ${word}.`,
      correct: `Yes! ${word}.`,
      reprompt: 'Hmm... try again?',
      hint: `Let's look. ${word}.`,
      giveAnswer: `This one is ${word}.`,
    },
    ...extra,
  }
}

describe('what a round shows', () => {
  it.each([
    [undefined, 'picture', 'picture'],
    ['blending-cv', 'picture', 'picture'],
    ['cvc-word', 'picture', 'picture'],
    ['letter-names', 'letter', 'letter'],
    ['letter-sounds', 'letter-sound', 'letter-sound'],
    ['sight-word', 'none', 'written-word'],
    ['simple-sentence', 'sentence', 'written-word'],
  ] as const)('%s → card %s, chip %s', (type, card, face) => {
    expect(wordCardFor(type)).toBe(card)
    expect(chipFaceFor(type)).toBe(face)
  })

  it('names chips as the web does', () => {
    expect(chipLabel('picture', 'cat')).toBe('Picture of cat')
    expect(chipLabel('letter', 'B')).toBe('Letter B')
    expect(chipLabel('letter-sound', 'M')).toBe('Letter M')
    expect(chipLabel('written-word', 'was')).toBe('Word was')
  })

  it('holds the read-aloud 1.5 s on cvc-word only', () => {
    expect(SILENT_TEXT_WINDOW_MS).toBe(1500)
    expect(readAloudDelayMs(problem('cat', 'cvc-word'))).toBe(1500)
    expect(readAloudDelayMs(problem('cat', 'blending-cv'))).toBe(0)
    expect(readAloudDelayMs(problem('cat'))).toBe(0)
    expect(readAloudDelayMs(problem('the', 'sight-word'))).toBe(0)
  })
})

describe('how a tap is judged', () => {
  it('a chip is right when its word is the target', () => {
    expect(isCorrectChip(problem('cat'), 'cat')).toBe(true)
    expect(isCorrectChip(problem('cat'), 'bat')).toBe(false)
  })

  it('wrong taps: re-prompt, then the hint at 2, the answer at 3', () => {
    let s = { wrongCount: 0, hintPlayed: false, guidedPlayed: false }
    const first = wrongTapOutcome(s)
    expect(first).toEqual({
      wrongCount: 1,
      scheduleHint: false,
      scheduleGuided: false,
    })
    s = { ...s, wrongCount: 1 }
    expect(wrongTapOutcome(s)).toEqual({
      wrongCount: 2,
      scheduleHint: true,
      scheduleGuided: false,
    })
    s = { ...s, wrongCount: 2, hintPlayed: true }
    expect(wrongTapOutcome(s)).toEqual({
      wrongCount: 3,
      scheduleHint: false,
      scheduleGuided: true,
    })
    // A burst after the answer schedules nothing more.
    s = { ...s, wrongCount: 3, guidedPlayed: true }
    expect(wrongTapOutcome(s)).toEqual({
      wrongCount: 4,
      scheduleHint: false,
      scheduleGuided: false,
    })
  })

  it('a burst of second-wrong taps schedules the hint once', () => {
    const latched = { wrongCount: 1, hintPlayed: true, guidedPlayed: false }
    expect(wrongTapOutcome(latched).scheduleHint).toBe(false)
  })

  it('counts a right tap unless Emma gave the answer; streak on clean wins', () => {
    expect(countsAsCorrect({ guidedPlayed: false })).toBe(true)
    expect(countsAsCorrect({ guidedPlayed: true })).toBe(false)
    expect(isCleanWin({ wrongCount: 0, guidedPlayed: false })).toBe(true)
    expect(isCleanWin({ wrongCount: 1, guidedPlayed: false })).toBe(false)
    expect(isCleanWin({ wrongCount: 0, guidedPlayed: true })).toBe(false)
  })
})

describe('the second wrong tap', () => {
  const blend = 'c - a - t ... cat'

  it('plays the blend on cvc-word, with the letter steps', () => {
    const p = problem('cat', 'cvc-word')
    const withBlend = { ...p, utterances: { ...p.utterances, blend } }
    expect(secondWrongPrompt(withBlend)).toEqual({
      kind: 'blend',
      text: blend,
      steps: [0, undefined, 1, undefined, 2, undefined, 3],
    })
  })

  it('falls back to the hint without a blend, or off cvc-word', () => {
    const p = problem('cat', 'blending-cv')
    expect(secondWrongPrompt(problem('cat', 'cvc-word'))).toEqual({
      kind: 'hint',
      text: "Let's look. cat.",
    })
    expect(
      secondWrongPrompt({ ...p, utterances: { ...p.utterances, blend } }),
    ).toEqual({ kind: 'hint', text: "Let's look. cat." })
  })

  it('lights one letter per grapheme, all of them on the whole word', () => {
    expect([0, 1, 2].map((i) => letterHighlighted(i, 1, 3))).toEqual([
      false,
      true,
      false,
    ])
    expect([0, 1, 2].map((i) => letterHighlighted(i, 3, 3))).toEqual([
      true,
      true,
      true,
    ])
    expect(letterHighlighted(0, null, 3)).toBe(false)
  })
})

describe('the sentence panel', () => {
  it('peels punctuation off the gap', () => {
    expect(sentenceTokens('The dog ___.')).toEqual([
      { kind: 'word', text: 'The' },
      { kind: 'word', text: 'dog' },
      { kind: 'gap', before: '', after: '.' },
    ])
    expect(sentenceTokens('The cat ___ the mat.')[2]).toEqual({
      kind: 'gap',
      before: '',
      after: '',
    })
    expect(sentenceTokens('Can he ___?')[2]).toEqual({
      kind: 'gap',
      before: '',
      after: '?',
    })
  })

  it('fills the gap for the scene label', () => {
    expect(filledSentence('The cat ___ the mat.', 'sat')).toBe(
      'The cat sat the mat.',
    )
  })
})

describe('the chips', () => {
  it.each(STATIC_WORD_SONG_PLANS.map((p) => [p.id, p] as const))(
    '%s: 3 distinct chips, the target once, the same order every time',
    (_id, plan) => {
      for (const p of plan.problems) {
        const words = buildWordChipOrder(p, false).map((e) => e.word)
        expect(words).toHaveLength(3)
        expect(new Set(words).size).toBe(3)
        expect(words.filter((w) => w === p.target.word)).toHaveLength(1)
        expect(buildWordChipOrder(p, false).map((e) => e.word)).toEqual(words)
      }
    },
  )

  it('letter-names: three letters of one case', () => {
    for (const letter of ['b', 'B', 'q', 'Z']) {
      const p = { ...problem(letter, 'letter-names'), index: 2 }
      const words = buildWordChipOrder(p, false).map((e) => e.word)
      expect(new Set(words).size).toBe(3)
      const upper = letter === letter.toUpperCase()
      for (const w of words) expect(w === w.toUpperCase()).toBe(upper)
    }
  })

  it('letter-sounds: three letters from the pool', () => {
    const p = problem('M', 'letter-sounds')
    const words = buildWordChipOrder(p, false).map((e) => e.word)
    expect(new Set(words).size).toBe(3)
    for (const w of words) expect(LETTER_SOUNDS_POOL).toContain(w)
  })

  it('buildWordRound bundles the round', () => {
    const p = problem('cat', 'cvc-word')
    const round = buildWordRound(p, { crossVowel: false })
    expect(round.card).toBe('picture')
    expect(round.chipFace).toBe('picture')
    expect(round.readAloudDelayMs).toBe(1500)
    expect(round.chips.map((e) => e.word)).toEqual(
      buildWordChipOrder(p, false).map((e) => e.word),
    )
  })
})
