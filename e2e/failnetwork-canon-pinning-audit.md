# `failNetwork: true` × canon-content-pinning audit

**Ticket:** `86c9y49bu` (Jessica, audit — catalogue + classify, NOT a mock-swap)
**Date:** 2026-06-14
**Base:** `origin/main` @ `734874f`

## The structural defect this audit hunts

`installClaudeMock(page, { failNetwork: true })` aborts the `/api/claude` route. App.tsx
catches the rejection and the screen falls through to `pickStaticSessionPlan`
(`src/screens/Math/sessionPlans.ts:424-434`). That function special-cases **only**
`focusNode === 'add-to-20'`; **every other non-`add-to-10` focus falls into the
`add-to-10` rotation** (`op: '+'`, `correct ∈ [3,10]`, single-digit operands). For
word-song, the analogous fallback is `pickStaticWordSongPlan()` → short-a CVC /
blending-cv stub content.

So a spec that PINS canon-specific content (operand range, addend value, chip text,
utterance prose, tier-specific words) under `failNetwork: true` for any
`focusNode ∉ {add-to-10, add-to-20}` is asserting against content that is **never
served** — the trivially-green / wrong-tier trap documented in `testing-and-ci.md`
§4.1.1d / §4.1.1e / §4.1.1f and the §4.2 `failNetwork` tier-asymmetry warning.

## Method

1. Grep `failNetwork:\s*true` across `e2e/` → 33 files matched the token; many were
   **documentary mentions only** (docstrings explaining why the spec does NOT use
   `failNetwork`). Filtered to actual `installClaudeMock(page, { failNetwork: true })`
   call sites → **18 specs actually invoke it** (some at multiple sites / describe
   blocks).
2. For each invoking spec/block: determined (a) the seeded `focusNode` (via
   `skillLevelOverrides` + picker order), and (b) whether any active assertion pins
   canon-specific content vs. content-agnostic state.
3. Classified each: **structurally-safe** / **needs-upgrade** / **ambiguous**.
   ZERO ambiguous (ticket success criterion).

## Classification of canon-content-pinning assertion vs. content-agnostic

An assertion is **content-agnostic** (safe under `failNetwork` regardless of tier) when
it reads only:

- the persisted `Progress` doc — `skillLevels[node]`, `skillFocus` attribution,
  `successRate`, `history.length`, changed-node sets, mastery transitions;
- per-problem captures written at the chip-tap site — `latencyMs`,
  `perProblemAnswerValue/Word` (derived from whatever chip rendered, then compared to
  the captured tapped value — derivation, not a fixed pin);
- DOM presence/visibility/index/count of structural testids (Placement A/B, scaffold
  container, math root index), with no tier-specific text pinned;
- content-derivation patterns — read whatever addend/word rendered, assert it stays
  stable across a re-render (`toHaveText(firstAddendA!)`).

An assertion **pins canon content** (unsafe under `failNetwork` for non-add-to-10/20)
when it asserts a fixed operand range / addend value / `op` glyph / chip text / tier
word / utterance prose that only the real tier canon serves.

---

## Results

**Total `failNetwork: true` call-site specs:** 18
**Structurally-safe:** 18
**Needs-upgrade:** 0
**Ambiguous:** 0

### Structurally-safe — math, `add-to-10` or `add-to-20` focus (tier-exempt)

The static fallback serves the correct tier for these focuses, so even content-pinning
assertions are sound.

