/**
 * @vitest-environment node
 *
 * Content wave 2's Word Song canon, tent words and cake words
 * (`design/native/content-wave-2.md` § 3.2, § 4.2, § 6.2), written by
 * `spliceContentWave2WordCanon.ts`: the committed files are the splice's
 * output, hold the spec's lines, reuse only bytes whose ElevenLabs request is
 * the same, and leave exactly the § 6.2 texts for the Lily render.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bigWordsOf } from '@marian/core/wordSong/bigWordsSteps'
import {
  BIG_WORDS_RECAP_FOCUS,
  bigWordsCanonViolations,
} from './bigWordsCanonCheck.ts'
import { PENDING_CANON_NODES, activeCombos } from './generateSessionCanon.ts'
import {
  WAVE_2_WORD_STEPS,
  awaitingRender,
  spliceWordStep,
  type CanonDoc,
} from './spliceContentWave2WordCanon.ts'

const DIR = resolve(process.cwd(), 'public/canon/word-song/level-1')
const committed = (stem: string): CanonDoc =>
  JSON.parse(readFileSync(resolve(DIR, `${stem}.json`), 'utf8'))

describe.each(WAVE_2_WORD_STEPS)('committed canon: %s', (step) => {
  const doc = committed(step)

  it('is exactly the splice output (re-running it changes nothing)', () => {
    expect(JSON.stringify(spliceWordStep(step))).toBe(JSON.stringify(doc))
  })

  it('holds the spec lines: 8 words in canon order, 5 slots each, no blend, the "reading words" recap', () => {
    expect(bigWordsCanonViolations(step, doc.plan.utterances)).toEqual([])
    expect(bigWordsCanonViolations(step, doc.utterances)).toEqual([])
    expect(doc.plan.utterances).toEqual(
      doc.utterances.map(({ id, text }) => ({ id, text })),
    )
    expect(doc.utterances).toHaveLength(60)
    expect(
      doc.utterances.find((u) => u.id === 'session.end.recap.focus')?.text,
    ).toBe(BIG_WORDS_RECAP_FOCUS)
    expect(
      doc.utterances.filter((u) => u.id.endsWith('.read')).map((u) => u.text),
    ).toEqual(bigWordsOf(step).map((w) => `Read the ${w}.`))
  })

  it('leaves exactly the 32 new texts (536 characters) for the Lily render (§ 6.2), none after it', () => {
    const newTexts = bigWordsOf(step).flatMap((w) => {
      const W = w.charAt(0).toUpperCase() + w.slice(1)
      return [
        `Read the ${w}.`,
        `Yes! That's a ${w}.`,
        `Let's look. ${W}.`,
        `This one is ${w}.`,
      ]
    })
    expect(newTexts).toHaveLength(32)
    expect(newTexts.reduce((n, t) => n + t.length, 0)).toBe(536)
    // Before the render: exactly these. After it: none.
    const waiting = awaitingRender(doc)
    expect(waiting).toEqual(waiting.length > 0 ? newTexts : [])
  })

  it('reuses duck words’ bytes for the shared lines (the re-prompt and the 20 session-end lines)', () => {
    const duck = committed('duck-words')
    const bytes = new Map(duck.utterances.map((u) => [u.text, u.audio.base64]))
    const reused = doc.utterances.filter(
      (u) => u.id.startsWith('session.end.') || u.id.endsWith('.reprompt'),
    )
    expect(reused).toHaveLength(28)
    for (const u of reused) expect(bytes.get(u.text), u.id).toBe(u.audio.base64)
  })
})

describe('the two steps in the bake lists', () => {
  it('are pending (no Haiku bake by the way) and active combos', () => {
    for (const step of WAVE_2_WORD_STEPS) {
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
    for (const step of WAVE_2_WORD_STEPS)
      expect(block).toContain(`['word-song', '${step}']`)
  })
})
