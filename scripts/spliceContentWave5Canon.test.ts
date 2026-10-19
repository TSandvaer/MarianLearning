/**
 * @vitest-environment node
 *
 * Content wave 5's Word Song canon (`design/native/content-wave-5.md`
 * § 4.2, § 5.2, § 7.2, § 9.1, AC 4, AC 6), written by
 * `spliceContentWave5Canon.ts`: snail words and moon words in the land-6
 * template, goat stories in wave 3's story format. The committed files are
 * the splice's output, hold the tables and the rules (taught words, § 7.2's
 * shape, the lead-cue words at P1), parse 8/8 on the native parser with
 * each step's own chips, reuse only bytes whose ElevenLabs request is the
 * same (the re-prompt, the session end, the reading-stories recap), and
 * leave exactly § 9.1's texts for the Lily render.
 *
 * The 94 new texts have empty audio until their Lily render
 * (`npx tsx scripts/revoiceCanonLily.ts --unrendered`); that red lives in
 * `canonIntegrity.test.ts` (a), which has no exemption by design.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BIG_WORDS_STEPS } from '@marian/core/wordSong/bigWordsSteps'
import {
  STORY_RECAP_FOCUS,
  storiesOf,
  type LittleStory,
} from '@marian/core/wordSong/littleStories'
import {
  PlanFromServerError,
  wordSongSessionPlanFromServer,
} from '@marian/core/wordSong/planFromServer'
import { buildWordRound } from '@marian/core/wordSong/wordRound'
import {
  BIG_WORDS_RECAP_FOCUS,
  bigWordsCanonViolations,
} from './bigWordsCanonCheck.ts'
import { PENDING_CANON_NODES, activeCombos } from './generateSessionCanon.ts'
import { storyCanonViolations, taughtWords } from './spliceContentWave3Canon.ts'
import {
  WAVE_5_WORD_STEPS,
  WAVE_5_STORY_STEP,
  awaitingRender,
  goatStoryViolations,
  leadCueViolations,
  spliceWave5Step,
  type CanonDoc,
} from './spliceContentWave5Canon.ts'

const DIR = resolve(process.cwd(), 'public/canon/word-song/level-1')
const committed = (stem: string): CanonDoc =>
  JSON.parse(readFileSync(resolve(DIR, `${stem}.json`), 'utf8'))

const STEPS = [...WAVE_5_WORD_STEPS, WAVE_5_STORY_STEP] as const

/** § 9.1's bill of new canon texts per step: [texts, characters]. */
const NEW_TEXTS: Record<(typeof STEPS)[number], [number, number]> = {
  'snail-words': [32, 548],
  'moon-words': [32, 552],
  'goat-stories': [30, 805],
}

describe('the steps', () => {
  it('snail words, moon words, then goat stories', () => {
    expect(STEPS).toEqual(['snail-words', 'moon-words', 'goat-stories'])
  })
})

describe.each(STEPS)('committed canon: %s', (step) => {
  const doc = committed(step)

  it('is exactly the splice output (re-running it changes nothing)', () => {
    expect(JSON.stringify(spliceWave5Step(step))).toBe(JSON.stringify(doc))
  })

  it('holds its table: 8 problems, 5 slots each, no blend, its recap', () => {
    expect(doc.plan.utterances).toEqual(
      doc.utterances.map(({ id, text }) => ({ id, text })),
    )
    expect(doc.utterances).toHaveLength(60)
    expect(doc.utterances.some((u) => u.id.endsWith('.blend'))).toBe(false)
    const recap = doc.utterances.find(
      (u) => u.id === 'session.end.recap.focus',
    )?.text
    if (step === 'goat-stories') {
      expect(storyCanonViolations(step, doc.plan.utterances)).toEqual([])
      expect(recap).toBe(STORY_RECAP_FOCUS)
    } else {
      expect(bigWordsCanonViolations(step, doc.plan.utterances)).toEqual([])
      expect(recap).toBe(BIG_WORDS_RECAP_FOCUS)
    }
  })

  it('parses 8/8 on the native parser, with the step’s own chips (AC 4, AC 5, AC 6)', () => {
    const plan = wordSongSessionPlanFromServer(doc.plan, {
      littleStories: true,
      step,
    })
    expect(plan.problems).toHaveLength(8)
    plan.problems.forEach((p, i) => {
      const chips = buildWordRound(p, { crossVowel: false })
        .chips.map((e) => e.word)
        .sort()
      if (step === 'goat-stories') {
        const row = storiesOf(step)[i]!
        expect(p.contentType).toBe('little-story')
        expect(p.storyId).toBe(row.id)
        expect(chips).toEqual([row.answer, ...row.wrong].sort())
      } else {
        const row = BIG_WORDS_STEPS[step][i]!
        expect(p.contentType).toBe('cvc-word')
        expect(chips).toEqual(
          [row.word, ...(i < 3 ? row.gentle : row.trap)].sort(),
        )
      }
    })
  })

  it('leaves exactly § 9.1’s new texts for the Lily render, none after it', () => {
    const waiting = awaitingRender(doc)
    if (waiting.length === 0) return // rendered
    const shared = new Set(
      STEPS.slice(0, STEPS.indexOf(step)).flatMap((s) =>
        awaitingRender(committed(s)),
      ),
    )
    const fresh = waiting.filter((t) => !shared.has(t))
    expect([fresh.length, fresh.reduce((n, t) => n + t.length, 0)]).toEqual(
      NEW_TEXTS[step],
    )
  })

  it('reuses committed bytes for the shared lines (the re-prompt and the 19 session-end lines but the recap)', () => {
    const duck = committed('duck-words')
    const bytes = new Map(duck.utterances.map((u) => [u.text, u.audio.base64]))
    const reused = doc.utterances.filter(
      (u) =>
        (u.id.startsWith('session.end.') &&
          u.id !== 'session.end.recap.focus') ||
        u.id.endsWith('.reprompt'),
    )
    expect(reused).toHaveLength(27)
    for (const u of reused) {
      expect(u.audio.base64, u.id).not.toBe('')
      expect(bytes.get(u.text), u.id).toBe(u.audio.base64)
    }
  })

  it('reuses the recap’s committed bytes', () => {
    const source = committed(
      step === 'goat-stories' ? 'sheep-stories' : 'duck-words',
    )
    const recap = (d: CanonDoc) =>
      d.utterances.find((u) => u.id === 'session.end.recap.focus')!
    expect(recap(doc).audio.base64).not.toBe('')
    expect(recap(doc).audio.base64).toBe(recap(source).audio.base64)
  })
})

