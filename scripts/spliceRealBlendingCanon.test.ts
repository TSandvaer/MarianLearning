/**
 * @vitest-environment node
 *
 * Real blending's canon (`design/native/real-blending.md` § 6, § 11, AC 8,
 * AC 9), written by `spliceRealBlendingCanon.ts`: blending sounds'
 * replaced file (`'listen-blend'`, "Listen.") and sounding out's new one
 * (`'sound-out'`, "What is it?"). The committed files are the splice's
 * output and hold § 6's tables; stop 1's 8 blends carry cvc-words' bytes;
 * every reused text carries its source's bytes; a new text is empty until
 * the Lily render (that red lives in `canonIntegrity.test.ts` (a), which
 * has no exemption by design).
 *
 * AC 9's "before" is `__fixtures__/canonRequests.before.json`: every
 * committed canon text's ElevenLabs request on `main` at aeeb3476, before
 * `CANON_TEXT_INPUTS`, as [tier, text, request] (request `null` = the text
 * itself). Only `letter-sounds` and `simple-sentences` change a request, so
 * every other tier is stored as `null`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CANON_TEXT_INPUTS,
  renderElevenLabsText,
} from '../api/_tts_elevenlabs.js'
import {
  PENDING_CANON_NODES,
  activeCombos,
  combosToBakeFor,
} from './generateSessionCanon.ts'
import {
  REAL_BLENDING_STEPS,
  awaitingRender,
  realBlendingViolations,
  spliceRealBlendingStep,
  type CanonDoc,
} from './spliceRealBlendingCanon.ts'

const DIR = resolve(process.cwd(), 'public/canon/word-song/level-1')
const committed = (stem: string): CanonDoc =>
  JSON.parse(readFileSync(resolve(DIR, `${stem}.json`), 'utf8'))

/** § 6's tables, slot by slot: read, correct, hint, giveAnswer, blend. */
const TABLE: Record<string, ReadonlyArray<readonly string[]>> = {
  'blending-cv': [
    [
      'Listen.',
      "Yes! That's a fan.",
      "Let's look. Fan.",
      'This one is fan.',
      'f - a - n ... fan',
    ],
    [
      'Listen.',
      "Yes! That's a man.",
      "Let's look. Man.",
      'This one is man.',
      'm - a - n ... man',
    ],
    [
      'Listen.',
      "Yes! That's a van.",
      "Let's look. Van.",
      'This one is van.',
      'v - a - n ... van',
    ],
    [
      'Listen.',
      "Yes! That's a hat.",
      "Let's look. Hat.",
      'This one is hat.',
      'h - a - t ... hat',
    ],
    [
      'Listen.',
      "Yes! That's a cat.",
      "Let's look. Cat.",
      'This one is cat.',
      'c - a - t ... cat',
    ],
    [
      'Listen.',
      "Yes! That's a bag.",
      "Let's look. Bag.",
      'This one is bag.',
      'b - a - g ... bag',
    ],
    [
      'Listen.',
      "Yes! That's a pan.",
      "Let's look. Pan.",
      'This one is pan.',
      'p - a - n ... pan',
    ],
    [
      'Listen.',
      "Yes! That's a tag.",
      "Let's look. Tag.",
      'This one is tag.',
      't - a - g ... tag',
    ],
  ],
  'sounding-out': [
    [
      'What is it?',
      "Yes! That's a fan.",
      "Let's look. Fan.",
      'This one is fan.',
      'f - a - n ... fan',
    ],
    [
      'What is it?',
      "Yes! That's a man.",
      "Let's look. Man.",
      'This one is man.',
      'm - a - n ... man',
    ],
    [
      'What is it?',
      "Yes! That's a mat.",
      "Let's look. Mat.",
      'This one is mat.',
      'm - a - t ... mat',
    ],
    [
      'What is it?',
      "Yes! That's a bat.",
      "Let's look. Bat.",
      'This one is bat.',
      'b - a - t ... bat',
    ],
    [
      'What is it?',
      "Yes! That's a can.",
      "Let's look. Can.",
      'This one is can.',
      'c - a - n ... can',
    ],
    [
      'What is it?',
      "Yes! That's a cap.",
      "Let's look. Cap.",
      'This one is cap.',
      'c - a - p ... cap',
    ],
    [
      'What is it?',
      'Yes! Dad!',
      "Let's look. Dad.",
      'This one is dad.',
      'd - a - d ... dad',
    ],
    [
      'What is it?',
      'Yes! Jam!',
      "Let's look. Jam.",
      'This one is jam.',
      'j - a - m ... jam',
    ],
  ],
}
const PLAN: Record<string, [string, string]> = {
  'blending-cv': ['blending-cv-level-1', 'Word Song Blending CV Level 1'],
  'sounding-out': ['sounding-out-level-1', 'Word Song Sounding Out Level 1'],
}
const RECAP: Record<string, string> = {
  'blending-cv': 'You worked on blending sounds today!',
  'sounding-out': 'You worked on sounding out today!',
}

