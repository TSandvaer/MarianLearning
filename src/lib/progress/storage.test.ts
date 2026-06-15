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
      // Wave 5 sibling-tier split — fixture mirrors the post-split
      // schema-floor shape; legacy `two-digit-addsub` key would be
      // accepted via the read-path remap in storage.ts but every NEW
      // fixture should go straight to the split literals.
      'two-digit-addsub-no-regroup': 'locked',
      'two-digit-addsub-with-regroup': 'locked',
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
    // Digraphs split into 3 sequential sibling nodes per PR #211.
    expect(loaded?.skillLevels['digraphs-sh']).toBe('locked')
    expect(loaded?.skillLevels['digraphs-ch']).toBe('locked')
    expect(loaded?.skillLevels['digraphs-th-voiceless']).toBe('locked')
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

describe('loadProgress — dead-letter remap: digraphs → digraphs-sh (PR #211)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('remaps a legacy `digraphs: <level>` key to `digraphs-sh: <level>` on load', () => {
    // Hand-edited QA case from the proposal §2.6 — a blob with
    // `digraphs: 'practicing'` that predates the SkillNode split. The
    // strict guard would otherwise reject the post-split blob because
    // `digraphs-sh` is missing from the skillLevels map. The read-path
    // remap moves the value to its new home; the schema-floor defaulter
    // then fills `digraphs-ch` and `digraphs-th-voiceless` with
    // 'locked'. Net: progress is preserved and the blob validates.
    const seed = defaultProgress('Marian')
    const skillLevelsWithLegacy: Record<string, string> = {
      ...seed.skillLevels,
    }
    // Strip the new keys to simulate a pre-PR-#211 blob.
    delete skillLevelsWithLegacy['digraphs-sh']
    delete skillLevelsWithLegacy['digraphs-ch']
    delete skillLevelsWithLegacy['digraphs-th-voiceless']
    // Add the legacy key with a non-default value (hand-edited case).
    skillLevelsWithLegacy['digraphs'] = 'practicing'

    const blob = { ...seed, skillLevels: skillLevelsWithLegacy }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    // Legacy value lands on the leading digraph sibling.
    expect(loaded?.skillLevels['digraphs-sh']).toBe('practicing')
    // Downstream digraph siblings stay at the schema floor.
    expect(loaded?.skillLevels['digraphs-ch']).toBe('locked')
    expect(loaded?.skillLevels['digraphs-th-voiceless']).toBe('locked')
    // The legacy `digraphs` key is stripped from the validated shape
    // (the guard rejects unrecognised keys; the remap moves the value
    // BEFORE the guard runs).
    expect('digraphs' in (loaded?.skillLevels ?? {})).toBe(false)
    // Round-trip validates.
    expect(isProgressV1(loaded)).toBe(true)
  })

  it('treats the new `digraphs-sh` key as canonical when both legacy and new keys are present', () => {
    // Edge case: a blob carries BOTH `digraphs: 'mastered'` (legacy)
    // AND `digraphs-sh: 'practicing'` (post-split). The new key wins
    // — the legacy key is stripped and the new key's value is
    // preserved. This is the "we trust the explicit new-shape value
    // over the implicit legacy carry-over" posture.
    const seed = defaultProgress('Marian')
    const skillLevelsWithBoth: Record<string, string> = {
      ...seed.skillLevels,
      'digraphs-sh': 'practicing',
    }
    skillLevelsWithBoth['digraphs'] = 'mastered'

    const blob = { ...seed, skillLevels: skillLevelsWithBoth }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(loaded?.skillLevels['digraphs-sh']).toBe('practicing')
    expect('digraphs' in (loaded?.skillLevels ?? {})).toBe(false)
    expect(isProgressV1(loaded)).toBe(true)
  })

  it('leaves a blob untouched when only the new `digraphs-sh` key is present (post-PR-#211 happy path)', () => {
    // A fresh-storage Marian saved on post-PR-#211 code: no legacy
    // `digraphs` key, only the three new sibling nodes. Load must
    // round-trip cleanly with no remap firing.
    const seed = defaultProgress('Marian')
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))

    const loaded = loadProgress()
    expect(loaded).toEqual(seed)
    expect(loaded?.skillLevels['digraphs-sh']).toBe('locked')
    expect(loaded?.skillLevels['digraphs-ch']).toBe('locked')
    expect(loaded?.skillLevels['digraphs-th-voiceless']).toBe('locked')
  })
})

