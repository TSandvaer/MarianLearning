# E2E coverage audit — 2026-05-09

Ticket: 86c9q7tpu (AC3)

## Scope

Retroactive audit of Playwright coverage gaps for PRs merged or in-flight
between 2026-05-04 and 2026-05-09. The trigger was Thomas catching the
flower-row overflow on PR #166 during iPad smoke — a viewport-width
regression that should have been pinned by Playwright. Per
`feedback_jessica_first_for_objective_gates.md`: numeric bounds, layout
invariants, and round-trip data integrity are Jessica's specs (not
Thomas iPad-smoke).

This audit lists what each PR currently has in e2e, what's missing, and
ranks the gaps by recommended priority for follow-up tickets.

## Audit summary

| PR   | Topic                           | E2e coverage today                                                              | Gap rank       |
| ---- | ------------------------------- | ------------------------------------------------------------------------------- | -------------- |
| #160 | Cloud sync (T2)                 | None at e2e layer; unit-only                                                    | P1             |
| #162 | Word Song pre-warm on Hub mount | None; pure App.tsx state-machine wiring                                         | P1             |
| #164 | Leitner M4 session-gen wiring   | None at e2e; unit-tested at planner + Math layer                                | P2             |
| #166 | add-to-20 content               | New: AC1 flower-fit spec (this PR). Canon-served audio per problem NOT covered. | P1 (audio gap) |
| #167 | Latency-band fix                | New: AC2 latency-band invariant spec (this PR).                                 | Closed         |

---

## PR #160 — Cloud sync (round-trip)

### Existing assertions

- Unit: `src/lib/progress/cloudSync.test.ts` (22 tests) — pure-function
  coverage of `pushProgressToCloud`, `fetchProgressFromCloud`,
  `reconcileWithCloud`, `withDefaultedSkillLevels` parity with
  `storage.ts`.
- Unit: `src/lib/progress/deviceId.test.ts` (10 tests) — UUID
  generation, validation, persistence under `marian-tutor:device-id`.
- Server: `api/progress.test.ts` (24 tests) — handler request/response
  shapes, rate limit per deviceId, KV adapter mocked.

### Missing assertions (e2e layer)

- **Boot-time reconcile install path**: no spec asserts that a
  cloud-newer blob installs into localStorage on App mount. The unit
  tests cover the decision tree in isolation, but nothing exercises
  the App's mount-effect wiring + `hubProgressSnapshot` re-projection
  end-to-end.
- **Session-end fire-and-forget push**: no spec asserts that
  `recordProgressOnSessionEnd` actually fires the `POST /api/progress`
  side-effect after a math/word-song session completes. Rate-limit
  failures or 4xx responses must NOT block Marian; that contract is
  unit-tested but not e2e-tested.
- **ParentSettings Restore-from-device-id flow**: the parent paste-
  UUID-and-restore flow is unit-tested at component level but never
  driven through the actual page. A regression that breaks the click-
  handler wiring would not be caught.
- **Round-trip integrity**: a single device's progress blob → push →
  fetch → install on a second simulated device session, with a deep
  shape comparison (skillLevels, history, parentSettings, lastPlayedISO)
  asserting nothing got lost in transit.

### Recommended follow-up tickets

1. **`e2e/cloud-sync-roundtrip.spec.ts`** (P1) — full push-then-fetch
   round-trip. Mocks `/api/progress` at the Playwright route layer
   (mirroring `mockClaude.ts` shape). Drives session-end → asserts POST
   was made → seeds a fresh page with the captured blob → asserts the
   restored progress shape deep-equals the source.

2. **`e2e/cloud-sync-boot-reconcile.spec.ts`** (P2) — boot reconcile
   install branch: prime `/api/progress` GET to return a blob newer
   than localStorage, mount the App, assert
   `marian-tutor:progress:v1` reflects the cloud blob's contents.

---

## PR #162 — Word Song pre-warm on Hub mount

### Existing assertions

- Unit: `src/App.test.tsx` — pre-warm fetch counts are asserted with
  the `body.payload.track === 'word-song'` filter (per
  `testing-and-ci.md` §4.2.1). Catches the rapid-bounce latch-leak
  regression.
