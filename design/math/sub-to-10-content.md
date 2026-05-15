# Number Garden — `sub-to-10` content tier (16-fact pool, wrong-operation distractor, op-parameterized slow-fact threshold)

**Status:** APPROVED with all open questions locked (Thomas, 2026-05-15). Ready for Kevin's implementation. Devon's PR #238 design review passed with nits applied; see §11 for the locked decisions.
**Ticket:** TBD — Matt to file. This spec lands the design-side content for the FIRST subtraction tier in Number Garden. PR split locked at 2 (content + canon in PR 1; render + parser in PR 2).
**Authority:** `design/research/sub-to-10-fact-sequencing-marian.md` (Dave, 2026-05-15) — the curriculum-side authority on fact ordering, distractor design, dual-exposure rule, advancement gate, and op-specific slow-fact threshold. This spec consumes Dave's note verbatim where it makes a call and formalises it for Kevin's planner / canon / `distractors.ts` work.
**Predecessor research (read for context):** `design/research/math-distractor-and-streak-decisions.md` (Dave, 2026-04-25 — the gentle / off-by-one cutoff at problem 3); `design/research/add-to-10-counting-to-recall.md` (Dave, 2026-04-29 — Marian's finger-counting profile); `design/research/speed-feedback-automaticity-marian.md` (Dave, 2026-05-15 — verdict: NO speed-feedback UX; the slow-fact directive is a backend re-targeting tool, not a UI signal).
**Structural predecessor (precedent shape, cloned section-for-section):** `design/word-song/digraphs-th-word-list.md` (Kyle, 2026-05-14) — the most recently shipped content-tier spec. This is the first MATH content-tier spec; we mirror the word-song shape because Kevin already reads against it.

---

## 0. Why this spec, why now

- `sub-to-10` is the NEXT focus node on the Number Garden ladder after `add-to-10` (the only first-class math tier today). `MATH_TRACK_GUIDE` in [`api/_planner.ts`](../../api/_planner.ts) carries only a one-line skeleton for `sub-to-10`:
  ```
  - sub-to-10: subtraction with both operands and answer in 1-10. read: "<A> minus <B>. How many?" e.g. "Seven minus three. How many?"
  ```
  Haiku would hallucinate problems off this skeleton today. The planner needs a directive block on par with `add-to-10`'s (with fact-pool guidance, mix rules, and read-line template).
- Marian's April 2026 diagnostic: subtraction within 15 confident. She has the CONCEPT and a counting-back strategy. The gap is RETRIEVAL automaticity — the same gap as `add-to-10`. This tier exists to drill the retrieval pathway, NOT to teach the concept.
- Dave's research note (`sub-to-10-fact-sequencing-marian.md`) is the curriculum-side authority. This spec consumes it.
- **Dave's verdict on visual scaffolding** (`sub-to-10-fact-sequencing-marian.md` § Q2 / § Recommendations): **skip the CRA visual detour entirely.** The 4-chip recognition format IS the representational layer of CRA for a child with subtraction concept. Emma's read-aloud is the anchor. No ten-frame, no manipulatives, no number-line render. Net: this spec authors content for the existing Math chip-tap surface unchanged. No screen work; no UI primitives.
- **Dave's verdict on speed-feedback UX** (`speed-feedback-automaticity-marian.md`): NO speed-feedback UI. The slow-fact directive is a planner-side re-targeting tool. This spec formalises an op-specific threshold; the UI is not touched.

**Scope of this spec:**

- The 16-fact ordered pool (§1) with band + category + per-fact teaching note.
- The problem-mix rules for an 8-problem session drawn from the pool (§2).
- The two distractor classes for `sub-to-10`, including the NEW **wrong-operation distractor** (§3).
- The read-line template + per-slot utterance templates (§4).
- The schema posture — sub-to-10 reuses `MathFact { a, b, op: '-' }` with no new infrastructure (§5).
- The advancement gate (`add-to-20 → sub-to-10` promotion per the locked curriculum order) — accuracy-only per Dave (§6).
- The dual-exposure rule (never pair a `-` fact with its `+` inverse in the same session) (§7).
- The op-parameterized slow-fact threshold REQUEST for `slowFacts.ts` (§8).
- The wire-up checklist for Kevin (§9).
- The locked Thomas decisions on Q1 (curriculum order), Q2 (slow-fact threshold shape), Q3 (chip-range widening), Q4 (first-session framing) plus the locked PR split (§11).

**Out-of-scope:**

- **Implementation.** This spec hands off to Kevin (planner directive + canon bake + distractors extension + slowFacts parameterization).
- **`sub-to-20`** — a separate future tier, not specced here.
- **Speed-feedback UX** — killed by Dave's `speed-feedback-automaticity-marian.md`. No streak-fade-on-slow, no timer, no orange/yellow chip, no haptic.
- **CRA visual scaffolding** — Dave § Q2 ruled out (ten-frame, number-line, manipulative phase). The chip-tap is the representational layer.
- **Fact-family interleaving (mixed `+` and `-` in one session)** — Dave § Application supports it as a future direction (per McNeil et al. 2025) but the dual-exposure rule (§7) is the conservative posture for v1: do NOT pair a `-` problem and its `+` inverse in the same 8-problem session. A future spec can widen this once `sub-to-10` is established.
- **Major `Math.tsx` UI redesign.** Subtraction renders through the existing chip-tap pipeline; the screen is operation-agnostic. The PR-2 changes Kevin makes are argument plumbing (`op`, `distractorClass`, `minAnswer` through to `pickDistractors`) and the operator-glyph render (− vs + in the problem display); no layout, no new UI primitives, no new states.
- **Two-digit-numerals SSML.** The `[1, 10]` answer range stays within Azure's clean single-digit lexicon; no `<phoneme>` overrides needed.

---

## 1. The 16-fact pool — ordered, banded, categorised

The pool below is the union of facts Haiku may draw from for any `sub-to-10` session. The full single-digit subtraction surface with answers in `[0, 10]` contains 55 ordered pairs; the 16 below cover each difficulty band and conceptual category without redundancy (Dave § "Concrete fact ordering"). **All 16 are pool-eligible; the per-session mix rules (§2) drive how Haiku composes the 8 problems.**

### 1.1 Pool table (LOCKED — Dave § "Concrete fact ordering")

| #   | Fact      | Band   | Category        | Teaching note (per-fact, where non-obvious)                                                                                                                                                                                                                       |
| --- | --------- | ------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `5 − 5 = 0` | easy   | subtract-self   | `n − n = 0` rule. No counting — rule-application only. Among the fastest retrievals; baseline confidence-builder.                                                                                                                                                 |
| 2   | `8 − 8 = 0` | easy   | subtract-self   | Repeats the rule with a larger `n`; confirms generality. Do NOT drill both subtract-self facts in the same session — one per session is sufficient (§2.3).                                                                                                        |
| 3   | `7 − 0 = 7` | easy   | subtract-zero   | `n − 0 = n` rule (identity). No counting; rule-application only.                                                                                                                                                                                                  |
| 4   | `9 − 0 = 9` | easy   | subtract-zero   | Repeats the rule. Same one-per-session guidance as `subtract-self`.                                                                                                                                                                                               |
| 5   | `10 − 5 = 5` | easy   | doubles         | Doubles halving. Highly memorable; Marian knows `5 + 5 = 10` from `add-to-10`. Single-step finger-count.                                                                                                                                                          |
| 6   | `8 − 4 = 4` | easy   | doubles         | Doubles halving. Marian knows `4 + 4 = 8`.                                                                                                                                                                                                                        |
| 7   | `6 − 3 = 3` | easy   | doubles         | Doubles halving. Marian knows `3 + 3 = 6`.                                                                                                                                                                                                                        |
| 8   | `9 − 1 = 8` | easy   | subtract-one    | Count back one step; same scaffold as `n + 1` in addition. Easiest non-rule fact.                                                                                                                                                                                 |
| 9   | `10 − 1 = 9` | medium | subtract-one    | Count back one step; bridges the decade (anchor for take-from-10).                                                                                                                                                                                                |
| 10  | `10 − 2 = 8` | medium | subtract-two    | Count back two steps. **Watch wrong-operation lure** (`10 + 2 = 12`) — exemplar of the Class-2 wrong-op distractor (§3.2). The wrong-op value 12 falls outside `[0, 10]`, so the trap delivers via the off-by-one fallback (§3.2 "Out-of-range wrong-op fallback"). |
| 11  | `10 − 3 = 7` | medium | take-from-10    | Bridges through 10; highest-leverage facts. The make-10 mental model `add-to-20` will later depend on lives here.                                                                                                                                                 |
| 12  | `10 − 7 = 3` | medium | take-from-10    | Inverse of `7 + 3 = 10`. Expose deliberately to build the fact-family link — but **NEVER in the same session as `7 + 3 = 10`** (§7 dual-exposure rule).                                                                                                           |
| 13  | `9 − 4 = 5` | hard   | general         | No obvious shortcut; count-back or derive from `10 − 5`. Where retrieval gains will appear last.                                                                                                                                                                  |
| 14  | `8 − 3 = 5` | hard   | general         | No obvious shortcut; count-back. Wrong-op lure `11` is out of range (`maxAnswer=10`) → fall back to off-by-one (§3.2).                                                                                                                                            |
| 15  | `7 − 4 = 3` | hard   | general         | Often confused with `7 − 3 = 4` (the Robinson-2013 wrong-direction-of-compensation error). The off-by-one distractor is load-bearing here.                                                                                                                        |
| 16  | `9 − 6 = 3` | hard   | general         | Hardest in the pool. Subtrahend is large, not a clean anchor. Final-band fact.                                                                                                                                                                                    |

**Band counts:**

- `easy` — 8 facts (#1–8): subtract-self ×2, subtract-zero ×2, doubles ×3, subtract-one ×1.
- `medium` — 4 facts (#9–12): subtract-one ×1, subtract-two ×1, take-from-10 ×2.
- `hard` — 4 facts (#13–16): general ×4.

**Category counts:** subtract-self ×2 · subtract-zero ×2 · doubles ×3 · subtract-one ×2 · subtract-two ×1 · take-from-10 ×2 · general ×4.

### 1.2 Pool-composition cross-check

- **Answer range**: `[0, 9]`. Two facts (#1, #2) have `correct = 0`; the rest `correct ∈ [3, 9]`. **`correct = 0` is a NEW value in the math chip range** — `add-to-10` never produced `0` as a correct answer. Kevin's wire-up must confirm `ANSWER_RANGE_MIN = 1` in [`distractors.ts`](../../src/screens/Math/distractors.ts) is widened to `0` for `op === '-'` problems, OR the two subtract-self facts (#1, #2) are excluded from any session where the chip range can't be widened. See §3.3 + §9.
- **Minuend range**: `[5, 10]`. The most common minuend is `10` (#5, #9, #10, #11, #12 — five facts), reflecting the take-from-10 emphasis Dave calls out.
- **Subtrahend range**: `[0, 8]`.
- **`MathFact` representation**: every pool fact maps cleanly to `{ a: minuend, b: subtrahend, op: '-' }` — see §5.

### 1.3 Why these 16, not more

The 55-fact full surface contains many redundant facts (e.g. `7 − 1 = 6` and `5 − 1 = 4` both exemplify the subtract-one category without adding pedagogical signal). The 16-fact pool covers every difficulty band and category at a depth that supports Leitner box-aware re-targeting once latency + accuracy data accumulates. Pool extensions (more `general` band facts) can land in a follow-up tier; this pool is the v1 surface for Kevin's first canon bake.

---

## 2. Problem-mix rules — how Haiku draws 8 problems from the pool

The session is 8 problems, drawn from the 16-fact pool above. The mix obeys the warm-up + automaticity-targeting pattern established by `add-to-10` and tightened by Dave's research for `sub-to-10`.

### 2.1 Per-problem index mix

| Problem index | Tier         | Band source             | Distractor class (§3)                           | Why                                                                                                                                                |
| ------------- | ------------ | ----------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1            | gentle       | `easy` band only        | Class 0 — gentle (≥2 away, range extremes)      | Session opener. Dave § Application: "problems 1–3 should use well-spaced distractors regardless of how easy the fact itself is, to allow context calibration before tight discriminations begin." Same posture as `add-to-10`. |
| P2            | gentle       | `easy` band only        | Class 0 — gentle                                | Calibration continues.                                                                                                                             |
| P3            | gentle       | `easy` band only        | Class 0 — gentle                                | Marian has had 3 successful experiences before the trap distractors arrive — preserves the post-Dave `GENTLE_RAMP_THROUGH = 3` cutoff exactly.    |
| P4            | discriminate | `medium` or `hard` band | Class 1 — off-by-one **OR** Class 2 — wrong-op  | First diagnostic problem. Distractor class chosen randomly between Class 1 and Class 2.                                                            |
| P5            | discriminate | `medium` or `hard` band | Class 1 or Class 2                              | "                                                                                                                                                  |
| P6            | discriminate | `medium` or `hard` band | Class 1 or Class 2                              | "                                                                                                                                                  |
| P7            | discriminate | `medium` or `hard` band | Class 1 or Class 2                              | "                                                                                                                                                  |
| P8            | discriminate | `medium` or `hard` band | Class 1 or Class 2                              | Closer; full discriminative pressure.                                                                                                              |

### 2.2 Discriminate-tier distractor mix (P4–P8)

Of the 5 discriminate problems (P4–P8), **at least 2 MUST carry the wrong-operation distractor** (Class 2 — §3.2). The remaining 3 may use Class 1 (off-by-one) OR Class 2. Rationale: Dave § Q4 / Recommendations names the wrong-operation lure as the higher-leverage trap for `sub-to-10`; without an explicit minimum, Haiku may default-to-Class-1 because off-by-one was the only distractor type in `add-to-10`.

**Constraint flow at the planner directive level** (§4): Haiku is asked to TAG each P4–P8 problem with a `distractorClass: 'off-by-one' | 'wrong-op'` hint. The planner directive specifies the ≥2 minimum; `distractors.ts` at render time honours the hint when present (and falls back to a deterministic round-robin within the session if Haiku omits it — see §3.4).

### 2.3 Band coverage rules

- **At least one `easy`-band fact MUST appear in P1–P3** (gentle ramp); always true by §2.1 because problems 1–3 draw exclusively from the `easy` band.
- **At least one `take-from-10` fact (category #11–12) MUST appear in P4–P8.** Highest-leverage facts; Marian's future `add-to-20` make-10 mental model depends on them (Dave § "Haiku session design rules" #2).
- **No more than ONE fact per category in a single session.** Avoids 3-doubles-in-a-row monotony. Practically: at most one subtract-self, one subtract-zero, one doubles, one subtract-one, one subtract-two, two take-from-10 (the category is small and high-value — relaxed cap), and up to two `general`.
- **The dual-exposure rule (§7) applies** — never pair a `-` fact with its `+` inverse in the same session.
- **No duplicates within an 8-problem set** (same as `add-to-10`).

### 2.4 Recent-score modulation

The user message ships a `recentSuccessRate` for the focus node (§"Progress hint piping" in `architecture-overview.md`). The directive (§4) instructs Haiku to use this hint as in `add-to-10`:

- Low score (`< 0.5`) → favour `easy` band for the discriminate problems (substitute `easy` band facts for what would otherwise be `medium`/`hard`).
- High score (`≥ 0.85`) → push into `hard` band for the discriminate problems.
- Mid score or no data → balanced mix (default §2.1 distribution).

### 2.5 Leitner directive (forward-looking)

`sub-to-10` is **NOT** Leitner-active in v1. The Leitner gate in `_planner.ts:buildUserMessage` and `_planner.ts:isLeitnerActive` is currently scoped `track === 'math' && focusNode === 'add-to-10'`. A future Leitner widening to `sub-to-10` can use the same machinery (boxes 1–5, same prompt format). **Out of scope for this spec.** Kevin's wire-up checklist (§9) flags the gate scope as a TODO once the pool has accumulated 5+ sessions of latency + accuracy data.

### 2.6 Slow-fact directive (forward-looking, op-parameterized)

`sub-to-10` is **NOT** slow-fact-active in v1 (`buildSlowFactSessionHint` scope is `add-to-10` only). When it widens, the threshold for `op === '-'` MUST be calibrated separately from `op === '+'` — see §8. Kevin's wire-up checklist (§9) flags this.

---

## 3. Distractor design — three classes (gentle + off-by-one + NEW wrong-operation)

`sub-to-10` reuses the existing `pickDistractors(correct, problemIndex, maxAnswer)` API in [`src/screens/Math/distractors.ts`](../../src/screens/Math/distractors.ts) but EXTENDS it with a new third distractor class. The cutoff and gentle behaviour stay locked from Dave's 2026-04-25 consult.

### 3.1 Class 0 — gentle (P1–P3) — unchanged from `add-to-10`

Algorithm: two distractor values, each ≥2 away from `correct`, biased toward `[ANSWER_RANGE_MIN, maxAnswer]` extremes. Already implemented in [`distractors.ts:gentleDistractors`](../../src/screens/Math/distractors.ts). **No code change for `sub-to-10`** — same algorithm fires on `op === '-'` problems for `problemIndex ∈ {1, 2, 3}`.

**One range adjustment** — see §3.3: `gentleDistractors` may need `ANSWER_RANGE_MIN = 0` for `op === '-'` sessions if pool facts #1 / #2 (correct = 0) are ever drawn. Kevin's call.

### 3.2 Class 2 — wrong-operation distractor — NEW for `sub-to-10`

**Definition.** For a subtraction problem `a − b = c`, the wrong-operation distractor is `a + b` (the addition answer using the same operand pair). It targets the cognitive error Dave names as "applying the wrong operation" — the most impactful real-world confusion for subtraction (Dave § Q4: "the more impactful distractor to add is the **wrong-operation distractor**").

**Worked examples:**

- `10 − 2 = 8`, wrong-op distractor = `10 + 2 = 12`. **12 is out of range** (`maxAnswer = 10`). See "Out-of-range wrong-op fallback" below.
- `9 − 1 = 8`, wrong-op distractor = `10`. In range. Pair with an off-by-one (`7` or `9`) for the second distractor — but `9` would alias the wrong-op answer minus-one, so prefer `7`.
- `6 − 3 = 3`, wrong-op distractor = `9`. In range. Pair with `4` (off-by-one) for the second distractor.

**Scope.** Class 2 is conditional on `op === '-' && problemIndex >= 4`. Never fires for P1–P3 (gentle ramp). Never fires for `op === '+'` (addition has no equivalent meaningful "wrong-operation" lure within the `[1, 10]` range — the inverse would be `a − b`, often negative; see §3.6).

**Combined-pair shape (Class 2 plus a second distractor).**

For a Class-2 problem, the two distractors are:

| Slot      | Value                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------- |
| Trap      | `a + b` (the wrong-operation lure)                                                             |
| Secondary | The off-by-one near-miss (`c - 1` if in range, else `c + 1` if in range — `pickDistractors`'s off-by-one fallback applies) |

**Out-of-range wrong-op fallback.** If `a + b > maxAnswer` (e.g. `10 − 2 = 8` → wrong-op `12` out of range when `maxAnswer = 10`), fall back to a second off-by-one distractor. So `10 − 2 = 8` renders chips `{6, 8, 9}` (correct `8`, off-by-ones `7` and `9`, but `7` is in range so the fallback is the same `{7, 9}` off-by-one pair). Concretely: when wrong-op is OOR, the problem renders identically to a Class-1 off-by-one problem. **Haiku's distractorClass hint is then misleading** — `distractors.ts` must check range-fitness FIRST and silently downgrade to Class 1.

**Alias-collision check.** If the wrong-op value coincides with the off-by-one value (e.g. `correct + 1 === a + b`), the wrong-op pair degenerates to a single distinct distractor. Walk further on the off-by-one side: substitute `c - 2` (next-nearest in-range). Pool inspection: this collision never occurs for any pool fact in §1 because `a + b - c = 2 * b`, and for the pool no fact has `b = 0` (subtract-zero has `a + b = a` and `c = a`, so the collision is `correct === wrong-op` — see next paragraph for that case).

**Same-value collision (wrong-op aliases correct itself).** Only the subtract-zero facts (#3 `7 − 0 = 7`, #4 `9 − 0 = 9`) trigger this: wrong-op `7 + 0 = 7` equals correct `7`. In this case, Class 2 is **forbidden** for the problem — Haiku is instructed to use Class 1 (off-by-one) for subtract-zero facts. The two distractors degenerate to `{c-1, c+1}` clamped. **Already handled by the §2.3 rule "no subtract-zero in P4–P8 if a Class-2 distractor is forced"** — see directive in §4.2.

### 3.3 Answer range — widening `ANSWER_RANGE_MIN` to support `correct = 0`

Two pool facts produce `correct = 0`: #1 (`5 − 5`) and #2 (`8 − 8`). Today `ANSWER_RANGE_MIN = 1` in [`distractors.ts:58`](../../src/screens/Math/distractors.ts#L58). Kevin's wire-up has two options:

| Option | Behaviour                                                                                                      | Trade-off                                                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Widen `ANSWER_RANGE_MIN` to `0` for `op === '-'` problems only (operation-parameterized minimum, mirrors `maxAnswer`). | Cleanest. Subtract-self / subtract-zero facts work end-to-end. `0` becomes a valid chip value.                                                            |
| B      | Keep `ANSWER_RANGE_MIN = 1`; exclude pool facts #1, #2 from any session that needs distractor generation.       | Easier code change but Dave's pool is incomplete. Removes the rule-based identity facts that anchor the easiest band.                                     |

**Spec recommendation: Option A.** The rule-based identity facts (`n − n = 0`, `n − 0 = n`) are pedagogically high-value (Dave § Source 3 — Robinson 2013: Identity principle is the easiest derived-fact strategy, used correctly by 65–73% of children). Removing them drops the easiest band from 8 facts to 6 and forfeits the highest-confidence opener facts in the pool.

**Concrete change.** Add an optional parameter `minAnswer: number` to `pickDistractors`, default `ANSWER_RANGE_MIN`. For `op === '-'` callers, pass `0`. `gentleDistractors` and `offByOneDistractors` honour the new lower bound. Tests pin both bounds.

### 3.4 Distractor-class hint shape — planner → screen

Haiku emits `distractorClass` per discriminate problem (P4–P8) on the wire. The hint is a SOFT signal — `distractors.ts` may override it (range-fitness, collision avoidance per §3.2). Wire shape:

```ts
// MathProblem (browser shape) gains an optional field. Planner emits;
// `Math.tsx` reads when calling pickDistractors.
interface MathProblem {
  index: number
  addendA: number  // minuend when op === '-'
  addendB: number  // subtrahend when op === '-'
  op: '+' | '-'    // NEW — required when planner emits sub-to-10 content
  correct: number
  distractorClass?: 'off-by-one' | 'wrong-op'  // NEW — present on P4-P8 sub-to-10 problems
  utterances: MathProblemUtterances
}
```

The flat wire `read` text already disambiguates op (`"… minus …"` vs `"… plus …"`); the planFromServer.ts adapter widens its regex branch (see §9 "Parser widening").

### 3.6 Class 2 is sub-tier-only — `add-to-10` is explicitly UNCHANGED

For symmetry, consider: `3 + 5 = 8`, wrong-op = `3 − 5 = -2`. Negative numbers are out of any chip range. Even if the absolute value (`2`) is used, it lacks the pedagogical hook (no shared error pattern in addition-direction confusion at this age, per Dave § Q4). Class 2 is `sub-to-10`-and-future-sub-tiers only. **`add-to-10` continues to use Classes 0 and 1 only — no code change for `add-to-10`.**

---

## 4. Planner directive — `MATH_TRACK_GUIDE` `sub-to-10` block

Replace the one-line skeleton in [`api/_planner.ts:920`](../../api/_planner.ts#L920) with the directive block below. The block follows the same shape as `add-to-10`'s expanded directive ("Prefer bridge-through-5..." etc.) plus the sub-tier-specific guidance.

### 4.1 Block text (literal — Kevin's copy)

> ```
> - sub-to-10: subtraction with both operands in [0, 10] and answer in [0, 10]. read: "<minuend> minus <subtrahend>. How many are left?" e.g. "Seven minus three. How many are left?"
>
>   FIRST-SESSION READ-LINE — on the very first session on this node (lifetimeFirstEncounters['sub-to-10'] not yet set), use the warmer phrasing: "<minuend> take away <subtrahend>. How many are left?" e.g. "Eight take away three. How many are left?" This frames subtraction as physical removal, which matches Marian's mental model from counting back. Subsequent sessions revert to the "minus" template. Emma's voice config is unchanged — the SSML and prosody pipeline does not change for this tier.
>
>   FACT POOL (16 facts; pick exactly 8 distinct facts from this pool per session, no duplicates):
>   - Easy band — rule-application / single-step:
>     · 5-5=0, 8-8=0           (subtract-self — at most one per session)
>     · 7-0=7, 9-0=9           (subtract-zero — at most one per session)
>     · 10-5=5, 8-4=4, 6-3=3   (doubles — at most one per session)
>     · 9-1=8                  (subtract-one)
>   - Medium band — counting back / bridges:
>     · 10-1=9                 (subtract-one)
>     · 10-2=8                 (subtract-two)
>     · 10-3=7, 10-7=3         (take-from-10 — at most TWO per session, this category is high-value)
>   - Hard band — general:
>     · 9-4=5, 8-3=5, 7-4=3, 9-6=3  (general — at most two per session)
>
>   SESSION COMPOSITION RULES (apply IN ORDER):
>   1. Problems 1-3 (gentle ramp): draw EXCLUSIVELY from the easy band. Calibration window; no traps yet.
>   2. Problems 4-8 (discriminate): draw from medium + hard bands. Recent-score modulation: low score (< 0.5) → bias toward medium; high score (>= 0.85) → bias toward hard; mid score → balanced.
>   3. At least one take-from-10 fact (10-3 or 10-7) MUST appear somewhere in problems 4-8.
>   4. DUAL-EXPOSURE RULE: never pair a subtraction fact and its addition inverse in the same session. E.g. if 10-7=3 is included, 7+3=10 (or 3+7=10) is FORBIDDEN. This rule is forward-compatible — when Marian later moves to mixed add+sub sessions, this rule remains in force per Dave's research on inverse-principle interference.
>   5. NO duplicate facts within the 8-problem set.
>   6. Category cap: at most one each of subtract-self, subtract-zero, doubles, subtract-one, subtract-two; at most two of take-from-10; at most two of general.
>
>   DISTRACTOR-CLASS HINT (for problems 4-8 only):
>   Tag each P4-P8 problem with `distractorClass: "off-by-one" | "wrong-op"`. At least 2 of the 5 problems P4-P8 MUST be tagged "wrong-op" (the trap is `minuend + subtrahend` — the addition answer using the same pair). DO NOT use "wrong-op" for subtract-zero facts (the wrong-op would alias the correct answer). For subtract-self facts placed in P4-P8 (unusual since they live in the easy band, but technically possible if recent-score is very high), prefer "wrong-op" — the lure is `2n`, a strong distractor. Problems 1-3 are NEVER tagged (they use the gentle ramp).
>
>   PROSODY: numbers are spelled out as words ("zero", "one", "two", ... "ten"). Capitalize the first word of each sentence. The "minus" / "take away" template renders cleanly on `en-US-EmmaMultilingualNeural` rate -10%; no SSML overrides required for any value in [0, 10].
> ```

### 4.2 Per-slot utterance templates

The 5-slot per-problem utterance shape is unchanged from `add-to-10` (`read`, `correct`, `reprompt`, `hint`, `giveAnswer`). Slot-by-slot:

| Slot         | Template                                                                                                                                | Example for `10 − 2 = 8`                                       | Notes                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `read`       | `"<minuend> minus <subtrahend>. How many are left?"` *(first-session of node: `"<minuend> take away <subtrahend>. How many are left?"`)* | `"Ten minus two. How many are left?"`                          | "are left" framing follows Dave § Q2 (concrete-removal mental model).                                                                                                |
| `correct`    | `"Yes! <answer>!"` (same as `add-to-10`)                                                                                                | `"Yes! Eight!"`                                                | **Article-led variant NOT applicable** — math celebration template differs from word-song's `"Yes! That's a <word>."`; the math correct is bare number-celebration. No bang-fallback list. |
| `reprompt`   | `"Hmm... try again?"` (verbatim, same as `add-to-10`)                                                                                   | `"Hmm... try again?"`                                          | Locked phrasing — do NOT vary.                                                                                                                                       |
| `hint`       | `"Look. <minuend>. Take away <subtrahend>. How many now?"`                                                                              | `"Look. Ten. Take away two. How many now?"`                    | Mirrors `add-to-10`'s "Look. Three. And two more. How many now?" structure. Uses "take away" framing in the hint regardless of read-line variant (the hint is a scaffold, not a primary read). |
| `giveAnswer` | `"This one is <answer>."` (same as `add-to-10`)                                                                                         | `"This one is eight."`                                         | Locked.                                                                                                                                                              |

**`correct = 0` celebration form.** For subtract-self facts (#1, #2), the correct line is `"Yes! Zero!"`. The word "zero" reads cleanly on `en-US-EmmaMultilingualNeural` — no SSML override required.

### 4.3 First-encounter scaffolding gate

Per `architecture-overview.md` §"Session-start derived-state blocks" and `api/_firstEncounterGate.ts:FIRST_ENCOUNTER_GATED_NODES`, the math node `sub-to-10` needs to be added to the gated set so the `read`-line variant ("take away" on first session, "minus" subsequent) is driven by `Progress.lifetimeFirstEncounters['sub-to-10']`.

**Current state of the gate.** `FIRST_ENCOUNTER_GATED_NODES` in [`api/_firstEncounterGate.ts`](../../api/_firstEncounterGate.ts) today contains ONLY `'cvc-words-short-o'`. No math node is yet in the gated set — `sub-to-10` is the FIRST math node to enter the first-encounter-gating system. The unit test `getFirstEncounterGatedNodes › does NOT include any math focus nodes` at [`_firstEncounterGate.test.ts:99-110`](../../api/_firstEncounterGate.test.ts#L99-L110) is a NEGATIVE-assertion guard (`expect(gated).not.toContain(mathNode)`) — it currently passes because no math node is gated. Adding `'sub-to-10'` to `FIRST_ENCOUNTER_GATED_NODES` will break this test; Kevin's wire-up must revise it (see §9.4).

**Behaviour:**

- Session 1 on this node (`lifetimeFirstEncounters['sub-to-10'] === undefined`): use `"<minuend> take away <subtrahend>. How many are left?"`.
- Sessions 2+: use `"<minuend> minus <subtrahend>. How many are left?"`.

The gate fires once-per-lifetime (the existing `Progress.lifetimeFirstEncounters` semantics). The gate flag is set AT session-start when the planner emits the variant; subsequent sessions read the flag and skip the variant. No retroactive flip.

**Why the gate.** Dave § Q2 / Recommendations: "the 'take away' phrasing is conceptually grounded and maps onto physical removal, which is the mental model Marian uses when counting back. This is a copy decision for Kyle/Kevin, not a full representational detour." Limiting it to the first session avoids the cognitive load of a phrasing-variability signal across the tier; the "minus" phrasing aligns with how subtraction is named in standard practice and how she'll encounter it long-term.

---

## 5. Schema posture — `MathFact` reuse, `op: '-'`, NO new infrastructure

`sub-to-10` introduces NO new TypeScript types. Every fact uses the existing [`MathFact`](../../src/lib/progress/types.ts) shape:

```ts
interface MathFact {
  a: number             // minuend for op === '-'
  b: number             // subtrahend for op === '-'
  op: '+' | '-' | '*'   // '-' for sub-to-10
}
```

**Wire-shape changes.** The on-the-wire `MathProblem` shape (server → browser) needs:

1. A required `op: '+' | '-'` field on every problem. Today `MathProblem` infers `op = '+'` because `add-to-10` is the only first-class math tier. Widening to include `op` is mechanical; the field is REQUIRED on `sub-to-10` problems. Make the field REQUIRED on all math problems (default `'+'` for `add-to-10` to preserve backwards compatibility on canon and the static fallback) so callers cannot forget to set it. See §9 "Wire-shape widening".
2. An optional `distractorClass?: 'off-by-one' | 'wrong-op'` field on `MathProblem` (§3.4). Only present on `sub-to-10` P4–P8; absent on `add-to-10` problems entirely.

**Browser parser adapter.** [`planFromServer.ts:parseReadAddends`](../../src/screens/Math/planFromServer.ts) is anchored to `"X plus Y. How many?"`. The widening regex must accept `"X minus Y. How many are left?"` and `"X take away Y. How many are left?"` and tag the parsed problem with `op: '-'`. Per `project_planner_parser_contract.md` memory: **widen the browser parser BEFORE widening the planner.** Sequencing in Kevin's PR matters — see §9.

**No `slowFacts.ts` changes for v1.** The op-parameterized threshold (§8) is a separate task gated on `sub-to-10` being added to the slow-fact directive scope. v1 ships content + canon only; slow-fact widening lands in a follow-up.

**No screen-side changes.** `Math.tsx` is operation-agnostic; chip-rendering and gesture handling consume `MathProblem` without inspecting `op`. The audio path consumes `read` text verbatim; "minus" / "take away" speak naturally with the Emma voice without phoneme overrides.

---

## 6. Advancement gate — `add-to-20 → sub-to-10` (ACCURACY ONLY)

Per the locked curriculum order (§11 Q1), `sub-to-10` sits AFTER `add-to-20` in the tree. The advancement gate is therefore `add-to-20 → sub-to-10`, not `add-to-10 → sub-to-10`. Dave's research note frames the promotion as accuracy-only regardless of which addition tier is the predecessor; the rule applies the same way:

> The predecessor node qualifies for promotion when ≥ 95% accuracy across 3 consecutive `cross-day-deduped` sessions (math default threshold `95/3` locked 2026-05-02, ticket 86c9kwvy0; see `progress-and-persistence.md` § "Mastery rule").

**Explicitly NOT a gate:**

- ❌ Slow-fact list length. Even if Marian's predecessor-node slow-fact list is large, she advances to `sub-to-10` once accuracy holds. **Dave § Recommendations / Risks: holding her on the predecessor past 95% waiting for latency to drop is _developmentally backwards_ for this transition — fact-family exposure via `sub-to-10` is itself part of the treatment for slow upstream addition facts (McNeil et al. 2025).** The rationale Dave originally framed against `add-to-10 → sub-to-10` applies equally to `add-to-20 → sub-to-10`: subtraction practice tightens addition-fact retrieval via the inverse-principle.
- ❌ Latency median. The slow-fact directive is a backend re-targeting tool; it does NOT inform promotion (Dave's `speed-feedback-automaticity-marian.md` § Recommendation 7).

**Hard stop (parent / observation gate, NOT algorithmic):** Dave § Q6 — do NOT advance if Marian shows emotional distress signals (session abandonment, repeated retries with no improvement). This is a Thomas / parent observation lever, exercised via the existing Parent Settings `autoPromote: false` flag.

**Code implication.** NO code change to `applyMasteryRule` or `pickFocusNode`. The existing rule already promotes on accuracy alone. This spec affirms the existing behaviour is correct for the `add-to-20 → sub-to-10` transition and documents the rationale.

**Rationale to capture in `.claude/docs/progress-and-persistence.md`.** Per Dave's research note "Non-obvious findings" #3: any future code path that gates promotion on "slow-fact list is short" would be developmentally backwards for this specific transition. Worth documenting in `progress-and-persistence.md` § "Focus-node picker" as a "DO NOT gate on slow-fact list length" footnote. This is a documentation update flagged for `maintain-docs` routing — not a Kevin task.

---

## 7. Dual-exposure rule — never pair a `-` fact with its `+` inverse in the same session

**Rule (LOCKED — Dave § Q3 / Recommendations / Risks).**

> Within an 8-problem `sub-to-10` session, no subtraction fact and its addition inverse may co-occur.

**Definition.** For a subtraction fact `a − b = c`, the addition inverses are `b + c = a` and `c + b = a`. **Both** orderings are forbidden in the same session as the subtraction fact.

**Examples:**

- ✅ Session contains `10 − 7 = 3`; `7 + 3 = 10` is FORBIDDEN; `3 + 7 = 10` is FORBIDDEN.
- ✅ Session contains `8 − 3 = 5`; `3 + 5 = 8` is FORBIDDEN; `5 + 3 = 8` is FORBIDDEN.
- ✅ Session contains `5 − 5 = 0`; `0 + 5 = 5` is FORBIDDEN; `5 + 0 = 5` is FORBIDDEN.

**V1 enforcement scope.** `sub-to-10` sessions are pure-subtraction in v1 (per `MATH_TRACK_GUIDE` `sub-to-10` block — all 8 problems use `op === '-'`). Within a single 8-problem subtraction set, two `−` facts can be inverses of each other ONLY if they reference the same operand triple (e.g. `10 − 7 = 3` and `10 − 3 = 7`) — these are NOT forbidden (different operand pairs, same triple). The dual-exposure rule applies to `−` ↔ `+` cross-operation pairing, not `−` ↔ `−`.

**Forward-compatibility.** When future spec widens the planner to mixed-operation sessions (sometimes referred to as fact-family interleaving), the dual-exposure rule MUST remain in force. The directive block in §4.1 (rule #4) is forward-compatible — the prohibition is on operand-triple co-occurrence regardless of where the `+` problem comes from.

**Enforcement layer.** Single source of truth is the planner directive (§4.1 rule #4). Haiku enforces; the parser does NOT re-validate (parsing dual-exposure across operations would require both `+` and `-` parser branches to coordinate, and the v1 pool is pure-`−` so there's nothing to coordinate against).

---

## 8. Op-parameterized slow-fact threshold — REQUEST for Kevin's `slowFacts.ts`

**Out of scope for THIS spec to author** — flagged here as a Kevin TODO for a separate PR (§9).

**Problem.** Today [`src/lib/progress/slowFacts.ts:69`](../../src/lib/progress/slowFacts.ts#L69) defines `SLOW_FACT_MIN_MEDIAN_LATENCY_MS = 5000` — a single global threshold. Per Dave § Source 6 (Geary et al. 2007), subtraction retrieval mean RT in 2nd graders is _systematically_ higher than addition RT for comparable facts because subtraction lacks the rehearsal scaffolding addition gets from counting-on. Applying the same 5 s threshold to `op === '-'` will flood the slow-fact payload on early `sub-to-10` sessions (every new subtraction fact will look slow), defeating the canon-first fast-path because non-empty slowFacts bypasses canon AND the in-memory cache (`planner-and-canon.md` § "Track-based payload" — `slowFacts` bypass posture).

**Proposed shape — operation-parameterized + tenure-aware threshold.** Per Dave's "Non-obvious findings" #1:

| Operation | Sessions on the node | Threshold (ms) |
| --------- | -------------------- | -------------- |
| `+`       | any                  | `5000`         |
| `−`       | 1 – 10               | `7000`         |
| `−`       | 11 – 20              | `6000`         |
| `−`       | 21 +                 | `5000`         |
| `*`       | any                  | `5000` (placeholder — re-evaluate when multiplication tier ships) |

The session-tenure count is `progress.history.filter(e => e.skillFocus.includes('sub-to-10')).length` evaluated at slow-fact-build time.

**Alternative simpler shape (RECOMMENDED for v1 of the slowFacts widening).** Suppress the slow-fact directive entirely for the first 5 `sub-to-10` sessions (treat the node as "new tier, baseline phase") and only engage it once `progress.history` for the node has ≥ 5 entries — then apply a flat `op === '-' → 6000 ms` threshold. This is simpler than the 3-band tenure ladder above and still avoids the cold-start flood. **Kevin's call between the 3-band ladder and the flat threshold + 5-session warmup.**

**Code-change shape.**

```ts
// slowFacts.ts — add operation-aware threshold accessor
export function slowFactLatencyThresholdMs(
  op: '+' | '-' | '*',
  nodeSessionCount: number,
): number {
  if (op !== '-') return SLOW_FACT_MIN_MEDIAN_LATENCY_MS // 5000
  if (nodeSessionCount < 10) return 7000
  if (nodeSessionCount < 20) return 6000
  return SLOW_FACT_MIN_MEDIAN_LATENCY_MS
}
```

Or for the recommended simpler shape:

```ts
const SUB_SLOW_FACT_WARMUP_SESSIONS = 5
const SUB_SLOW_FACT_THRESHOLD_MS = 6000
// inside buildSlowFactSessionHint, after the per-fact aggregation pass:
if (sessionCountForFocusNode < SUB_SLOW_FACT_WARMUP_SESSIONS) return []
```

**Out of scope here.** Kevin chooses. This spec FLAGS the requirement; the slowFacts widening is its own PR. Dependencies:

1. The slow-fact directive scope (`isSlowFactsActive` in [`_planner.ts:726`](../../api/_planner.ts#L726)) must widen to include `sub-to-10` BEFORE the threshold change matters.
2. The `buildSlowFactSessionHint` function must take the focus-node argument so it can count node-tenure (today it doesn't — it scans the whole `progress.history` for add-to-10 entries via `isAddToTenEntry`).

**Suggested order.** Land sub-to-10 content + canon first (the current scope of this spec). Slow-fact widening lands in a follow-up after Marian has generated 5+ `sub-to-10` sessions and the latency profile can be sanity-checked against the proposed threshold.

---

## 9. Wire-up checklist for Kevin

This is the ONLY actionable list for the implementing developer. Everything above is rationale + content; everything below is what changes in code.

> **Dependency order is load-bearing.** Per `project_planner_parser_contract.md`: widen the browser parser BEFORE widening the planner. Items below are numbered in safe-merge order.

### 9.1 Parser widening (FIRST — must land before any planner widening)

- [ ] **`src/screens/Math/planFromServer.ts` — HARD REQUIREMENT — add `"zero": 0` to `NUMBER_WORDS`.** Today [`planFromServer.ts:84-104`](../../src/screens/Math/planFromServer.ts#L84-L104) maps `"one"` → `1` through `"twenty"` → `20`. It does NOT contain `"zero"`. Sub-to-10 facts #3 (`7 − 0 = 7`) and #4 (`9 − 0 = 9`) produce read-lines containing the word "zero" ("seven minus zero is seven", "nine minus zero is nine"); the parser routes numeric tokens through `NUMBER_WORDS` and will throw `PlanFromServerError` on these facts without the entry. **Kevin MUST add `"zero": 0` to `NUMBER_WORDS` in this PR.** Devon's audit of the live source confirms the gap.
- [ ] **`src/screens/Math/planFromServer.ts`** — widen the regex / parse path to accept the `sub-to-10` read templates and tag parsed problems with `op: '-'`:
  - Match `"<minuend-word> minus <subtrahend-word>. How many are left?"`
  - Match `"<minuend-word> take away <subtrahend-word>. How many are left?"` (first-session variant)
  - Keep matching the existing `"<addend-A-word> plus <addend-B-word>. How many?"` template — tag with `op: '+'`.
- [ ] **`src/screens/Math/sessionPlans.ts`** — add `op: '+' | '-'` to `MathProblem` (REQUIRED). Default `'+'` for all existing fallback plans. Add `distractorClass?: 'off-by-one' | 'wrong-op'` (OPTIONAL).
- [ ] **`src/screens/Math/planFromServer.ts`** — pass `op` through into the rehydrated `MathSessionPlan`.
- [ ] **Tests** — `planFromServer.test.ts` gains read-template fixtures for `sub-to-10`: both "minus" and "take away" variants. Include explicit fixtures for `7 - 0 = 7` and `9 - 0 = 9` (the subtract-zero pool facts that require the new `"zero"` entry — parse failure here is the regression Devon flagged). Assert `op === '-'` after parse.
- [ ] **CI gate** — vitest passes locally (`npx vitest run` per `feedback_run_vitest_before_merge`).

### 9.2 Distractor extension

- [ ] **`src/screens/Math/distractors.ts`** — extend `pickDistractors(correct, problemIndex, maxAnswer, opts?)` with:
  - Optional `op?: '+' | '-'` (default `'+'`).
  - Optional `minAnswer?: number` (default `ANSWER_RANGE_MIN`). For `op === '-'` callers, pass `0`.
  - Optional `distractorClass?: 'off-by-one' | 'wrong-op'` (Haiku's hint, soft signal).
  - New `wrongOpDistractors(correct, a, b, problemIndex, [minAnswer, maxAnswer])` internal function:
    - Computes `a + b` as the trap.
    - Pairs with `correct ± 1` as the secondary (off-by-one fallback per §3.2).
    - Falls back to Class 1 (`offByOneDistractors`) when `a + b > maxAnswer` (out-of-range trap) OR `a + b === correct` (subtract-zero alias).
  - Dispatch logic: P1–P3 → `gentleDistractors`; P4+ with `op === '-'` AND `distractorClass === 'wrong-op'` (or fallback round-robin) → `wrongOpDistractors`; P4+ otherwise → `offByOneDistractors`.
- [ ] **`src/screens/Math/distractors.test.ts`** — pin every pool fact (§1.1) against expected distractor outputs for both Classes 1 and 2. Pin the alias / OOR fallbacks. Pin the gentle ramp on subtract-self facts (correct = 0) confirms `minAnswer = 0` widening works.
- [ ] **Wire `op` + `distractorClass` through the screen.** `Math.tsx` invokes `pickDistractors` with the new args. No render logic changes; just argument plumbing.

### 9.3 Planner directive — `MATH_TRACK_GUIDE` `sub-to-10` block

- [ ] **`api/_planner.ts:920`** — replace the one-line `sub-to-10` skeleton with the directive block in §4.1.
- [ ] **`api/_planner.ts`** — verify the system-prompt JSON contract carries `op` and (optional) `distractorClass` in the emitted `MathProblem` shape. Update the example JSON in the system prompt if `add-to-10`'s example currently shows only `+` problems.
- [ ] **`api/_planner.test.ts`** — add a focused test: stub Haiku, feed back a `sub-to-10` plan, assert: (a) every problem has `op: '-'`; (b) at least one take-from-10 fact appears in P4-P8; (c) at least 2 of P4-P8 carry `distractorClass: 'wrong-op'`; (d) no operand-triple co-occurs as `-` and `+` (dual-exposure).
- [ ] **`api/_planner.ts:effectiveFocusNode`** — confirm `sub-to-10` is NOT in `WORD_SONG_FIRST_CLASS_FOCUS_NODES` (it's math, not word-song; just sanity-check no off-by-one mistake). Math honours caller-supplied focusNode verbatim; no change needed there.

### 9.4 First-encounter gate

- [ ] **`api/_firstEncounterGate.ts`** — add `'sub-to-10'` to `FIRST_ENCOUNTER_GATED_NODES`. Today the set contains only `'cvc-words-short-o'`; `sub-to-10` is the FIRST math node to enter first-encounter gating.
- [ ] **`api/_planner.ts:buildUserMessage`** — wire the first-encounter check into the user-message construction so the read-line variant is selected per session (`"take away"` on first-encounter, `"minus"` otherwise).
- [ ] **`api/_firstEncounterGate.test.ts:99-110`** — REVISE OR REPLACE the existing negative-assertion test `'does NOT include any math focus nodes'`. That test enumerates `['add-to-10', 'add-to-20', 'sub-to-10', 'sub-to-20', 'two-digit-addsub']` and asserts NONE are gated — adding `'sub-to-10'` to the set will make it fail. The current test was a design statement ("math nodes are not first-encounter-gated") that remains true for every math node EXCEPT `sub-to-10`. Replace with per-node assertions:
  - `expect(getFirstEncounterGatedNodes()).toContain('sub-to-10')` — the new gated math node.
  - For each of `'add-to-10'`, `'add-to-20'`, `'sub-to-20'`, `'two-digit-addsub'`: `expect(getFirstEncounterGatedNodes()).not.toContain(mathNode)` — these remain non-gated.
  Keep the existing pass-through and rewrite-case suites unchanged; only the `getFirstEncounterGatedNodes` describe block needs the per-node split.

### 9.5 Canon prebake

- [ ] **`scripts/generateSessionCanon.ts:activeCombos()`** — confirm `sub-to-10` is in `MATH_FOCUS_NODES` iteration set. It SHOULD already be (the iteration set typically covers all `VALID_MATH_FOCUS_NODES`); verify and add if missing.
- [ ] **`npm run canon:regen`** — incremental regen for `sub-to-10` only:
  ```
  rm public/canon/math/level-1/sub-to-10.json
  cp .env.local <worktree>/.env.local           # canon-bake needs the keys
  yarn install --frozen-lockfile               # worktree needs node_modules
  npx tsx scripts/generateSessionCanon.ts --require-keys
  ```
  Per `planner-and-canon.md` § "Incremental-by-default trick". Bake produces ~25s of work and ~$0.005 of Haiku + Azure spend. Commit the JSON diff in the same PR.
- [ ] **Canon-lint gate** — `npm run canon:lint` must pass (ASCII-7 only, no slash-IPA, no angle tags). The "minus" / "take away" / "How many are left" templates are all ASCII; no risk.
- [ ] **`scripts/generateSessionCanon.test.ts`** — the combo-count regression assertion should pick up `sub-to-10` automatically if it's already in the iteration set; if the test pins the count explicitly, bump.

### 9.6 Mastery / focus-node picker — NO CHANGE

Per §11 Q1 (Thomas, 2026-05-15): **leave the tree alone.** Existing curriculum order is `number-recog → add-to-10 → add-to-20 → sub-to-10 → sub-to-20 → ...`; that's the order that ships.

- [ ] **`src/lib/progress/mastery.ts`** — NO CHANGE to `MATH_TREE`.
- [ ] **`src/lib/progress/focusNode.ts`** — NO CHANGE to `MATH_NODES_IN_ORDER`.
- [ ] **`applyMasteryRule` / `pickFocusNode`** — NO CODE CHANGE. The promotion rule applies as-is.
- [ ] **`src/lib/progress/defaults.ts:93`** — **HARD REQUIREMENT** — flip `'sub-to-10': 'mastered'` to `'sub-to-10': 'practicing'` in `DEFAULT_SKILL_LEVELS`. Marian's April 2026 diagnostic marked subtraction-within-15 as confident, so the existing default is `'mastered'` — but Dave's research treats `sub-to-10` as a retrieval-automaticity tier (the same gap as `add-to-10`), and leaving it `'mastered'` means a fresh Marian would never see `sub-to-10` problems. Devon's PR #238 review flagged this; Thomas confirmed the flip 2026-05-15. Note: this only affects greenfield boots; existing Marian localStorage state is unaffected (her live blob is what it is).

### 9.7 Slow-fact widening — DEFERRED FOLLOW-UP

- [ ] **(FOLLOW-UP PR)** Implement op-parameterized threshold in `slowFacts.ts` per §8. Two design choices on the table; Kevin picks. NOT in this PR.

### 9.8 Test coverage minimums

- [ ] Unit: parser (every pool fact's read-line parses with correct `op`), distractors (every pool fact × both classes), planner stub (composition rules #1-6 from §4.1 enforced).
- [ ] E2E (Jessica): Per `feedback_progression_e2e_mandatory` — any PR touching `mastery.ts` / `focusNode.ts` / `firstEncounterGate.ts` / `parentSettings.ts` requires a failing-first E2E spec. Kevin's PR touches `_firstEncounterGate.ts` for the read-line variant gate — Jessica must author an E2E spec at `e2e/sub-to-10-first-encounter.spec.ts` covering: (a) first-session read-line is "take away"; (b) second session is "minus"; (c) the `lifetimeFirstEncounters['sub-to-10']` flag flips at session-start, not session-end. **DISPATCH-TIME REQUIREMENT** — must be paired with the implementation PR, not a follow-up.
- [ ] Self-test report on the PR per `feedback_self_test_report`: AC walkthrough + side-effect inventory.

### 9.9 Docs

- [ ] **`.claude/docs/skill-trees-and-content.md`** — append a "Math distractors — Class 2 (wrong-operation) for `sub-to-10`" subsection under "Math distractors". Document the algorithm + scope (sub tier only, P4-P8 only). Note that `add-to-10` is unchanged.
- [ ] **`.claude/docs/progress-and-persistence.md`** — under "Mastery rule" or "Focus-node picker", add a footnote: "Promotion is accuracy-only; do NOT introduce a slow-fact-list-length gate for `add-to-10 → sub-to-10` (Dave's research confirms fact-family exposure via the next tier is itself therapeutic for slow upstream facts; gating on slow-list-shortness would be developmentally backwards)."

---

## 10. Acceptance criteria

Testable by Jessica's Playwright suite + Kevin's vitest suite.

- [ ] **AC1**: The 16-fact pool is faithfully encoded in `MATH_TRACK_GUIDE`'s `sub-to-10` block (vitest snapshot on the directive block; planner-test asserts pool membership).
- [ ] **AC2**: Every Haiku-generated `sub-to-10` plan composition rule from §4.1 holds: P1-P3 from `easy` band, ≥1 take-from-10 in P4-P8, ≥2 `wrong-op` tagged in P4-P8, no duplicates, no operand-triple `−`/`+` co-occurrence within the 8-problem set, category caps respected.
- [ ] **AC3**: First-encounter gate — session 1 on `sub-to-10` uses "take away"; sessions 2+ use "minus". Verified via E2E with seeded `lifetimeFirstEncounters`.
- [ ] **AC4**: Class 2 distractors fire correctly: for every pool fact in P4-P8 with `distractorClass === 'wrong-op'`, one of the two chip distractors is `minuend + subtrahend` when in range; OOR cases fall back to Class 1 (off-by-one); subtract-zero same-value collisions silently downgrade to Class 1.
- [ ] **AC5**: `correct = 0` chip values render and play correctly (subtract-self facts #1, #2). Emma says "Yes! Zero!" naturally on the cheerful celebration prosody.
- [ ] **AC6**: Read-line parser accepts both `sub-to-10` templates and tags problems with `op: '-'`; existing `add-to-10` "X plus Y. How many?" continues to parse with `op: '+'`.
- [ ] **AC7**: Canon JSON `public/canon/math/level-1/sub-to-10.json` baked and committed. Canon-lint passes (ASCII-7, no slash-IPA, no angle tags). File parses via `isSessionStartResponse`.
- [ ] **AC8**: Advancement gate — `add-to-20 → sub-to-10` (the curriculum-order slot per §9.6, decision locked §11 Q1) fires on accuracy threshold alone, NOT influenced by slow-fact list length. Verified via existing mastery tests; no new gate added.
- [ ] **AC9**: Dual-exposure rule — within any single 8-problem session, no operand triple appears in both `+` and `-` forms. Today vacuously true because v1 sessions are pure-`−`; covered by the planner test enumerating all 8 problems.
- [ ] **AC10**: Slow-fact directive remains DISABLED for `sub-to-10` in v1 (`isSlowFactsActive` predicate unchanged — gated on `focusNode === 'add-to-10'`); the §8 op-parameterized threshold lands in a follow-up PR.
- [ ] **AC11**: `op` field is required on every `MathProblem` emitted by the planner. Backwards compatibility — existing `add-to-10` canon entries can be lazily migrated by `planFromServer.ts` (default `'+'` when absent) so a stale-canon `add-to-10` doesn't break.

---

## 11. Decisions locked (Thomas, 2026-05-15)

The four questions originally surfaced as open are now resolved. The spec is the contract for Kevin's implementation; the section below records the decisions and rationale so Kevin doesn't have to re-derive them.

**Q1 — Curriculum order: insert `sub-to-10` between `add-to-10` and `add-to-20`, or leave it after `add-to-20`?**

**DECIDED: Option A — leave the tree alone.** Tree stays `number-recog → add-to-10 → add-to-20 → sub-to-10 → sub-to-20 → ...`. NO changes to `MATH_TREE` in [`src/lib/progress/mastery.ts`](../../src/lib/progress/mastery.ts) or `MATH_NODES_IN_ORDER` in [`src/lib/progress/focusNode.ts`](../../src/lib/progress/focusNode.ts).

Rationale: A re-ordering would be a progression-state-machine change that per `feedback_progression_e2e_mandatory` requires a paired failing-first E2E spec at dispatch time, and would carry the risk of stale `Progress` blobs landing on a node out of expected order. Dave's "next on the curriculum ladder" framing is satisfied by interpretation ("next *subtraction* node," which is unambiguously `sub-to-10`); no pedagogical signal forces re-ordering. Ship `sub-to-10` in its existing slot after `add-to-20`; revisit ordering only if real-Marian data signals a need.

**Q2 — Slow-fact threshold implementation: tenure-banded ladder vs. flat warmup-then-threshold?**

**DECIDED: flat 6000 ms + 5-session warmup for `op === '-'`.** Kevin implements the simpler shape from §8 ("Alternative simpler shape"); the 3-band tenure ladder is dropped.

Rationale: There is no empirical `sub-to-10` latency data yet against which to calibrate a 3-band ladder, so the ladder's threshold cliffs (7000 → 6000 → 5000) are speculative. A flat 6000 ms threshold gated by a 5-session warmup avoids the cold-start flood (per `planner-and-canon.md` § "Track-based payload" — non-empty `slowFacts` bypasses canon AND the in-memory cache, which would otherwise tank the canon-first fast-path) while keeping the implementation surface narrow. Retune once Marian has generated ≥ 10 `sub-to-10` sessions and the latency profile is visible in production data. This work remains a follow-up PR (not in this PR's scope per §9.7).

**Q3 — Widen `ANSWER_RANGE_MIN` to 0 for `op === '-'`, or drop subtract-self / subtract-zero facts from the pool?**

**DECIDED: widen `ANSWER_RANGE_MIN` to 0 for `op === '-'`** (Option A per §3.3). Kevin's wire-up MUST also add `"zero"` to the `NUMBER_WORDS` map in [`src/screens/Math/planFromServer.ts`](../../src/screens/Math/planFromServer.ts) — see §9.1 HARD REQUIREMENT (Devon's audit dependency).

Rationale: The rule-based identity facts (`n − n = 0`, `n − 0 = n`) are pedagogically the easiest band (Dave § Source 3 — Robinson 2013: 65–73% of children apply the Identity principle correctly). Dropping facts #1, #2, #3, #4 from the pool would forfeit the highest-confidence opener facts and trim the easy band from 8 to 4. `Math.tsx` is already changing in PR 2 for the operator glyph + `op` plumbing, so adding `minAnswer` to `pickDistractors` lands cleanly in that PR. Future subtraction tiers will need `0`-chip support too; getting it in place now avoids a re-litigation.

**Q4 — First-session "take away" framing — single-session gate or persistent through intro phase?**

**DECIDED: single-session-only** (the spec default — see §4.3). The "take away" phrasing fires once on the first session over the lifetime of `sub-to-10`; sessions 2+ use "minus".

Rationale: Dave § Q2 explicitly scopes the recommendation to "the very first session." Persisting "take away" across the whole intro phase would introduce phrasing variability across the tier — a cognitive load signal Marian doesn't need once she's seen subtraction once. The "minus" template aligns with how subtraction is named in standard practice and how she'll encounter it long-term. Re-open only if Thomas's iPad ear-test post-merge signals a problem.

**PR split.** **DECIDED: 2-PR per Kevin's recommendation.**
- **PR 1 (this content tier):** planner directive (§4.1), `MATH_TRACK_GUIDE` block, first-encounter gate wiring + test revision (§9.4), `NUMBER_WORDS` zero entry (§9.1 hard requirement), canon prebake (§9.5).
- **PR 2 (Math.tsx render):** `op` field on `MathProblem` wire shape, parser widening for "minus" / "take away" templates (§9.1), `distractors.ts` extension with Class 2 (§9.2 + §3.2), `Math.tsx` argument plumbing, operator-glyph render.

Sequencing follows `project_planner_parser_contract.md`: PR 1's planner widening lands AFTER PR 2's parser widening. The canon bake in PR 1 produces "minus" / "take away" read-lines; if PR 2 hasn't landed yet, the browser parser would throw on those lines. Recommended merge order is PR 2 first (parser-ready browser), THEN PR 1 (planner emits the new content). If Kevin needs PR 1 to land first for canon-bake reasons, the canon's "minus" / "take away" reads are dormant until PR 2 ships; the static fallback plan still works.

---

## 12. Risks / counter-evidence

- **The wrong-operation distractor risks being too easy if the trap value is far from `correct`.** For `8 − 4 = 4`, wrong-op `12` is OOR → falls back to off-by-one anyway. For `9 − 1 = 8`, wrong-op `10` is only `correct + 2` — close enough to be a meaningful trap. For `10 − 7 = 3`, wrong-op `17` is OOR. **Net: roughly half the pool's wrong-op values are in-range; the other half degrade to Class 1.** Per Dave § Recommendations the wrong-op trap remains valuable for the in-range half; the OOR half doesn't make things worse, just doesn't add the new trap class. Acceptable tradeoff; no special handling needed beyond the §3.2 fallback.

- **The dual-exposure rule could be over-restrictive once Marian masters `sub-to-10` and we want to interleave `+`/`-` sessions** (per McNeil et al. 2025, fact-family interleaving is _therapeutic_ for both operations). The rule as worded (§7) applies WITHIN a session, not across sessions. Cross-session interleaving is unaffected; only same-session inverse-pair co-occurrence is forbidden. The spec's intent is preserved even when mixed-operation sessions ship in a future tier.

- **Pool size of 16 may be thin once Marian advances past the easy band.** With 8 easy facts, 4 medium, 4 hard, late-tier sessions risk hitting the same 4-fact `hard` band repeatedly. A pool extension (more `general`-band facts) is the natural follow-up; tracked in §9.7 as a follow-up PR. NOT a blocker for v1.

- **`correct = 0` SSML/audio risk.** Tested mentally only — "Yes! Zero!" should render fine on Emma multilingual. **Real ear-test pending** (post-merge by Thomas on the Vercel preview); spec assumes default Azure prosody handles "zero" cleanly. Fallback: per `planner-and-canon.md` § "Empirical IPA-outcomes taxonomy", the default-Azure-lexicon-is-fine option (Option 1) is the right posture unless ear-test reveals an issue.

- **Curriculum order locked (no reorder).** Thomas decided 2026-05-15 to leave the tree alone (§11 Q1). Marian sees `sub-to-10` after `add-to-20`. If a future ear-test or real-Marian observation suggests she'd benefit from seeing subtraction earlier in the curriculum, a `MATH_TREE` reorder is a progression-state-machine change that per `feedback_progression_e2e_mandatory` requires a paired failing-first E2E spec at dispatch time.

---

## 13. Side-effects inventory

What this spec implies for code (Kevin) and content (canon). PR split per §11: PR 1 = content + canon; PR 2 = render + parser.

**PR 1 — content + canon (Kevin):**

- `api/_planner.ts` — `MATH_TRACK_GUIDE` `sub-to-10` block expanded.
- `api/_firstEncounterGate.ts` — `'sub-to-10'` added to `FIRST_ENCOUNTER_GATED_NODES` (first math node in the set).
- `api/_firstEncounterGate.test.ts:99-110` — REVISE the `'does NOT include any math focus nodes'` negative-assertion test to per-node assertions: `sub-to-10` IS gated; the other math nodes (`add-to-10`, `add-to-20`, `sub-to-20`, `two-digit-addsub`) are NOT gated. See §9.4.
- `api/_planner.ts:buildUserMessage` — first-encounter check wired into user-message construction for read-line variant.
- `src/lib/progress/defaults.ts:93` — HARD REQUIREMENT — flip `'sub-to-10': 'mastered'` to `'sub-to-10': 'practicing'` in `DEFAULT_SKILL_LEVELS`. Decision locked Thomas 2026-05-15 (see §9.6 + §11 Q1 rationale).
- `public/canon/math/level-1/sub-to-10.json` — new canon, baked via `npm run canon:regen` per §9.5; ~1.2 MB; 59 utterances at 8 problems × 5 slots + 19 Session-End.

**PR 2 — render + parser (Kevin):**

- `src/screens/Math/planFromServer.ts` — HARD REQUIREMENT — add `"zero": 0` to `NUMBER_WORDS` (Devon's audit, §9.1). Widen the regex / parse path to accept `"X minus Y. How many are left?"` and `"X take away Y. How many are left?"`; emit `op: '-'`. Keep matching the existing `"X plus Y. How many?"` template — tag with `op: '+'`.
- `src/screens/Math/sessionPlans.ts` — `MathProblem` gains required `op: '+' | '-'` field + optional `distractorClass?: 'off-by-one' | 'wrong-op'`.
- `src/screens/Math/distractors.ts` — `pickDistractors` signature extended; new `wrongOpDistractors` function; `ANSWER_RANGE_MIN` parameterized to 0 for `op === '-'` (per §3.3 Option A locked Q3).
- `src/screens/Math/Math.tsx` — argument plumbing (`op`, `distractorClass`, `minAnswer` through to `pickDistractors`) + operator-glyph render (− vs +).

**Test changes:**

- PR 1: `_planner.test.ts` `sub-to-10` plan composition tests; revised `_firstEncounterGate.test.ts` per-node assertions.
- PR 2: `planFromServer.test.ts` `sub-to-10` parser fixtures including `7 − 0 = 7` and `9 − 0 = 9` (the "zero" entries Devon flagged); `distractors.test.ts` Class-2 wrong-op tests + subtract-self / subtract-zero edge cases.
- Cross-PR (Jessica E2E, dispatch-time pairing per `feedback_progression_e2e_mandatory`): `e2e/sub-to-10-first-encounter.spec.ts` for read-line variant gate. Must pair with PR 1 since PR 1 touches `_firstEncounterGate.ts`.

**Doc changes:**

- `.claude/docs/skill-trees-and-content.md` — Math distractors Class 2 subsection added (post-merge, `maintain-docs` may auto-route).
- `.claude/docs/progress-and-persistence.md` — promotion-gate footnote added.

**Out of both PRs' scope (follow-up):**

- `src/lib/progress/slowFacts.ts` — flat 6000 ms + 5-session warmup for `op === '-'` (§8, decision locked Q2). `_planner.ts:isSlowFactsActive` widening to include `sub-to-10`. Lands once Marian has generated ≥ 10 `sub-to-10` sessions.

---

## 14. Cross-references

- **Dave's research** — `design/research/sub-to-10-fact-sequencing-marian.md` (canonical authority). Read for the full evidence chain.
- **Dave's add-to-10 research** — `design/research/add-to-10-counting-to-recall.md` (Marian's finger-counting profile).
- **Dave's speed-feedback research** — `design/research/speed-feedback-automaticity-marian.md` (verdict: no speed-feedback UI; slow-fact directive is a backend re-targeting tool).
- **Dave's distractor research** — `design/research/math-distractor-and-streak-decisions.md` (gentle/off-by-one cutoff at problem 3; streak `[3, 5, 8]`).
- **Precedent content spec** — `design/word-song/digraphs-th-word-list.md` (structural model; cloned section-for-section here).
- **Math screen spec** — `design/screen-3-math.md` (chip-tap surface, audio integration, HUD).
- **Planner architecture** — `.claude/docs/planner-and-canon.md`.
- **Progress + mastery** — `.claude/docs/progress-and-persistence.md`.
- **Skill-tree taxonomy** — `.claude/docs/skill-trees-and-content.md`.
- **Memory: planner-parser contract** — `project_planner_parser_contract.md` (widen parser BEFORE planner — §9.1 enforces).
- **Memory: progression E2E mandatory** — `feedback_progression_e2e_mandatory` (Jessica E2E spec required at dispatch time for any progression-state-machine PR).
