# Skill Trees & Content

What this doc covers: the two skill trees (Number Garden = math, Word Song = literacy), the per-screen content data — math distractors and session plans, word packs, word distractors, word session plans — the server-plan adapters that translate `/api/claude` responses into the per-screen nested shape, the picture-pack pipeline, the Hub stage taxonomy and sliding-window helper, and the locked spec-drift decisions that govern thresholds and pool composition. Source of truth lives under [`MarianLearning/src/screens/Math/`](MarianLearning/src/screens/Math/) and [`MarianLearning/src/screens/WordSong/`](MarianLearning/src/screens/WordSong/), with the curriculum graph itself in [`MarianLearning/src/lib/progress/`](MarianLearning/src/lib/progress/).

## Two skill trees

Both trees are declared in three places, locked against each other by tests:

- Type unions in [`src/lib/progress/types.ts`](MarianLearning/src/lib/progress/types.ts).
- Promotion-order constants `MATH_TREE` / `LITERACY_TREE` in [`src/lib/progress/mastery.ts`](MarianLearning/src/lib/progress/mastery.ts).
- Picker-order constants `MATH_NODES_IN_ORDER` / `WORD_SONG_NODES_IN_ORDER` in [`src/lib/progress/focusNode.ts`](MarianLearning/src/lib/progress/focusNode.ts).
- Hub display lists `NUMBER_GARDEN_STAGES` / `WORD_SONG_STAGES` in [`src/screens/Hub/stages.ts`](MarianLearning/src/screens/Hub/stages.ts).

The Hub stage IDs are NOT identical to the `SkillNode` strings — they were authored slightly earlier with display-friendly aliases. See "Hub stage taxonomy" below for the cross-walk.

### Number Garden (math)

Promotion order, root-to-leaf:

```
number-recog → add-to-10 → add-to-20 → sub-to-10 → sub-to-20 →
two-digit-addsub → skip-counting → mult-2-5-10 → mult-3-4 → mult-6-9
```

