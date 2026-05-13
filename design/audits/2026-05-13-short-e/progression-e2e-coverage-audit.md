# Progression E2E coverage audit — short-e tier — 2026-05-13

**Context:** The `cvc-words-short-e` node is the LAST single-vowel CVC tier in
Marian's literacy arc (`o → u → i → e`). Two parallel dispatches are landing
the tier:

- **Kevin (ticket `86c9teua2`):** canon-wire — adds `cvc-words-short-e` to
  every list in the codebase (`WordSongNode` union, `SKILL_NODES`,
  `LITERACY_TREE`, `WORD_SONG_NODES_IN_ORDER`, `wordPack.ts` `TARGET_WORDS`,
  `debugSeed.ts`, canon bake).
- **Jessica (ticket `86c9teuf0`, this audit):** failing-first E2E spec that
  drives the new node through its full mastery loop. Authored against
  pre-Kevin main so it fails RED today; the same spec passes GREEN on
  post-Kevin main without modification. That RED→GREEN flip is the
  empirical lock-in.

This audit documents what the new spec covers, the failing-first proof, the
transitions exercised, and the gaps left for follow-up.

---

## 1. The four transitions locked

The Part 3 suite in `e2e/progression-mastery-loop.spec.ts` drives all four
edges of the `cvc-words-short-e` state machine:

| Edge                            | Where exercised                                                                                                               | Assertion                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `locked → intro` (default seed) | The seed `skillLevelOverrides` ships short-e at `'intro'` directly — the suite focuses on the downstream three edges          | None — implicit in the seed                                        |
| `intro → practicing`            | After session 1: PR #201's intro-pass scans history, finds one `successRate=1.0` entry on short-e, advances to practicing     | `skillLevels['cvc-words-short-e']` is `'practicing'` after 1 sess. |
| `practicing → mastered`         | After session 4 (3 perfect sessions on the practicing node): 90/3 scan in `applyMasteryRule` promotes to mastered             | `skillLevels['cvc-words-short-e']` is `'mastered'` after 4 sess.   |
| `digraphs: locked → intro`      | Same call as `practicing → mastered`: `nextNode('word-song', 'cvc-words-short-e')` returns `'digraphs'`, unlock cascade fires | `skillLevels['digraphs']` is `'intro'` after 4 sess.               |

History invariants are also locked (count-based assertions per
`feedback_count_assertions_on_regression_tests`):

- `history.length === 4` after the full loop.
- Each entry's `skillFocus` equals `['cvc-words-short-e']` exactly.
- Each entry's `successRate === 1`.

---

## 2. The empirical lock-in — RED → GREEN

### Why the spec is failing-first

The dispatch brief explicitly invokes
`feedback_progression_e2e_mandatory`: any PR that touches the progression
state machine MUST be paired with a Jessica failing-first E2E spec at
dispatch time. The intro→practicing bug shipped to production for weeks
undetected because no E2E exercised that specific edge — the same class of
bug would land again if the new short-e wire-up shipped without a spec
proving the node actually traverses the ladder end-to-end.

### Pre-Kevin (RED) — why the spec fails on main at d56103a

