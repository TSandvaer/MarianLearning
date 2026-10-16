/**
 * @vitest-environment node
 *
 * The land-6 Word Song canon (content wave 1, duck words and crab words):
 * the bake-time check against synthetic plans (green before the bake), and
 * the committed canon files (red until the render agent bakes them: they
 * carry Lily's audio, which needs Thomas's OK on the credit use).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { canonFileTierFor } from '../api/_canon.js'
import {
  PENDING_CANON_NODES,
  activeCombos,
  combosToBakeFor,
} from './generateSessionCanon.ts'
import { wordSongSessionPlanFromServer } from '@marian/core/wordSong/planFromServer'
import { bigWordsOf } from '@marian/core/wordSong/bigWordsSteps'
import {
  BIG_WORDS_RECAP_FOCUS,
  bigWordsCanonViolations,
  expectedBigWordsLines,
  isBigWordsStep,
} from './bigWordsCanonCheck.ts'

const STEPS = ['duck-words', 'crab-words'] as const

function canonPath(step: string): string {
  return resolve(process.cwd(), `public/canon/word-song/level-1/${step}.json`)
}

describe('bigWordsCanonCheck', () => {
  it('knows exactly the two land-6 steps', () => {
    expect(STEPS.filter(isBigWordsStep)).toEqual([...STEPS])
    expect(
      ['simple-sentences', 'cvc-words', 'mult-mix'].filter(isBigWordsStep),
    ).toEqual([])
  })

  it('spells the § 6.2 lines (rows 69-72 and 113-116)', () => {
    expect(expectedBigWordsLines('duck-words').slice(0, 5)).toEqual([
      { id: 'word.p1.read', text: 'Read the duck.' },
      { id: 'word.p1.correct', text: "Yes! That's a duck." },
      { id: 'word.p1.reprompt', text: 'Hmm... try again?' },
      { id: 'word.p1.hint', text: "Let's look. Duck." },
      { id: 'word.p1.giveAnswer', text: 'This one is duck.' },
    ])
    expect(expectedBigWordsLines('crab-words').slice(15, 20)).toEqual([
      { id: 'word.p4.read', text: 'Read the crab.' },
      { id: 'word.p4.correct', text: "Yes! That's a crab." },
      { id: 'word.p4.reprompt', text: 'Hmm... try again?' },
      { id: 'word.p4.hint', text: "Let's look. Crab." },
      { id: 'word.p4.giveAnswer', text: 'This one is crab.' },
    ])
    expect(expectedBigWordsLines('duck-words')).toHaveLength(40)
  })

  it('passes a plan that is exactly the spec, and the parser reads it as 8 picture-word problems', () => {
    for (const step of STEPS) {
      const utterances = [
        ...expectedBigWordsLines(step),
        { id: 'session.end.recap.focus', text: BIG_WORDS_RECAP_FOCUS },
      ]
      expect(bigWordsCanonViolations(step, utterances)).toEqual([])
      const plan = wordSongSessionPlanFromServer({
        id: `word-song-${step}`,
        label: step,
        utterances,
      })
      expect(plan.problems.map((p) => p.contentType)).toEqual(
        Array(8).fill('cvc-word'),
      )
      expect(plan.problems.map((p) => p.target.word)).toEqual(bigWordsOf(step))
      // No blend clip (K11): the 2nd wrong plays the hint line.
      expect(
        plan.problems.filter(
          (p) => p.contentType === 'cvc-word' && p.utterances.blend,
        ),
      ).toEqual([])
    }
  })

  it('names every drift: order, a reworded line, a blend slot, a missing slot, the recap', () => {
    const lines = expectedBigWordsLines('duck-words').map((u) => ({ ...u }))
    // Swap P1 and P2's read lines, reword P3's correct, drop P8's hint.
    lines[0]!.text = 'Read the rock.'
    lines[5]!.text = 'Read the duck.'
    lines[11]!.text = 'Yes! Ring!'
    const drifted = [
      ...lines.filter((u) => u.id !== 'word.p8.hint'),
      { id: 'word.p1.blend', text: 'd - u - ck ... duck' },
      {
        id: 'session.end.recap.focus',
        text: 'You worked on duck words today!',
      },
    ]
    expect(bigWordsCanonViolations('duck-words', drifted)).toEqual([
      'word.p1.read is "Read the rock.", expected "Read the duck."',
      'word.p2.read is "Read the duck.", expected "Read the rock."',
      `word.p3.correct is "Yes! Ring!", expected "Yes! That's a ring."`,
      `missing word.p8.hint ("Let's look. Sack.")`,
      'unexpected word.p1.blend ("d - u - ck ... duck")',
      'session.end.recap.focus is "You worked on duck words today!", expected "You worked on reading words today!"',
    ])
  })
})

// `CANON_FILES` on the voice-QA page is hardcoded; sight-words and
// simple-sentences once shipped without an entry, so their clips could not
// be ear-tested (sibling-tier-checklist.md, ticket 86ca8f54x). Every baked
// combo must be listed.
describe('voice-QA CANON_FILES', () => {
  it('lists every baked canon combo, the two land-6 steps included', () => {
    const html = readFileSync(
      resolve(process.cwd(), 'public/voice-qa.html'),
      'utf8',
    )
    const block = html.slice(
      html.indexOf('const CANON_FILES'),
      html.indexOf('const GREET_FILES'),
    )
    const listed = new Set(
      [...block.matchAll(/\[\s*'(math|word-song)',\s*'([^']+)'\s*\]/g)].map(
        (m) => `${m[1]}/${m[2]}`,
      ),
    )
    const baked = activeCombos().map(
      (c) => `${c.track}/${canonFileTierFor(c.focusNode)}`,
    )
    expect(baked.filter((key) => !listed.has(key))).toEqual([])
    expect(listed.has('word-song/duck-words')).toBe(true)
    expect(listed.has('word-song/crab-words')).toBe(true)
  })
})

// Before #581 the Vercel `prebuild` ran the bake on every preview build with
// the build env's keys, and three pushes of this branch baked the two steps
// on Vercel (Haiku + TTS credit, Azure voice, never committed). The gate
// still keeps an incremental or `--force` run off them.
describe('the pending-canon gate', () => {
  const combos = activeCombos()
  const none = () => false

  it('an incremental run never bakes a pending step, even when its file is missing', () => {
    // Both land-6 steps are pending (other steps may join the set too).
    expect(STEPS.filter((n) => PENDING_CANON_NODES.has(n))).toEqual([...STEPS])
    const baked = combosToBakeFor(
      combos,
      { force: false, includePending: false },
      none,
    ).map((c) => c.focusNode)
    expect(baked.filter((n) => PENDING_CANON_NODES.has(n))).toEqual([])
    expect(baked).toHaveLength(
      combos.filter((c) => !PENDING_CANON_NODES.has(c.focusNode)).length,
    )
    // --force does not include them either.
    expect(
      combosToBakeFor(combos, { force: true, includePending: false }, none)
        .map((c) => c.focusNode)
        .filter((n) => PENDING_CANON_NODES.has(n)),
    ).toEqual([])
  })

  it('--include-pending bakes them (the deliberate render), and an existing file is still skipped', () => {
    // Only the two land-6 files are missing.
    const exists = (c: { focusNode: string }) =>
      !(STEPS as readonly string[]).includes(c.focusNode)
    expect(
      combosToBakeFor(combos, { force: false, includePending: true }, exists)
        .map((c) => c.focusNode)
        .sort(),
    ).toEqual(['crab-words', 'duck-words'])
    expect(
      combosToBakeFor(combos, { force: false, includePending: false }, exists),
    ).toEqual([])
  })
})

// Expected red until the render agent bakes the two canon files.
describe.each(STEPS)('committed canon: %s', (step) => {
  it('exists, matches the spec lines exactly and carries audio on every line', () => {
    expect(existsSync(canonPath(step)), canonPath(step)).toBe(true)
    const canon = JSON.parse(readFileSync(canonPath(step), 'utf8')) as {
      plan: { id: string; utterances: { id: string; text: string }[] }
      utterances: { id: string; text: string; audio?: unknown }[]
    }
    expect(bigWordsCanonViolations(step, canon.plan.utterances)).toEqual([])
    expect(bigWordsCanonViolations(step, canon.utterances)).toEqual([])
    expect(canon.utterances.filter((u) => u.audio === undefined)).toEqual([])
  })
})
