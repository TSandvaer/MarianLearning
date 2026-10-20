/**
 * Real blending's two problem types: stop 1 `'listen-blend'` (Emma says the
 * sounds, the learner finds the word) and stop 2 `'sound-out'` (the learner
 * taps the letters, then finds the word), `design/native/real-blending.md`
 * § 6, § 8, ACs 1–4.
 *
 * Failing-first: the parser reads both committed canon files with the
 * native options, routes the two exact reads before the little-story
 * branch, takes the target from the blend and rejects a blend that does
 * not spell a target; the deal gives § 6's chips; the round rules widen.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { blendSoundsText, blendTargetWord } from './blendHighlight'
import {
  LISTEN_BLEND_READ,
  PlanFromServerError,
  SOUND_OUT_READ,
  wordSongSessionPlanFromServer,
  type WordSongPlanFromServerOptions,
} from './planFromServer'
import { buildWordChipOrder } from './wordChips'
import { isForbiddenPair } from './wordPack'
import {
  hidesPictureUntilAnswer,
  readAloudDelayMs,
  secondWrongPrompt,
  usesBlendClip,
} from './wordRound'
import type { WordSongContentType, WordSongProblem } from './wordSessionPlans'

const CANON = join(process.cwd(), 'public', 'canon', 'word-song', 'level-1')
const readPlan = (stem: string): unknown =>
  JSON.parse(readFileSync(join(CANON, `${stem}.json`), 'utf8')).plan

/** The native app's options (Devon wires `blendReads` into NATIVE_PARSE). */
const NATIVE = {
  littleStories: true,
  blendReads: true,
} as WordSongPlanFromServerOptions

const LISTEN_BLEND = 'listen-blend' as WordSongContentType
const SOUND_OUT = 'sound-out' as WordSongContentType

/** § 6's tables: [word, chips (correct first)]. */
const STOP_1: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['fan', ['fan', 'dog', 'bus']],
  ['man', ['man', 'cup', 'log']],
  ['van', ['van', 'pen', 'cup']],
  ['hat', ['hat', 'cat', 'bag']],
  ['cat', ['cat', 'bat', 'cap']],
  ['bag', ['bag', 'tag', 'bat']],
  ['pan', ['pan', 'fan', 'man']],
  ['tag', ['tag', 'bag', 'bat']],
]
const STOP_2: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['fan', ['fan', 'dog', 'bus']],
  ['man', ['man', 'cup', 'log']],
  ['mat', ['mat', 'pen', 'dog']],
  ['bat', ['bat', 'cat', 'hat']],
  ['can', ['can', 'fan', 'man']],
  ['cap', ['cap', 'cat', 'bag']],
  ['dad', ['dad', 'bag', 'bat']],
  ['jam', ['jam', 'bag', 'pan']],
]
const PROBE_WORDS = ['nap', 'rat', 'map', 'tap']

describe('the two reads (§ 8)', () => {
  it('are exact strings, exported', () => {
    expect(LISTEN_BLEND_READ).toBe('Listen.')
    expect(SOUND_OUT_READ).toBe('What is it?')
  })
})

describe('the committed canon parses with the native options (AC 1)', () => {
  it("blending-cv.json: 8/8 'listen-blend', fan man van hat cat bag pan tag", () => {
    const plan = wordSongSessionPlanFromServer(readPlan('blending-cv'), NATIVE)
    expect(plan.id).toBe('blending-cv-level-1')
    expect(plan.problems.map((p) => p.contentType)).toEqual(
      Array(8).fill(LISTEN_BLEND),
    )
    expect(plan.problems.map((p) => p.target.word)).toEqual(
      STOP_1.map(([w]) => w),
    )
  })

  it("sounding-out.json: 8/8 'sound-out', fan man mat bat can cap dad jam", () => {
    const plan = wordSongSessionPlanFromServer(readPlan('sounding-out'), NATIVE)
    expect(plan.id).toBe('sounding-out-level-1')
    expect(plan.label).toBe('Word Song Sounding Out Level 1')
    expect(plan.problems.map((p) => p.contentType)).toEqual(
      Array(8).fill(SOUND_OUT),
    )
    expect(plan.problems.map((p) => p.target.word)).toEqual(
      STOP_2.map(([w]) => w),
    )
  })

  it('"What is it?" never routes to the little stories; the four story files still parse as stories', () => {
    const so = wordSongSessionPlanFromServer(readPlan('sounding-out'), NATIVE)
    expect(so.problems.some((p) => p.contentType === 'little-story')).toBe(
      false,
    )
    for (const stem of [
      'fox-stories',
      'hen-stories',
      'bug-stories',
      'sheep-stories',
    ]) {
      const plan = wordSongSessionPlanFromServer(readPlan(stem), NATIVE)
      expect(
        plan.problems.every((p) => p.contentType === 'little-story'),
        stem,
      ).toBe(true)
    }
  })

  it('without blendReads both files throw (the frozen web plays its static plan)', () => {
    for (const stem of ['blending-cv', 'sounding-out']) {
      expect(() =>
        wordSongSessionPlanFromServer(readPlan(stem), { littleStories: true }),
      ).toThrow(PlanFromServerError)
      expect(() => wordSongSessionPlanFromServer(readPlan(stem))).toThrow(
        PlanFromServerError,
      )
    }
  })
})