/** § 11's bill per file: [new texts, characters] ("Listen." in stop 1;
 *  "What is it?", the recap and 15 lines of mat, bat and cap in stop 2). */
const NEW_TEXTS: Record<string, [number, number]> = {
  'blending-cv': [1, 7],
  'sounding-out': [17, 296],
}

const text = (doc: CanonDoc, id: string) =>
  doc.utterances.find((u) => u.id === id)?.text

describe('the steps', () => {
  it('blending sounds, then sounding out', () => {
    expect(REAL_BLENDING_STEPS).toEqual(['blending-cv', 'sounding-out'])
  })
})

describe.each(REAL_BLENDING_STEPS)('committed canon: %s (AC 8)', (step) => {
  const doc = committed(step)

  it('is exactly the splice output (re-running it changes nothing)', () => {
    expect(JSON.stringify(spliceRealBlendingStep(step))).toBe(
      JSON.stringify(doc),
    )
  })

  it('equals § 6: its plan id and label, 8 problems of 6 slots, every reprompt "Hmm... try again?"', () => {
    expect([doc.plan.id, doc.plan.label]).toEqual(PLAN[step])
    expect(doc.plan.utterances).toEqual(
      doc.utterances.map(({ id, text }) => ({ id, text })),
    )
    TABLE[step]!.forEach(([read, correct, hint, giveAnswer, blend], i) => {
      const p = `word.p${i + 1}`
      expect(
        doc.utterances
          .filter((u) => u.id.startsWith(`${p}.`))
          .map((u) => [u.id, u.text]),
      ).toEqual([
        [`${p}.read`, read],
        [`${p}.correct`, correct],
        [`${p}.reprompt`, 'Hmm... try again?'],
        [`${p}.hint`, hint],
        [`${p}.giveAnswer`, giveAnswer],
        [`${p}.blend`, blend],
      ])
    })
    expect(doc.utterances.filter((u) => u.id.startsWith('word.'))).toHaveLength(
      48,
    )
  })

  it("carries the shipped session end, with the step's recap", () => {
    const shipped = committed('blending-cv').utterances.filter((u) =>
      u.id.startsWith('session.end.'),
    )
    const own = doc.utterances.filter((u) => u.id.startsWith('session.end.'))
    expect(own.map((u) => u.id)).toEqual(shipped.map((u) => u.id))
    for (const u of own)
      if (u.id !== 'session.end.recap.focus')
        expect(u, u.id).toEqual(shipped.find((s) => s.id === u.id))
    expect(text(doc, 'session.end.recap.focus')).toBe(RECAP[step])
  })

  it('passes the splice lints', () => {
    expect(realBlendingViolations(step, doc)).toEqual([])
  })

  it("leaves exactly § 11's new texts for the Lily render, none after it", () => {
    const waiting = awaitingRender(doc)
    if (waiting.length === 0) return // rendered
    expect([waiting.length, waiting.reduce((n, t) => n + t.length, 0)]).toEqual(
      NEW_TEXTS[step],
    )
  })
})