- Unit: Hub.test.tsx — Hub mount renders the path-strip + tile
  rendering; doesn't drive the App-level fetch effect.

### Missing assertions (e2e layer)

- **Pre-warm settles before chip-tap**: the load-bearing user-facing
  promise of #162 was "Word Song chips become tappable as fast as
  Math chips because the audio is pre-fetched on Hub". No spec
  asserts that a chip-tap-after-Hub-Word-Song-tap sequence has the
  same time-to-enabled distribution as Math's.
- **No unintended side-effect on Hub mount**: a regression that
  fires the word-song fetch before Howler is unlocked, or fires it
  twice on rapid Hub re-mount (the rapid-bounce window covered in
  unit), wouldn't be caught at the e2e layer.
- **Cancel-on-route-flip**: when Marian taps Number Garden mid-pre-
  warm, the word-song fetch should abort cleanly; nothing exercises
  this end-to-end.

### Recommended follow-up tickets

3. **`e2e/word-song-prewarm-on-hub.spec.ts`** (P1) — Hub mounts;
   assert exactly ONE word-song POST via route capture; tap Number
   Garden; assert ZERO additional word-song POSTs (the running fetch
   either resolves silently or aborts, but doesn't refire).

4. **`e2e/word-song-prewarm-chip-latency.spec.ts`** (P2) — driven on
   the canonical-fixture path (`mockClaude` default), measure the
   wall-time delta between Hub-tap-Word-Song-chip and chip becoming
   tappable; assert it's within the same band as Math's.

---

## PR #164 — Leitner M4 session-gen wiring

### Existing assertions

- Unit: `api/_planner.test.ts` — Leitner directive emission, validation
  of malformed `leitner` arrays, canon + cache bypass on non-empty
  leitner.
- Unit: `src/lib/progress/leitner.test.ts` — pure Leitner-box helpers
  (`addItem`, `promote`, `demote`).
- Unit: `src/screens/SessionEnd/progressHistory.test.ts` —
  `applyLeitnerOutcomes` integration with `recordProgressOnSessionEnd`.

### Missing assertions (e2e layer)

- **End-to-end box-1 → box-2 evolution**: no spec drives a full math
  session where a Leitner-tracked fact is in box 1, the session-end
  outcome promotes it, and the next session's `/api/claude` payload
  reflects the box-2 state. The full read-write cycle is unit-tested
  in pieces but never run through the browser.
- **`mathFactsLeitner` round-trip after session-end**: the persisted
  `Progress.mathFactsLeitner` shape after a session is unit-tested but
  not pinned at e2e — a regression that drops the field on the write
  path would not be caught.
- **Leitner hint shipped on session-start payload**: no spec captures
  the outgoing POST body and asserts the `progress.leitner` block is
  present and well-formed when `mathFactsLeitner` has items.

### Recommended follow-up tickets

5. **`e2e/leitner-state-evolution.spec.ts`** (P2) — seed
   `mathFactsLeitner` with one fact at box 1; complete a perfect
   session that includes that fact; assert post-session
   `mathFactsLeitner` shows the fact at box 2 with updated `lastSeen`.

6. **`e2e/leitner-payload-shape.spec.ts`** (P2) — capture the
   outgoing `/api/claude` POST body via the route handler, assert
   `progress.leitner` matches the expected shape when seeded
   non-empty, and is omitted entirely when empty (the canon-served
   free-path gate).

---

## PR #166 — add-to-20 content

### Existing assertions

- Unit: `src/screens/Math/sessionPlans.test.ts` — every problem in
  `STATIC_ADD_TO_20_PLANS` has sum in [11, 20], addends in [1, 9], no
  duplicate problems within a plan.
- Unit: `src/screens/Math/distractors.test.ts` — distractor algorithm
  extended for sums up to 20.
- Unit: `api/_planner.test.ts` — Haiku prompt wiring for `add-to-20`
  focus node.
- Unit: `src/lib/debug/debugSeed.test.ts` — `add-to-20` seed produces
  correct `skillLevels` patch.
- **NEW (AC1, this PR)**: `e2e/add-to-20-flower-row-fit.spec.ts` —
  flower-row stays inside iPad-portrait viewport on every problem.

### Missing assertions (e2e layer)

- **Canon-served audio fires per problem**: when `?debug=1&seed=add-to-20`
  routes the planner to the canon JSON for level-1 add-to-20, no spec
  asserts that the served audio decodes and the read-aloud caption
  walks per problem (i.e. that the canon JSON has 8 problems × 5 slots
  rendered correctly). A regression that ships a canon file with empty
  base64 or wrong utterance ids would surface only on real iPad.
- **`number-recog` and `add-to-10` are both `'mastered'` after seed**:
  the seed's intent — focus picker walks past easier tiers — is unit-
  tested but the live picker walk through
  `App.tsx#readProgressHintsForTrack` isn't.
- **Mastery promotion add-to-20 → two-digit-addsub**: unit tests cover
  the rule; no e2e walks 3 cross-day perfect sessions on add-to-20 +
  asserts the next-tier unlock.

### Recommended follow-up tickets

7. **`e2e/add-to-20-canon-audio.spec.ts`** (P1) — installs the canon
   path (NOT failNetwork), seeds add-to-20, asserts the read-aloud
   caption walks for problem 1 (the strongest signal that canon
   served real audio + plan rehydration succeeded).

8. **`e2e/add-to-20-mastery-promotion.spec.ts`** (P2) — sibling of
   `mastery-promotion.spec.ts` but for the next tier hop. Catches a
   future P0.2-class regression on the add-to-20 → two-digit-addsub
   focus-node propagation.

---

## PR #167 — Latency-band fix

### Existing assertions

- Unit: `src/screens/Math/Math.test.tsx` — anchor moment in
  `useLayoutEffect([readAloudPlayed])`; sanity-bound floor + ceiling.
- Unit: `src/screens/SessionEnd/progressHistory.test.ts` — `latencyMs`
  field round-trips through `recordProgressOnSessionEnd`.
- **NEW (AC2, this PR)**: `e2e/latency-band-invariant.spec.ts` — every
  persisted `latencyMs[N]` entry is either `-1` or in `[250, 60000]` ms.

### Missing assertions

- None at the regression-pin layer. The future M4.x consumer that
  reads `latencyMs` (counting → retrieval transition diagnostic) will
  bring its own contract; that's a forward-spec, not a backfill.

---

## Top 5 highest-ROI follow-up specs

Ranked by "regression class most likely to ship past Thomas's iPad
without a Playwright spec":

1. **`e2e/cloud-sync-roundtrip.spec.ts`** (P1) — round-trip data
   integrity is a Jessica spec by definition. Cloud-sync silent
   failures are catastrophic for Marian (lost progress) and not
   visually obvious during iPad smoke.

2. **`e2e/word-song-prewarm-on-hub.spec.ts`** (P1) — count-based
   assertion on the per-track POST shape. Easy to write, catches the
   #162 regression class (chatty Hub mount, missing pre-warm,
   double-fetch).

3. **`e2e/add-to-20-canon-audio.spec.ts`** (P1) — pins the canon JSON
   shape end-to-end for the add-to-20 tier. A regression that ships
   an empty canon file is invisible until Marian taps Number Garden
   on add-to-20 and hears silence.

4. **`e2e/word-song-prewarm-chip-latency.spec.ts`** (P2) — empirical
   assertion of the user-facing promise of PR #162 (Word Song feels
   as snappy as Math).

5. **`e2e/leitner-state-evolution.spec.ts`** (P2) — full Leitner box
   read-write cycle. The unit pieces all pass but the integration
   path is unproven at e2e.

## Cross-references

- `feedback_jessica_first_for_objective_gates.md` — the routing rule
  that this audit operationalises.
- `testing-and-ci.md` § 8 — current e2e spec set.
- `screens-and-flows.md` § Math — testid taxonomy.
- `progress-and-persistence.md` § "Latency capture (M4 — diagnostic)"
  — band invariant source.