describe('loadProgress — dead-letter remap: two-digit-addsub → two-digit-addsub-no-regroup (Wave 5 — ticket 86c9y0bvc)', () => {
  // Mirror of the digraphs remap test block above. Wave 5 split the
  // single `'two-digit-addsub'` SkillNode into adjacent no-regroup +
  // with-regroup sibling tiers. The remap moves any legacy
  // `'two-digit-addsub'` key on a persisted blob to
  // `'two-digit-addsub-no-regroup'` (the rename preserves current
  // behaviour); the schema-floor defaulter then fills
  // `'two-digit-addsub-with-regroup'` with `'locked'`. Net: progress
  // is preserved and the blob validates — no schemaVersion bump.
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('remaps a legacy `two-digit-addsub: <level>` key to `two-digit-addsub-no-regroup: <level>` on load', () => {
    // Marian's defaultProgress had `'two-digit-addsub': 'locked'` so
    // production users hit the no-op branch of this remap. The test
    // uses a non-default value to prove the remap preserves the level
    // verbatim — the QA hand-edit case (someone setting the legacy
    // literal to 'practicing' via DevTools during a previous build).
    const seed = defaultProgress('Marian')
    const skillLevelsWithLegacy: Record<string, string> = {
      ...seed.skillLevels,
    }
    // Strip the new keys to simulate a pre-Wave-5 blob.
    delete skillLevelsWithLegacy['two-digit-addsub-no-regroup']
    delete skillLevelsWithLegacy['two-digit-addsub-with-regroup']
    // Add the legacy key with a non-default value (hand-edited case).
    skillLevelsWithLegacy['two-digit-addsub'] = 'practicing'

    const blob = { ...seed, skillLevels: skillLevelsWithLegacy }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    // Legacy value lands on the no-regroup sibling (the band that
    // preserves the pre-split behaviour).
    expect(loaded?.skillLevels['two-digit-addsub-no-regroup']).toBe(
      'practicing',
    )
    // The new with-regroup tier defaults to the schema floor.
    expect(loaded?.skillLevels['two-digit-addsub-with-regroup']).toBe('locked')
    // The legacy `two-digit-addsub` key is stripped from the validated
    // shape (the guard rejects unrecognised keys; the remap moves the
    // value BEFORE the guard runs).
    expect('two-digit-addsub' in (loaded?.skillLevels ?? {})).toBe(false)
    // Round-trip validates.
    expect(isProgressV1(loaded)).toBe(true)
  })

  it('treats the new `two-digit-addsub-no-regroup` key as canonical when both legacy and new keys are present', () => {
    // Edge case: a blob carries BOTH `two-digit-addsub: 'mastered'`
    // (legacy) AND `two-digit-addsub-no-regroup: 'practicing'`
    // (post-split). The new key wins — same "trust the explicit
    // new-shape value over the implicit legacy carry-over" posture
    // as the digraphs remap.
    const seed = defaultProgress('Marian')
    const skillLevelsWithBoth: Record<string, string> = {
      ...seed.skillLevels,
      'two-digit-addsub-no-regroup': 'practicing',
    }
    skillLevelsWithBoth['two-digit-addsub'] = 'mastered'

    const blob = { ...seed, skillLevels: skillLevelsWithBoth }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(loaded?.skillLevels['two-digit-addsub-no-regroup']).toBe(
      'practicing',
    )
    expect('two-digit-addsub' in (loaded?.skillLevels ?? {})).toBe(false)
    expect(isProgressV1(loaded)).toBe(true)
  })

  it('leaves a blob untouched when only the new `two-digit-addsub-no-regroup` key is present (post-Wave-5 happy path)', () => {
    // A fresh-storage Marian saved on post-Wave-5 code: no legacy
    // `two-digit-addsub` key, only the two new sibling nodes. Load
    // must round-trip cleanly with no remap firing.
    const seed = defaultProgress('Marian')
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))

    const loaded = loadProgress()
    expect(loaded).toEqual(seed)
    expect(loaded?.skillLevels['two-digit-addsub-no-regroup']).toBe('locked')
    expect(loaded?.skillLevels['two-digit-addsub-with-regroup']).toBe('locked')
  })
})