describe('the bytes (§ 6 "Audio", AC 8)', () => {
  const cvc = committed('cvc-words')
  const cvcBytes = new Map(cvc.utterances.map((u) => [u.text, u.audio.base64]))

  it("stop 1's 8 blends carry exactly cvc-words.json's bytes", () => {
    const blends = committed('blending-cv').utterances.filter((u) =>
      u.id.endsWith('.blend'),
    )
    expect(blends).toHaveLength(8)
    for (const u of blends) {
      expect(u.audio.base64, u.id).not.toBe('')
      expect(u.audio.base64, u.id).toBe(cvcBytes.get(u.text))
    }
  })

  it('every text another Word Song file carries keeps those bytes, and only new texts are empty', () => {
    const others = new Map<string, string>()
    for (const stem of ['cvc-words', 'sight-words', 'duck-words'])
      for (const u of committed(stem).utterances)
        if (u.audio.base64 !== '' && !others.has(u.text))
          others.set(u.text, u.audio.base64)
    for (const step of REAL_BLENDING_STEPS)
      for (const u of committed(step).utterances) {
        const shared = others.get(u.text)
        if (shared !== undefined) expect(u.audio.base64, u.id).toBe(shared)
      }
  })

  it("can's, dad's and jam's lines move into sounding out with their bytes (they were only in the old blending-cv.json)", () => {
    const so = committed('sounding-out')
    for (const t of [
      "Yes! That's a can.",
      'Yes! Dad!',
      'Yes! Jam!',
      "Let's look. Can.",
      "Let's look. Dad.",
      "Let's look. Jam.",
      'This one is can.',
      'This one is dad.',
      'This one is jam.',
    ]) {
      const u = so.utterances.find((v) => v.text === t)
      expect(u?.audio.base64, t).not.toBe('')
    }
  })

  it('stop 1 keeps no "Tap the <word>." line', () => {
    expect(
      committed('blending-cv').utterances.filter((u) =>
        u.text.startsWith('Tap the '),
      ),
    ).toEqual([])
  })
})

describe('the bake lists (AC 8, K2)', () => {
  it('both steps are pending and active; a --force bake skips both', () => {
    for (const step of REAL_BLENDING_STEPS) {
      expect(PENDING_CANON_NODES.has(step), step).toBe(true)
      const combos = activeCombos().filter(
        (c) => c.track === 'word-song' && c.focusNode === step,
      )
      expect(combos, step).toHaveLength(1)
      expect(
        combosToBakeFor(
          combos,
          { force: true, includePending: false },
          () => true,
        ),
      ).toEqual([])
    }
  })

  it('both are on the voice-QA page (CANON_FILES)', () => {
    const html = readFileSync(
      resolve(process.cwd(), 'public/voice-qa.html'),
      'utf8',
    )
    const block = html.slice(
      html.indexOf('const CANON_FILES'),
      html.indexOf('const GREET_FILES'),
    )
    for (const step of REAL_BLENDING_STEPS)
      expect(block).toContain(`['word-song', '${step}']`)
  })
})

// ── AC 9: the requests ─────────────────────────────────────────────────

describe('the ElevenLabs requests (§ 11, AC 9)', () => {
  it('"Listen." goes to Lily as "Listen," (the one-word rule), through a one-entry map', () => {
    expect(CANON_TEXT_INPUTS).toEqual({ 'Listen.': 'Listen,' })
    expect(renderElevenLabsText('Listen.')).toBe('Listen,')
    expect(renderElevenLabsText('Listen.', 'blending-cv')).toBe('Listen,')
  })

  it('every request of the canon committed on main is unchanged', () => {
    const before = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          'scripts/__fixtures__/canonRequests.before.json',
        ),
        'utf8',
      ),
    ) as [string | null, string, string | null][]
    expect(before.length).toBeGreaterThan(1000)
    expect(before.some(([, t]) => t in CANON_TEXT_INPUTS)).toBe(false)
    const changed = before.filter(
      ([tier, t, req]) =>
        renderElevenLabsText(t, tier ?? undefined) !== (req ?? t),
    )
    expect(changed).toEqual([])
  })

  it.each([
    ['m - a - t ... mat', '/mː/ - /æ/ - /t/ ... mat'],
    ['b - a - t ... bat', '/b/ - /æ/ - /t/ ... bat'],
    ['c - a - n ... can', '/k/ - /æ/ - /n/ ... can'],
    ['c - a - p ... cap', '/k/ - /æ/ - /p/ ... cap'],
    ['d - a - d ... dad', '/d/ - /æ/ - /d/ ... dad'],
    ['j - a - m ... jam', '/dʒ/ - /æ/ - /mː/ ... jam'],
  ])("the new blend %s renders to § 11's IPA", (blend, ipa) => {
    expect(renderElevenLabsText(blend, 'sounding-out')).toBe(ipa)
  })
})