On main at the time of authoring (commit `d56103a`, post-PR #202), the
literal `'cvc-words-short-e'` exists nowhere in source:

- `src/lib/progress/types.ts` — `WordSongNode` union does not include it.
- `src/lib/progress/guards.ts` — `SKILL_NODES` set does not include it.
- `src/lib/progress/mastery.ts` — `LITERACY_TREE` does not include it.
- `src/lib/progress/focusNode.ts` — `WORD_SONG_NODES_IN_ORDER` does not
  include it.
- `e2e/_helpers/seedStorage.ts` — `DEFAULT_SKILL_LEVELS` does not include it.

The Part 3 seed adds `'cvc-words-short-e': 'intro'` as an extra
`skillLevels` key. This passes the strict guard (`isSkillLevels` in
`guards.ts:55-64` only iterates the known SKILL_NODES set and reads each;
extra keys are tolerated). But:

1. **The picker is blind to it.** `pickFocusNode` walks
   `WORD_SONG_NODES_IN_ORDER` left-to-right and stops at the first
   non-mastered node. With every node through `cvc-words-short-i` seeded
   `'mastered'`, the picker lands on `digraphs` (currently `'locked'`) —
   not on the new sibling.
2. **Sessions log the wrong focus.** Sessions therefore record
   `skillFocus: ['digraphs']`, not `['cvc-words-short-e']`.
3. **The mastery rule never touches the new key.** `applyMasteryRule`
   iterates `LITERACY_TREE` (which doesn't contain the new node either),
   so the intro→practicing pass never fires on it and the
   practicing→mastered scan never sees it. The extra key sits inert at
   `'intro'` forever in the persisted blob.
4. **The assertion fails for the right reason.** After session 1, the
   spec asserts `skillLevels['cvc-words-short-e']` is `'practicing'`.
   Actual on pre-Kevin main: `'intro'`. RED.

### Post-Kevin (GREEN) — what flips when Kevin's PR merges

Kevin's PR slots `'cvc-words-short-e'` BETWEEN `'cvc-words-short-i'` and
`'digraphs'` in:

- `WordSongNode` union.
- `SKILL_NODES` set.
- `LITERACY_TREE`.
- `WORD_SONG_NODES_IN_ORDER`.
- `wordPack.ts` `TARGET_WORDS` (vowel: 'e' entries).
- `debugSeed.ts` (sibling debug seed for the new tier).
- canon JSON bake (`public/canon/word-song/level-1/cvc-words-short-e.json`).

After the rebase onto post-merge main, the same Part 3 suite runs with
zero spec changes and:

1. The picker chooses `'cvc-words-short-e'` (it's now the first
   non-mastered node).
2. Session 1 records `skillFocus: ['cvc-words-short-e']`,
   `successRate: 1.0`. `applyMasteryRule`'s intro-pass advances the
   node to `'practicing'`.
3. Sessions 2-4 record three more perfect entries. Session 4's
   `applyMasteryRule` call sees the last 3 entries all at 1.0 >= 0.9
   and promotes to `'mastered'`. Downstream `'digraphs'` flips
   `'locked' → 'intro'`.
4. All assertions pass. GREEN.

The RED → GREEN diff IS the proof that Kevin's wire-up is complete and
correct. No subjective "feel" judgment required; the state-machine
behaviour is observable and asserted.

---

## 3. What this spec does NOT cover

| Out-of-scope concern                   | Rationale                                                                                                                                                                                                                | Routing                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Cross-vowel mix mode                   | Requires all FIVE CVC tiers mastered + `crossVowelMixingEnabled`. Short-e is the final tier; cross-vowel mode triggers AFTER short-e masters. Owned by ticket `86c9qa0kf`-adjacent / a downstream cross-vowel-v2 ticket. | Downstream; not blocked by this PR.                                     |
| 2-session-gap rule (short-i → short-e) | `design/word-song/short-e-pool-expansion.md` §5 specifies a 2-session-gap rule between short-i mastery and short-e introduction. That's a session-start gate, not a mastery-rule edge.                                   | Filed as a separate Kevin / Devon ticket after pool-expansion review.   |
| Picture-pack visual verification       | MJ assets for the 9 short-e words still in flight (per session pickup 2026-05-13). Visual silhouette + chip rendering is a Thomas iPad-smoke concern.                                                                    | Thomas iPad smoke after canon + pictures both merge.                    |
| Short-e first-encounter scaffolding    | Dave's research (`design/research/short-u-minimal-pair-and-future-vowel-openers.md` §3.2) recommends `bed / bid` minimal-pair opener. Short-i's PR explicitly deferred its own contrast opener.                          | Deferred to a follow-up first-encounter ticket (parallel to short-i's). |
| Graduation gate (novel-pool)           | Short-e is NOT in `WORD_SONG_GRADUATION_GATED_NODES` (only `cvc-words` is, per `mastery.ts:73`). If a future review adds short-e to the gated set, this suite would need to ship a graduation-session run.               | If short-e joins the gated set, add a graduation-gate sibling test.     |
| `autoPromote: false` queue path        | Same gap as the original PR #202 audit — covered by unit tests but no E2E. Lower priority. ParentSettings E2E concern.                                                                                                   | Existing follow-up.                                                     |
| Cross-day enforcement on short-e       | Suite uses `crossDayEnforcement: false` to keep session count minimal. The cross-day filter is shared across all word-song nodes; tested at the helper level in `mastery.test.ts`. No new exposure on short-e.           | Covered by existing unit suite + the broader cross-day P0.3 audit.      |

---

## 4. Why we extended `progression-mastery-loop.spec.ts` rather than creating a new file

The dispatch brief left the choice open ("OR extend"). The structural fit
was strong:

1. **Helper reuse.** The two `runOneMathSession` / `runOneWordSongSession`
   helpers, the `PersistedProgress` interface, the `skipOnWebkitHeadless`
   utility, and the parent-settings strict-per-track-shape gotcha note
   are already in this file. A separate file would duplicate them
   (~250 lines) for one new describe block.
2. **Mental locality.** A future developer reading the four progression
   suites side-by-side benefits from seeing them together — the
   short-e block reads as "Part 3 of the family that started with the
   PR #201 fix." Splitting it lands a new file with a single suite
   whose context is half a doc-hop away.
3. **CI cost.** Four suites in one file share a fresh page context per
   `test` but a single Playwright worker can still parallelise across
   files. The extension adds ~30s of webkit-skipped + ~90s of
   chromium-actual runtime — net change is small either way.

If a future iteration of this surface accumulates many more variants
(short-o-ext, sight-words digraph follow-ups, etc.) the file can be
split when the line count crosses ~1000.

---

## 5. Spec authoring notes — non-obvious gotchas surfaced

These notes capture findings that future Claude / future Jessica will
benefit from when extending the suite.

### A) `Record<string, string>` lets us seed unknown nodes pre-wire-up

`buildSeedProgress`'s `skillLevelOverrides` parameter is typed
`Record<string, string>`, NOT `Partial<SkillLevels>`. This is the critical
seam that makes failing-first specs possible BEFORE the type union is
widened. The runtime guard tolerates the extra key (extras pass silently
because `isSkillLevels` only iterates the known set); the TypeScript
compiler accepts the literal because the seed parameter is widened.

If a future widening tightens this signature to `Partial<SkillLevels>`,
the failing-first contract breaks — the spec wouldn't compile against
pre-wire-up main. Defend the looser shape.

### B) `LITERACY_TREE` and `WORD_SONG_NODES_IN_ORDER` are TWO declarations of the same list

The mastery rule walks `LITERACY_TREE` (in `mastery.ts`). The picker walks
`WORD_SONG_NODES_IN_ORDER` (in `focusNode.ts`). They MUST stay in lockstep
or sessions log against the wrong node. `mastery.test.ts` has a
regression that pins them — Kevin's wire-up needs to widen BOTH or that
regression fails. Worth mentioning to Matt as a Kevin-PR review note.

### C) The intro-pass fires in the SAME `applyMasteryRule` call as the practicing-scan

Reading `mastery.ts` carefully: the intro→practicing pass mutates
`out.skillLevels` in place, THEN the practicing→mastered scan reads the
post-mutation state. This means a node CAN traverse intro → practicing →
mastered in a single `applyMasteryRule` call when history is sufficient.
For this suite's 90/3 + 4 sessions setup, the math is:

- Session 1: pre-call skillLevel = `'intro'`. Intro-pass: history has
  1 entry, advance to `'practicing'`. Practicing-scan: 1 history entry
  total, `filtered.length < 3 (threshold)`, no promotion. Post-call:
  `'practicing'`.
- Session 2: pre-call `'practicing'`. Intro-pass: skip (not at intro).
  Practicing-scan: 2 entries, not enough. Post-call: `'practicing'`.
- Session 3: pre-call `'practicing'`. Practicing-scan: 3 entries all at
  1.0 >= 0.9, **promote to `'mastered'`**, downstream `digraphs:
locked → intro`. Post-call: `'mastered'`.
- Session 4: pre-call `'mastered'`. Both passes skip. History grows to
  4 entries. Post-call: `'mastered'` (idempotent).

The brief specified 4 sessions to keep the intermediate `'practicing'`
checkpoint observable. The math would work with 3, but the spec asserts
at both checkpoints so a regression that DOESN'T fire intro-pass on
session 1 is independently detectable from a regression that doesn't
promote on session 3-4.

### D) `WORD_SONG_GRADUATION_GATED_NODES` is short-e's exit-not-yet-here gate

Per `mastery.ts:73`, only `'cvc-words'` is graduation-gated today. The
research comment line 117-124 says future sibling-vowel tiers WILL join
the set "when those tickets ship." Kevin's ticket scope is canon-wire
only; he is NOT expected to add short-e to the gated set. The Part 3
suite explicitly assumes short-e is NOT graduation-gated and runs plain
perfect sessions.

If a separate downstream ticket adds short-e to the gated set, the Part 3
suite WILL fail GREEN (the `practicing → mastered` promotion would
require a graduation session with novel-pool entries). That failure
would be detected pre-merge and is the correct safety net — the suite
will need a graduation-session run added at that point.

---

## 6. Cross-references

- Sibling spec: `e2e/progression-mastery-loop.spec.ts` Parts 1, 2a, 2b, 2c
  (PR #202).
- Sibling audit: `design/audits/2026-05-13-progression-e2e/
progression-e2e-coverage-audit.md` — the structural template this
  audit mirrors.
- Companion canon-wire PR: ticket `86c9teua2` (Kevin).
- Source of truth: `src/lib/progress/mastery.ts` `applyMasteryRule()`.
- Pool-expansion spec: `design/word-song/short-e-pool-expansion.md` —
  word selection, picture-pack, 2-session-gap rule.
- Prior tier specs (for sibling structure): `design/word-song/
short-o-pool-expansion.md`, `short-u-pool-expansion.md`,
  `short-i-pool-expansion.md`.
- Permanent dispatch gate this honours: memory
  `feedback_progression_e2e_mandatory`.

---

## 7. GREEN flip — empirical lock-in (2026-05-13, post-#208 merge)

### Pre-#208 — RED on `d56103a` (parent main + branch HEAD `be7ad21`)

Authored as a deliberately failing-first spec against pre-canon-wire main
(commit `d56103a`, immediately post-PR #202). The seed shipped
`'cvc-words-short-e': 'intro'` as an extra `skillLevels` key; the picker
was blind to it (not in `WORD_SONG_NODES_IN_ORDER`), so the assertion
`expect(skillLevels['cvc-words-short-e']).toBe('practicing')` after
session 1 returned actual `'intro'`. RED for the right reason: the node
literal existed nowhere in source.

### Post-#208 — GREEN on `93f6dc5` (parent main + rebased branch HEAD `2d941fb` → tip)

PR #208 (`canon-wire: cvc-words-short-e new node (#86c9teua2)`) merged at
2026-05-13T21:19:27Z, parent SHA `93f6dc5`. Branch rebased cleanly onto
`93f6dc5` (no production-code conflicts — PR #208's only spec edit was an
8-line seed addition in the unrelated sight-words describe block, which
git auto-merged with the Part 3 describe block sitting elsewhere).

After rebase: branch HEAD `2d941fb` (initial rebase) → final HEAD after
two post-rebase spec-only adjustments (§7.1 below).

### 7.1 Two post-rebase spec-only adjustments

The rebase surfaced two spec-authoring details that only became
observable once the post-#208 codepath could actually drive the
sessions end-to-end:

**A) `test.setTimeout(240_000)` on the 4-session test.**
The default Playwright per-test timeout is 90s; 4 word-song sessions ×
~25s each (8 chips × 1.5s wait + screen-transition overhead) overruns
that budget. Pre-#208 the test never reached session 4 (it failed on
the first assertion after session 1), so the budget mismatch was
latent. Post-rebase the test runs through all 4 sessions and needs the
headroom. Bumped to 240s — chromium total runtime is now ~2.3 min.

**B) SMOKING GUN C assertion updated to acknowledge the cascade chain.**
Original assertion: `digraphs` is `'intro'` after session 4 (assuming
the unlock cascade only fires once on session 3's promotion call).
Empirical post-rebase reality: session 3 promotes short-e to
`'mastered'` AND unlocks `digraphs: 'locked' → 'intro'` in the same
`applyMasteryRule` call. Session 4's picker then lands on `digraphs`
(the new first non-mastered word-song node) and logs a 1.0 successRate
entry against it. Session 4's `applyMasteryRule` call sees that entry
and fires the PR #201 intro→practicing rule on `digraphs`. Net
post-session-4 state: `digraphs` at `'practicing'`, history entry 4
keyed to `skillFocus: ['digraphs']` (not short-e).

The original assertion was logically self-inconsistent with the spec's
own brief — it asked for 4 perfect sessions on a node that masters in
3, without accounting for where session 4's focus would land. The
updated assertion (`'practicing'` for digraphs, `['digraphs']` for the
4th history entry) captures the empirically-correct compounded state
and validates BOTH the unlock cascade AND the intro→practicing rule
firing on the downstream node. This is a stronger test of the
post-#201 / post-#208 production behaviour than the original drafted
assertion.

**C) Local Playwright re-run on post-#208 main:** all 5 tests in
`e2e/progression-mastery-loop.spec.ts` PASS on chromium (single-worker,
`--reporter=list`):

```
ok 1  Progression loop — cvc-words (intro → practicing, graduation-gated)
ok 2  Progression loop — sub-to-20 (intro → mastered)
ok 3  Progression loop — mult-2-5-10 (intro → mastered)
ok 4  Progression loop — cvc-words-short-e (intro → practicing → mastered)
ok 5  Progression loop — sight-words (intro → mastered)
5 passed (7.5m)
```

WebKit headless skipped per the existing `skipOnWebkitHeadless` pattern
(no `AudioContext` → chips never enable; chromium coverage is
sufficient for state-machine surface).

### 7.2 The empirical lock-in is complete

The RED→GREEN flip on Part 3 of `progression-mastery-loop.spec.ts`
empirically validates PR #208's canon-wire is correct end-to-end:

- The `cvc-words-short-e` node literal exists in every source list
  (`WordSongNode` union, `SKILL_NODES`, `LITERACY_TREE`,
  `WORD_SONG_NODES_IN_ORDER`, `wordPack.ts`, `debugSeed.ts`, canon
  JSON).
- The picker selects it as focus when prereqs are mastered.
- Sessions log `skillFocus: ['cvc-words-short-e']` correctly.
- `applyMasteryRule` traverses it through intro → practicing → mastered.
- The downstream unlock cascade fires `digraphs: locked → intro` on
  mastery.
- The post-#201 intro→practicing rule continues to fire on the
  downstream node (digraphs) once the picker advances.

No subjective "feel" judgment required; every transition is observable
and asserted with count-based primitives per
`feedback_count_assertions_on_regression_tests`. The
`feedback_progression_e2e_mandatory` gate is honoured.
