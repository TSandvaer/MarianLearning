/**
 * The app-built cvc-words graduation check (Thomas 2026-10-23): the canon
 * plan with three problems swapped for probe-word blocks from the bundled
 * probe canon, read by the same parser and dealt the same chips as any
 * canon problem.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultProgress } from '../progress/defaults'
import type { Progress, SessionHistoryEntry } from '../progress/types'
import {
  GRADUATION_PROBE_PROBLEMS,
  graduationAttempts,
  graduationProbeWords,
  withGraduationProbes,
} from './graduationCheck'
import { NOVEL_PROBE_WORDS } from './novelProbeWords'
import { wordSongSessionPlanFromServer } from './planFromServer'
import { buildWordChipOrder } from './wordChips'
import { isForbiddenPair } from './wordPack'

const canonDoc = (stem: string) =>
  JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        'public',
        'canon',
        'word-song',
        'level-1',
        `${stem}.json`,
      ),
      'utf8',
    ),
  )
const CANON = canonDoc('cvc-words').plan
const PROBE_DOC = canonDoc('cvc-words-probe')
const PROBE = PROBE_DOC.plan

const words = (plan: unknown) =>
  wordSongSessionPlanFromServer(plan, { step: 'cvc-words' }).problems.map(
    (p) => p.target.word,
  )

describe('withGraduationProbes', () => {
  it('swaps problems 2, 5 and 7 for the probe words, the rest stay canon', () => {
    const plan = withGraduationProbes(CANON, PROBE, ['nap', 'rat', 'map'])
    expect(words(plan)).toEqual([
      'hat',
      'nap',
      'man',
      'van',
      'rat',
      'bag',
      'map',
      'tag',
    ])
    expect(GRADUATION_PROBE_PROBLEMS).toEqual([2, 5, 7])
  })

  it('a probe problem is a cvc word in canon slot texts, keeping the session reprompt', () => {
    const plan = wordSongSessionPlanFromServer(
      withGraduationProbes(CANON, PROBE, ['nap', 'rat', 'map']),
      { step: 'cvc-words' },
    )
    const p2 = plan.problems[1]!
    expect(p2.contentType).toBe('cvc-word')
    expect(p2.utterances).toEqual({
      read: 'Read the nap.',
      correct: "Yes! That's a nap.",
      reprompt: 'Hmm... try again?',
      hint: "Let's look. Nap.",
      giveAnswer: 'This one is nap.',
      blend: 'n - a - p ... nap',
    })
    // Same ids and order as the canon plan; only the swapped texts differ.
    const swapped = withGraduationProbes(CANON, PROBE, ['nap', 'rat', 'map'])!
    expect(swapped.utterances.map((u) => u.id)).toEqual(
      CANON.utterances.map((u: { id: string }) => u.id),
    )
    const changed = swapped.utterances.filter(
      (u, i) => u.text !== CANON.utterances[i].text,
    )
    expect(changed).toHaveLength(15)
    expect(changed.every((u) => /^word\.p[257]\./.test(u.id))).toBe(true)
  })

  it('deals each probe chips from its pairing row, with no forbidden pair', () => {
    for (let attempt = 0; attempt < NOVEL_PROBE_WORDS.length; attempt++) {
      const plan = wordSongSessionPlanFromServer(
        withGraduationProbes(CANON, PROBE, graduationProbeWords(attempt)),
        { step: 'cvc-words' },
      )
      for (const n of GRADUATION_PROBE_PROBLEMS) {
        const chips = buildWordChipOrder(plan.problems[n - 1]!, false).map(
          (e) => e.word,
        )
        expect(chips).toHaveLength(3)
        expect(new Set(chips).size).toBe(3)
        for (const a of chips)
          for (const b of chips)
            if (a !== b) expect(isForbiddenPair(a, b)).toBe(false)
      }
    }
  })

  it('declines a malformed plan, a word outside the probe pool, or a missing block', () => {
    expect(withGraduationProbes(null, PROBE, ['nap', 'rat', 'map'])).toBeNull()
    expect(withGraduationProbes(CANON, {}, ['nap', 'rat', 'map'])).toBeNull()
    expect(withGraduationProbes(CANON, PROBE, ['nap', 'rat'])).toBeNull()
    expect(withGraduationProbes(CANON, PROBE, ['nap', 'rat', 'cat'])).toBeNull()
    const noTap = {
      ...PROBE,
      utterances: PROBE.utterances.filter(
        (u: { text: string }) => !u.text.includes('tap'),
      ),
    }
    expect(withGraduationProbes(CANON, noTap, ['rat', 'map', 'tap'])).toBeNull()
  })
})

describe('the probe canon', () => {
  it('holds one rendered five-line block per novel probe word', () => {
    expect(PROBE.utterances).toHaveLength(NOVEL_PROBE_WORDS.length * 5)
    expect(
      PROBE_DOC.utterances.filter(
        (u: { audio: { base64: string } }) => u.audio.base64 === '',
      ),
    ).toEqual([])
    for (const w of NOVEL_PROBE_WORDS) {
      expect(
        withGraduationProbes(CANON, PROBE, [w, w, w])?.utterances.some(
          (u) => u.text === `Read the ${w}.`,
        ),
      ).toBe(true)
    }
  })
})

describe('graduationProbeWords', () => {
  it('takes three probe words, starting one further on each attempt', () => {
    expect(graduationProbeWords(0)).toEqual(['nap', 'rat', 'map'])
    expect(graduationProbeWords(1)).toEqual(['rat', 'map', 'tap'])
    expect(graduationProbeWords(2)).toEqual(['map', 'tap', 'nap'])
    expect(graduationProbeWords(4)).toEqual(graduationProbeWords(0))
  })

  it('counts the attempts as the node’s entries with a novel-pool score', () => {
    const entry = (
      skillFocus: SessionHistoryEntry['skillFocus'],
      novel?: number,
    ): SessionHistoryEntry => ({
      dateISO: '2026-10-23T09:00:00.000Z',
      skillFocus,
      successRate: 1,
      ...(novel !== undefined ? { novelPoolSuccessRate: novel } : {}),
    })
    const progress: Progress = {
      ...defaultProgress(),
      history: [
        entry(['cvc-words']),
        entry(['cvc-words'], 0.5),
        entry(['sounding-out'], 1),
        entry(['cvc-words']),
      ],
    }
    expect(graduationAttempts(progress, 'cvc-words')).toBe(1)
  })
})
