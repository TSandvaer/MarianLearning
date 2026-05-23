# Wave 7 — Literacy bookend backfill + math content-depth audit

**Status:** plan — pre-dispatch
**Date drafted:** 2026-05-23
**Author:** Matt (planning role; orchestrator dispatches)
**Sponsor decision:** Track A and Track B run **in parallel** (Thomas, 2026-05-23).
**Foundation:** retro `retro-2026-05-23-wave-6-with-regroup.md` § "Next-session backlog" item 5 ("Wave 7? — open question for sponsor"); `[[feedback_track_based_wave_decomposition]]`; `[[feedback_haiku_directive_sharpening]]` (7 validated patterns).

---

## TL;DR

Wave 7 ships two parallel tracks:

- **Track A — Literacy bookend backfill.** The 4 untuned Word Song tiers (`letter-names`, `letter-sounds`, `sight-words`, `simple-sentences`) currently fall through `effectiveFocusNode` to a `blending-cv` stub. Track A makes the **bookend pair** (letter-names + letter-sounds) first-class with their own canon, planner directive, and lint binding; the **forward-looking pair** (sight-words + simple-sentences) is **queued to Wave 8**.
- **Track B — Math content depth on Marian's actual path.** The `add-to-10` directive shipped before the post-Wave-6 sharpening playbook (CATEGORY-MIX-BUDGET-first hoist, FAILURE MODES BOTH WAYS commentary, WORKED EXAMPLE block, RULE_IDENTITY+SPEC+LINT triple-pin per `[[feedback_haiku_directive_sharpening]]` Pattern 7). `sub-to-20` is already very sharp (CATEGORY-CAP SELF-CHECK with rejection examples, DISTRACTOR-COVERAGE SELF-CHECK). Track B audits add-to-10 first (Marian is HERE NOW — highest-leverage tier), then sub-to-20 as a lighter audit, then optionally add-to-20 only if cross-tier drift is found.

Both tracks dispatch in parallel at Wave-7 kickoff. The bookend pair is independent of Track B; Dave wears two hats (literacy directive author + math audit author) but the two threads do not block each other because Dave's outputs feed different downstream agents (Kevin/Devon for canon bake on Track A; Kyle for spec refresh on Track B if drift surfaces).

---

## Track A — Literacy bookend backfill

### Gap (empirically verified)

`public/canon/word-song/level-1/` ships these tiers today: `blending-cv`, `cvc-words`, `cvc-words-short-{o,u,i,e}`, `digraphs-{sh,ch,th-voiceless}`. The 4 tiers ABSENT from canon:

- `letter-names`
- `letter-sounds`
- `sight-words`
- `simple-sentences`

All 4 are in `VALID_WORD_SONG_FOCUS_NODES` (`api/_planner.ts:154-171`) but NOT in `WORD_SONG_FIRST_CLASS_FOCUS_NODES`; they fall through `effectiveFocusNode` to `blending-cv` content as stub. Confirmed by reading `api/_planner.ts:660-661` ("valid-but-untuned nodes (`letter-sounds`, `sight-words`, `simple-sentences`) fall back to `blending-cv` content as a stub").

### Wave-7 scope decision — bookend pair, not all 4

**Recommendation:** ship `letter-names` + `letter-sounds` in Wave 7; queue `sight-words` + `simple-sentences` to Wave 8.

**Rationale:**

1. **Pedagogical-readiness gradient.** Per `phonics-sequence-marian.md` §Q1 (Dave, 2026-04-26), Marian's alphabet is mastered (CLAUDE.md current-levels table) — `letter-names` is below her level (completeness win, zero blast-radius). `letter-sounds` is just at her edge (consonant sounds mastered; short-vowel sounds are mid-progression). Both are **bake-once-and-leave** tiers that the picker will rarely land on for her but must exist for graceful walk-through behaviour.
2. **`sight-words` requires curriculum design that hasn't happened yet.** Per `phonics-sequence-marian.md` §Q4, Dave recommends a 10-word core set (`the, a, I, to, and, was, for, you, is, of`). That's a content spec Kyle needs to flesh out per-tier — picture/no-picture render, prompt template, distractor strategy. Not a bake-then-ship tier.
3. **`simple-sentences` is forward-looking by months.** Decodable-sentence construction depends on `sight-words` shipping first AND CVC mastery being further along than Marian is today. Premature shipping wastes Haiku budget on canon that won't be exercised until late 2026.
4. **Wave-6 playbook discipline.** The retro § "What went well" called out "pre-staged Wave-N+1 plumbing" as the cleanest pattern. Wave 7 ships bookend canon; Wave 8 ships forward-looking canon once `sight-words` spec is authored. Splitting reduces the parallel-author conflict surface on `api/_planner.ts` (per `[[feedback_haiku_directive_sharpening]]` precedent of parallel-vowel-tier conflicts) and keeps each wave's reviewer-load bounded.

