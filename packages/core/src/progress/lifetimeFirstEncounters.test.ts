/**
 * Unit tests for the lifetime-first-encounter gate (ticket 86c9q9ben).
 *
 * AC9d: migration test pinned — round-trip an existing 2026-05-09-shape
 * Progress payload and assert lifetimeFirstEncounters is populated
 * correctly.
 *
 * AC9h: Vitest unit coverage for the predicate function (pure-function,
 * easy).
 */

import { describe, expect, it } from 'vitest'

import { defaultProgress } from './defaults'
import {
  inferLifetimeFirstEncountersFromProgress,
  isFirstEncounter,
  markFirstEncounterSeen,
} from './lifetimeFirstEncounters'
import type { Progress, SkillLevels } from './types'

/**
 * Build a Progress whose skillLevels matches the diagnostic baseline
 * but lets the test override individual levels for the inference rule.
 */
function buildProgressWithLevels(overrides: Partial<SkillLevels>): Progress {
  const base = defaultProgress()
  return {
    ...base,
    skillLevels: { ...base.skillLevels, ...overrides },
  }
}

describe('isFirstEncounter — predicate (AC9h)', () => {
  it('returns true when progress is null (greenfield posture, no profile yet)', () => {
    expect(isFirstEncounter(null, 'cvc-words-short-u')).toBe(true)
  })

  it('returns true when lifetimeFirstEncounters is undefined (defensive — pre-86c9q9ben blob)', () => {
    const progress = defaultProgress()
    // Strip the field that defaultProgress() seeds.
    const stripped: Progress = { ...progress }
    delete stripped.lifetimeFirstEncounters
    expect(isFirstEncounter(stripped, 'cvc-words-short-u')).toBe(true)
  })

  it('returns true when lifetimeFirstEncounters is empty (greenfield Marian)', () => {
    const progress: Progress = {
      ...defaultProgress(),
      lifetimeFirstEncounters: [],
    }
    expect(isFirstEncounter(progress, 'cvc-words-short-u')).toBe(true)
  })

  it('returns true when the queried node is NOT in lifetimeFirstEncounters', () => {
    const progress: Progress = {
      ...defaultProgress(),
      lifetimeFirstEncounters: ['cvc-words', 'cvc-words-short-o'],
    }
    expect(isFirstEncounter(progress, 'cvc-words-short-u')).toBe(true)
  })

  it('returns false when the queried node IS in lifetimeFirstEncounters', () => {
    const progress: Progress = {
      ...defaultProgress(),
      lifetimeFirstEncounters: ['cvc-words', 'cvc-words-short-u'],
    }
    expect(isFirstEncounter(progress, 'cvc-words-short-u')).toBe(false)
  })

  it('keys on the exact node string — sibling tiers are independent', () => {
    const progress: Progress = {
      ...defaultProgress(),
      lifetimeFirstEncounters: ['cvc-words-short-o'],
    }
    expect(isFirstEncounter(progress, 'cvc-words-short-o')).toBe(false)
    // short-u is independent — short-o presence doesn't gate it.
    expect(isFirstEncounter(progress, 'cvc-words-short-u')).toBe(true)
  })
})

describe('markFirstEncounterSeen — append-once', () => {
  it('appends the node to a populated list', () => {
    const progress: Progress = {
      ...defaultProgress(),
      lifetimeFirstEncounters: ['cvc-words'],
    }
    const next = markFirstEncounterSeen(progress, 'cvc-words-short-u')
    expect(next.lifetimeFirstEncounters).toEqual([
      'cvc-words',
      'cvc-words-short-u',
    ])
  })

  it('appends the node to an empty list (greenfield)', () => {
    const progress: Progress = {
      ...defaultProgress(),
      lifetimeFirstEncounters: [],
    }
    const next = markFirstEncounterSeen(progress, 'cvc-words-short-u')
    expect(next.lifetimeFirstEncounters).toEqual(['cvc-words-short-u'])
  })

  it('returns the input unchanged (same reference) when the node is already present', () => {
    const progress: Progress = {
      ...defaultProgress(),
      lifetimeFirstEncounters: ['cvc-words', 'cvc-words-short-u'],
    }
    const next = markFirstEncounterSeen(progress, 'cvc-words-short-u')
    expect(next).toBe(progress)
  })

  it('seeds an empty list when lifetimeFirstEncounters is undefined and the node is being added (defensive)', () => {
    const progress: Progress = { ...defaultProgress() }
    delete progress.lifetimeFirstEncounters
    const next = markFirstEncounterSeen(progress, 'cvc-words-short-u')
    expect(next.lifetimeFirstEncounters).toEqual(['cvc-words-short-u'])
  })

  it('returns a fresh object — does not mutate input', () => {
    const progress: Progress = {
      ...defaultProgress(),
      lifetimeFirstEncounters: ['cvc-words'],
    }
    const before = [...(progress.lifetimeFirstEncounters ?? [])]
    markFirstEncounterSeen(progress, 'cvc-words-short-u')
    expect(progress.lifetimeFirstEncounters).toEqual(before)
  })
})