describe('loadProgress — letterSoundsVowelStates defaulter (Wave 9 W9.2 — ticket 86c9ya3gd)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('fills all four vowels with "intro" when the literacy field is entirely absent (pre-W9.2 blob)', () => {
    // A blob written before W9.2 shipped carries no `literacy` namespace
    // at all. The defaulter must add it with every trackable vowel at
    // 'intro' so downstream consumers (W9.3 / W9.4) see a populated map.
    const seed = defaultProgress('Marian')
    const blob: Record<string, unknown> = { ...seed }
    delete blob.literacy
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(loaded?.literacy?.letterSoundsVowelStates).toEqual({
      '/o/': 'intro',
      '/u/': 'intro',
      '/i/': 'intro',
      '/e/': 'intro',
    })
    expect(isProgressV1(loaded)).toBe(true)
  })

  it('fills missing vowels with "intro" while preserving present per-vowel values (partial map)', () => {
    // A blob carrying a PARTIAL map — e.g. only /o/ and /u/ set — must
    // get the missing /i/ and /e/ filled to 'intro', and the present
    // values must round-trip verbatim (no clobbering of earned state).
    const seed = defaultProgress('Marian')
    const blob = {
      ...seed,
      literacy: {
        letterSoundsVowelStates: { '/o/': 'mastered', '/u/': 'practicing' },
      },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(loaded?.literacy?.letterSoundsVowelStates).toEqual({
      '/o/': 'mastered',
      '/u/': 'practicing',
      '/i/': 'intro',
      '/e/': 'intro',
    })
    expect(isProgressV1(loaded)).toBe(true)
  })

  it('fills all four vowels when literacy exists but letterSoundsVowelStates is absent', () => {
    // `literacy: {}` (the namespace present but empty) → fill the full
    // default map.
    const seed = defaultProgress('Marian')
    const blob = { ...seed, literacy: {} }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(loaded?.literacy?.letterSoundsVowelStates).toEqual({
      '/o/': 'intro',
      '/u/': 'intro',
      '/i/': 'intro',
      '/e/': 'intro',
    })
  })

  it('round-trips a fully-populated map unchanged (defaulter is a no-op)', () => {
    // When every vowel is already present, the defaulter must NOT mutate
    // the blob — a fresh-storage Marian saved on post-W9.2 code round-
    // trips deep-equal.
    const seed = defaultProgress('Marian')
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))

    const loaded = loadProgress()
    expect(loaded).toEqual(seed)
    expect(loaded?.literacy?.letterSoundsVowelStates).toEqual({
      '/o/': 'intro',
      '/u/': 'intro',
      '/i/': 'intro',
      '/e/': 'intro',
    })
  })

  it('preserves an earned per-vowel value verbatim — defaulter never downgrades a present vowel', () => {
    // The defaulter is a fill, not a reset. A vowel Marian has at
    // 'mastered' must NOT be downgraded to the 'intro' floor.
    const seed = defaultProgress('Marian')
    const blob = {
      ...seed,
      literacy: {
        letterSoundsVowelStates: {
          '/o/': 'mastered',
          '/u/': 'mastered',
          '/i/': 'practicing',
          '/e/': 'intro',
        },
      },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded?.literacy?.letterSoundsVowelStates?.['/o/']).toBe('mastered')
    expect(loaded?.literacy?.letterSoundsVowelStates?.['/i/']).toBe(
      'practicing',
    )
  })

  it('rejects a blob where a present vowel carries an invalid state (defaulter does not coerce bad values)', () => {
    // The defaulter only fills MISSING vowels. A present vowel with an
    // invalid value ('locked' is not a VowelSubMasteryState) is a real
    // corruption signal — the strict guard rejects the blob.
    const seed = defaultProgress('Marian')
    const blob = {
      ...seed,
      literacy: {
        letterSoundsVowelStates: { '/o/': 'locked' },
      },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    expect(loadProgress()).toBeNull()
  })

  it('rejects a blob where literacy is a non-object (defaulter does not paper over corruption)', () => {
    const seed = defaultProgress('Marian')
    const blob = { ...seed, literacy: 'nope' }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    expect(loadProgress()).toBeNull()
  })
})

describe('loadProgress — cvcGraduationSessionFired defaulter (ticket 86c9qa6n3)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('defaults a missing cvcGraduationSessionFired to false (pre-86c9qa6n3 blob)', () => {
    // A blob written before CVC review mode shipped carries no
    // `cvcGraduationSessionFired`. The defaulter must add it as `false`
    // so a Marian who already mastered all three CVC tiers still gets her
    // one-shot graduation review on the next eligible session.
    const seed = defaultProgress('Marian')
    const blob: Record<string, unknown> = { ...seed }
    delete blob.cvcGraduationSessionFired
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(loaded?.cvcGraduationSessionFired).toBe(false)
    expect(isProgressV1(loaded)).toBe(true)
  })

  it('preserves cvcGraduationSessionFired: true verbatim (defaulter never resets a fired latch)', () => {
    // The defaulter is a fill, not a reset. A latch already at `true`
    // must round-trip — resetting it to false would re-fire the one-shot
    // graduation review.
    const seed = defaultProgress('Marian')
    const blob = { ...seed, cvcGraduationSessionFired: true }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded?.cvcGraduationSessionFired).toBe(true)
  })

  it('rejects a blob where cvcGraduationSessionFired is a non-boolean (defaulter does not coerce bad values)', () => {
    // A present-but-invalid value is a corruption signal — the strict
    // guard rejects the whole blob rather than carrying a bad latch.
    const seed = defaultProgress('Marian')
    const blob = { ...seed, cvcGraduationSessionFired: 'yes' }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    expect(loadProgress()).toBeNull()
  })
})
