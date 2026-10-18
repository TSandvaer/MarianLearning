/**
 * @vitest-environment node
 *
 * Content wave 4's Word Song canon (`design/native/content-wave-4.md`
 * § 3.2, § 4.2, § 6.2, § 8.1, AC 4, AC 6), written by
 * `spliceContentWave4Canon.ts`: bee words and car words in the land-6
 * template, sheep stories in wave 3's story format. The committed files
 * are the splice's output, hold the tables and the rules (taught words with
 * the _seed_ exemption for the -ed check, § 6.2's shape), parse 8/8 on the
 * native parser with each step's own chips, reuse only bytes whose
 * ElevenLabs request is the same (the sh step's sheep and shark lines, the
 * re-prompt, the session end), and leave exactly § 8.1's texts for the Lily
 * render.
 *
 * The 88 new texts have empty audio until their Lily render
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
  WAVE_4_WORD_STEPS,
  WAVE_4_STORY_STEP,
  awaitingRender,
  sheepStoryViolations,
  spliceWave4Step,
  type CanonDoc,
} from './spliceContentWave4Canon.ts'

const DIR = resolve(process.cwd(), 'public/canon/word-song/level-1')
const committed = (stem: string): CanonDoc =>
  JSON.parse(readFileSync(resolve(DIR, `${stem}.json`), 'utf8'))

const STEPS = [...WAVE_4_WORD_STEPS, WAVE_4_STORY_STEP] as const

/** § 8.1's bill of new canon texts per step: [texts, characters]. */
const NEW_TEXTS: Record<(typeof STEPS)[number], [number, number]> = {
  'bee-words': [28, 469],
  'car-words': [28, 469],
  'sheep-stories': [32, 834],
}

describe('the steps', () => {
  it('bee words, car words, then sheep stories', () => {
    expect(STEPS).toEqual(['bee-words', 'car-words', 'sheep-stories'])
  })
})

describe.each(STEPS)('committed canon: %s', (step) => {
  const doc = committed(step)

  it('is exactly the splice output (re-running it changes nothing)', () => {
    expect(JSON.stringify(spliceWave4Step(step))).toBe(JSON.stringify(doc))
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
    if (step === 'sheep-stories') {
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
      if (step === 'sheep-stories') {
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

  it('leaves exactly § 8.1’s new texts for the Lily render, none after it', () => {
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
})

describe('the sh step’s sheep and shark lines are reused, not billed (§ 8.1)', () => {
  it.each([
    ['bee-words', 'sheep', 4],
    ['car-words', 'shark', 5],
  ] as const)('%s P%i… %s', (step, word, n) => {
    const sh = committed('digraphs-sh')
    const bytes = new Map(sh.utterances.map((u) => [u.text, u.audio.base64]))
    const doc = committed(step)
    const lines = doc.utterances.filter((u) => u.id.startsWith(`word.p${n}.`))
    expect(lines.map((u) => u.text)).toContain(`Read the ${word}.`)
    for (const u of lines) {
      expect(u.audio.base64, u.id).not.toBe('')
      if (!u.id.endsWith('.reprompt'))
        expect(bytes.get(u.text), u.id).toBe(u.audio.base64)
    }
  })
})

describe('sheep stories: the rules (§ 6.2)', () => {
  it('the table passes: taught words (with the 16 new targets), no plural, -ed only in seed, the sheep in every story, 2 of the 16 per story, all 16 used', () => {
    expect(sheepStoryViolations()).toEqual([])
  })

  /** The table with sheep-1's story swapped for `story`. */
  const withSheep1 = (story: string) =>
    storiesOf('sheep-stories').map((s, i) => (i === 0 ? { ...s, story } : s))

  // The lines stay the table's, so each message is the rules' own.
  it.each([
    [
      'The sheep sat in the jeep. It has a pear.',
      ['sheep-1: "pear" is not a taught word'],
    ],
    [
      'The sheep sat in the jeeps. It has a peach.',
      [
        'sheep-1: "jeeps" is not a taught word',
        'sheep-1: a plural or -s ending',
      ],
    ],
    [
      'The sheep hopped in the jeep. It has a peach.',
      ['sheep-1: "hopped" is not a taught word', 'sheep-1: an -ed ending'],
    ],
    ['The sheep sat in the jeep. It has a seed.', []],
  ] as const)('the lint on "%s"', (story, expected) => {
    const doc = committed('sheep-stories')
    expect(
      storyCanonViolations(
        'sheep-stories',
        doc.plan.utterances,
        taughtWords(),
        withSheep1(story),
      ),
    ).toEqual(expected)
  })

  it('"she" is caught by § 6.2, not the lint (she is a taught word)', () => {
    const rows = withSheep1('The sheep sat in the jeep. She has a peach.')
    const doc = committed('sheep-stories')
    expect(
      storyCanonViolations(
        'sheep-stories',
        doc.plan.utterances,
        taughtWords(),
        rows,
      ),
    ).toEqual([])
    expect(sheepStoryViolations(rows)).toEqual(['sheep-1: "she"'])
  })

  it('"seed" passes the -ed check (its exemption, § 6.2)', () => {
    expect(
      storiesOf('sheep-stories').filter((s) => /\bseed\b/.test(s.story)),
    ).toHaveLength(1)
    const doc = committed('sheep-stories')
    expect(storyCanonViolations('sheep-stories', doc.plan.utterances)).toEqual(
      [],
    )
  })

  it('throws on the web parser (no littleStories), so the frozen web falls back', () => {
    expect(() =>
      wordSongSessionPlanFromServer(committed('sheep-stories').plan),
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