describe('inferLifetimeFirstEncountersFromProgress — migration helper (AC9d)', () => {
  it('returns empty for a true greenfield blob (every word-song node locked)', () => {
    const progress = buildProgressWithLevels({
      'letter-names': 'locked',
      'letter-sounds': 'locked',
      'blending-cv': 'locked',
      'cvc-words': 'locked',
      'cvc-words-short-o': 'locked',
      'cvc-words-short-u': 'locked',
      'cvc-words-short-i': 'locked',
      'cvc-words-short-e': 'locked',
      // Digraphs split into 3 sequential sibling nodes per PR #211.
      'digraphs-sh': 'locked',
      'digraphs-ch': 'locked',
      'digraphs-th-voiceless': 'locked',
      'sight-words': 'locked',
      'simple-sentences': 'locked',
    })
    expect(inferLifetimeFirstEncountersFromProgress(progress)).toEqual([])
  })

  it("preserves Marian's pre-86c9q9ben diagnostic baseline — practicing/intro/mastered nodes are already-encountered", () => {
    // The April 2026 diagnostic seed: letter-names mastered,
    // letter-sounds + blending-cv practicing, cvc-words intro,
    // sight-words intro. Those 5 should land in
    // lifetimeFirstEncounters — Marian has been on this app since
    // before the field existed; she's seen those tiers.
    const progress = defaultProgress()
    expect(inferLifetimeFirstEncountersFromProgress(progress)).toEqual([
      'letter-names',
      'letter-sounds',
      'blending-cv',
      'cvc-words',
      'sight-words',
    ])
  })

  it('Pre-86c9q9ben blob with cvc-words-short-o practicing → already encountered (does NOT replay box/fox scaffolding)', () => {
    // The shape of a Marian who graduated past short-a and is mid-
    // short-o when this code ships. The migration must NOT re-fire
    // the box/fox scaffolding for her.
    const progress = buildProgressWithLevels({
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'cvc-words': 'mastered',
      'cvc-words-short-o': 'practicing',
      'cvc-words-short-u': 'locked',
    })
    const result = inferLifetimeFirstEncountersFromProgress(progress)
    expect(result).toContain('cvc-words-short-o')
    expect(result).not.toContain('cvc-words-short-u')
  })

  it('Pre-86c9q9ben blob with cvc-words-short-u practicing (debug-seeded) → already encountered (does NOT replay contrast line)', () => {
    // Conservative posture per the type doc-comment: a pre-feature
    // Marian who somehow ended up mid-short-u (e.g. via the debug
    // seed on iPad) is treated as already-encountered. Better to
    // miss the scaffolding once than to replay it on someone who
    // already had her contrast-line moment.
    const progress = buildProgressWithLevels({
      'letter-names': 'mastered',
      'letter-sounds': 'mastered',
      'blending-cv': 'mastered',
      'cvc-words': 'mastered',
      'cvc-words-short-o': 'mastered',
      'cvc-words-short-u': 'practicing',
    })
    expect(inferLifetimeFirstEncountersFromProgress(progress)).toContain(
      'cvc-words-short-u',
    )
  })

  it("Greenfield-with-diagnostic — Marian's actual real-world shape (AC9d migration test)", () => {
    // Round-trip a 2026-05-09-shape Progress payload (the diagnostic
    // baseline as `defaultProgress()` returns it) and assert the
    // inferred list matches: letter-names, letter-sounds, blending-cv,
    // cvc-words, sight-words. The other tiers stay out — short-o
    // greenfield gets the box/fox line on its first session,
    // short-u greenfield gets the contrast line on its first
    // session.
    const realShape = defaultProgress() // 2026-05-09 baseline
    const inferred = inferLifetimeFirstEncountersFromProgress(realShape)
    // She HAS seen these tiers (or had them as her entry point —
    // close enough for a one-time migration).
    expect(inferred).toContain('cvc-words')
    expect(inferred).toContain('blending-cv')
    expect(inferred).toContain('letter-sounds')
    // She has NOT seen these — short-o + short-u stay greenfield
    // for the gate.
    expect(inferred).not.toContain('cvc-words-short-o')
    expect(inferred).not.toContain('cvc-words-short-u')
  })

  it('order is stable (mirrors WORD_SONG_NODES_IN_ORDER)', () => {
    // Pin the order so a downstream consumer that depends on
    // declaration order doesn't see drift between runs.
    const progress = buildProgressWithLevels({
      'letter-names': 'mastered',
      'letter-sounds': 'practicing',
      'blending-cv': 'mastered',
      'cvc-words': 'practicing',
      'cvc-words-short-o': 'mastered',
      'cvc-words-short-u': 'practicing',
      // Digraphs split into 3 sequential sibling nodes per PR #211.
      'digraphs-sh': 'locked',
      'digraphs-ch': 'locked',
      'digraphs-th-voiceless': 'locked',
      'sight-words': 'intro',
      'simple-sentences': 'locked',
    })
    expect(inferLifetimeFirstEncountersFromProgress(progress)).toEqual([
      'letter-names',
      'letter-sounds',
      'blending-cv',
      'cvc-words',
      'cvc-words-short-o',
      'cvc-words-short-u',
      'sight-words',
    ])
  })
})