### Per-tier work — letter-names + letter-sounds (Wave 7)

Each of these is a SEPARATE ticket (track-based parallel-author decomposition per `[[feedback_track_based_wave_decomposition]]`).

#### Tier 1 — `letter-names`

| #   | Ticket                                            | Assignee | Depends on                | Notes                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------- | -------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | letter-names — content/pedagogy spec              | Kyle     | (none — fires at kickoff) | Per-letter prompt template ("Tap the letter A."), 8-problem pool composition rule (which letters per session — uppercase/lowercase mix, alphabetical vs. random, easy/hard band by letter shape), distractor strategy (visually similar letters: b/d/p/q confusion class per Marian's "minor b/d confusion" in CLAUDE.md current-level table) |
| A2  | letter-names — Haiku directive in WORD_SONG_GUIDE | Dave     | A1 spec available         | Translate Kyle's pool composition rule into `WORD_SONG_TRACK_GUIDE` block; mirror sub-to-10's RULE_IDENTITY+SPEC+LINT triple-pin shape; reference research-fit (alphabet mastered per Marian's diagnostic, so this tier is review-mode by design — pool may skew toward b/d/p/q for residual confusion class)                                 |
| A3  | letter-names — canon bake + planner wiring + lint | Kevin    | A2 directive merged       | Add literal to `WORD_SONG_FIRST_CLASS_FOCUS_NODES`, `WORD_SONG_FOCUS_NODES` (canon bake iteration), bake the canon JSON, commit. Optional: add a tier-specific compositionLint binding only if Kyle's spec rule has mechanical structure to lint (e.g., "≤2 letters per session may be from the b/d/p/q confusion class").                   |
| A4  | letter-names — failing-first E2E spec             | Jessica  | (parallel with A3)        | Spec: progression seam — a fresh user with `letter-names` as focusNode should reach the screen, hear the bake's first read, and the chip render uses the bake's letter pool (not the blending-cv stub). Pattern: canon-bytes mock per PR #283 (NOT failNetwork — per Wave 6B Test 2 defect + `[[feedback_failing_first_must_prove_green]]`). |

#### Tier 2 — `letter-sounds`

Same A1-A4 shape, mirrored for the `letter-sounds` tier:

| #   | Ticket                                              | Assignee | Depends on                | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------- | -------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| A5  | letter-sounds — content/pedagogy spec               | Kyle     | (none — fires at kickoff) | Per-sound prompt template ("What letter says /m/?" or similar — Kyle picks), 8-problem pool composition (which sounds per session — consonants Marian has mastered vs. the short-vowel ladder per `phonics-sequence-marian.md` §Q1: `a → o → u → i → e`). IPA pronunciation in TTS via the `<phoneme>` pattern documented in `audio-system.md` (see `project_audio_phoneme_overrides.md`).                                                              |
| A6  | letter-sounds — Haiku directive in WORD_SONG_GUIDE  | Dave     | A5 spec available         | Translate Kyle's spec into a `WORD_SONG_TRACK_GUIDE` block; explicitly enumerate which letters/sounds may appear (pool-membership self-check) and respect Dave's `o → u → i → e` ordering (no `/e/` and `/i/` adjacent per `phonics-sequence-marian.md` §Q1 — acoustic-similarity ban).                                                                                                                                                                 |
| A7  | letter-sounds — canon bake + planner wiring + lint  | Devon    | A6 directive merged       | Mirror A3 but for letter-sounds. Devon takes this to keep Kevin/Devon load balanced across the wave (per the Wave 5+6 retro Pattern H observation — Kevin 55% vs Devon 9%).                                                                                                                                                                                                                                                                            |
| A8  | letter-sounds — failing-first E2E spec              | Jessica  | (parallel with A7)        | Same shape as A4. Canon-bytes mock.                                                                                                                                                                                                                                                                                                                                                                                                                    |

### Track A deferrals (Wave 8)

- `sight-words` — needs Kyle spec from Dave's 10-word core set (`phonics-sequence-marian.md` §Q4) before bake. Ticket filed for Wave 8 only after Wave 7 ships, to avoid scope creep here.
- `simple-sentences` — depends on `sight-words` shipping + further CVC progress. Queued.

---

## Track B — Math content-depth audit on Marian's actual path

### Audit-first principle

Per the wave brief: "the audit asks: do these early canons honor what we now know about pedagogical band-by-slot, distractor pedagogical-fit (`[[feedback_distractor_class_pedagogical_gates_mechanical]]`), op-mix discipline?"

The audit produces evidence (file:line citations of pedagogical gaps). Re-bake fires ONLY if audit surfaces a real gap. Jessica's regression spec fires ONLY if a currently-violated invariant is found (per the wave brief explicitly: "re-bake without behavior change doesn't need a new spec").

### Pre-audit empirical observations (matt, 2026-05-23)

I read the directives at `api/_planner.ts:933-975` (add-to-10), `api/_planner.ts:976-1049` (add-to-20), and `api/_planner.ts:1080-1187` (sub-to-10 + sub-to-20). Initial impressions, for Dave to confirm/reject in the formal audit:

- **add-to-10** has FACT POOL + bands + NEGATIVE ANCHOR + category caps + sums-to-10 anchor rule + band-by-slot canonical restatement. It LACKS, vs. the sub-to-10 / add-to-20 / sub-to-20 reference standard: (a) CATEGORY-MIX BUDGET hoisted FIRST per `[[feedback_haiku_directive_sharpening]]` Pattern 3 (per-rule self-check anchored against attention-budget-shift); (b) FAILURE MODES BOTH WAYS commentary (failure surface is more abstract for sums-to-10 vs. for doubles-prior); (c) explicit WORKED EXAMPLE block; (d) RULE_IDENTITY+SPEC+LINT triple-pin per Pattern 7; (e) NO compositionLint binding (`scripts/compositionLint.ts` binds only sub-to-10 today). The add-to-20 NOF in `planner-and-canon.md` flagged that Haiku has a strong "doubles" prior under sharpened add-to-10 directive — caught by composition-lint for sub-to-10 but not for add-to-10.
- **sub-to-20** is already very sharp (CATEGORY-CAP SELF-CHECK with worked rejection examples, DISTRACTOR-COVERAGE SELF-CHECK on Class B traps, NEGATIVE ANCHOR on read-line "minus" verbatim). Likely low-ROI audit; expect Dave to find ≤1 gap.
- **add-to-20** is sharp (CATEGORY-MIX BUDGET first, FAILURE MODES BOTH WAYS, WORKED EXAMPLE). Already on the post-Wave-6 playbook.

If Dave's audit confirms these impressions, the highest-leverage Wave 7 deliverable is **a sharpening pass on add-to-10 with a new compositionLint binding** — same Wave-6 shape as the sub-to-10 work.

### Per-tier work — add-to-10 (primary), sub-to-20 (secondary), add-to-20 (conditional)

#### Tier 1 — add-to-10 audit + sharpen

| #   | Ticket                                                                 | Assignee     | Depends on                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------- | ------------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| B1  | add-to-10 — pedagogical audit vs current playbook                      | Dave         | (none — fires at kickoff)               | Compare `api/_planner.ts:933-975` directive against the 7 sharpened patterns in `[[feedback_haiku_directive_sharpening]]`. Output: file:line evidence of gaps + a concrete sharpening proposal. Cite `add-to-10-counting-to-recall.md` (Marian's actual finger-counting evidence base) and `feedback_distractor_class_pedagogical_gates_mechanical.md`. Specifically: does the existing directive honour the "Class 2 wrong-op REJECTED" + "Class 3 answer-equals-operand REJECTED" + "zero-addend WIDEN REJECTED" decisions from PR #251 and PR #254?                                                                                                                                                                                                                            |
| B2  | add-to-10 — spec refresh (CONDITIONAL on B1 finding pedagogical drift) | Kyle         | B1 audit posted                         | Skip if B1 finds no pedagogical drift requiring re-spec. If fires: refresh `design/math/add-to-10-content.md` (already exists per `ls design/math/`) — pin band-by-slot, fact-pool composition, category caps. Open-ticket-only-if-needed gate to avoid wasted cycles.                                                                                                                                                                                                                  |
| B3  | add-to-10 — directive sharpen + compositionLint binding + re-bake      | Kevin        | B1 audit posted; B2 spec if applicable  | Translate B1's gaps into the planner directive (apply Patterns 3, 5, 7 from `[[feedback_haiku_directive_sharpening]]`); extend `scripts/compositionLint.ts` with a `TierLintBinding` for add-to-10 (same shape as the sub-to-10 binding shipped in PR #245); add the 56-style unit tests under `scripts/compositionLint.test.ts`; re-bake the canon. Verify post-bake via the new lint binding.                                                                                          |
| B4  | add-to-10 — failing-first regression spec (CONDITIONAL on B1)          | Jessica      | B1 audit posted                         | SKIP if B1 finds no behaviour-changing violation (per wave brief: "re-bake without behavior change doesn't need a new spec"). If fires: write the spec BEFORE B3's re-bake so the spec is RED then GREEN. Pattern: canon-bytes mock per PR #283; NOT failNetwork (per `[[feedback_failing_first_must_prove_green]]`). Devon does cross-review of the spec to confirm it can be MADE GREEN (Wave-6 lesson).                                                                              |

#### Tier 2 — sub-to-20 audit (lighter)

| #   | Ticket                                                                       | Assignee   | Depends on                | Notes                                                                                                                                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------- | ---------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B5  | sub-to-20 — pedagogical audit (lighter pass)                                 | Dave       | (none — fires at kickoff) | Compare `api/_planner.ts:1112-1187` against the 7 patterns. My pre-audit impression: this directive is already on the post-Wave-6 playbook (CATEGORY-CAP SELF-CHECK with worked rejection examples, DISTRACTOR-COVERAGE SELF-CHECK, NEGATIVE ANCHOR on read-line). Expect Dave to find ≤1 gap — and if so, the gap is likely RULE_IDENTITY+SPEC+LINT triple-pin (the directive has cap rules but no compositionLint binding for sub-to-20 yet). |
| B6  | sub-to-20 — sharpen + lint binding (CONDITIONAL on B5)                       | Devon      | B5 audit posted           | Skip if B5 finds no gap. Devon takes this to keep load balanced. Same shape as B3.                                                                                                                                                                                                                                                                             |
| B7  | sub-to-20 — failing-first regression spec (CONDITIONAL on B5)                | Jessica    | B5 audit posted           | Skip if no behaviour-changing violation.                                                                                                                                                                                                                                                                                                                       |

#### Tier 3 — add-to-20 inter-tier drift check (conditional)

| #   | Ticket                                                            | Assignee | Depends on                    | Notes                                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------- | -------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B8  | add-to-20 — inter-tier drift check vs new add-to-10 sharpening    | Dave     | B3 or B6 audit complete       | Fires only if Dave's add-to-10 sharpening surfaces a pattern that should propagate fleet-wide (e.g. "the new CATEGORY-MIX BUDGET hoist for add-to-10 should be the standard"). Doc-only deliverable; no canon change in Wave 7. |

---

## Dependency graph

```
KICKOFF (parallel):
├── Track A:
│   ├── A1 Kyle letter-names spec ──→ A2 Dave directive ──→ A3 Kevin bake
│   │                                                       └─ A4 Jessica E2E (parallel with A3)
│   └── A5 Kyle letter-sounds spec ──→ A6 Dave directive ──→ A7 Devon bake
│                                                            └─ A8 Jessica E2E (parallel with A7)
│
└── Track B:
    ├── B1 Dave add-to-10 audit ──→ B2 Kyle spec (CONDITIONAL) ──→ B3 Kevin sharpen + lint + bake
    │                                                              └─ B4 Jessica regression spec (CONDITIONAL, parallel with B3)
    ├── B5 Dave sub-to-20 audit ──→ B6 Devon sharpen + lint (CONDITIONAL)
    │                               └─ B7 Jessica regression (CONDITIONAL)
    └── B8 Dave add-to-20 inter-tier drift check (CONDITIONAL on B3 / B6 outcomes)
```

### Parallelization map — Wave 7 kickoff

**Fire these 5 in parallel at Wave-7 kickoff** (none depend on each other):

1. **A1 — Kyle: letter-names spec**
2. **A5 — Kyle: letter-sounds spec**
3. **B1 — Dave: add-to-10 audit**
4. **B5 — Dave: sub-to-20 audit**
5. (Kevin / Devon held in reserve for the next round — they activate when A2/A6/B3/B6 brief fires)

Kyle is the bottleneck on Track A (two specs). Dave is the bottleneck on Track B (two audits + potentially A2/A6 directive author too if Kyle delegates that). If Dave's load gets crowded, Kyle can take A2/A6 directive-author handoff after specs land — the directives are bake-time content, not research-grade output.

**Second wave (fires once first round lands):**

6. A2 Dave letter-names directive (after A1 lands)
7. A6 Dave letter-sounds directive (after A5 lands)
8. B2 Kyle add-to-10 spec refresh (after B1 lands, ONLY if drift found)

**Third wave (parallel as briefs fire):**

9. A3 Kevin letter-names bake (after A2 merged)
10. A4 Jessica letter-names E2E (parallel with A3)
11. A7 Devon letter-sounds bake (after A6 merged)
12. A8 Jessica letter-sounds E2E (parallel with A7)
13. B3 Kevin add-to-10 sharpen + lint + bake (after B1 + optional B2)
14. B4 Jessica add-to-10 regression spec (parallel with B3, ONLY if behaviour-changing violation found)
15. B6 Devon sub-to-20 sharpen + lint (parallel with B3, ONLY if drift found)
16. B7 Jessica sub-to-20 regression (parallel with B6, ONLY if drift found)
17. B8 Dave add-to-20 inter-tier drift check (after B3 / B6 outcomes settle)

---

## Risk register

| #   | Risk                                                                                                                                                                                | Mitigation                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Canon-bake re-roll budget.** Each new tier bake plus the add-to-10 re-bake is ~$0.02 per attempt (per Wave-6 telemetry). If add-to-10's doubles-prior surfaces (per `planner-and-canon.md`), expect 2-3 re-rolls. | Wire compositionLint binding for add-to-10 IN THE SAME PR as the directive sharpen, so the lint catches violations pre-disk. Same shape as PR #245 sub-to-10 lint.                                                                                                                                                          |
| R2  | **Doc-elevation queue items from Wave 6 retro that may collide with Wave 7 surface.** `progress-and-persistence.md` (producer-strict/boundary-loose pattern); `planner-and-canon.md` (MATH_TRACK_GUIDE insertion-order discipline). | Track A doesn't touch these docs. Track B's add-to-10 sharpen MAY touch MATH_TRACK_GUIDE insertion-order if Dave proposes hoisting CATEGORY-MIX BUDGET earlier. Flag for the implementing agent (Kevin) to coordinate with the queued doc-elevation if active.                                                              |
| R3  | **Parallel-author conflict on `api/_planner.ts`.** Both A2 (letter-names directive) and A6 (letter-sounds directive) edit WORD_SONG_TRACK_GUIDE. B3 (add-to-10 sharpen) edits MATH_TRACK_GUIDE. Three simultaneous edits to `_planner.ts`. | A2 + A6 land sequentially within Dave's queue (Dave is single agent, naturally serializes). B3 is on the math half of the file — no conflict with A2/A6. Empirically, the Wave-3 short-o + short-e parallel surfaced the WORD_SONG specific conflict pattern documented in `skill-trees-and-content.md`; rebaser takes union of both sides. |
| R4  | **Wave 6D follow-up (Jessica failNetwork → canon-bytes mock) is unblocked but un-prioritised.** Carry-over from Wave 6 retro Next-Session item 1.                                   | Not in Wave 7 scope by sponsor direction (Track A + Track B). Recommend Wave 8 or a sidebar dispatch — surfaced here so it does not get forgotten.                                                                                                                                                                          |
| R5  | **Kyle bottleneck on Track A (two specs simultaneously).** If letter-names + letter-sounds both need substantial design work, Kyle may serialize internally.                       | Brief Kyle to prioritise letter-names FIRST (simpler — alphabet recognition is Marian's strongest skill; the spec is more "review-mode tier scaffolding" than novel design). letter-sounds is the bigger design lift (TTS phoneme handling, vowel-ladder ordering).                                                         |
| R6  | **The conditional gates on B2/B4/B6/B7 may produce a "do nothing" outcome if audits find no drift.** That's a valid Wave-7 outcome but should not be confused with "Wave 7 failed". | If both B1 + B5 audits find no drift, Wave 7 ships as Track-A-only. Document the audit outcomes in the audit ticket; close the conditional tickets explicitly with rationale. The audits themselves are valuable artifacts — they validate the existing directives against the playbook.                                  |
| R7  | **add-to-10 re-bake may surface the doubles-prior failure mode flagged in `planner-and-canon.md`** (Haiku has strong "doubles" prior; first 2 attempts violated cap, attempt 3 cleared on non-determinism alone). | The compositionLint binding (B3) catches this pre-disk; Kevin iterates until clean. Per `planner-and-canon.md`: "Future directive iteration should apply pattern #3 — either hoist the doubles cap earlier in the directive, or add a 'you have N doubles already' inline self-check at fact-selection time." This is the Wave 7 sharpening lever. |
| R8  | **MCP ClickUp auth expiry mid-wave (per Wave 6 retro).** Tickets queued for status flips can stall.                                                                                | Out of Matt's hands; orchestrator handles re-auth when it surfaces. Plan does not depend on mid-wave ticket-flip latency for correctness. |

---

## Open questions for sponsor

None blocking. Recommendations made above; awaiting orchestrator dispatch.

The only judgment call worth surfacing: **Track A bookend-pair-only (Wave 7) vs. all-4-literacy-tiers (Wave 7 + Wave 8 collapsed)**. Recommendation is bookend-pair-only based on pedagogical-readiness gradient (`sight-words` needs Kyle spec from 10-word core set first; `simple-sentences` is months away from Marian hitting it). If Thomas prefers to ship all 4 in Wave 7, the plan extends naturally — add 8 more tickets in the same shape, accept the higher parallel-edit conflict surface on `api/_planner.ts` and the longer cycle.

---

## Cross-references

- `[[feedback_track_based_wave_decomposition]]` — Matt's wave plans carry `assignee_recommendation` per track
- `[[feedback_haiku_directive_sharpening]]` — 7 patterns the audit checks against
- `[[feedback_distractor_class_pedagogical_gates_mechanical]]` — pedagogical fit gates mechanical fit
- `[[feedback_failing_first_must_prove_green]]` — failing-first specs must prove they can be MADE GREEN
- `[[feedback_always_parallel_dispatch]]` — 3-5 in flight default
- `[[feedback_clickup_in_progress_classifier_denial]]` — leave tickets at TO DO; orchestrator flips IN REVIEW when PRs open
- `.claude/retros/retro-2026-05-23-wave-6-with-regroup.md` — wave shape precedent
- `.claude/docs/sibling-tier-checklist.md` — the 15-place widening checklist for Track A bakes (letter-names + letter-sounds add new first-class tiers; checklist applies)
- `.claude/docs/planner-and-canon.md` § "Haiku has a strong 'doubles' prior under sharpened add-to-10 directive" — the exact failure mode B3 is sharpening for
- `design/research/add-to-10-counting-to-recall.md` — Marian's finger-counting evidence base; informs B1 audit
- `design/research/phonics-sequence-marian.md` — alphabet + sounds + sight-word source of truth; informs A1/A5
