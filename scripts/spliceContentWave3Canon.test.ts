/**
 * @vitest-environment node
 *
 * Content wave 3's little-story canon (`design/native/content-wave-3.md`
 * § 4.6, § 4.7, § 5.1, AC 5), written by `spliceContentWave3Canon.ts`: the
 * committed files are the splice's output, hold the table's lines and the
 * taught-words rule (D2), parse 24/24 with § 4.7's chips on the native
 * parser, reuse only bytes whose ElevenLabs request is the same, and leave
 * exactly § 5.1's texts for the Lily render.
 *
 * The 85 new texts (99 slots) have empty audio until their Lily render
 * (`npx tsx scripts/revoiceCanonLily.ts --unrendered`); that red lives in
 * `canonIntegrity.test.ts` (a), which has no exemption by design.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  STORY_RECAP_FOCUS,
  storiesOf,
  type StoryNode,
} from '@marian/core/wordSong/littleStories'
import {
  PlanFromServerError,
  wordSongSessionPlanFromServer,
} from '@marian/core/wordSong/planFromServer'
import { buildWordRound } from '@marian/core/wordSong/wordRound'
import { PENDING_CANON_NODES, activeCombos } from './generateSessionCanon.ts'
import {
  STORY_REPROMPT,
  WAVE_3_STORY_STEPS,
  awaitingRender,
  spliceStoryStep,
  storyCanonViolations,
  taughtWords,
  type CanonDoc,
} from './spliceContentWave3Canon.ts'

const DIR = resolve(process.cwd(), 'public/canon/word-song/level-1')
const committed = (stem: string): CanonDoc =>
  JSON.parse(readFileSync(resolve(DIR, `${stem}.json`), 'utf8'))

/** § 5.1's per-step bill of new texts: [texts, characters]. */
const NEW_TEXTS: Partial<Record<StoryNode, [number, number]>> = {
  'fox-stories': [25, 661],
  'hen-stories': [31, 748],
  'bug-stories': [29, 724],
}

describe.each(WAVE_3_STORY_STEPS)('committed canon: %s', (step) => {
  const doc = committed(step)

  it('is exactly the splice output (re-running it changes nothing)', () => {
    expect(JSON.stringify(spliceStoryStep(step))).toBe(JSON.stringify(doc))
  })

  it('holds the table: 8 stories, 5 slots each, no blend, the "reading stories" recap', () => {
    expect(storyCanonViolations(step, doc.plan.utterances)).toEqual([])
    expect(doc.plan.utterances).toEqual(
      doc.utterances.map(({ id, text }) => ({ id, text })),
    )
    expect(doc.utterances).toHaveLength(60)
    expect(doc.utterances.some((u) => u.id.endsWith('.blend'))).toBe(false)
    expect(
      doc.utterances.find((u) => u.id === 'session.end.recap.focus')?.text,
    ).toBe(STORY_RECAP_FOCUS)
    const rows = storiesOf(step)
    expect(
      doc.utterances.filter((u) => u.id.endsWith('.hint')).map((u) => u.text),
    ).toEqual(rows.map((s) => s.story))
    expect(
      doc.utterances.filter((u) => u.id.endsWith('.read')).map((u) => u.text),
    ).toEqual(rows.map((s) => s.question))
  })

  it('parses 8/8 on the native parser, with § 4.7 chips (AC 5)', () => {
    const plan = wordSongSessionPlanFromServer(doc.plan, {
      littleStories: true,
    })
    const rows = storiesOf(step)
    expect(plan.problems).toHaveLength(8)
    plan.problems.forEach((p, i) => {
      expect(p.contentType).toBe('little-story')
      expect(p.storyId).toBe(rows[i]!.id)
      expect(
        buildWordRound(p, { crossVowel: false })
          .chips.map((e) => e.word)
          .sort(),
      ).toEqual([rows[i]!.answer, ...rows[i]!.wrong].sort())
    })
  })

  it('throws on the web parser (no littleStories), so the frozen web falls back', () => {
    expect(() => wordSongSessionPlanFromServer(doc.plan)).toThrow(
      PlanFromServerError,
    )
  })

  it('leaves exactly § 5.1’s new texts for the Lily render, none after it', () => {
    const waiting = awaitingRender(doc)
    if (waiting.length === 0) return // rendered
    const shared = new Set(
      WAVE_3_STORY_STEPS.slice(0, WAVE_3_STORY_STEPS.indexOf(step)).flatMap(
        (s) => awaitingRender(committed(s)),
      ),
    )
    const fresh = waiting.filter((t) => !shared.has(t))
    expect([fresh.length, fresh.reduce((n, t) => n + t.length, 0)]).toEqual(
      NEW_TEXTS[step],
    )
  })

  it('reuses duck words’ bytes for the shared lines (the re-prompt and the 19 session-end lines but the recap)', () => {
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
    expect(
      doc.utterances.filter((u) => u.text === STORY_REPROMPT),
    ).toHaveLength(8)
  })
})

describe('the rules (§ 4.7, D2)', () => {
  it('every story word is taught: a canon target, a sight-words / simple-sentences word, or and / got / hid', () => {
    const taught = taughtWords()
    for (const w of [
      'a',
      'the',
      'is',
      'it',
      'in',
      'on',
      'to',
      'she',
      'has',
      'sat',
      'ran',
    ])
      expect(taught.has(w), w).toBe(true)
    for (const step of WAVE_3_STORY_STEPS)
      expect(
        storyCanonViolations(step, committed(step).plan.utterances, taught),
      ).toEqual([])
  })

  it('a story with an untaught word or a plural is caught', () => {
    const doc = committed('fox-stories')
    const bad = doc.plan.utterances.map((u) =>
      u.id === 'word.p1.hint' ? { ...u, text: 'The foxes sat on the rug.' } : u,
    )
    expect(storyCanonViolations('fox-stories', bad).length).toBeGreaterThan(0)
  })
})

describe('the three steps in the bake lists', () => {
  it('are pending (never Haiku-baked) and active combos', () => {
    for (const step of WAVE_3_STORY_STEPS) {
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
    for (const step of WAVE_3_STORY_STEPS)
      expect(block).toContain(`['word-song', '${step}']`)
  })
})
