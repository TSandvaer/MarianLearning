/**
 * Regression coverage for additive-no-bump field migrations on the
 * Progress blob.
 *
 * Context (Jessica, 2026-05-09)
 * -----------------------------
 * The persistence surface has accumulated four additive-no-bump optional
 * fields under `schemaVersion: 1` over the last 30 days:
 *
 *   - `parentSettings` (M2.5, ticket 86c9kpjc7)
 *   - `pendingPromotion` (M3, ticket 86c9kmwd0)
 *   - `latencyMs[]` on `SessionHistoryEntry` (PR #164/#167, ticket
 *     86c9pwgc8 — M4 Leitner wiring)
 *   - `lifetimeFirstEncounters` (PR #174, ticket 86c9q9ben)
 *
 * Each individually has unit coverage. What's missing is the
 * cross-cutting "what happens when a blob from a pre-feature build round-
 * trips through `loadProgress` / `saveProgress`" shape — the inter-
 * feature contract that protects Marian's blob from silent clobbering
 * across deploys.
 *
 * Specifically: if ANY of these defaulters silently mutate fields they
 * shouldn't (populating `latencyMs` with bogus values, overwriting a
 * present `lifetimeFirstEncounters`, downgrading skillLevels), Marian's
 * accumulated state is at risk during the next deploy + reconcile cycle.
 *
 * Five gaps closed here, 8 tests total:
 *
 *   1. Pre-`latencyMs` payload (no field on history entries) round-trips
 *      cleanly — defaulter does NOT populate bogus `latencyMs` arrays
 *      (the field remains absent).
 *   2. Pre-`lifetimeFirstEncounters` payload gets the inference rule
 *      applied (mirror of `cloudSync`'s parity test, pinned at storage
 *      layer too).
 *   3. Future-version payload (`schemaVersion: 99`) is REFUSED — `migrate`
 *      returns null per the documented contract.
 *   4. Future-version-of-v1 payload with EXTRA unknown fields at the
 *      top-level survives the round-trip (forward-compat hygiene — when
 *      iPad upgrades to a new bundle that adds a field but laptop
 *      downgrades / saves first, the next upgrade-cycle save shouldn't
 *      drop the unknown field silently).
 *   5. Empty / null Progress payloads fail to load; the App's caller
 *      then falls back to `defaultProgress()`.
 *   6. A blob with `parentSettings: undefined` (the field present-but-
 *      explicitly-undefined edge) is treated identically to a blob
 *      where the field is absent.
 *   7. A blob carrying `lifetimeFirstEncounters: []` (greenfield from
 *      the post-PR-#174 first-launch path) round-trips verbatim —
 *      defaulter does NOT replace the empty array with the inferred
 *      rule.
 *   8. A blob with `pendingPromotion` set survives round-trip with the
 *      field intact (M3 contract).
 *
 * Why count-based assertions
 * --------------------------
 * Per `feedback_count_assertions_on_regression_tests.md`. We use
 * `.toEqual(...)` shape-exact assertions and `.toBeUndefined()` /
 * specific-value checks so a regression that adds a stray field or
 * silently fills one surfaces.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultProgress } from './defaults'
import { isProgressV1 } from './guards'
import { migrate } from './migrate'
import { STORAGE_KEY, loadProgress, saveProgress } from './storage'
import type { Progress, SessionHistoryEntry, SkillLevels } from './types'

describe('Progress — additive-no-bump field migrations', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  // -------------------------------------------------------------------------
  // 1. Pre-latencyMs history entries round-trip cleanly
  // -------------------------------------------------------------------------

  it('pre-latencyMs history entries round-trip without populating bogus values', () => {
    // Simulate a blob written by a build that predates PR #164/#167:
    // history entries carry dateISO + skillFocus + successRate but no
    // latencyMs field. The defaulter must NOT fabricate a latencyMs
    // array (Dave's research deliverable depends on real measured
    // values; bogus zeros would poison the diagnostic signal).
    const seed = defaultProgress('Marian')
    const preLatencyHistory: SessionHistoryEntry[] = [
      {
        dateISO: '2026-04-29T10:00:00.000Z',
        skillFocus: ['add-to-10'],
        successRate: 0.875,
      },
      {
        dateISO: '2026-04-30T10:00:00.000Z',
        skillFocus: ['add-to-10'],
        successRate: 1.0,
      },
    ]
    const blob: Progress = { ...seed, history: preLatencyHistory }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(loaded?.history).toHaveLength(2)
    // Field stays absent — no fabrication.
    expect(loaded?.history[0]?.latencyMs).toBeUndefined()
    expect(loaded?.history[1]?.latencyMs).toBeUndefined()
    // Other fields survive verbatim.
    expect(loaded?.history[0]?.successRate).toBe(0.875)
    expect(loaded?.history[1]?.successRate).toBe(1.0)
    expect(isProgressV1(loaded)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // 2. Pre-lifetimeFirstEncounters payload gets the inference rule
  // -------------------------------------------------------------------------

  it('pre-lifetimeFirstEncounters payload gets the inference rule applied at load time', () => {
    // Simulate a blob written by a build that predates PR #174: no
    // `lifetimeFirstEncounters` field. The defaulter
    // (`withDefaultedLifetimeFirstEncounters`) must walk skillLevels
    // and append every non-locked word-song node. Mirrors the
    // cloud-side parity test in `cloudSync.test.ts`.
    const seed = defaultProgress('Marian')
    const blob: Record<string, unknown> = { ...seed }
    delete blob.lifetimeFirstEncounters
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    // Marian's diagnostic baseline:
    //   letter-names: mastered      → encountered
    //   letter-sounds: practicing   → encountered
    //   blending-cv: practicing     → encountered
    //   cvc-words: intro            → encountered
    //   cvc-words-short-o: locked   → NOT encountered
    //   cvc-words-short-u: locked   → NOT encountered
    //   digraphs: locked            → NOT encountered
    //   sight-words: intro          → encountered
    //   simple-sentences: locked    → NOT encountered
    expect(loaded?.lifetimeFirstEncounters).toEqual([
      'letter-names',
      'letter-sounds',
      'blending-cv',
      'cvc-words',
      'sight-words',
    ])
    expect(isProgressV1(loaded)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // 3. Future-version payload — refused, never guessed
  // -------------------------------------------------------------------------

  it('future-version payload (schemaVersion: 99) is refused — migrate returns null', () => {
    // Per `migrate.ts:49` contract: "Future-version data: refuse rather
    // than guess." Verifies the contract still holds — a downgrade /
    // misrouted blob from a hypothetical future schema must NOT silently
    // bulldoze through. The caller (loadProgress) treats null as corrupt
    // and falls back to defaults.
    const seed = defaultProgress('Marian')
    const futureBlob = { ...seed, schemaVersion: 99 as unknown as 1 }

    expect(migrate(futureBlob)).toBeNull()
    // And via the storage adapter: same outcome.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(futureBlob))
    expect(loadProgress()).toBeNull()
  })

  // -------------------------------------------------------------------------
  // 4. Forward-compat: extra-but-unknown top-level keys
  // -------------------------------------------------------------------------

  it('blob with extra top-level keys not yet known to the schema does NOT have them silently dropped on save round-trip', () => {
    // Forward-compat scenario: iPad upgrades to a bundle that adds a
    // hypothetical new field `experimentBucket: string`, writes a blob
    // with it, then laptop opens the same blob on the OLDER bundle that
    // doesn't know about the field. The current bundle's read path
    // accepts the blob (the strict guard does NOT reject extra keys),
    // but if a save on the old-bundle laptop drops the unknown field,
    // the iPad loses that data on the next reconcile.
    //
    // CURRENT BEHAVIOUR (verified by reading storage.ts):
    //   - loadProgress() validates via isProgressV1 which only checks
    //     known keys; extra keys are preserved via JSON.parse.
    //   - saveProgress() serializes the in-memory shape verbatim. If
    //     the in-memory shape carried the unknown field through, save
    //     keeps it; if our read path strips it, save loses it.
    //
    // What we actually pin: a blob with extra top-level keys does NOT
    // crash the load, AND the parsed in-memory shape preserves the
    // unknown key when the read path returns it (so a subsequent save
    // would also preserve it). This is the forward-compat hygiene gate.
    const seed = defaultProgress('Marian')
    const blobWithExtra = {
      ...seed,
      // A field a future schema might add. The strict guard in
      // guards.ts does not reject unknown keys (it whitelists known
      // ones via property existence checks).
      experimentBucket: 'cohort-A',
      futureFlag: true,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blobWithExtra))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    // The known fields are intact and the blob is valid v1.
    expect(isProgressV1(loaded)).toBe(true)
    // Unknown fields preserved on the in-memory shape — a subsequent
    // save would round-trip them. We cast through `unknown` because the
    // typed Progress interface doesn't carry them.
    const loadedAsRecord = loaded as unknown as Record<string, unknown>
    expect(loadedAsRecord.experimentBucket).toBe('cohort-A')
    expect(loadedAsRecord.futureFlag).toBe(true)

    // Round-trip via save: the unknown fields survive a save → load
    // cycle (forward-compat hygiene confirmed).
    saveProgress(loaded as Progress)
    const reloaded = loadProgress()
    expect(reloaded).not.toBeNull()
    const reloadedAsRecord = reloaded as unknown as Record<string, unknown>
    expect(reloadedAsRecord.experimentBucket).toBe('cohort-A')
    expect(reloadedAsRecord.futureFlag).toBe(true)
  })

  // -------------------------------------------------------------------------
  // 5. Empty / null payload — null return triggers caller-side default fallback
  // -------------------------------------------------------------------------

  it('empty localStorage yields null from loadProgress (caller falls back to defaultProgress)', () => {
    // Greenfield first-launch: nothing stored yet. The contract is
    // `loadProgress() === null`; the App's mount-time
    // `useState(loadProgress)` then initializes to null and the
    // greet-or-hub branch handles the default path.
    expect(loadProgress()).toBeNull()
  })

  it('explicit null payload string in localStorage yields null (corruption fallback)', () => {
    // Defensive: a previous build / external script wrote a literal
    // `"null"` to the slot. JSON.parse yields `null`, the schema-version
    // read finds nothing, loadProgress returns null. App falls back to
    // defaults — no crash.
    window.localStorage.setItem(STORAGE_KEY, 'null')
    expect(loadProgress()).toBeNull()
  })

  // -------------------------------------------------------------------------
  // 6. parentSettings: undefined (explicit) treated as absent
  // -------------------------------------------------------------------------

  it('blob with parentSettings explicitly undefined receives defaulted settings (treated as absent)', () => {
    // Edge case: a blob written by some path that explicitly sets the
    // field to undefined (e.g. `JSON.stringify` drops it, but a hand-
    // crafted blob from a debug tool might carry an explicit `null`).
    // The defaulter must produce a fully-shaped parentSettings.
    const seed = defaultProgress('Marian')
    const blob: Record<string, unknown> = { ...seed }
    delete blob.parentSettings
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(loaded?.parentSettings).toBeDefined()
    // Defaults — Thomas-locked 2026-05-02.
    expect(loaded?.parentSettings?.autoPromote).toBe(true)
    expect(loaded?.parentSettings?.crossDayEnforcement).toBe(true)
    expect(loaded?.parentSettings?.masteryThreshold.math).toEqual({
      percent: 0.95,
      sessions: 3,
    })
    expect(loaded?.parentSettings?.masteryThreshold['word-song']).toEqual({
      percent: 0.9,
      sessions: 3,
    })
  })

  // -------------------------------------------------------------------------
  // 7. lifetimeFirstEncounters: [] (greenfield) round-trips verbatim
  // -------------------------------------------------------------------------

  it('blob carrying lifetimeFirstEncounters: [] (post-PR-#174 first-launch) round-trips verbatim', () => {
    // The defaulter must respect a present-but-empty list. Greenfield
    // Marian created post-#174 has `lifetimeFirstEncounters: []` — if
    // the defaulter naively filled it via the inference rule, her FIRST
    // session at any non-locked word-song node would skip first-encounter
    // scaffolding (because skillLevels say cvc-words is at 'intro'). The
    // defaulter's contract is "infer ONLY when undefined."
    const seed = defaultProgress('Marian')
    const blob: Progress = { ...seed, lifetimeFirstEncounters: [] }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(loaded?.lifetimeFirstEncounters).toEqual([])
    expect(isProgressV1(loaded)).toBe(true)
  })

  it('blob carrying a hand-set lifetimeFirstEncounters list round-trips verbatim (no overwrite by inference)', () => {
    // Round-trip pin: a blob that already carries the field with a
    // hand-curated list (e.g. parent edited via a future export/import
    // tool) must NOT have it overwritten by the inference rule.
    // Mirror of `cloudSync.test.ts`'s "preserves it verbatim across
    // install" test, pinned at the storage-side defaulter.
    const seed = defaultProgress('Marian')
    const blob: Progress = {
      ...seed,
      lifetimeFirstEncounters: ['cvc-words-short-u'],
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(loaded?.lifetimeFirstEncounters).toEqual(['cvc-words-short-u'])
  })

  // -------------------------------------------------------------------------
  // 8. pendingPromotion present survives round-trip
  // -------------------------------------------------------------------------

  it('blob with pendingPromotion set survives round-trip (M3 contract)', () => {
    // M3 (ticket 86c9kmwd0) writes `pendingPromotion` when a node
    // qualifies for promotion AND `autoPromote === false`. The field
    // must survive a load → save cycle — losing it here would mean
    // Marian's queued promotion silently disappears on the next deploy.
    const seed = defaultProgress('Marian')
    const blob: Progress = { ...seed, pendingPromotion: 'add-to-10' }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    expect(loaded?.pendingPromotion).toBe('add-to-10')

    // Save round-trip preserves it.
    saveProgress(loaded as Progress)
    const reloaded = loadProgress()
    expect(reloaded?.pendingPromotion).toBe('add-to-10')
  })

  // -------------------------------------------------------------------------
  // 9. Cross-cutting: a "real Marian" blob with ALL 30-day additions
  //    round-trips deep-equal
  // -------------------------------------------------------------------------

  it('a fully-populated v1 blob with all 30-day additive fields round-trips deep-equal', () => {
    // Belt-and-braces: take the full surface — parentSettings present,
    // pendingPromotion set, lifetimeFirstEncounters non-empty, history
    // with latencyMs entries — and round-trip it. No defaulter should
    // mutate any field; output must be deep-equal to input.
    const seed = defaultProgress('Marian')
    const fullBlob: Progress = {
      ...seed,
      profile: { ...seed.profile, lastPlayedISO: '2026-05-09T10:00:00.000Z' },
      history: [
        {
          dateISO: '2026-05-08T10:00:00.000Z',
          skillFocus: ['add-to-10'],
          successRate: 0.875,
          latencyMs: [1200, 800, 950, 700, 600, 1100, 900, 850],
        },
      ],
      pendingPromotion: 'add-to-10',
      lifetimeFirstEncounters: [
        'letter-names',
        'letter-sounds',
        'blending-cv',
        'cvc-words',
      ],
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fullBlob))

    const loaded = loadProgress()
    expect(loaded).toEqual(fullBlob)
  })

  // -------------------------------------------------------------------------
  // 10. Cross-cutting: skillLevels missing key + lifetimeFirstEncounters
  //     missing — both defaulters fire correctly in sequence
  // -------------------------------------------------------------------------

  it('skillLevels missing a key AND lifetimeFirstEncounters missing — both defaulters fire in correct order', () => {
    // Verifies the layered defaulter ordering documented in
    // storage.ts § "Layered post-parse" — withDefaultedSkillLevels runs
    // BEFORE isProgressV1, then withDefaultedLifetimeFirstEncounters
    // runs after the guard. A blob with both gaps must come out
    // healed on both axes.
    const seed = defaultProgress('Marian')
    const skillLevelsMissingShortU: Partial<SkillLevels> = {
      ...seed.skillLevels,
    }
    delete (skillLevelsMissingShortU as Record<string, unknown>)[
      'cvc-words-short-u'
    ]
    const blob: Record<string, unknown> = {
      ...seed,
      skillLevels: skillLevelsMissingShortU,
    }
    delete blob.lifetimeFirstEncounters
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))

    const loaded = loadProgress()
    expect(loaded).not.toBeNull()
    // Skill-level defaulter healed the missing short-u key.
    expect(loaded?.skillLevels['cvc-words-short-u']).toBe('locked')
    // Lifetime-first-encounters defaulter inferred from the (now-
    // healed) skillLevels — short-u stays absent because it just
    // defaulted to 'locked'.
    expect(loaded?.lifetimeFirstEncounters).toEqual([
      'letter-names',
      'letter-sounds',
      'blending-cv',
      'cvc-words',
      'sight-words',
    ])
    expect(isProgressV1(loaded)).toBe(true)
  })
})