describe('the lead-cue words at P1 (§ 5.3 lint)', () => {
  it('the table passes: snail words P1 ends in its team, moon words P1 holds "oo"', () => {
    expect(leadCueViolations()).toEqual([])
  })

  it('names a P1 that breaks the rule', () => {
    expect(
      leadCueViolations({
        'snail-words': ['boat', 'tray'],
        'moon-words': ['boot', 'moon'],
      }),
    ).toEqual([])
    expect(
      leadCueViolations({
        'snail-words': ['train', 'tray'],
        'moon-words': ['stool', 'moon'],
      }),
    ).toEqual([])
    expect(
      leadCueViolations({
        'snail-words': ['snail', 'tray'],
        'moon-words': ['chain', 'moon'],
      }),
    ).toEqual([
      'snail-words P1 "snail" does not end in ai, ay or oa',
      'moon-words P1 "chain" holds no "oo"',
    ])
  })
})

describe('goat stories: the rules (§ 7.2)', () => {
  it('the table passes: taught words (with the 16 new targets), no plural or -ed, the goat in every story, 2 of the 16 per story, all 16 used, the goat answers P1 and P7 only', () => {
    expect(goatStoryViolations()).toEqual([])
  })

  /** The table with goat-1's story swapped for `story`. */
  const withGoat1 = (story: string): LittleStory[] =>
    storiesOf('goat-stories').map((s, i) => (i === 0 ? { ...s, story } : s))

  // The lines stay the table's, so each message is the rules' own.
  it.each([
    [
      'The goat sat in the boat. It has a pear.',
      ['goat-1: "pear" is not a taught word'],
    ],
    [
      'The goat sat in the boats. It has a loaf.',
      ['goat-1: "boats" is not a taught word', 'goat-1: a plural or -s ending'],
    ],
    [
      'The goat hopped in the boat. It has a loaf.',
      ['goat-1: "hopped" is not a taught word', 'goat-1: an -ed ending'],
    ],
  ] as const)('the lint on "%s"', (story, expected) => {
    const doc = committed('goat-stories')
    expect(
      storyCanonViolations(
        'goat-stories',
        doc.plan.utterances,
        taughtWords(),
        withGoat1(story),
      ),
    ).toEqual(expected)
  })

  it('§ 7.2’s own rules: "she", the goat missing, too few words, a long question, an answer the goat should not give', () => {
    expect(
      goatStoryViolations(
        withGoat1('The goat sat in the boat. She has a loaf.'),
      ),
    ).toEqual(['goat-1: "she"'])
    expect(
      goatStoryViolations(withGoat1('The cat sat in the boat. It has a loaf.')),
    ).toEqual(['goat-1: no goat'])
    expect(
      goatStoryViolations(withGoat1('The goat sat in the boat with a loaf.')),
    ).toEqual(['goat-1: not 2 sentences', 'goat-1: 9 words'])
    const rows = storiesOf('goat-stories').map((s, i) =>
      i === 1 ? { ...s, question: 'What is in the little red train?' } : s,
    )
    expect(goatStoryViolations(rows)).toEqual([
      'goat-2: question of 32 characters',
    ])
    const goat4 = storiesOf('goat-stories').map((s, i) =>
      i === 3 ? { ...s, answer: 'goat', wrong: ['coat', 'tray'] as const } : s,
    )
    expect(goatStoryViolations(goat4)).toEqual([
      'goat-4: the goat answers (only P1 and P7 may)',
    ])
  })

  it('every story word but the extras is taught; no exemption this wave', () => {
    const doc = committed('goat-stories')
    expect(storyCanonViolations('goat-stories', doc.plan.utterances)).toEqual(
      [],
    )
  })

  it('throws on the web parser (no littleStories), so the frozen web falls back', () => {
    expect(() =>
      wordSongSessionPlanFromServer(committed('goat-stories').plan),
    ).toThrow(PlanFromServerError)
  })
})

describe('the three steps in the bake lists', () => {
  it('are pending (never Haiku-baked) and active combos', () => {
    for (const step of STEPS) {
      expect(PENDING_CANON_NODES.has(step)).toBe(true)
      expect(
        activeCombos().filter(
          (c) => c.track === 'word-song' && c.focusNode === step,
        ),
      ).toHaveLength(1)
    }
  })

  it('are on the voice-QA page (CANON_FILES)', () => {
    const html = readFileSync(
      resolve(process.cwd(), 'public/voice-qa.html'),
      'utf8',
    )
    const block = html.slice(
      html.indexOf('const CANON_FILES'),
      html.indexOf('const GREET_FILES'),
    )
    for (const step of STEPS)
      expect(block).toContain(`['word-song', '${step}']`)
  })
})