| Spec                               | Focus                            | Why safe                                                                                                                                                                                                               |
| ---------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add-to-20-flower-row-fit.spec.ts` | `add-to-20`                      | `add-to-20` IS the special-cased static rotation; reads addends only for viewport-fit layout. Tier-exempt.                                                                                                             |
| `mastery-promotion.spec.ts`        | `add-to-10`                      | Default fallback tier. Asserts persisted `skillFocus`. (NIT: uses `.toContain('add-to-10')` — `feedback_count_assertions_on_regression_tests` smell, but `add-to-10` is the safe tier and this is out of audit scope.) |
| `subitising-scaffold.spec.ts`      | `add-to-10` (active tests 1/3/4) | Active `failNetwork` tests seed `add-to-10`; assert scaffold-container `toHaveCount`. Test 5 (`sub-to-10`) is `test.fixme`'d and overrides with a canned sub-to-10 mock — never runs under bare `failNetwork`.         |

### Structurally-safe — content-agnostic assertions (any focus)

The fallback content is wrong-tier, but no assertion reads it. Added a 1-line WHY
comment at each non-add-to-10/20 call site (see "Comments added" below).

| Spec / describe block                                           | Focus                           | Assertion surface                                                                                         |
| --------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `progression-mastery-loop.spec.ts` — cvc-words                  | `cvc-words`                     | persisted `skillLevels` / `skillFocus` / `history`                                                        |
| `progression-mastery-loop.spec.ts` — sub-to-20                  | `sub-to-20`                     | persisted Progress doc                                                                                    |
| `progression-mastery-loop.spec.ts` — mult-2-5-10                | `mult-2-5-10`                   | persisted Progress doc                                                                                    |
| `progression-mastery-loop.spec.ts` — cvc-words-short-e          | `cvc-words-short-e`             | persisted Progress doc                                                                                    |
| `progression-mastery-loop.spec.ts` — sight-words                | `sight-words`                   | persisted Progress doc                                                                                    |
| `digraphs-sh-progression.spec.ts`                               | `digraphs-sh`                   | persisted `skillLevels` / `skillFocus`                                                                    |
| `simple-sentences-progression.spec.ts` — Test 1                 | `simple-sentences`              | persisted Progress doc (mastery / changed-node set)                                                       |
| `two-digit-addsub-with-regroup-progression.spec.ts` — Tests 3,4 | `two-digit-addsub-with-regroup` | persisted Progress doc (Test 2 pins addend-a ≥ 10 and correctly uses a canon-bytes mock, NOT failNetwork) |
| `digraphs-th-mouth-cue-display.spec.ts` — Tests 1-4             | `digraphs-th-voiceless`         | DOM-presence only (Placement A/B testids); no chip content                                                |
| `latency-band-invariant.spec.ts`                                | `add-to-10` (default)           | `latencyMs` band membership                                                                               |
| `schema-answer-value.spec.ts`                                   | `add-to-10` (default)           | `perProblemAnswerValue/Word` derived from tapped chip                                                     |
| `backgrounding-mid-session.spec.ts`                             | `add-to-10` (default)           | visibility / problem-index / count                                                                        |
| `cold-mount-math-fetch-in-flight.spec.ts`                       | `add-to-10` (default)           | addend presence + cross-render stability (derivation)                                                     |
| `hub-to-math.spec.ts`                                           | `add-to-10` (default)           | addend presence + cross-render stability (derivation)                                                     |
| `session-end-to-hub.spec.ts`                                    | `add-to-10` (default)           | session → SessionEnd → Hub flip (navigation)                                                              |
| `path-a-fetch-abort-rapid-route-bounce.spec.ts`                 | `add-to-10` (default)           | fetch-abort / route-bounce state (no content)                                                             |
| `cloud-sync-conflict.spec.ts`                                   | `cvc-words` (no session driven) | boot reconcile cycle; cloud-sync post-body; no session content                                            |
| `localstorage-corruption-recovery.spec.ts`                      | n/a (boot recovery)             | app-boots assertions; explicitly avoids `.toContain` on textContent                                       |
| `multi-tab-same-key-desync.spec.ts`                             | `add-to-10`                     | cross-tab desync state; no session content pinned                                                         |

> Note: the per-spec table row count exceeds 18 because several specs contain multiple
> `failNetwork` describe-blocks / tests; the 18 figure counts distinct files.

### Needs-upgrade

**None.** The two historical offenders are already remediated and out of scope:

- `sub-to-20.spec.ts` — pinned teen-operand content under `failNetwork`; migrated to
  `installFocusAwareMathCanonClaudeMock` (PR #275 follow-up). No active `failNetwork`
  call site remains (only documentary mentions).
- `two-digit-addsub-with-regroup-progression.spec.ts` Test 2 — pinned addend-a ≥ 10;
  migrated to the canon-bytes mock (Wave 6D). The canon-bytes mock was later promoted
  to the shared `installMathCanonClaudeMock` (ticket 86c9y490t); the failNetwork-pinning
  audit itself lists Test 2 as out of scope.

The `installFocusAwareMathCanonClaudeMock` / `installMathCanonClaudeMock` families and
the already-fixed `sub-to-20` / with-regroup Test 2 are all out of scope per the ticket.

### Ambiguous

**None.** Every spec is explicitly safe or (had any pinned content existed) would be
queued for upgrade.

## Comments added (1-line WHY at each non-add-to-10/20 safe pairing)

Per the ticket ("for structurally-safe, add a 1-line spec comment stating WHY"), an
audit-tagged comment was added at the `failNetwork: true` call site of each
structurally-safe spec whose focus is NOT `add-to-10`/`add-to-20` (where the
tier-asymmetry COULD have bitten but doesn't, because the assertions are
content-agnostic):

- `progression-mastery-loop.spec.ts` — 5 describe blocks (cvc-words, sub-to-20,
  mult-2-5-10, cvc-words-short-e, sight-words)
- `digraphs-sh-progression.spec.ts`
- `simple-sentences-progression.spec.ts` — Test 1
- `two-digit-addsub-with-regroup-progression.spec.ts` — Tests 3 + 4

The `add-to-10`/`add-to-20`-focus specs and the DOM-presence / boot-recovery specs were
NOT annotated — the tier-asymmetry is structurally inapplicable there, and several
already carry their own inline rationale.

## Conclusion

The 23-spec concern from Devon's PR #322 cross-review is **fully resolved on
`main`**: every actively-invoking `failNetwork: true` spec is either on the
tier-exempt `add-to-10`/`add-to-20` focus or asserts content-agnostic state. The two
specs that once pinned wrong-tier content were already migrated to canon-bytes mocks.
No follow-up mock-swap ticket is required.