/** A one-problem-repeated plan with the given p1 lines. */
function planWith(lines: Record<string, string>): unknown {
  const utterances: { id: string; text: string }[] = []
  for (let p = 1; p <= 8; p++) {
    const slots: Record<string, string> = {
      read: LISTEN_BLEND_READ,
      correct: "Yes! That's a cat.",
      reprompt: 'Hmm... try again?',
      hint: "Let's look. Cat.",
      giveAnswer: 'This one is cat.',
      blend: 'c - a - t ... cat',
      ...lines,
    }
    for (const [slot, text] of Object.entries(slots))
      if (text !== '') utterances.push({ id: `word.p${p}.${slot}`, text })
  }
  return { id: 'x', label: 'x', utterances }
}

describe('rejections (AC 2)', () => {
  for (const read of ['Listen.', 'What is it?']) {
    it(`"${read}" with no blend`, () => {
      expect(() =>
        wordSongSessionPlanFromServer(planWith({ read, blend: '' }), NATIVE),
      ).toThrow(PlanFromServerError)
    })
    it(`"${read}" with a blend whose letters don't spell its word ("c - a - t ... hat")`, () => {
      expect(() =>
        wordSongSessionPlanFromServer(
          planWith({ read, blend: 'c - a - t ... hat' }),
          NATIVE,
        ),
      ).toThrow(PlanFromServerError)
    })
    it(`"${read}" with a blend whose word is not a target ("p - a - t ... pat", a distractor only)`, () => {
      expect(() =>
        wordSongSessionPlanFromServer(
          planWith({ read, blend: 'p - a - t ... pat' }),
          NATIVE,
        ),
      ).toThrow(PlanFromServerError)
    })
  }

  it('"Tap the cat." still parses as \'blending-cv\' (a canon miss, the frozen web)', () => {
    for (const options of [NATIVE, undefined]) {
      const plan = wordSongSessionPlanFromServer(
        planWith({ read: 'Tap the cat.' }),
        options,
      )
      expect(plan.problems[0]!.contentType).toBe('blending-cv')
      expect(plan.problems[0]!.target.word).toBe('cat')
    }
  })
})

describe("the deal gives § 6's chips (AC 3)", () => {
  for (const [stem, table] of [
    ['blending-cv', STOP_1],
    ['sounding-out', STOP_2],
  ] as const) {
    it(`${stem}: gentle P1–P3, trap P4–P8, no forbidden pair, f and v apart, no probe word`, () => {
      const plan = wordSongSessionPlanFromServer(readPlan(stem), NATIVE)
      plan.problems.forEach((p: WordSongProblem, i) => {
        const chips = buildWordChipOrder(p, false).map((e) => e.word)
        expect([...chips].sort(), `P${p.index}`).toEqual(
          [...table[i]![1]].sort(),
        )
        for (const a of chips)
          for (const b of chips)
            if (a !== b) expect(isForbiddenPair(a, b), `${a}–${b}`).toBe(false)
        const onsets = chips.map((w) => w[0])
        expect(onsets.includes('f') && onsets.includes('v')).toBe(false)
        for (const w of chips) expect(PROBE_WORDS).not.toContain(w)
      })
    })
  }
})

describe('the round rules (AC 4)', () => {
  const ALL: WordSongContentType[] = [
    'blending-cv',
    'cvc-word',
    'letter-names',
    'letter-sounds',
    'sight-word',
    'simple-sentence',
    'little-story',
    LISTEN_BLEND,
    SOUND_OUT,
  ]

  it("usesBlendClip: 'cvc-word', 'listen-blend', 'sound-out' only", () => {
    expect(ALL.filter(usesBlendClip)).toEqual([
      'cvc-word',
      LISTEN_BLEND,
      SOUND_OUT,
    ])
  })

  it('hidesPictureUntilAnswer: the two new types only', () => {
    expect(ALL.filter(hidesPictureUntilAnswer)).toEqual([
      LISTEN_BLEND,
      SOUND_OUT,
    ])
  })

  it('readAloudDelayMs is 0 for both; secondWrongPrompt plays the blend (stop 1) or the sounds (stop 2)', () => {
    const [s1] = wordSongSessionPlanFromServer(
      readPlan('blending-cv'),
      NATIVE,
    ).problems
    const so = wordSongSessionPlanFromServer(readPlan('sounding-out'), NATIVE)
      .problems[2]!
    expect(readAloudDelayMs(s1!)).toBe(0)
    expect(readAloudDelayMs(so)).toBe(0)
    expect(secondWrongPrompt(s1!)).toMatchObject({
      kind: 'blend',
      text: 'f - a - n ... fan',
    })
    expect(secondWrongPrompt(so)).toEqual({
      kind: 'sounds',
      text: 'm - a - t ... mat',
    })
  })

  it('without a blend the 2nd wrong falls back to the hint (§ 10)', () => {
    const [p] = wordSongSessionPlanFromServer(
      readPlan('sounding-out'),
      NATIVE,
    ).problems
    const bare: WordSongProblem = {
      ...p!,
      utterances: { ...p!.utterances, blend: undefined },
    }
    expect(secondWrongPrompt(bare)).toEqual({
      kind: 'hint',
      text: "Let's look. Fan.",
    })
  })

  it('blendSoundsText and blendTargetWord', () => {
    expect(blendSoundsText('f - a - n ... fan')).toBe('f - a - n')
    expect(blendTargetWord('f - a - n ... fan')).toBe('fan')
    expect(blendTargetWord('j - a - m ... jam')).toBe('jam')
    expect(blendTargetWord('Tap the cat.')).toBeNull()
    expect(blendTargetWord('Listen.')).toBeNull()
  })
})
