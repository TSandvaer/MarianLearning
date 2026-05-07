/**
 * Regression coverage for the storage read-path defaulter (ticket
 * 86c9pkfth — harden progress localStorage).
 *
 * The trip-wire: `isSkillLevels` (in `guards.ts`) requires every node in
 * the current `SKILL_NODES` set to exist as a key in the saved blob.
 * Adding a new skill node to the union (next short vowel, future
 * digraphs tier, etc.) would otherwise reject every existing blob and
 * `loadProgress()` would return null → defaults clobber Marian's
 * progress.
 *
 * The fix: `withDefaultedSkillLevels` runs BEFORE `isProgressV1` and
 * fills every missing skill-level key with `'locked'` from a
 * canonical schema-floor source. A blob that was valid yesterday
 * stays valid today after a node addition; the new node defaults
 * to 'locked' (the safe schema floor — never grants Marian access
 * she didn't have).
 *
 * This file deliberately constructs a "blob with one node missing"
 * fixture and asserts the round-trip survives the load. On main HEAD
 * before the fix lands, the assertion fails (loadProgress() returns
 * null and the app would silently revert to defaults).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultProgress } from './defaults'
import { isProgressV1 } from './guards'
import { STORAGE_KEY, loadProgress } from './storage'
import type { Progress, SkillLevels, SkillNode } from './types'

describe('loadProgress — skill-level defaulter (ticket 86c9pkfth)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('parses a blob missing one skill-level key and defaults that key to "locked"', () => {
    // Simulate a future-state where SKILL_NODES has widened: write a
    // blob that's MISSING `cvc-words-short-o` (mirrors the real PR #151
    // hazard before the sibling-node ship). The strict guard rejects
    // this on main HEAD; the defaulter must fill the missing key and
    // let the load succeed.
    const seed = defaultProgress('Marian')
    const skillLevelsMissingShortO: Partial<SkillLevels> = {
      ...seed.skillLevels,
    }
    delete (skillLevelsMissingShortO as Record<string, unknown>)[
      'cvc-words-short-o'
    ]

    const blob = {
      ...seed,
      skillLevels: skillLevelsMissingShortO,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(loaded?.skillLevels['cvc-words-short-o']).toBe('locked')
    // Existing keys are preserved verbatim — no clobbering of Marian's
    // April diagnostic baseline.
    expect(loaded?.skillLevels['add-to-10']).toBe(seed.skillLevels['add-to-10'])
    expect(loaded?.skillLevels['cvc-words']).toBe(seed.skillLevels['cvc-words'])
    // Round-trip is now isProgressV1-valid.
    expect(isProgressV1(loaded)).toBe(true)
  })

  it('parses a blob missing several skill-level keys and defaults all of them to "locked"', () => {
    // Defense-in-depth: a future migration scenario where MULTIPLE
    // nodes get added simultaneously. Each missing key should land on
    // 'locked'. Only the keys the user previously had data for must
    // round-trip unchanged.
    const seed = defaultProgress('Marian')
    const partialSkillLevels: Record<string, string> = {
      // Only carry the math nodes Marian has data on. All literacy
      // nodes are "missing" — should default to 'locked'.
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
    }
    const blob = {
      ...seed,
      skillLevels: partialSkillLevels,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    // Every literacy node defaults to 'locked' — schema-floor.
    expect(loaded?.skillLevels['letter-names']).toBe('locked')
    expect(loaded?.skillLevels['letter-sounds']).toBe('locked')
    expect(loaded?.skillLevels['blending-cv']).toBe('locked')
    expect(loaded?.skillLevels['cvc-words']).toBe('locked')
    expect(loaded?.skillLevels['cvc-words-short-o']).toBe('locked')
    expect(loaded?.skillLevels['digraphs']).toBe('locked')
    expect(loaded?.skillLevels['sight-words']).toBe('locked')
    expect(loaded?.skillLevels['simple-sentences']).toBe('locked')
    // Math nodes are preserved.
    expect(loaded?.skillLevels['add-to-10']).toBe('practicing')
    expect(loaded?.skillLevels['number-recog']).toBe('mastered')
    expect(isProgressV1(loaded)).toBe(true)
  })

  it('preserves existing skill-level values verbatim — defaulter NEVER clobbers a present key', () => {
    // The defaulter is a fill, not a reset. If Marian has a node at
    // 'mastered', the load path must NOT downgrade her to the
    // schema-floor 'locked'. This is the load-bearing reason we use
    // a separate `defaultLockedSkillLevels()` (everything 'locked')
    // rather than `defaultProgress()` (which carries Marian's April
    // diagnostic baseline) — the floor must be a true minimum, not a
    // baseline that could overwrite real user data.
    const seed = defaultProgress('Marian')
    const customSkillLevels: SkillLevels = {
      ...seed.skillLevels,
      'add-to-10': 'mastered',
      'cvc-words': 'practicing',
    }
    const blob: Progress = { ...seed, skillLevels: customSkillLevels }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded?.skillLevels['add-to-10']).toBe('mastered')
    expect(loaded?.skillLevels['cvc-words']).toBe('practicing')
  })

  it('rejects a blob where skillLevels is not an object (defaulter does not paper over real corruption)', () => {
    // Defense in depth: the defaulter only fills missing keys when
    // skillLevels is at least an object. A blob with `skillLevels:
    // null` (truly corrupt) still fails the guard and returns null —
    // we don't want to mask actual corruption with silent recovery.
    const seed = defaultProgress('Marian')
    const blob = { ...seed, skillLevels: null }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    expect(loadProgress()).toBeNull()
  })

  it('rejects a blob where a present skill-level value is invalid (defaulter does not coerce bad values)', () => {
    // The defaulter only fills MISSING keys. A key that's present with
    // an invalid value (`'super-mastered'` is not a SkillLevel) is a
    // real corruption signal — the guard correctly rejects it.
    const seed = defaultProgress('Marian')
    const blob = {
      ...seed,
      skillLevels: { ...seed.skillLevels, 'add-to-10': 'super-mastered' },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    expect(loadProgress()).toBeNull()
  })

  it('round-trips a fully-shaped Progress document unchanged (no spurious mutation)', () => {
    // The defaulter must be a no-op when every key is already present.
    // No clobbering of `parentSettings`, `pendingPromotion`, history,
    // leitner, profile.
    const seed = defaultProgress('Marian')
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))

    const loaded = loadProgress()
    expect(loaded).toEqual(seed)
  })

  it('schema-floor coverage — every node in the current SKILL_NODES set must default to "locked"', () => {
    // Whitebox check: install an empty `skillLevels: {}` and verify
    // EVERY node the runtime guard knows about defaults to 'locked'.
    // If a future PR adds a node to the union without updating the
    // defaulter's source, this test fails first. (This is the
    // mirror-update guard: SKILL_NODES additions MUST also extend
    // `defaultLockedSkillLevels()`.)
    const seed = defaultProgress('Marian')
    const blob = { ...seed, skillLevels: {} }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    // Enumerate every key the seed declares — they all must be
    // 'locked' on the schema-floor path.
    const expectedNodes = Object.keys(seed.skillLevels) as SkillNode[]
    for (const node of expectedNodes) {
      expect(loaded?.skillLevels[node]).toBe('locked')
    }
  })
})