describe('migration round-trip via storage adapter (AC9d)', () => {
  it('loadProgress → write → loadProgress preserves lifetimeFirstEncounters across one cycle', async () => {
    // Mock localStorage. Simulates a pre-86c9q9ben blob (no
    // lifetimeFirstEncounters field) by writing the JSON manually,
    // then loading via the canonical adapter and asserting the
    // defaulter inferred the field correctly.
    const { loadProgress, saveProgress, STORAGE_KEY } =
      await import('./storage')
    const fakeStorage: Record<string, string> = {}
    const originalLocalStorage = globalThis.localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => fakeStorage[k] ?? null,
        setItem: (k: string, v: string) => {
          fakeStorage[k] = v
        },
        removeItem: (k: string) => {
          delete fakeStorage[k]
        },
        clear: () => {
          for (const k of Object.keys(fakeStorage)) delete fakeStorage[k]
        },
        get length() {
          return Object.keys(fakeStorage).length
        },
        key: (i: number) => Object.keys(fakeStorage)[i] ?? null,
      },
    })

    try {
      // Hand-rolled pre-86c9q9ben blob — no lifetimeFirstEncounters.
      // Marian is mid-short-a per the diagnostic baseline.
      const preFeatureBlob = {
        schemaVersion: 1,
        profile: {
          childName: 'Marian',
          character: 'melody',
          lastPlayedISO: '2026-05-08T10:00:00.000Z',
        },
        skillLevels: {
          'number-recog': 'mastered',
          'add-to-10': 'practicing',
          'add-to-20': 'locked',
          'sub-to-10': 'mastered',
          'sub-to-20': 'intro',
          'two-digit-addsub': 'locked',
          'skip-counting': 'locked',
          'mult-2-5-10': 'intro',
          'mult-3-4': 'locked',
          'mult-6-9': 'locked',
          'letter-names': 'mastered',
          'letter-sounds': 'practicing',
          'blending-cv': 'practicing',
          'cvc-words': 'intro',
          'cvc-words-short-o': 'locked',
          'cvc-words-short-u': 'locked',
          digraphs: 'locked',
          'sight-words': 'intro',
          'simple-sentences': 'locked',
        },
        mathFactsLeitner: { items: [] },
        history: [],
      }
      fakeStorage[STORAGE_KEY] = JSON.stringify(preFeatureBlob)

      // Load via the canonical adapter — defaulter should fill in
      // lifetimeFirstEncounters from the existing skillLevels.
      const loaded = loadProgress()
      expect(loaded).not.toBeNull()
      expect(loaded!.lifetimeFirstEncounters).toEqual([
        'letter-names',
        'letter-sounds',
        'blending-cv',
        'cvc-words',
        'sight-words',
      ])
      // She has NOT encountered short-o or short-u — gate must fire
      // on those tiers.
      expect(loaded!.lifetimeFirstEncounters).not.toContain('cvc-words-short-o')
      expect(loaded!.lifetimeFirstEncounters).not.toContain('cvc-words-short-u')

      // Save round-trip — the just-loaded blob is now persistable.
      saveProgress(loaded!)
      const reloaded = loadProgress()
      expect(reloaded).not.toBeNull()
      expect(reloaded!.lifetimeFirstEncounters).toEqual(
        loaded!.lifetimeFirstEncounters,
      )
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      })
    }
  })
})