Source: [`types.ts:15`](MarianLearning/src/lib/progress/types.ts#L15) `NumberGardenNode` union, [`mastery.ts:100`](MarianLearning/src/lib/progress/mastery.ts#L100) `MATH_TREE`, [`focusNode.ts:45`](MarianLearning/src/lib/progress/focusNode.ts#L45) `MATH_NODES_IN_ORDER`. Mirrors `CLAUDE.md` `## Two skill trees` exactly.

### Word Song (literacy)

Promotion order:

```
letter-names → letter-sounds → blending-cv → cvc-words →
cvc-words-short-o → digraphs → sight-words → simple-sentences
```

Source: [`types.ts:30`](MarianLearning/src/lib/progress/types.ts#L30) `WordSongNode`, [`mastery.ts:121`](MarianLearning/src/lib/progress/mastery.ts#L121) `LITERACY_TREE`, [`focusNode.ts:66`](MarianLearning/src/lib/progress/focusNode.ts#L66) `WORD_SONG_NODES_IN_ORDER`.

**Canon-wire PRs must widen `LITERACY_TREE` and `WORD_SONG_NODES_IN_ORDER` in the same commit.** These constants live in separate files (`mastery.ts` and `focusNode.ts`) and are locked against each other by a regression in `mastery.test.ts`. If they diverge across two PRs, the mastery engine and the picker walk inconsistent trees between deploys — promotion can land on a node the picker doesn't yet know about. The `mastery.test.ts` lock catches drift at CI time but only after the inconsistency has already shipped. **Rule:** any PR that adds a new `WordSongNode` must update both constants in the same commit, following the same "move together" discipline as the `SkillNode`-widening sync points in `progress-and-persistence.md`.

`cvc-words` is the implicit short-a CVC node. Subsequent vowels add **sibling nodes** between `cvc-words` and `digraphs` — `cvc-words-short-o` lands first; future `cvc-words-short-u`, `cvc-words-short-i`, `cvc-words-short-e` follow. The naming is asymmetric (implicit short-a vs explicit short-o) and that's deliberate: a sibling-node approach added zero migration burden over Marian's existing localStorage `cvc-words` entry, while a rename + migration shim was a new failure surface for no pedagogical benefit. See [`design/word-song/short-o-pool-expansion.md`](MarianLearning/design/word-song/short-o-pool-expansion.md) §2 (Q3 locked 2026-05-04 with Thomas).

Untuned tier coverage today: only the bare `digraphs` generic parent node (and any genuinely-unbuilt node) produces a stub plan — the planner falls back to blending-cv content with a non-error log. **`letter-sounds`, `sight-words`, and `simple-sentences` are all first-class now** (in `WORD_SONG_FIRST_CLASS_FOCUS_NODES`, `api/_planner.ts:761`); the older framing that listed them as stubs is stale as of 2026-06-13 (sight-words shipped Wave 11; simple-sentences shipped Wave 13 PR #423). The stub fallback is what makes it safe to surface a still-unbuilt node from the picker in v1.

**Digraph tier status (updated 2026-06-11):** all three first-class digraph tiers are **fully shipped** — own word pool, planner directive in `WORD_SONG_TRACK_GUIDE`, committed canon JSON, wordPack render, e2e content spec, lint/regression:

| Tier                    | Word-pack PR | Planner/canon PR | Re-voiced |
| ----------------------- | ------------ | ---------------- | --------- |
| `digraphs-sh`           | #220         | #223             | #356      |
| `digraphs-ch`           | #226         | #227             | #356      |
| `digraphs-th-voiceless` | #230         | #230             | #356      |

The parent node `digraphs` remains the generic stub; the specific siblings carry the real content, mirroring how `cvc-words` preceded `cvc-words-short-o`/`-short-u`/etc. Ground-truth audit: `design/wave-11-plan.md` (PR #376).

**Stale-framing hazard:** an earlier version of this paragraph called `digraphs-ch`/`digraphs-th-voiceless` "expected future" tiers; that framing propagated into the Wave 10 retro defer-list and nearly caused Wave 11 to file build-tickets for already-merged work. Before treating any tier as unbuilt, verify on-disk: `git ls-files public/canon/word-song/level-1/`. As of 2026-06-13 **every leaf Word Song tier is first-class** — sight-words shipped Wave 11, simple-sentences shipped Wave 13 (PR #423). Only the bare `digraphs` generic parent node remains a stub-fallback node. The skill tree's literacy line is now fully built end-to-end.

**Cross-tier review — spec vs implementation.** The digraphs-sh word-list spec describes a "2–3 new + 5–6 review" session model where a session draws mostly from the current tier but also reviews prior-tier words. This has **no planner implementation** as of 2026-05-14 — every word-song tier emits 8 problems exclusively from its own pool. Cross-tier review is design intent, not shipped behaviour; treat spec prose about it as aspirational, and any PR claiming to implement it must add a round-trip test pinning cross-tier word distribution.

## Math content

The Math screen renders 8-problem sums-to-10 sessions. Per-problem render time at the screen consumes:

- The plan (server-generated via `/api/claude` or fallback to a static rotation).
- A pair of distractors generated at render time via `pickDistractors(correct, problemIndex)`.

Distractor values are NOT in the plan. This was Kyle's spec call — a single source of truth for the gentle/off-by-one rule lives in `distractors.ts`, not duplicated across plans.

### Math distractors

[`src/screens/Math/distractors.ts`](MarianLearning/src/screens/Math/distractors.ts). Pure functions, no DOM/React/audio.

Two tiers:

| Tier       | Problems | Rule                                                                                                                                                     |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gentle`   | 1–3      | Distractors are at least 2 away from the correct answer, biased toward `[1, 10]` extremes.                                                               |
| `offByOne` | 4–8      | Distractors are `correct - 1` and `correct + 1`, clamped into `[1, 10]` by substituting the next-nearest in-range non-correct number when one falls out. |

Tier cutoff: `GENTLE_RAMP_THROUGH = 3` ([`distractors.ts:49`](MarianLearning/src/screens/Math/distractors.ts#L49)). Single-source-of-truth constant — if Dave revisits, change one number.

History: Kyle's spec originally sat the gentle/offByOne switch between problem 2 and problem 3. Dave's developmental consult on ticket 86c9grn9c recommended extending the gentle ramp by one item (anxiety-window literature + Siegler's overlapping-waves model). Switch now sits between problems 3 and 4. Decision is in `design/research/math-distractor-and-streak-decisions.md`.

Constraints (must hold for both tiers):

1. Distractors live in `[1, 10]` — the problem space for sums to 10.
2. The two distractors are distinct from each other and from `correct`.
3. Output is a tuple `[d1, d2]`. Position randomisation across the 3 chips lives in `AnswerChips` — `pickDistractors` is deterministic so tests don't have to seed RNG.

`pickDistractors(correct, problemIndex)` throws if `correct` is outside the valid range — the session-plan generator should never emit one, and silently coercing would hide a real bug.

`pickTier(problemIndex)` is the public predicate ([`distractors.ts:58`](MarianLearning/src/screens/Math/distractors.ts#L58)). Out-of-range upper values fall through to `'offByOne'` (the safe default beyond warm-up).

Worked examples (off-by-one):

- `correct=2 → [1, 3]`
- `correct=5 → [4, 6]`
- `correct=10 → [9, 8]` (`correct+1=11` is OOR → substitute `8 = correct-2`)
- `correct=1 → [2, 3]` (`correct-1=0` is OOR → substitute `3 = correct+2`)

### Distractor class design — pedagogical fit gates mechanical fit

This principle governs decisions about ADDING new distractor classes to the pool (not the runtime distractor tiers in `distractors.ts` above — that's the per-problem rule). When Dave proposes a new class, or Kyle/Devon audits whether to adopt one, **open with developmental-psychology fit**: does the class target a real 7-9-year-old error pattern documented in the literature or in Marian's diagnostic? **Only then** verify mechanical fit (range coverage, pool sufficiency, doesn't collide with existing classes).

A mechanically-sufficient class without pedagogical justification is the wrong class. Adding it pollutes the pool with "near-correct lookalikes" that don't model what Marian actually gets wrong in practice.

**Validated across 3 add-to-10 precedents this session arc (2026-05-16):**

- **Class 2 wrong-op REJECTED for add-to-10** (PR #251 §3.2). Range-fitness was empirically 45.5% (mechanically sufficient — comparable to sub-to-10's adoption rate). REJECTED because addition-direction confusion isn't a documented 7-9yo error pattern. The same Class 2 is ACCEPTED for sub-to-10 (where direction confusion IS documented as a stable error mode).
- **Class 3 answer-equals-operand REJECTED for add-to-10** (PR #254 audit). Mechanically sufficient. REJECTED because adopting it would model "I forgot to add" as a stable mistake, which isn't observed; the actual stable mistake is operation-misreading (already covered by Class 1).
- **Zero-addend WIDEN REJECTED** (PR #254 audit). Mechanically sufficient — would have widened the pool by 5 facts. REJECTED because zero-addend recognition is operationally trivial for ages 7-9 (developmental psychology consensus); adopting would be "harder questions that don't model real confusions".

The rule is asymmetric: pedagogical fit can VETO a mechanically-sufficient proposal; mechanical fit alone cannot ratify a pedagogically-weak proposal. Always order the audit pedagogical-first.

Canonical memory: `feedback_distractor_class_pedagogical_gates_mechanical.md`.

### Speed-feedback UX — locked ruling (source file provenance)

**The ruling.** Across all math tiers (`add-to-10`, `sub-to-10`, `sub-to-20`, `add-to-20`, and future tiers), speed-feedback UI is **locked off**:

- No streak-fade-on-slow, no timer, no orange/yellow speed chip, no haptic on slow response.
- The `slowFacts` planner directive is a **backend re-targeting tool only** — it tells Haiku to surface slow facts for extra practice, but it carries no screen-side UI signal.
- Latency is not a promotion gate; mastery criteria index on correctness, not speed.
- Emma reacts to correctness only. A slow-but-correct answer gets the same celebration as a fast one.

This ruling is consistent across all citing specs: `design/math/sub-to-10-content.md` (lines 6, 21, 40, 373, 674), `design/math/sub-to-20-content.md` (lines 24, 47, 679), `design/math/add-to-20-content.md` (line 25), `design/research/sub-to-10-fact-sequencing-marian.md` (line 70), and `design/research/sub-to-20-pedagogical-sequence.md` (line 206). It is implemented — do not interpret the provenance note below as licence to revisit the decision.

**Provenance.** All five specs cite `design/research/speed-feedback-automaticity-marian.md` as the locked authority. The original file (Dave, 2026-05-15) was never committed to git — `git log --all -- design/research/speed-feedback-automaticity-marian.md` was empty as of 2026-06-11. The ruling itself is real and was always reconstructable from cross-cites: `design/math/sub-to-10-content.md:21,40` state it directly; `design/research/sub-to-10-fact-sequencing-marian.md:163` records the op-specific slow-fact threshold calibration (≥5 s for `+`, start ≥7 s for `-`). The on-disk `design/research/speed-feedback-automaticity-marian.md` (committed 2026-06-11, branch `chore/rd-research-chain-fixes`) is a **reconstruction** — it reproduces the locked ruling faithfully and is explicitly headed as such, but the original evidence chain was lost because the file was never committed when the ruling was first authored.

**Authoring rule going forward.** When a Dave research file is the sole locked authority for a UX ruling, it must be committed to git **before or with** the spec that cites it. An untracked research file is an unverifiable citation — downstream agents dispatched against tickets that cite it cannot read the evidence chain, and the ruling can appear to have no basis on a fresh checkout. The dispatch template's "Pedagogy gate" block (added 2026-06-11) enforces this for content-tier dispatches.

### Wave-3 distractor helpers — planned, not yet shipped (as of 2026-05-22)

`phantomBorrowDistractor` does NOT yet exist in [`distractors.ts`](MarianLearning/src/screens/Math/distractors.ts). It is a **planned** Wave-3 helper for the two-digit-addsub tier — referenced in design docs and ticket briefs, but the function body has not been written. Any dispatch brief that references a line number inside `distractors.ts` for this helper is pointing at a future planned location, not the current file.

**What IS near `distractors.ts` line ~226 (approximate, verify before use):** the `gentleDistractors` function's `op === '-'` default (`minAnswer = 0`), which is load-bearing for sub-to-10 subtract-self facts (`correct = 0`) and is intentionally untouched by Wave-3 work.

**Chip-floor alignment is a caller-site concern, not a helper-site concern.** When a Wave-3 tier needs a different `minAnswer` floor (e.g. `1` instead of `0` to suppress phantom-borrow distractors), the override is passed as `opts.minAnswer` at the `pickDistractors(...)` call site in `buildChipOrder` inside [`Math.tsx`](MarianLearning/src/screens/Math/Math.tsx) — NOT inside `distractors.ts` itself. `distractors.ts` is tier-agnostic; it accepts `minAnswer` as a parameter.

**`phantomBorrowTrap` in `compositionLint.ts` is NOT exported.** It is a lint-internal helper (~`compositionLint.ts:2548`). Dispatch briefs that reference cross-linking to it from distractor tests must use a hardcoded pin constant (e.g. `PHANTOM_BORROW_LINT_FLOOR_PIN = 1` — see Devon PR #297) with a comment pointing to the compositionLint line — not a live import. Render-side `minAnswer` passed from `Math.tsx` and the lint-side `< 1` guard literal MUST be kept in sync; PR #297's pin-tests are the tripwire.

**Wrong-framing risk (Devon NOF, PR #297, 2026-05-22).** A dispatch brief that says "align the chip floor at `distractors.ts:226`" is wrong on two counts: (a) `phantomBorrowDistractor` does not exist there or anywhere yet; (b) floor alignment belongs at the `Math.tsx` call site. If a future brief makes this framing mistake, the agent should correct it inline and proceed with the caller-site fix.

### Canon-file-name vs SkillNode-literal — dual identifier surface (post PR #308, 2026-05-22)

After the PR #308 SkillNode split, the literal `'two-digit-addsub'` survives in **three places** purely as a **canon-file-name tier identifier** — it maps to the disk file `public/canon/math/level-1/two-digit-addsub.json` and is NOT the runtime `NumberGardenNode` union literal anymore. The three surviving sites:

- [`scripts/compositionLint.ts`](MarianLearning/scripts/compositionLint.ts) — tier binding keyed on the canon file name.
- [`scripts/generateSessionCanon.ts`](MarianLearning/scripts/generateSessionCanon.ts) — bake iteration list (`activeCombos()`).
- [`api/_planner.test.ts`](MarianLearning/api/_planner.test.ts) — routing-table sweep.

Meanwhile the runtime `NumberGardenNode` union (post-#308) is `'two-digit-addsub-no-regroup' | 'two-digit-addsub-with-regroup'`. The canon file kept its legacy disk-naming as a deliberate split-PR boundary: PR #308 ships the SkillNode infrastructure split + read-path K2 remap (see [`progress-and-persistence.md`](progress-and-persistence.md) § "Read-path remap migrations"); Wave 5 PR B (ticket `86c9y0xda`) ships the canon rebake + binding activation that flips the disk-naming to the new sibling identifiers.

**Trap.** A naive find-and-replace of `'two-digit-addsub'` across the codebase will break the canon-lint surface and the bake loop while leaving the planner routing table inconsistent. Until Wave 5 PR B lands the dual-identifier surface is intentional. **Detection rule for reviewers:** any PR claiming to "rename two-digit-addsub" must touch BOTH (a) the SkillNode union side AND (b) the canon-file-name side in lockstep, OR explicitly call out which side it is renaming and leave the other side alone. The two are independently editable but semantically coupled.

### Math session plans (fallback rotation)

[`src/screens/Math/sessionPlans.ts`](MarianLearning/src/screens/Math/sessionPlans.ts). Three deterministic fallback plans the screen can render end-to-end without any network dependency. When real Claude prompt wiring lands, `pickStaticSessionPlan()` is replaced (or wrapped) with a fetch — the `MathSessionPlan` shape is the contract that survives the swap.

`STATIC_SESSION_PLANS`:

| Plan           | Label                    | Notes                                                           |
| -------------- | ------------------------ | --------------------------------------------------------------- |
| `sums-to-10-A` | bridge-through-5 warm-up | Opens with 3+2, 1+4, 4+2; trap window includes doubles and 5+5. |
| `sums-to-10-B` | small-number warm-up     | Opens with 1+2, 2+3, 4+1.                                       |
| `sums-to-10-C` | doubles & near-doubles   | Opens with 2+2, 3+3, 1+5.                                       |

Each plan covers Marian's documented ceiling: sums to 10 with addends ≥ 1 and answer ≤ 10. Per the diagnostic, plans favour facts that bridge through 5 and the easy doubles over rote 1+N strings. Easier "bridge through 5" facts go in the gentle window (problems 1–3); trickier doubles and near-doubles land in the off-by-one window (4–8).

`pickStaticSessionPlan(now)` rotates by `Math.floor(now().getTime() / 60_000) % STATIC_SESSION_PLANS.length` so two consecutive sessions don't see the exact same problem order. Tests pass `now` to pin the choice.

### Math plan shape and wire adapter

[`MathSessionPlan`](MarianLearning/src/screens/Math/sessionPlans.ts) (defined at [`sessionPlans.ts:159`](MarianLearning/src/screens/Math/sessionPlans.ts#L159)):

```ts
interface MathProblem {
  index: number // 1..8
  addendA: number
  addendB: number
  correct: number // = addendA + addendB
  utterances: MathProblemUtterances
}

interface MathProblemUtterances {
  read: string // "Three plus two. How many?"
  correct: string // "Yes! Five!"
  reprompt: string // "Hmm... try again?"
  hint: string // "Look. Three. And two more. How many now?"
  giveAnswer: string // "This one is five." (after 3 wrongs)
}
```

The on-the-wire shape that `/api/claude` (kind=`session-start`) consumes and returns is FLAT — `plan.utterances: { id, text }[]`. The browser-side nested shape carries `utterances.{slot}` per problem because every consumer in `Math.tsx` reads utterance lines by slot name inside the gesture-driven state machine.

Two adapters bridge the two shapes:

- `mathSessionPlanToUtteranceSources(plan)` → flat `{id, text}[]` for the request payload, problem-major slot order.
- `mathSessionPlanFromWire(skeleton, utterances)` → rehydrate by id (every problem × slot must match `math.p<N>.<slot>`).

Utterance ID template: `math.p{N}.{slot}` (canonical, per `design/screen-3-math.md` §"Audio integration contract"). Builder helper: `mathUtteranceId(problemIndex, slot)`. Slots in canonical render order: `read | correct | reprompt | hint | giveAnswer`.

### Math `planFromServer`

[`src/screens/Math/planFromServer.ts`](MarianLearning/src/screens/Math/planFromServer.ts). Adapter from server canonical plan to client session shape, used after the track-based switchover (ticket 86c9jteud).

Parse strategy: the Haiku prompt (`api/_planner.ts:MATH_TRACK_GUIDE`) constrains the `read` line to the template `"<addend-A> plus <addend-B>. How many?"` where each addend is a number word in 1..10. `parseReadAddends(read)` uses a case-insensitive regex anchored to that template and a `NUMBER_WORDS` lookup for `one`..`ten`. Throws `PlanFromServerError` on any drift.

The model's per-utterance text content is NOT validated beyond `read` parsing — the strings flow through to captions verbatim, but we don't try to validate "yes! five!" against `addendA + addendB`. Captions and computed `correct` come from the same upstream model; mismatch is a soft issue (Marian sees the picked sum on screen and hears Emma's voice). The hard invariant is structural: 8 problems × 5 slots, every utterance id matches `math.p<N>.<slot>`.

**Out-of-namespace ids (skip-not-throw):** server responses can carry utterances whose ids fall outside `math.p<N>.<slot>` — e.g. the `session.end.*` family added in 86c9kj2u6. Those are loaded into the singleton howl-map for cross-screen consumption (SessionEnd reads them via `playSessionUtterance`) but don't belong in the nested per-problem plan. The parser SKIPS such ids rather than throwing; additive emissions upstream don't cascade into a silent-fallback regression.

## Word Song content

The Word Song screen renders 8-problem CVC sessions. The current first-class content modes are `blending-cv` ("Tap the <word>." with picture chips) and `cvc-word` ("Read the <word>." with picture chips, drawn from the cvc-words short-a or cvc-words-short-o pool depending on focus).

### Word pack (canonical short-a + short-o pools)

[`src/screens/WordSong/wordPack.ts`](MarianLearning/src/screens/WordSong/wordPack.ts). Static content layer — the word→picture map, the per-target distractor pairings, and the forbidden-pair list. Pure data, no logic.

`WordEntry` shape ([`wordPack.ts:34`](MarianLearning/src/screens/WordSong/wordPack.ts#L34)):

```ts
interface WordEntry {
  word: string // lowercase, no punctuation
  pictureKey: string // resolves to picture-{key}.svg or inline placeholder
  vowel?: 'a' | 'o' | 'u' | 'i' | 'e' // OPTIONAL — CVC tiers + the digraphs-ch tier set it; digraphs-sh omits it
  phoneme?: string // digraphs-sh sets this; digraphs-ch sets neither-or-`vowel` (see note)
  category: WordCategory
  isTarget: boolean // distractor-only entries (bus, sun, ...) are false
}
```

**`vowel` is optional repo-wide as of the digraphs-sh tier (PR #220) — but digraph tiers are NOT uniform.** CVC tiers classify by short-vowel grapheme and always set `vowel`. The **digraphs-sh** tier is phoneme-classified: it sets `phoneme` and leaves `vowel` undefined. The **digraphs-ch** tier (PR #227) breaks that symmetry — its 7 words are all short-vowel CVC/CVCC (`chin/chip/chop/chat/chest/chug/chick`), so the spec mandates they **set `vowel`** (and no `phoneme`). Do not assume "digraph tier ⇒ `vowel` undefined".

**Consumer invariant:** any code reading `entry.vowel` for pool-filtering must tolerate `undefined`. Prefer strict-equality branches (`entry.vowel === 'o'`) over falsy guards (`!entry.vowel` conflates `undefined` with `''`).

**The `vowel !== undefined` digraph-exclusion proxy is dead — in MULTIPLE `wordDistractors.test.ts` tests.** Several tests there _used_ `entry.vowel !== undefined` to exclude digraph-tier words — relying on the coincidence that sh entries omit `vowel`. digraph tiers that **set** `vowel` (ch, th) defeat the proxy and false-fail those tests. Two distinct test families are affected:

- **The cross-vowel exhaustiveness scan** — ch entries carry a/o/u (in `CVC_CROSS_VOWEL_VOWELS`); PR #227 replaced the proxy here with an explicit digraph-tier exclusion Set.
- **The generic CVC gentle/trap axis tests** — these assert every distractor shares a starting-char / ending-char / vowel / category axis with its target. digraph-tier neighbours used as traps (e.g. `bath`→`thin`) share the digraph grapheme / phoneme but _no_ CVC-style axis, so they false-fail. **ch survived these only by luck** — every ch word starts `c`, a shared-onset axis; th has no such coincidence and hit it head-on (PR #232 scoped these tests with the exclusion Set too).

**Any future digraph tier that sets `vowel` must be added to the digraph-tier exclusion Set used by ALL of these tests** (the Set was introduced per-test by PR #227 and is being consolidated into one shared `ALL_DIGRAPH_TIER_WORDS` set in the th wave — confirm the final name against merged `wordDistractors.test.ts`). Its content PR will also need to extend the count-based/exact-match assertions in `wordDistractors.test.ts` and `wordPictures.test.tsx` (`DISTRACTOR_ONLY_WORDS` exact list, `FORBIDDEN_PAIRS` exact list, `PENDING_PICTURE_PACK` fallback-count).

Three exported lists in [`wordPack.ts`](MarianLearning/src/screens/WordSong/wordPack.ts):

| Constant                | Members                                                  | Purpose                                                                           |
| ----------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `TARGET_WORDS`          | 14 short-a + 4 novel-pool probe + 8 short-o = 26 entries | Words that can appear as the correct answer.                                      |
| `DISTRACTOR_ONLY_WORDS` | `bus, sun, cup, pen`                                     | Pictures that only appear as distractors (different vowel, recognisable picture). |
| `ALL_WORDS`             | concat of the two                                        | Full pool for distractor picking.                                                 |

#### Short-a CVC pool (14 canonical targets)

`cat, hat, bat, mat, bag, fan, man, pan, cap, can, tag, dad, jam, van` — all CVC short-a, in Marian's likely vocabulary. Per `design/word-song-picture-pack.md` §"Per-word picture briefs". Spec drift decision K (locked): keep `bat` and `dad` despite developmental concerns — see `project_spec_drift_decisions` auto-memory.

#### Short-a novel-pool probes (4 entries, ticket 86c9m3aec)

`nap, rat, map, tap`. These are NOT part of the canonical 14-word pack. They are emitted ONLY by the planner on a graduation-session run (`isGraduationSession=true`); the `STATIC_WORD_SONG_PLANS` rotation doesn't pick from them. The mastery engine reads novel-pool accuracy as a second gate on cvc-words promotion (`NOVEL_POOL_THRESHOLD = 0.80`, see [progress-and-persistence.md](progress-and-persistence.md)).

Picture chips fall back to silhouette placeholders rendered by `wordPictures.tsx` — real illustrations are blocked on a separate Kyle ticket (probe-word picture pack). Silhouettes are visually distinct from the canonical pack via a forbidden-pair audit.

#### Short-o CVC pool (8 entries, ticket 86c9m3ae3)

Per [`design/word-song/short-o-pool-expansion.md`](MarianLearning/design/word-song/short-o-pool-expansion.md) §1, with Thomas's 2026-05-04 lock:

| #   | Word  | Picture status                                   | Notes                                                                                              |
| --- | ----- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 1   | `dog` | Real `pic-dog.svg` ships (only real asset today) | Promoted from distractor → target.                                                                 |
| 2   | `mop` | Silhouette placeholder                           | Wholly new entry.                                                                                  |
| 3   | `log` | Silhouette placeholder                           | Promoted from distractor.                                                                          |
| 4   | `pot` | Silhouette placeholder                           | Promoted from distractor.                                                                          |
| 5   | `box` | Silhouette placeholder                           | Wholly new; first-time `x = /ks/` introduction (Emma scaffolds: _"Box. The x sounds like /ks/."_). |
| 6   | `fox` | Silhouette placeholder                           | Promoted from distractor.                                                                          |
| 7   | `mom` | Silhouette placeholder                           | Wholly new; gender-balances `dad` from short-a pack.                                               |
| 8   | `hot` | Silhouette placeholder                           | Wholly new; depicted as steaming bowl.                                                             |

Decoding-load note: `box` and `fox` decode the `x` as `/ks/` (a two-phoneme grapheme). Strictly, these are not pure C-V-C; they are C-V-CC. They are universally listed as short-o CVC words in practitioner phonics curricula because the spelling pattern is three letters. Decision (locked 2026-05-04): keep both, Emma scaffolds on first encounter.

The 4 promoted entries (`dog, log, pot, fox`) used to live in `DISTRACTOR_ONLY_WORDS`. They now appear in `TARGET_WORDS` with `isTarget: true` but **retain their distractor pictures and continue to resolve as distractors** in v1 short-a `TARGET_PAIRINGS` rows — `getWordEntry()` reads whichever array carries them. The "DISTRACTOR_ONLY" label still holds in spirit because these 4 pictures cannot serve as the right answer in a short-a session (`WORD_SONG_TARGET_WORDS_FOR_PROMPT` doesn't list them) and the planner's pool-by-focus-node split keeps short-a + short-o sessions from cross-pollinating.

### `FORBIDDEN_PAIRS`

[`wordPack.ts:357`](MarianLearning/src/screens/WordSong/wordPack.ts#L357). Words whose pictures share a primary silhouette at 96pt and therefore must not appear in the same trio. Per `design/word-song-picture-pack.md` §"Distractor pairing matrix" hand-off note. Stored as an unordered-pair set.

| Pair        | Why                                                                                   |
| ----------- | ------------------------------------------------------------------------------------- |
| `cat ↔ dog` | Both four-legged animals in side profile.                                             |
| `bus ↔ van` | Both vehicles in side view.                                                           |
| `pan ↔ pot` | Both cooking vessels in three-quarter view.                                           |
| `cap ↔ hat` | Both head-coverings, similar mass at 96pt.                                            |
| `man ↔ dad` | Both human figures.                                                                   |
| `mom ↔ dad` | Both parent-with-child compositions; differ on hair/outfit (added with short-o pool). |

`isForbiddenPair(a, b)` matches in either direction.

**Authoring-time self-check — FORBIDDEN_PAIRS applies to the spec, not just the runtime.** `wordDistractors.ts` enforces `assertNotForbidden` at render time, but the failure mode surfaces silently during spec authoring: a distractor matrix row can list a FORBIDDEN_PAIR as a trap distractor (e.g. `moth`'s spec matrix listed `['thin', 'thick']` as a trap pair — itself a FORBIDDEN_PAIR). The runtime catch never fires because the shipped `wordPack.ts` used the correct pairing (`['thin', 'math']`), but the spec was wrong for the duration between authoring and review. **Checklist item:** when authoring or reviewing a `TARGET_PAIRINGS` distractor pair in a `design/word-song/<tier>-word-list.md` spec, run `isForbiddenPair(d1, d2)` mentally against the current `FORBIDDEN_PAIRS` table before committing the pair to the spec. Do not assume the runtime gate is sufficient — spec errors propagate into review and post-ship cleanup work (the digraphs-th `moth` defect cost a follow-up PR #234).

### `TARGET_PAIRINGS` matrix

[`wordPack.ts:393`](MarianLearning/src/screens/WordSong/wordPack.ts#L393). Per-target gentle + trap distractor pairs, hand-curated by Kyle. Source of truth: `design/word-song-picture-pack.md` §"Distractor pairing matrix (master table)". Storing as a typed map gives `wordDistractors.ts` a deterministic lookup — no runtime computation, no random shuffles.

```ts
interface TargetPairings {
  gentle: readonly [string, string] // problems 1–3
  trap: readonly [string, string] // problems 4–8
}
```

Coverage today: 14 short-a canonical + 4 novel-pool probe + 8 short-o = 26 rows.

**Same-vowel-only rule for short-o** (per [`short-o-pool-expansion.md`](MarianLearning/design/word-song/short-o-pool-expansion.md) §8): every distractor for a short-o target is drawn from the short-o pool itself (`dog, mop, log, pot, box, fox, mom, hot`). No cross-vowel mixing in v1 — that's a separate downstream design (Dave §6 P2). Trap-tier pairs lean on `/ɒ/` rhyme or alliteration with the target where one exists; gentle-tier pairs are visually / categorically distinct.

### Word distractors

[`src/screens/WordSong/wordDistractors.ts`](MarianLearning/src/screens/WordSong/wordDistractors.ts). Thin functional layer that consumes `TARGET_PAIRINGS` + the constraint set to emit the trio for a problem.

Two tiers:

| Tier     | Problems | Rule                                                                                                                                                                  |
| -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gentle` | 1–3      | Distractors are clearly different from target — different category, different starting consonant, different vowel sound. Three banked wins to open the session.       |
| `trap`   | 4–8      | Distractors share at least one axis with the target (rhyme, alliteration, same vowel, same ending). Forces the whole-word read instead of first-letter pattern-match. |

Cutoff: `GENTLE_RAMP_THROUGH = 3` ([`wordDistractors.ts:65`](MarianLearning/src/screens/WordSong/wordDistractors.ts#L65)) — locked, mirrors Math's `GENTLE_RAMP_THROUGH = 3`. Per Kyle's spec line 184: "Do not parameterise."

`pickDistractors(target, problemIndex)` reads the per-tier pair from the matrix, looks up entries via `getWordEntry`, and runs the defensive `assertNotForbidden` checks (target↔d1, target↔d2, d1↔d2). Throws on:

- Missing matrix entry for `target.word` (every `TARGET_WORDS` row must have a `TARGET_PAIRINGS` row).
- Forbidden-pair violation (matrix drift; should never happen since the matrix is curated).
- Distinctness violation (d1 == target, d2 == target, or d1 == d2).

**Cross-vowel mode is NOT yet built.** Filed in ClickUp `86c9m3aek`. The current behaviour is same-vowel-only on the short-o pool, and short-a sessions never see short-o words leak into them (planner-side guarantee — see `WORD_SONG_TRACK_GUIDE` in `api/_planner.ts`). Per the persona-owner header, the design spec must precede impl.

#### `DISTRACTOR_ONLY_WORDS` is empty post-#208 — forward-compat export pattern

After PR #208 (short-e canon-wire, ticket 86c9teua2) promoted `pen` to `isTarget: true` and moved it into `TARGET_WORDS`, `DISTRACTOR_ONLY_WORDS` is an empty `readonly WordEntry[]`. Every pack-resident word now lives in `TARGET_WORDS` and has a `TARGET_PAIRINGS` row.

**The export is intentionally retained.** [`wordPack.ts`](MarianLearning/src/screens/WordSong/wordPack.ts) keeps `export const DISTRACTOR_ONLY_WORDS: readonly WordEntry[] = [] as const` even though it currently has zero entries. Two reasons:

1. **Forward-compat for future tier work.** A future vowel tier (or a cross-pool variety pass) may need pictures that exist in the pack as distractors-only — words whose silhouettes are useful for confusion but which Marian shouldn't ever be asked to "Read." Re-introducing the array gives a typed home for those entries with no refactor.
2. **`ALL_WORDS` spread stability.** `ALL_WORDS = [...TARGET_WORDS, ...DISTRACTOR_ONLY_WORDS]` keeps its expression stable. Callers (e.g. `getWordEntry` lookups) don't need to know whether a word came from one array or the other.

**Tests must not assume the array is non-empty.** Specs that depend on probing a "no pairing matrix entry" path should NOT iterate `DISTRACTOR_ONLY_WORDS` (it will be empty), and should NOT pick a word like `'bus'` or `'pen'` and expect it to be distractor-only (those words have flipped to targets, or could in a future tier).

**Recommended pattern for testing the "no matrix entry" defensive throw — synthetic out-of-matrix `WordEntry`:** the canonical pattern is in [`wordDistractors.test.ts`](MarianLearning/src/screens/WordSong/wordDistractors.test.ts) "throws for a target word that is not in the pairings matrix":

```ts
const outOfMatrixWord = 'zzz-out-of-matrix' as const
// Pre-condition assertion ensures a future matrix expansion that adds this
// word doesn't silently flip the test from valid to invalid.
expect(TARGET_PAIRINGS[outOfMatrixWord]).toBeUndefined()
const fakeTarget = {
  word: outOfMatrixWord,
  pictureKey: outOfMatrixWord,
  vowel: 'a' as const,
  category: 'object' as const,
  isTarget: true,
}
expect(() => pickDistractors(fakeTarget, 1)).toThrow(/no pairing matrix entry/)
```

The `expect(TARGET_PAIRINGS[outOfMatrixWord]).toBeUndefined()` precondition is load-bearing — it guards the test against the failure mode where a future matrix row accidentally adds `zzz-out-of-matrix` (vanishingly unlikely, but the assertion costs nothing). Choose a prefix that is unambiguously not a real CVC word (`zzz-`, `__test-`, etc.). Do NOT use a real pack word as the synthetic — it WILL have a matrix row by construction and the test will pass for the wrong reason.

The same precondition pattern applies anywhere a test relies on a word being absent from a matrix or set; the pre-flight assertion is cheaper than future debugging.

#### `pen` is a cross-vowel-tier load-bearing distractor (post-#208, 2026-05-14)

`pen` appears in TWO places in `wordPack.ts`:

1. As a `TARGET_WORDS` entry with `vowel: 'e'`, `isTarget: true` (post-#208 promotion).
2. As a string reference in multiple short-a `TARGET_PAIRINGS` rows: `mat.gentle`, `bag.gentle`, `pan.gentle`, `tag.gentle`, `van.gentle` (legacy — these rows were authored when `pen` was distractor-only).

`getWordEntry('pen')` must continue to return a defined value for BOTH the short-e target lookup AND the short-a distractor lookups to keep working. The two flags (`isTarget`, distractor-eligibility) are independent: a word can be a target on its own tier AND a distractor on another tier simultaneously. Same precedent as the short-o promotions of `dog/log/pot/fox` (short-o targets, still distractors on short-a rows) and the short-u promotions of `sun/cup/bus` (short-u targets, still distractors on short-a rows).

**Cross-vowel-tier load-bearing — generalization.** Any word that is referenced as a string distractor in a `TARGET_PAIRINGS` row from a DIFFERENT vowel tier than the word's own `vowel` becomes cross-vowel-tier load-bearing. Today the cluster is:

| Word  | Own tier (`vowel`) | Referenced as distractor in                                                | Risk if removed from `TARGET_WORDS`                                                               |
| ----- | ------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pen` | `'e'`              | short-a rows: `mat, bag, pan, tag, van`                                    | `getWordEntry('pen')` throws → trio render fails on short-a session at problems 1–3 (gentle tier) |
| `dog` | `'o'`              | short-a rows: `hat.gentle, mat.gentle, fan.gentle`, etc.                   | Same shape — short-a trios with `dog` as gentle distractor break                                  |
| `log` | `'o'`              | short-a row `man.gentle: ['cup', 'log']`                                   | Same                                                                                              |
| `bus` | `'u'`              | short-a rows: `cat.gentle, bag.gentle, fan.gentle`, etc.                   | Same                                                                                              |
| `cup` | `'u'`              | short-a rows: `hat.gentle, bat.gentle, man.gentle, tag.gentle, van.gentle` | Same                                                                                              |
| `sun` | `'u'`              | short-a rows: `cat.gentle, bat.gentle, can.gentle`                         | Same                                                                                              |

**Operational rule.** Before removing a word from `TARGET_WORDS` (or flipping a word's `isTarget` to `false` without retaining the entry), grep the codebase for the word as a string token in `TARGET_PAIRINGS` and either:

1. Retain the entry with the appropriate `vowel:` + `isTarget: true`, OR
2. Update every `TARGET_PAIRINGS` row that references the word to use a different distractor (and re-audit `FORBIDDEN_PAIRS` for the new substitution).

The first option is almost always cheaper. The second option is correct when a vocab audit determines the word should leave the pack entirely (not just be re-classified).

**Regression-test surface.** [`wordDistractors.test.ts`](MarianLearning/src/screens/WordSong/wordDistractors.test.ts) "every distractor referenced in the matrix is a known word entry" iterates every `TARGET_PAIRINGS` row and runs `getWordEntry(distractor)` for each string token — fails loudly if a future PR removes a target word without retiring the string references that point at it. The assertion uses `expect(() => getWordEntry(word)).not.toThrow()` (count-based per `feedback_count_assertions_on_regression_tests`); count of throws is implicitly zero across the iteration.

**`POOL_EXTENSION_PENDING_CROSSVOWEL` exclusion in exhaustiveness tests.** `wordDistractors.test.ts` has a cross-vowel exhaustiveness scan that walks every `TARGET_WORDS` entry and asserts a valid gentle + trap distractor pair resolves without throwing. Pool-extension words on an EXISTING in-cross-vowel tier (e.g. short-o extended from 8 → 11 words in PR #207) trip this scan because the same-vowel-only constraint makes their pairing entries fail in isolation. These words must be added to a `POOL_EXTENSION_PENDING_CROSSVOWEL` exclusion set in the test so the scan skips them until the cross-vowel-mode spec (`86c9m3aek`) arrives and validates the full pairing surface. Do NOT satisfy the scan by changing the distractor matrix — the matrix captures the intended pedagogy; the test exclusion acknowledges the feature is unbuilt. Short-i (`'i'`) is NOT in `CVC_CROSS_VOWEL_VOWELS = ['a','o','u']` so short-i pool extensions don't trip this; future extensions on `'a'`, `'o'`, or `'u'` tiers always will.

#### Pool-extension sync points (three files must move together)

When extending a CVC pool tier — adding words to an existing tier such as short-o growing from 8 → 11 — **three files must be updated in the same PR**:

1. **`wordPack.ts TARGET_WORDS`** — add new `WordEntry` objects with `isTarget: true` and the correct `vowel:` field, plus the corresponding `TARGET_PAIRINGS` rows.
2. **Canon planner list** — `WORD_SONG_TARGET_WORDS_SHORT_*` in `api/_plannerWordList.ts` (canonical source of truth), so the Haiku planner can pick the new words. Re-bake the canon JSON via `npm run canon:regen` (or `rm <one-file>.json && npm run canon:generate --require-keys` for single-file incremental).
3. **`e2e/cvc-words-*-regression.spec.ts VALID_*_WORDS` Set constant** — the per-spec `ReadonlySet<string>` the regression spec uses to assert every planner-emitted target is from the expected pool. If the Set is not extended, the spec fails on any new word — which is correct behaviour, but the fix is to widen the Set, not to skip or weaken the assertion. Verified via PR #207 commit `0278dc9` (short-o 8 → 11 widening of `VALID_SHORT_O_WORDS`).

**Fourth update point — the spec's prose docstring.** Each `cvc-words-*-regression.spec.ts` has a "Note on canon authority" docstring near the top that lists the pool words in human-readable form (e.g. _"The eleven short-o targets — dog, mom, pot, log, mop, box, fox, hot, cot, top, pop"_). This prose must be updated in lockstep with `VALID_*_WORDS` — the docstring is not machine-checked, so drift is silent. Two-spot edit pattern: when you touch the constant, update the docstring in the same diff hunk.

Note: `POOL_EXTENSION_PENDING_CROSSVOWEL` above is a **fifth** file to touch — but only for extensions on `'a'`, `'o'`, or `'u'` tiers (short-i exempt). All five edits belong in the same PR as the pool extension itself. Dispatch briefs for pool-extension tickets must name every sync point explicitly; "update the test" is ambiguous between `VALID_*_WORDS` and `POOL_EXTENSION_PENDING_CROSSVOWEL`, which live in different files for different reasons.

**Do not confuse this pool-extension five-point checklist with the `SkillNode`-widening five-point checklist** documented in `progress-and-persistence.md` and `testing-and-ci.md` §4.1.4. They cover two DIFFERENT change shapes:

- **Adding a brand-new `SkillNode` literal** (e.g. introducing `cvc-words-short-e` as a new entry in the `SkillNode` union for the first time, like PR #208) → use the SkillNode-widening five points: `types.ts` union, `guards.ts SKILL_NODES`, `defaults.ts DEFAULT_PROGRESS`, `seedStorage.ts DEFAULT_SKILL_LEVELS`, `cloudSync.ts` migration.
- **Extending the pool of an existing node** (e.g. short-o 8 → 11 words in PR #207 — no new `SkillNode` literal) → use the pool-extension five points above: `TARGET_WORDS` + `TARGET_PAIRINGS`, canon planner list, `VALID_*_WORDS` spec constant, spec docstring, `POOL_EXTENSION_PENDING_CROSSVOWEL`.

A PR that does BOTH simultaneously (e.g. adds a new sibling vowel tier AND its initial pool) must satisfy BOTH checklists — they cover non-overlapping files for different reasons. Easy to conflate because both are "five sync points" — verify which change shape applies before starting.

**Parallel-vowel-tier-PR conflict surface — verified 2026-05-13.** When two vowel-tier canon-wire PRs are mid-flight simultaneously (e.g. PR #207 short-o-ext + PR #208 short-e), the predictable conflict files are NOT `wordPictures.tsx` (which 3-way-merges adjacent case-label additions cleanly). The real conflict surfaces are:

1. **`api/_planner.ts`** — both PRs edit the "Order easier-recognise words" trap-window prose block. Resolution: combine both tiers' word additions into the same sentence; do NOT choose one side.
2. **`api/_plannerWordList.ts`** — both PRs append history-note comments to the same JSDoc block. Resolution: combine both notes sequentially.
3. **`api/_planner.test.ts`** — regex pins on the celebration-prosody exception sentence may differ across branches if both PRs added exceptions. Resolution: take the merged-superset of exceptions.

`wordPictures.tsx` typically auto-merges because new case labels land in non-adjacent regions of the switch. **Never pre-prescribe `--ours` or `--theirs` in a rebase dispatch brief without first verifying the actual conflict region** — a `--ours` resolution that "accepts main" would silently discard the branch's planner additions for these files, surfacing later as a runtime regression when planner emissions diverge from the canon. Let the rebasing agent inspect the conflict and choose semantic merges file-by-file.

### Word session plans (fallback rotation)

[`src/screens/WordSong/wordSessionPlans.ts`](MarianLearning/src/screens/WordSong/wordSessionPlans.ts). Same architecture as Math — three deterministic fallback plans (`STATIC_WORD_SONG_PLANS`) so the screen can be developed and QA-tested end-to-end without network. When real planner wiring lands, `pickStaticWordSongPlan()` is replaced with a fetch.

| Plan                 | Label          | Opens with                                      |
| -------------------- | -------------- | ----------------------------------------------- |
| `word-song-shorta-A` | opens with cat | `cat → bag → jam → fan → pan → man → tag → cap` |
| `word-song-shorta-B` | opens with bag | `bag → fan → mat → cat → bat → hat → can → van` |
| `word-song-shorta-C` | opens with hat | `hat → pan → dad → bag → tag → fan → man → cat` |

Trap-window facts cluster /æt/, /æn/, or /æg/ rhymes by design. `pickStaticWordSongPlan(now)` rotates by minute, with a +1 offset relative to Math so consecutive sessions don't lock onto "Math A + Word Song A".

### Word plan shape

`WordSongSessionPlan` ([`wordSessionPlans.ts:134`](MarianLearning/src/screens/WordSong/wordSessionPlans.ts#L134)):

```ts
interface WordSongProblem {
  index: number // 1..8
  target: WordEntry
  utterances: WordSongProblemUtterances
  contentType?: WordSongContentType // 'blending-cv' | 'cvc-word'
}

interface WordSongProblemUtterances {
  read: string // "Tap the cat." or "Read the cat."
  correct: string // "Yes! Cat."
  reprompt: string // "Hmm... try again?"
  hint: string // "Let's look. Cat."
  giveAnswer: string // "This one is cat." (after 3 wrongs)
}
```

`contentType` is the discriminant on a WordSong problem ([`wordSessionPlans.ts:115`](MarianLearning/src/screens/WordSong/wordSessionPlans.ts#L115)):

- `blending-cv` (v1 default) — `"Tap the <word>."`. Marian taps the matching picture chip from a trio.
- `cvc-word` — `"Read the <word>."`. Same target pool for now (the 14 CVC short-a + the 8 short-o); when the planner widens, it can draw from a broader CVC list.

The field is OPTIONAL on the public type for back-compat: hand-built static plans (`STATIC_WORD_SONG_PLANS`) don't set it, and downstream code treats absence as `blending-cv`. The parser always sets it explicitly so plans rebuilt from the wire always carry the discriminant.

Utterance ID template: `word.p{N}.{slot}` (mirrors Math's `math.p{N}.{slot}`). Builder: `wordSongUtteranceId(problemIndex, slot)`.

Adapters mirror Math:

- `wordSongSessionPlanToUtteranceSources(plan)` — flatten to wire shape.
- `wordSongSessionPlanFromWire(skeleton, utterances)` — rehydrate by id.

### Word `planFromServer`

[`src/screens/WordSong/planFromServer.ts`](MarianLearning/src/screens/WordSong/planFromServer.ts). Adapter from server-generated `PlannerPlan` to `WordSongSessionPlan`. Sibling of Math's `planFromServer.ts`.

Read-line templates accepted ([`planFromServer.ts:171`](MarianLearning/src/screens/WordSong/planFromServer.ts#L171)):

```ts
;[
  {
    contentType: 'blending-cv',
    pattern: /^\s*tap\s+the\s+([a-z]+)\s*\.\s*$/i,
    label: '"Tap the <word>."',
  },
  {
    contentType: 'cvc-word',
    pattern: /^\s*read\s+the\s+([a-z]+)\s*\.\s*$/i,
    label: '"Read the <word>."',
  },
]
```

`parseReadLine(read)` returns `{ entry: WordEntry, contentType: WordSongContentType }`. The word is membership-checked against `TARGET_WORD_SET` (the lowercase `TARGET_WORDS.word` set) so distractor-only entries (`bus`, `sun`, etc.) cannot slip through as targets even if the model misreads the prompt.

`parseReadTarget(read)` is a legacy wrapper that returns the `WordEntry` only (back-compat; new code should call `parseReadLine`).

**Planner-parser contract — parser BEFORE planner.** PR #117 → #118 fought a P0 where planner content widened before the browser parser accepted the new shape. The contract since then: widen the parser first, ship it, then widen the planner in a separate PR. The two-template list above is exactly that contract — `'cvc-word'` was added to the parser in PR #132 (step 1, ticket 86c9kxp08); the planner widened to emit it in step 2 (ticket 86c9kxu07). See `project_planner_parser_contract` auto-memory.

`planFromServer` skips out-of-namespace ids the same way Math's parser does: `session.end.*` and other non-`word.p<N>.<slot>` ids are filtered out before grouping by problem index, so additive emissions upstream don't cascade into a silent-fallback regression.

### `plannerRoundTrip` test

[`src/screens/WordSong/plannerRoundTrip.test.ts`](MarianLearning/src/screens/WordSong/plannerRoundTrip.test.ts). End-to-end planner ↔ parser pin. The Anthropic SDK is mocked; for each test we hand-craft a wire-shape response that mirrors what the new prompt instructs Haiku to emit, feed it through `generateSessionPlan`, then through `wordSongSessionPlanFromServer`, and assert the per-problem `contentType` matches the requested focus node.

Suites:

- `blending-cv` round-trip — every problem's `contentType` is `'blending-cv'`, every `read` matches `/^Tap the [a-z]+\.$/`.
- `cvc-words` round-trip (the August unblock, step 2) — every problem's `contentType` is `'cvc-word'`, every `read` matches `/^Read the [a-z]+\.$/`, every word is in the canonical short-a `TARGET_WORDS`.
- `cvc-words-short-o` round-trip (ticket 86c9m3ae3) — pins the short-o sibling tier end-to-end: every target is from the 8-word short-o pool, every `target.vowel === 'o'`, no short-a leakage, every target resolves a gentle + trap distractor pair without throwing, distractors stay inside the short-o pool (same-vowel rule).
- Untuned-tier stub fallback — a `digraphs`-requested call falls back to blending-cv content (the stub-fallback contract).

#### Cloze parser-contract exception — `simple-sentences` (PR #423, 2026-06-13)

`simple-sentences` is the **first Word Song content type whose target word is NOT in the read line.** Every prior template (`Tap the <word>.`, `Read the <word>.`, `Find the word: <word>.`) captures the target directly from a fixed slot in the read line. A cloze read line (`"Finish the sentence: The cat ___ on the mat."`) gaps the answer out by design — Emma must NOT speak the answer — so `planFromServer.ts` resolves the target from the **`correct` utterance** (`"Yes! Sat."`) instead, and throws `PlanFromServerError` if the read line lacks a gap. The simple-sentence route runs before the generic read-line capture; existing templates are untouched (no regression).

**Invariant for future cloze / don't-say-the-answer tiers:** any tier where the answer is intentionally absent from the read line must resolve its target from `correct` (or a comparable non-read slot), never from a read-line regex.

Four coupled gotchas from the build (Kevin + Devon, PR #423), all on `src/screens/WordSong/`:

- **Membership guard is tier-specific.** `SIMPLE_SENTENCE_TARGET_SET` (`planFromServer.ts:282`) is the gate, NOT the CVC `TARGET_WORD_SET` — several valid gap targets (e.g. `sat`) are distractor-only entries in their home tier but legitimate answers here. Every such target still needs a `TARGET_PAIRINGS` row or `buildChipOrder` throws at render. **Open tension (ticket `86ca8jdt6`, 2026-06-13):** PR #430's `cat-sat-mat` target `bit` was added to `DISTRACTOR_ONLY_WORDS` WITHOUT a `TARGET_PAIRINGS` row — which by this rule would throw if rendered via `buildChipOrder`. Currently masked (the bake hasn't selected that row; production may serve planner-resolved chips that bypass `pickDistractors`). Whether this is a latent crash or the rule is over-stated for simple-sentence targets is **under verification — do NOT assume either** until `86ca8jdt6` resolves.
- **`___` stays literal in canon text; audio says "blank".** The canon `read` text stores `___` (the browser parser builds the displayed `sentenceFrame` from it; e2e asserts `gapTokenCount` on it). The `___`→"blank" substitution fires ONLY at TTS synth time via `substituteSentenceGap` (`api/_tts.ts:951`). Same stored-text-plain / audio-shaped pattern as letter-sounds — any future display-token-that-must-not-be-spoken keeps the token in canon and substitutes at synth.
- **Attached-punctuation gap token.** `"The dog ___."` whitespace-splits to the token `"___."`, so a `token === '___'` equality check misses it (renders literal underscores). Detection must find the `___` **substring** and peel surrounding punctuation. Jessica's e2e test caught this where a standalone-`___` component test did not — a concrete reason cloze render PRs need an e2e walk, not just unit tests.
- **sceneId frame-collision across gentle/trap phases.** `"The dog ran ___."` normalises identically whether it's a gentle row (gap `in`) or a trap row (gap `there`); deriving `sceneId` from the frame alone attaches the gentle scene to the trap problem. The fix gates on the gentle window (problem index ≤ 3) — phase isn't on the wire but index is. `normalizeSentenceFrame` (`sceneRegistry.ts`) is intentionally NOT a unique key. Scene assets live at `public/assets/scenes/scene-<sentence-id>.svg`; `SCENE_PICTURES` (`sceneRegistry.ts` — NOT `scenePictures.tsx`, which holds the `ScenePanel` component) maps sceneId → asset URL, **populated with all 8 gentle sceneIds as of PR #431 (2026-06-13)** — graceful text-only fallback for any unmapped id. **Scene drift is a 3-link chain that must stay in sync:** server pool `WORD_SONG_SIMPLE_SENTENCES` (`api/_plannerWordList.ts`) → browser frame-table `SIMPLE_SENTENCE_SCENES` (`wordPack.ts`) → render registry `SCENE_PICTURES` (`sceneRegistry.ts`). Link 1→2 is pinned by `plannerRoundTrip.test.ts`; link 2→3 by `sceneRegistry.test.ts` (every parser-emittable sceneId resolves, no orphan registry keys). A new gentle scene must update all three maps **and** both drift-guards in the same PR, or the sceneId silently falls back to text-only.
- Graduation-session round-trip (ticket 86c9m3aec) — three AC parts: 3 canonical sessions at 100% flag the next as graduation; graduation session with novel words at 100% advances focus past `cvc-words` to `cvc-words-short-o`; graduation session with novel words at 50% does NOT promote, focus stays on `cvc-words`, and the next session is a regular cvc-words session (NOT a re-graduation).
- `digraphs-sh` round-trip — every `read` matches the tier read-line template, every word is from the 7-word digraphs-sh pool, and the distinct-word count obeys the sub-8-pool invariant below.

#### Sub-8-word pool size invariant — "8 reads, ≥7 distinct"

`digraphs-sh` is the **first focus node whose canonical word pool is smaller than the session length** — 7 pool words, 8 problems per session. The `WORD_SONG_TRACK_GUIDE` carries an explicit EXCEPTION for this tier: the planner uses each of the 7 words once, then repeats one _conventional_ sh-CVC word (never a `hybridMode` word — `shoe`/`sheep`/`shark`) for the 8th slot.

**Regression-spec assertion contract for sub-8-word pools:**

```ts
// WRONG — fails legitimately on the repeated 8th word
expect(new Set(targets.map((t) => t.word)).size).toBe(8)

// CORRECT — count is exactly 8, distinct count is ≥ pool size
expect(targets).toHaveLength(8)
expect(new Set(targets.map((t) => t.word)).size).toBeGreaterThanOrEqual(7)
```

Any `plannerRoundTrip` test or e2e spec covering `digraphs-sh` (or any future tier with pool `N < 8`) must use `size >= N`, never `size === 8`. An exact-8 assertion fails non-deterministically on the legitimate repeat — a false CI red indistinguishable from a real pool-leakage regression. CVC tiers (short-a … short-e) all have ≥8-word pools and keep the strict 8-distinct assertion.

### Word pictures

[`src/screens/WordSong/wordPictures.tsx`](MarianLearning/src/screens/WordSong/wordPictures.tsx). All canonical pack words are asset-served via the wrapper-preserving `<image href>` pattern. The 4 novel-pool probes (`nap, rat, map, tap`) are the only remaining inline-SVG entries.

Renderer: `<WordPicture pictureKey="cat" large?={boolean} ariaLabel?={string} />` returns an outer `<svg>` element sized to fit its container (chip wrapper sets the box). Falls back to `renderUnknownPicture(key)` (rounded square + key text) if the key is unknown — defensive, should never surface for the curated pack.

#### Rendering pattern (canonical post-PR #157, commit `d3a35d8`)

Picture-pack words use `<image href="/assets/pictures/picture-${key}.svg">` **inside** the existing `<svg viewBox="0 0 96 96">` wrapper, NOT a `?react` import or an `<img>` element. The wrapper-preserving choice keeps the test contract stable: tests query `svg[data-testid="word-picture"]` directly with `role="img"`, `aria-label`, `data-large`, `data-picture-key` attributes — only the inner body changes. After PR #157 (full short-a pack ship), 26 case labels collapsed into a single shared switch arm that returns the same `<image href>` block parameterised by `pictureKey` — `wordPictures.tsx` shrank from ~1,300 lines of inline-SVG paths to a fall-through pattern. Future picture-pack additions (e.g. short-u, short-e tiers) should slot into the existing shared arm without adding case-body code.

**Embed PR ≠ chips visible: case LABELS are still required somewhere.** Adding new picture SVGs to `public/assets/pictures/` does NOT automatically make chips visible in the app. The "shared arm" means the render BODY is shared — the single `<image href="/assets/pictures/picture-${pictureKey}.svg">` block serves all pack words — but a `case '<word>':` LABEL must still be added to the switch statement for each new key. Without the label, the component falls through to `renderUnknownPicture(key)` AND `wordPictures.test.tsx` (which iterates `ALL_WORDS`) FAILS because any pictureKey routing to the unknown-fallback is a hard error. So the case-label extension is a forced-by-tests gate — it WILL land before any new tier merges. **Which PR carries the labels is project-policy ambiguous:** PR #205 (Devon's short-e embed) included the labels in the embed PR alongside the SVG drop, while PR #204 (Devon's short-o-ext embed) skipped them and PR #207 (Kevin's short-o-ext canon-wire) picked them up as a scope expansion. The phrase "slot into the existing shared arm without adding case-body code" above refers strictly to the BODY of each case, not to the labels. **Dispatch-brief guidance:** explicitly state in the embed-PR brief whether case labels are in scope (preferred: yes, keeps "what user actually sees" coherent in one PR), so the implementing agent doesn't take a minimal-diff interpretation and force the canon-wire PR to scope-expand.

**Filename convention:** `MarianLearning/public/assets/pictures/picture-{word}.svg`. The older `pic-dog.svg` was retired in PR #157; do not introduce new `pic-` prefixed files.

Vite PWA `globPatterns` in [`vite.config.ts:87`](MarianLearning/vite.config.ts#L87) already covers `svg`, so new picture assets are auto-precached by the service worker without config changes.

#### Coverage state (post-PR #157, commit `d3a35d8`)

- **Real asset, asset-served via `<image href>`** (26 words): all canonical pack entries.
  - 14 short-a target: `cat, hat, bat, mat, bag, fan, man, pan, cap, can, tag, dad, jam, van`
  - 8 distractor-only: `bus, sun, dog, fox, cup, pen, log, pot`
  - 4 short-o (PR #156): `mop, box, mom, hot`
- **Inline-SVG placeholders remaining** (4 words): the novel-pool probes `nap, rat, map, tap` only — these have a separate prompt sheet at [`design/word-song/probe-word-picture-pack.md`](MarianLearning/design/word-song/probe-word-picture-pack.md) and ship in a follow-up PR.
- **Silhouette fallbacks removed** entirely from the canonical pack as of PR #157.

**Total picture-pack SVGs on disk:** 34 (~6.8 MB combined, ~205 KB per asset average — verified 2026-05-09 post-short-u). The earlier ~83 KB / ~7.5 KB-per-asset figure was the hand-authored-SVG era; PRs #156/#157 migrated the pack to **Path 2 (PNG-in-SVG embed)** below, where each SVG wraps a base64-embedded PNG from Thomas's MJ source. Informal per-asset target post-#157 is **~50–200 KB**; the `picture-pack-style-anchor.md` §6 budgets are vestigial from the hand-authored era and don't reflect current reality.

**PWA cache-budget posture (verified empirically, ticket 86c9qa7uh):** `vite.config.ts`'s `maximumFileSizeToCacheInBytes` is a **per-file** gate (not cumulative) — Workbox excludes any single asset larger than this from the precache manifest, and total precache size has no Workbox-side cap. Today the value is `8 * 1024 * 1024` (8 MiB), lifted from 4 MiB in this ticket; the value is driven by Emma SVGs (~2.5–3.3 MB each), NOT picture-pack SVGs. Picture-pack SVGs at 73–414 KB are nowhere near the cap. The full precache manifest is ~30 MiB across 98 entries (`vite-plugin-pwa` reports the figure on build), which is comfortably inside typical installed-PWA quotas on iPad Safari (50+ MB granted, lazy growth beyond). Projected post-short-i + post-short-e + post-short-o-extension growth (~24 more SVGs at ~210 KB avg = ~5 MB additional) brings the precache to ~35 MiB total — still inside quota. **There is no cumulative cap to mitigate** when adding picture-pack tiers; check the per-file size of any new asset against the 8 MiB cap when adding (only an issue if a new individual file approaches it, e.g. an unresized 4K PNG-in-SVG).

**Hand-author cadence:** PR #156 shipped 4 SVGs; PR #157 shipped 22 in a single ~30-minute session with no automated tracer. The bottleneck for picture-pack work at this scale is the per-word distinctness-gate audit (e.g. cat-pointed-vs-dog-floppy, hat-brim-vs-cap-peak, mom/dad pair-discrimination), not SVG authoring volume. SVGO is not run on the output — hand-authored SVGs are already compact and SVGO occasionally strips load-bearing detail (whisker strokes, A-line dress flare).

**Important expectation-management note:** the spec uses the word "trace" for Phase 3, but agent environments to date (PR #156, PR #157) have not had `vtracer` / `potrace` / Inkscape CLI available, so when the trace step is delegated to a sub-agent, "trace" collapses to **hand-authored SVG primitives in the project's locked palette** that satisfy the distinctness gates while using the PNG as a compositional reference. End result of agent-delegated Phase 3: clean cartoon vectors, NOT watercolor-y reproductions of the MJ source.

There are **three viable Phase 3 paths**; pick consciously when scoping picture-pack work:

1. **Agent-delegated hand-author SVG** (PR #156, PR #157 used this path) — fast, satisfies spec gates, clean pack-cohesive vectors in locked palette, tiny file sizes. Loses MJ source character. Right when pack cohesion + chip-readability matter more than fidelity to a specific MJ output.
2. **Thomas-runs-PNG-embed-in-SVG** (Emma character SVGs were produced this way — see [`emma-character-and-animation.md`](./emma-character-and-animation.md) §2 "PNG-in-SVG technique") — despite the spec calling this step "trace", the actual Emma workflow is: Thomas runs the MJ PNG through an online BG-removal tool → wraps the transparent PNG as `<image href="data:image/png;base64,...">` inside an `<svg viewBox="0 0 W H">` shell → saves as `.svg`. **No actual vector tracing happens** — the SVG is just a delivery wrapper for a transparent PNG. Visual fidelity = 100% the source PNG. File size = roughly the transparent PNG size + ~33% base64 overhead (~2.5-5 MB at 2000×2000; ~200-600 KB at 1024×1024 — the full MJ source resolution). The Emma assets bumped `vite.config.ts` `maximumFileSizeToCacheInBytes` from 2 MiB → 4 MiB → 8 MiB across PR #104 + ticket 86c9qa7uh to give the per-file precache gate comfortable headroom. **Note:** this cap is per-file, not cumulative — see "PWA cache-budget posture" above for the empirical reality. Picture-pack SVGs land at ~73-600 KB each and don't drive the cap. For future picture-pack work, keep source PNGs at the full 1024×1024 MJ resolution — do not downsample. **The online BG-removal tool is under active evaluation (2026-05-14):** remove.bg's free tier caps output at 500×500; the free alternatives remove-bg.io and bgclear.ai both preserve the full 1024×1024 source, and bgclear.ai additionally preserved fine edge detail (fingers) that remove.bg and remove-bg.io both eroded on soft-skin-on-cream sources. The current canonical pick lives in memory `feedback_mj_workflow_explicit_removebg.md` step 6 — defer to it rather than hardcoding a tool here. Agent handles wiring only — the existing `<image href="/assets/pictures/picture-{word}.svg">` pattern already works regardless of what's inside the SVG.

   **Tooling for path 2:** the repo ships `yarn embed-pictures <input-dir> [output-dir]` ([`scripts/embed-pictures.ts`](MarianLearning/scripts/embed-pictures.ts)) which batch-converts a folder of transparent PNGs into the `<svg><image href="data:...">` wrapper format used by Emma. Output filenames carry the `picture-` prefix (auto-prefixing inputs that lack it) and write directly into the chosen output dir. **For non-picture asset classes the `picture-` prefix is WRONG:** the simple-sentences scene pack (PR #431) needs `scene-<id>.svg` to match `SCENE_PICTURES` keys, so the prefix must be stripped post-embed (PR #431 did a manual rename) until the script grows a `--prefix`/`--no-prefix` flag. **Canonical invocation (post-2026-05-13 migration):** point the script at the per-tier subdir for the tier you are shipping, e.g. `yarn embed-pictures design/references/picture-pack/transparent-short-o-ext public/assets/pictures` for short-o-extension, or `yarn embed-pictures design/references/picture-pack/transparent-short-e public/assets/pictures` for short-e. Do NOT point at the legacy flat `transparent/` path — it no longer exists as the canonical staging location. The script is the only project-side automation for this path; the online BG-removal step (see memory `feedback_mj_workflow_explicit_removebg.md` for the current canonical tool) is the upstream manual step.

   **Two embed-pipeline gotchas (verified 2026-05-09 during PR #170 short-u pack work):**
   - **Worktree drift on `transparent/` source PNGs.** `design/references/picture-pack/**/*.png` is gitignored, so updates to a source PNG in the canonical main repo path do NOT propagate to existing per-ticket worktrees. A worktree holds whatever was in its `transparent/` dir at worktree-creation time. If Thomas drops a fresh PNG into the canonical main repo while a sub-agent is operating in a worktree, the worktree's `yarn embed-pictures` run consumes the stale source and silently produces a no-op SVG. **Mitigation in any picture-pack dispatch operating in a worktree:** before running embed-pictures, either md5-check the source PNG against the canonical main-repo path OR explicitly `cp` the canonical PNG into the worktree's same path as a first step. PR #170's cup retrace hit this exact failure mode and required a follow-up commit (`8cdd711`) to land the actual new cup.
   - **Embed script auto-emits ALL PNGs in the input dir.** `yarn embed-pictures` walks every `.png` in the input dir and writes a corresponding SVG — there's no manifest gate or per-asset filter. So a stray PNG in a staging dir (e.g., a `gum` candidate that's been deferred from the active scope) WILL produce an unintended SVG output. **Canonical mitigation (post-PR #188 design intent, physically adopted 2026-05-13 in chore/picture-pack-tier-subdirs):** stage each tier's PNGs into a dedicated subdir `design/references/picture-pack/transparent-{tier}/` (e.g. `transparent-short-i/`, `transparent-short-e/`, `transparent-short-o-ext/`) and point the embed script at that subdir, not any shared flat dir. The 43 source PNGs across all shipped tiers (short-a, short-o, short-u, short-i, short-o-ext, short-e) now live in their respective per-tier subdirs; the old flat `transparent/` staging dir is retired as the canonical location. The per-tier pattern keeps each tier's embed scope clean and prevents cross-tier SVG overwrites. The existing `.gitignore` entry `design/references/picture-pack/**/*.png` (recursive glob) already covers all per-tier subdir PNGs — no `.gitignore` change needed. Each subdir has a committed `.gitkeep` so the empty-dir structure is tracked.
   - **Fresh worktrees have no `node_modules/` — `yarn install --frozen-lockfile` is Step 0.** Worktrees spawned via the Agent tool's `isolation: "worktree"` parameter are minimal checkouts — they share the git object store with the main working tree but do NOT inherit `node_modules/`. Running `yarn embed-pictures`, `yarn typecheck`, `npx vitest run`, or any other `tsx`-backed script in a fresh worktree will fail immediately with `'tsx' is not recognized as an internal or external command` until dependencies are installed. **Every dispatch brief that asks a sub-agent to run build scripts in a worktree must include `yarn install --frozen-lockfile` as Step 0.** Install time is ~16 s on a warm npm/yarn cache; it is not avoidable. This applies to all `package.json` scripts, not just embed work. Verified 2026-05-13 during PR #204 dispatch (Devon's short-o-ext embed agent hit this on first invocation).
   - **`.claude/docs/` lives in the workspace parent, not the worktree root.** When a sub-agent is operating in a worktree at `MarianLearning/.claude/worktrees/agent-*/`, the docs directory is at `C:\Trunk\PRIVATE\MarianLearning\.claude\docs\` — NOT under the worktree's `MarianLearning/.claude/`. Dispatch briefs that say "read `.claude/docs/*.md` first" without an absolute path cause agents to search the worktree tree recursively before finding (or failing to find) the files. **Always include the absolute workspace-parent path in any dispatch brief targeting a worktree.** Verified 2026-05-13 during PR #204 (Devon) and PR #206 (Jessica) — both surfaced the discoverability issue independently.
   - **`yarn <script>` is not reliably on PATH after `yarn install` in a worktree — use `npm run <script>` instead.** After `yarn install --frozen-lockfile` completes in a fresh worktree, the `yarn` binary itself may not be resolvable in the shell environment (PATH differs between native shell sessions and Agent-spawned processes). `npm run <script>` resolves all `package.json` scripts identically and is reliable in every worktree context. Use `npm run canon:regen`, `npm run embed-pictures`, `npm run typecheck`, etc. rather than `yarn <script>`. `npx vitest run` and `npx playwright test` also bypass the issue. Verified 2026-05-13 during PR #207 (Kevin's short-o-ext canon-wire).

3. **PNG-direct rendering** — skip SVG entirely; ship the compressed PNG via `<image href="/assets/pictures/picture-{word}.png">` (or `.webp`). Vite PWA `globPatterns` covers `png` and `webp` already; bundle budget per `reference_pwa_asset_size_limits` memory is 8 MiB total cache (raised from 4 MiB in ticket 86c9qa7uh), so ~26 compressed picture-pack PNGs at ~50-150 KB each (~2-4 MB total) fit with ample headroom. Right when visual fidelity is non-negotiable AND Thomas doesn't want to run the trace step himself.

When dispatching a Phase 3 brief, **ask which of the three paths Thomas wants** upfront — defaulting to path 1 (agent hand-author) is what produces the visual-fidelity gap surprise that surfaced post-PR-#157.

#### Picture-pack pipeline

Three phases per [`design/word-song/README.md`](MarianLearning/design/word-song/README.md) Phase model and [`short-o-pool-expansion.md`](MarianLearning/design/word-song/short-o-pool-expansion.md) §3:

| Phase                      | Owner                                                             | Output                                                                                                                                                                   | Blocking dependency                                                                                                 |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 1. Prompt sheet            | Kyle                                                              | [`design/word-song/short-o-picture-pack-prompts.md`](MarianLearning/design/word-song/short-o-picture-pack-prompts.md) (4 wholly-new short-o words: `mop, box, mom, hot`) | Short-a pack's `picture-pack-style-anchor.md` — style frame is shared.                                              |
| 2. Midjourney generation   | Thomas                                                            | Source PNGs (≥1024×1024)                                                                                                                                                 | Phase 1 merged. ~30–60 min generation time, no incremental subscription cost beyond what the short-a pack consumes. |
| 3. SVG trace + integration | Devon (integration) / Kevin (wiring) under Kyle's trace direction | `picture-{word}.svg` files at `public/assets/pictures/` + `wordPictures.tsx` updates                                                                                     | Phase 2 merged.                                                                                                     |

The 4 promoted-from-distractor short-o words (`dog, log, pot, fox`) belong to the short-a pack's eventual cohesion pass per `picture-pack-prompts.md` §1, NOT the short-o prompt sheet's scope.

Distinctness requirement at 96pt: each picture must be visually distinct enough that Marian can tap-and-confirm a chip. Placeholders are deliberately schematic (square / round / person-shape / vehicle-shape silhouette + recognisable primary feature). Forbidden-pair compatibility is the matrix's job, not the renderer's — `cat`/`dog` placeholders deliberately LOOK silhouette-similar; the matrix never co-pairs them.

#### MJ prompt-engineering gotchas for picture-pack words

Empirical lessons from the bib batch (2026-05-09, Phase 2 short-i pack). Apply at prompt-authoring time for every new picture-pack word.

**1. Clothing/textile/household-product subjects pull into product-photography mode**

Standard ballast (`--no photorealistic, 3d render`) does not defend against MJ's "stylised stock product photo" attractor. All 4 bib variants in the first batch came back as polished product photographs. The `--no photorealistic` term addresses photoreal landscape/portrait output, not the distinct "clean-background catalogue shot" mode that household and fabric subjects trigger.

Empirical fix: add `--no photo, product photography, fabric texture` for any clothing, textile, or household-object subject. Keep the standard ballast too — both layers are needed on this subject class.

**2. MJ defaults to the modern industrial form when a prototypical and a modern form co-exist**

When a word has a children's-book prototypical form (bib with ribbon tie-strings) AND a modern industrial-product form (snap-closure tabs), MJ defaults to the modern form even with explicit prompt language. Every bib in the first batch rendered with snap-closure tabs.

Fix: describe the prototypical form vividly using sensory / material cues ("ribbon tie-strings like fabric bows") AND add an explicit `--no [modern mechanism]` (e.g. `--no snap closure, velcro, hook`). Neither the description alone nor the `--no` alone was sufficient in isolation; both are needed.

Words in the current pack where this attractor likely applies: `bib` (snap-closure vs tie-string), `bag` (zip vs drawstring), `cap` (fitted vs floppy). Flag this check when authoring prompts for any word that has evolved from its children's-book prototype.

**3. Lead-with-noun strengthens the illustration-mode signal**

Opening the prompt with `"A flat illustrated cartoon DRAWING of [subject]"` weights illustration intent more than `"[subject] in flat illustrated style"`. The noun-forward phrasing treats the subject as the object of a depiction act, which aligns better with MJ's training distribution for children's-book illustration. Use this structure as the default template for all picture-pack words.

**4. Negate drop-shadows at MJ time, not after BG removal**

Kyle's per-word prompts say "no shadow drop" against the cream background, but MJ ignores that prose without explicit parameter negation. When a soft drop-shadow makes it into MJ output, AI BG-removal tools frequently preserve it as part of the foreground — the shadow's warm tone is close to the cream-background tone it is trying to mask, and the algorithm classifies the shadow blob as subject. Result: a yellow/cream-toned orphan shadow blob persists in the transparent PNG below the subject (confirmed on the `lid` batch, 2026-05-09 — variant 1's drop-shadow survived BG removal and required manual eraser cleanup).

Fix at the source: add `--no shadow, drop shadow, ground shadow` to every picture-pack prompt. Cheaper than the 30-second Paint cleanup, and removes the failure mode entirely. If a shadow does slip through (or you've already saved a PNG with one), the fallback is manual eraser in any basic image editor — the subject silhouette itself is intact, only the orphan shadow needs to go.

Structural template (combining all four fixes for high-risk subjects):

```
A flat illustrated cartoon DRAWING of a [vivid prototype description], solid white background, bold outlines, bright saturated colors, simple shapes, children's picture book style --no photo, product photography, fabric texture, [modern mechanism], photorealistic, 3d render, shadow, drop shadow, ground shadow
```

For lower-risk subjects (clear animals, unambiguous objects), the standard ballast alone is usually sufficient; add the product-photography and mechanism layers only when the subject is clothing, textiles, household tools, or anything with a known modern counterpart.

Cross-reference: `feedback_mj_moderator_negatives_per_word` auto-memory covers v7 parameter constraints, the ≤40-word ceiling, and the rule to tailor `--no` per word rather than pasting a full negative block.

## Hub stage taxonomy

[`src/screens/Hub/stages.ts`](MarianLearning/src/screens/Hub/stages.ts). Pure data + utility, split out from `stageIcons.tsx` so React Fast Refresh's "components-only export" rule stays clean (the .tsx file exports only the `StageIcon` React component).

### Stage IDs

Two unions, one per tree:

```ts
type NumberGardenStageId =
  | 'number-recog'
  | 'add-to-10'
  | 'add-to-20'
  | 'subtract-to-10'
  | 'subtract-to-20'
  | 'two-digit'
  | 'skip-counting'
  | 'multiply-2-5-10'
  | 'multiply-3-4'
  | 'multiply-6-9'

type WordSongStageId =
  | 'letter-names'
  | 'letter-sounds'
  | 'blending-cv'
  | 'cvc-words'
  | 'cvc-words-short-o'
  | 'digraphs'
  | 'sight-words'
  | 'simple-sentences'
```

Note the math IDs use `subtract-*` / `two-digit` / `multiply-*` aliases — they don't align 1:1 with `NumberGardenNode` strings (`sub-to-10` / `two-digit-addsub` / `mult-2-5-10` etc.). The Hub stage names were authored slightly earlier with display-friendly aliases. Mapping happens in the Hub-side projection layer ([`src/screens/Hub/progressProjection.ts`](MarianLearning/src/screens/Hub/progressProjection.ts)).

### Display-order constants

```ts
NUMBER_GARDEN_STAGES: NumberGardenStageId[] = [10 entries in declaration order]
WORD_SONG_STAGES:    WordSongStageId[]    = [8 entries in declaration order]
```

Source-of-truth: `design/screen-hub.md` § "Skill-tree picker — node design" + `CLAUDE.md`'s "Two skill trees" canonical stage order.

### `slidingWindow` helper

[`stages.ts:71`](MarianLearning/src/screens/Hub/stages.ts#L71). Compute the 5-node sliding window centred on the current stage index.

```ts
function slidingWindow<T>(
  stages: readonly T[],
  currentIndex: number,
  size = 5,
): { items: T[]; offset: number }
```

Math:

```ts
const desiredOffset = currentIndex - 1
const maxOffset = Math.max(0, stages.length - size)
const offset = Math.max(0, Math.min(maxOffset, desiredOffset))
```

Edge cases (per `design/screen-hub.md` §"Sliding window — which 5 stages render"):

- `currentIndex === 0` → `offset = 0` (no leftward slot, current sits at the left edge).
- `currentIndex` near the end → right edge of window aligns with the last stage (offset clamps at `maxOffset`).

Returns the picked items + the offset used. Empty `stages` returns `{ items: [], offset: 0 }`.

### `StageIcon` component

[`src/screens/Hub/stageIcons.tsx`](MarianLearning/src/screens/Hub/stageIcons.tsx). Renders one stage icon at the spec's 28pt visible / 44pt hit-zone footprint. Four `StageIconKind` values: `mastered | current | in-progress | locked`.

Shimmer prop: a single shimmer cycle on Hub mount when `kind === 'current'` — opacity 0.85 → 1 → 0.85 over 800ms then settled. Implemented at the consumer's motion layer; this prop just toggles a `data-shimmering` attribute the parent can hook.

Tree-themed art (Q9=B, Thomas-locked) is owned by Kyle in ticket `86c9j53yx`. Until the final SVGs land, this module emits simple inline shapes (CheckGlyph, PadlockGlyph, StageGlyph) that match the spec footprint. Each icon is text-free per the spec ("rely on Emma's TTS to name each step; reading-emergent age means text labels are invisible").

## Spec drift decisions (locked)

Per `project_spec_drift_decisions` auto-memory — defaults that have been explicitly resolved and locked:

- **G/H — Streak bonus thresholds:** `[3, 5, 8]` (correct streaks before bonus). Single source of truth at [`src/screens/_shared/gameplayConstants.ts:81`](MarianLearning/src/screens/_shared/gameplayConstants.ts#L81). Re-exported via [`src/screens/Math/constants.ts`](MarianLearning/src/screens/Math/constants.ts) and [`src/screens/WordSong/index.ts`](MarianLearning/src/screens/WordSong/index.ts).
- **K — Short-a pool:** keep `bat` and `dad` in `TARGET_WORDS`. Despite developmental concerns over animal/parent depictions, both ship.
- **L — Letter-tap cadence:** independent of math/word streaks — letter-tap timing isn't gated on the bonus thresholds.
- **M — Other content decisions:** see `project_spec_drift_decisions` for the full list.
- **N — Cross-vowel-mode pool-size floor (≥11) is a forcing function on borderline-vocab inclusion.** Cross-vowel-mode (PR #181) requires per-vowel CVC pools of ≥11 words to populate the discrimination matrix. This creates downstream pressure when a per-word vocab audit surfaces borderline-vocab candidates: dropping them for vocab clarity may push the pool below the floor and break cross-vowel-mode readiness. Empirically observed 2026-05-10: short-i shipped 8 words after `hip` (rosehip) and `rim` (wheel-rim) dropped voluntarily for vocab — already below the 11 floor; short-e and short-o-ext face the same pressure on `gem` (jewel-borderline) and `pop` (soda-vs-popping ambiguity). **Pool-spec authors should call out this trade-off explicitly when the audit-acceptable ceiling falls below the floor**, and flag whether the audit drop or the cross-vowel-mode coverage is the binding constraint for the dispatch decision. The picture-grounds-the-meaning pattern (used for `cot`, `hot`, `mom`) is a partial mitigation — the chip carries enough recognition that a borderline-vocab word can ship anyway, anchored by the picture.

Per `project_pic_dog_svg`: SVG vector is the locked format for dog and all future CVC pictures. No PNG-only assets, no PNG-in-SVG hybrids — a Phase 3 trace is the canonical output.

## Content-spec authoring conventions

Patterns that are non-obvious and have caused post-ship cleanup work across multiple tiers. Apply at spec-authoring time, not post-implementation.

### Research order vs implementation order — pin them explicitly

Dave's phonics research docs list words in **psycholinguistic / difficulty order** (the order they appear in the source literature). The shipped implementation constants — the planner pool and `wordPack.ts` target arrays — list words in **session-introduction order** (the order Marian encounters them across sessions). The two orderings differ whenever the recommended teaching sequence diverges from the research source's grouping; both are valid for their own purpose.

**Recurring defect pattern:** a spec's §0 prose (provenance / rationale) follows the research source, while §1's numbered table follows implementation intent — and neither section says which order it uses. Left implicit, they contradict each other and get deferred as "post-ship cleanup". The digraphs-th spec had exactly this defect (§0 in difficulty order, §1's table in introduction order), resolved in PR #234.

**Rule for spec authors:** §1's numbered word-pool table is always the canonical implementation order and must say so explicitly in its header or intro sentence. If §0's provenance prose uses a different order, add a one-line parenthetical noting it follows the research source and differs from §1. Never leave the discrepancy implicit — a one-line clarification at authoring time avoids a full PR cycle later.

## Cross-references

- Curriculum graph: see [`progress-and-persistence.md`](progress-and-persistence.md) for `Progress` shape, `SkillNode`, `SkillLevel`, mastery rule, focus-node picker.
- Source files: [`MarianLearning/src/screens/Math/`](MarianLearning/src/screens/Math/), [`MarianLearning/src/screens/WordSong/`](MarianLearning/src/screens/WordSong/), [`MarianLearning/src/screens/Hub/stages.ts`](MarianLearning/src/screens/Hub/stages.ts).
- Tests: [`distractors.test.ts`](MarianLearning/src/screens/Math/distractors.test.ts), [`sessionPlans.test.ts`](MarianLearning/src/screens/Math/sessionPlans.test.ts), [`planFromServer.test.ts`](MarianLearning/src/screens/Math/planFromServer.test.ts), [`wordDistractors.test.ts`](MarianLearning/src/screens/WordSong/wordDistractors.test.ts), [`wordPictures.test.tsx`](MarianLearning/src/screens/WordSong/wordPictures.test.tsx), [`plannerRoundTrip.test.ts`](MarianLearning/src/screens/WordSong/plannerRoundTrip.test.ts).
- Design docs: [`short-o-pool-expansion.md`](MarianLearning/design/word-song/short-o-pool-expansion.md), [`short-o-picture-pack-prompts.md`](MarianLearning/design/word-song/short-o-picture-pack-prompts.md), [`word-song-picture-pack.md`](MarianLearning/design/word-song-picture-pack.md), `design/screen-3-math.md`, `design/screen-4-word-song.md`, `design/screen-hub.md`.
- Marian's diagnostic baseline: `project_diagnostic_results` auto-memory + `CLAUDE.md` `## Marian's current levels`.
- Sibling-node naming rationale: `design/word-song/short-o-pool-expansion.md` §2 (Q3 locked 2026-05-04).
- Spec drift decisions: `project_spec_drift_decisions` auto-memory.
- Out of scope here: Progress shape (already in [`progress-and-persistence.md`](progress-and-persistence.md)), screen routing (Agent A), audio for problems / Howler / TTS (Agent B's `audio-system.md`), planner backend / canon (Agent B's `planner-and-canon.md`), Emma character (Agent D's `emma-character-and-animation.md`), test patterns (Agent D's `testing-and-ci.md`).
