# Number Garden — subitising scaffold content tier (add-to-10 EASY band, sums ≤ 5)

**Status:** SPEC — implementation blocked on this PR merging. Devon/Kevin pick up impl after spec approval.
**Ticket:** `tkt-subitising-scaffold-spec` (Matt to file in ClickUp `list_id: 901523003843`).
**Authority:** [`design/research/add-to-10-counting-to-recall.md`](../research/add-to-10-counting-to-recall.md) (Dave, 2026-04-29) — § Recommendation: "Priority 2 — Add dot-pattern visual prompts for sums ≤ 5." The current spec formalises that recommendation as the content-tier contract.
**Structural template:** [`design/math/add-to-10-content.md`](./add-to-10-content.md) (Kyle, 2026-05-16). Same §1-9 shape.
**Sibling spec (screen-layer):** [`design/screen-math-subitising-prompt.md`](../screen-math-subitising-prompt.md) (Kyle, 2026-05-09) — owns the dot-card visual primitive, motion envelope, flower-coordination, and screen-layout-stability rule. **This content-tier spec defers to that screen-layer spec for all visual/motion details** and only ratifies the content-tier rules (when does the scaffold fire? which patterns? how does it progress? how is fluency-fade gated?).

---

## 0. Why this spec, why now

- Marian is **actively in `add-to-10` today** and the April 2026 diagnostic flagged "100% finger reliance" — she counts on every sum. Dave's research (`add-to-10-counting-to-recall.md`, 2026-04-29) identifies subitising — instant visual recognition of small quantities (1-5) without counting — as the highest-ROI **visual** intervention to bridge counting → retrieval for the EASY band.
- A screen-layer spec for the dot-card affordance already exists (`screen-math-subitising-prompt.md`, 2026-05-09): it specifies the dice-pip visual, the 1100ms motion envelope, the absolute-positioned overlay above the flower row, the cross-fade, and the trigger predicate "both addends ≤ 5". What that spec **deliberately deferred** to a future content-tier spec is:
  1. **First-encounter behaviour vs steady-state behaviour.** Should the scaffold fire on every in-scope problem forever, or fade as Marian's automaticity grows? (`screen-math-subitising-prompt.md` § "First-read vs retry" only locks per-problem one-shot; cross-session progression is open.)
  2. **Progression / fluency-fade rule.** Should the scaffold be tied to Leitner box state, session count, focus-node `firstEncounterGate` flag, or some other signal? Screen-spec § "Why NOT trigger on Leitner box-1 facts" rejected Leitner-coupling-at-trigger-time but left open whether Leitner could drive a future fade.
  3. **Audio narration question.** Should Emma reinforce the dot-card with a parallel narration ("three and two — how many?"), or stay silent and let the existing `math.p{N}.read` carry the audio? Screen-spec § "Copy / TTS script" defaulted to silent-visual, but the open-question call to revisit this from a content-progression standpoint was deferred to here.
  4. **Scope confirmation.** Does subitising apply ONLY to `add-to-10` EASY band, or also to `sub-to-10` EASY band (the next math tier)? Multiplication concept (visual-grouping) later? Screen-spec § "Out-of-scope" parked these calls.
- **This spec answers (1)-(4) and locks the content-tier rules** so Devon can implement the trigger/progression layer alongside the existing dot-card visual.

**Scope of this spec:**

- §1 — The visual pattern shape decision (dice pips) and the per-pattern ASCII wireframes for 1-5.
- §2 — When the scaffold fires (trigger conditions: focus node, band, addends, first-encounter gate, fluency-fade rule).
- §3 — Interaction model (auto-reveal-static, no Marian-input, no scaffold-tap, silent visual).
- §4 — Progression / fluency-fade rule (per-band Leitner-box-tied, NOT per-fact, with explicit on/off thresholds).
- §5 — Accessibility (touch-target N/A — decorative; color-blind-safe; reduced-motion handled; audio narration question resolved NO).
- §6 — Tests (Playwright + visual checks + drift-guards).
- §7 — Open questions explicitly enumerated for Thomas's review at landing.
- §8 — Tracked follow-ups (extensions to `sub-to-10`, multiplication concept, ten-frame v2).

**Out-of-scope:**

- **The dot-card visual primitive itself.** Owned by `screen-math-subitising-prompt.md`. This spec does not re-derive the pip layout, the `<DotCard pips={n} />` component shape, the motion envelope, or the layout-stability rule. Anything visual is a cross-reference to that spec.
- **The flower affordance.** Flowers remain unchanged. The scaffold is **additive**, never a replacement. (Dave's research § Intervention C explicitly cautions against pulling concrete affordances early; this spec preserves that.)
- **Subitising for `sub-to-10` EASY band.** Open question — see §7.2. Likely a future sibling spec if the answer is yes.
- **Subitising for multiplication concept tier (visual grouping).** Open question — see §7.3. Multiplication is conceptually different (groups-of-N, not combine-quantities); a dot-card affordance would need fresh research and a fresh spec.
- **Per-fact dynamic suppression.** Out of scope per Leitner-coupling-at-trigger-time concerns; see §4.2 for why the fluency-fade operates on a **band-level** signal (the EASY band as a whole) rather than per-fact.
- **A new ParentSettings field.** The screen spec deferred a `subitisingFlashDurationMs` tunable to v2; this content spec inherits that deferral and adds no new parent knob.
- **Implementation.** This spec is content-tier rules only. Devon implements the trigger predicate + fluency-fade gate; Kevin reviews; Jessica writes the Playwright suite.

---

## 1. The visual pattern — dice pips (1-5), recap and ratification

> **Authority:** `screen-math-subitising-prompt.md` § "Visual style decision — dice pips (Dave's source 6)" is the canonical visual decision. This spec **ratifies** that decision from the content-tier perspective and provides the ASCII wireframes for the new spec's self-containment. No new visual primitives proposed.

### 1.1 Why dice pips beat the alternatives for Marian

Three patterns were considered (full decision rationale in the screen-layer spec). For content-tier completeness, the per-pattern verdict:

| Pattern shape | Pedagogical fit for Marian (8yo, Tagalog-primary, L2) | Verdict |
| --- | --- | --- |
| **Dice pips** (canonical 1-5 die faces) | Cross-cultural recognisability (dice are universal; Marian has seen them in board-game contexts). Stable visual contract — `3`-pip looks identical on every problem. Dave's source 6 (Clements via Hechinger 2023) cites dice as the most-common subitising stimulus in practitioner literature. Vocabulary tops out at 5 cleanly — matches the in-scope band exactly. | **Selected.** |
| **Ten-frame** (5×2 grid, fill cells) | Strong US-curricular precedent (grade-2 standard) but Marian has not been exposed to ten-frames in any prior surface. Introducing a new abstract grid metaphor alongside a new affordance is two new visual vocabularies at once. Two ten-frames side-by-side at small size are visually busy. | Rejected — adds new visual vocabulary on top of new affordance. |
| **Random-arrangement subitising** (irregular dot scatter, Clements original) | Most faithful to subitising research. Tests "true" pattern recognition. But inconsistency works against a child still building automaticity — `3` looks different every time → noise, not signal. | Rejected — inconsistency works against Marian's current developmental stage. |

**Net content-tier verdict:** dice pips for v1. Ten-frame revisits later under §8 follow-ups if Marian's empirical signal suggests dice pips are insufficient.

### 1.2 Pip-pattern wireframes (per quantity)

Canonical Western die layout. Each cell is conceptually a 3×3 implicit grid; pips occupy specific cells. The screen-layer spec at § "Pip layout" specifies the rendering primitive (inline SVG, ~80pt × 80pt cell, 12pt dot diameter, `--ink` fill on white background, soft `--my-pink` border).

```
   1 pip                  2 pips                  3 pips
+---------+            +---------+            +---------+
|         |            | ●       |            | ●       |
|    ●    |            |         |            |    ●    |
|         |            |       ● |            |       ● |
+---------+            +---------+            +---------+

   4 pips                  5 pips
+---------+            +---------+
| ●     ● |            | ●     ● |
|         |            |    ●    |
| ●     ● |            | ●     ● |
+---------+            +---------+
```

Position rules (locked, screen-layer spec § "Pip layout"):
- `1` → centre cell.
- `2` → top-left + bottom-right (the canonical "two" pip diagonal).
- `3` → top-left + centre + bottom-right (extends the "two" diagonal through centre).
- `4` → four corners (top-left, top-right, bottom-left, bottom-right).
- `5` → four corners + centre.

**Rendering side-by-side.** For a problem like `3 + 2`, the overlay shows:

```
            ┌─────────┐    ┌─────────┐
            │ ●       │    │ ●       │
            │    ●    │    │         │
            │       ● │    │       ● │
            └─────────┘    └─────────┘
              (three)         (two)
```

A 24pt gap between the two cells, centred horizontally above the (currently hidden) flower row. **No `+` glyph between the cells** — the symbolic row above the overlay already carries the operator. (Screen-layer spec § "Where the dot-card sits" locks this.)

### 1.3 Why not extend dice pips past 5

Canonical Western dice have 6 faces. `6` would be 2-rows-of-3 — a different visual primitive than 1-5 (which sit on the implicit 3×3 grid with stable corner anchors). Extending the dot-card to addends > 5 would mean introducing a second visual vocabulary mid-tier, which is exactly the failure mode rejected in §1.1 for ten-frame.

Addends > 5 fall out of scope (consistent with Dave's research recommendation, scope-locked at "sums ≤ 5"). This is content-tier-load-bearing: the trigger predicate in §2.2 is precisely "both addends ≤ 5".

---

## 2. Trigger conditions — when does the scaffold fire?

> **Authority:** This spec owns the trigger contract. Screen-layer spec § "Trigger condition — explicit logic" provides the implementation predicate (`shouldShowDotCard(problem, focusNode, parentSettings)`); this section adds the **first-encounter gate** and the **fluency-fade modulation** layers that the screen-layer spec deferred.

### 2.1 Trigger contract (LOCKED)

The scaffold fires on a problem if and only if all five conditions hold:

| Condition | Predicate | Rationale |
| --- | --- | --- |
| **C1. Focus node** | `focusNode === 'add-to-10'` | Only tier where subitising-on-small-quantities is pedagogically targeted. Other tiers (sub-to-10, add-to-20, etc.) — see §7.2, §7.3. |
| **C2. Both addends ≤ 5** | `problem.a ≤ 5 && problem.b ≤ 5` | Matches dice-pip vocabulary ceiling (§1.3). NOT `sum ≤ 5` — a `5+0` (excluded from pool anyway, see add-to-10-content §1.4) would technically fit "sum ≤ 5" but its right addend is out-of-vocabulary at 0. Both-addends-≤-5 is the dice-pip-renderable check. |
| **C3. EASY band gate** | Implied by C2 — every both-addends-≤-5 fact in `add-to-10` lands in EASY band (sum 3-5). Spec asserts this as a self-consistency check, not an additional rule. | Cross-check against `add-to-10-content.md` §1.3 pool table: EASY-band rows (sum 3, 4, 5) contain exactly the both-addends-≤-5 facts (`1+2`, `2+1`, `1+3`, `3+1`, `2+2`, `1+4`, `4+1`, `2+3`, `3+2`). 9 facts total. Every MEDIUM-band fact (sum 6-8) has at least one addend ≥ 1 and at least one addend > 5 OR both addends ≤ 5 with sum 6+ — but `add-to-10`'s closure rule `a ≥ 1, b ≥ 1, 3 ≤ a + b ≤ 10` combined with `max(a, b) ≤ 5` yields max sum 10 BUT in the actual pool, MEDIUM/HARD rows always have at least one addend ≥ 5. **Verified manually 2026-05-16** against the §1.3 pool: facts with both addends ≤ 5 are exactly the 9 EASY-band facts. (See §7.4 for the edge case `5 + 5 = 10`: technically both addends ≤ 5 holds, but `5+5` is HARD-band sums-to-10 — Thomas-decision call.) |
| **C4. First-encounter gate active** OR **fluency-fade not yet triggered** | See §2.2 and §2.3 | Per-band, NOT per-fact. The scaffold is on for the EASY band as a whole until the band hits a fluency threshold (§2.3), then it fades. |
| **C5. Parent-settings did NOT disable** | `parentSettings.subitisingScaffold !== 'off'` (key does not yet exist; see §2.5 — DEFERRED to v2) | Hook reserved for future opt-out without re-spec. v1 ships with no parent knob. |

**Conjunction.** All five must be true. If any is false, dot-card does NOT mount; flowers render as today.

### 2.2 First-encounter behaviour (LOCKED)

> **The scaffold fires on every in-scope problem during Marian's first 3 `add-to-10` sessions, unconditionally.** This is the first-encounter framing — the scaffold is fully visible while Marian is forming the recognition pathway.

Concretely:

- Session 1, 2, 3 of `add-to-10` → C4 = TRUE on every problem matching C1+C2+C3+C5. The dot-card shows on roughly 7-of-8 problems per session (EASY-band coverage on a typical 8-problem mix).
- Session 4+ → C4 graduates to the §2.3 fluency-fade rule.

**Why 3 sessions, not 1 or 5?** Three sessions is the minimum exposure window before any meaningful inference about Marian's subitising fluency can be drawn. Dave's research § 2 Intervention A notes that the subitising-pattern-to-quantity-image consolidation is "weeks to months" with targeted intervention — three sessions is a floor below which fade would be premature, and a ceiling above which it would feel like a fixed feature rather than a scaffold.

**`firstEncounterGate` integration.** The focus-node `firstEncounterGate` infrastructure (per `progress-and-persistence.md` and `api/_firstEncounterGate.ts`) ALREADY exists for tier-introduction copy. **Marian has already had her `add-to-10` first encounter** (she's been on this tier for weeks). So this spec does NOT consume `firstEncounterGate` directly; instead, it uses a **session-count gate** scoped to the subitising scaffold specifically:

- Storage key: `marian-tutor:progress:v1` → `profile.subitisingScaffoldSessionsObserved?: number` (NEW field; default 0). Increments once per session where the scaffold actually rendered (i.e., any in-scope problem on an `add-to-10` session). Capped at 4 (we only care about the 1-2-3-fade boundary). Persists across sessions.
- C4 = `subitisingScaffoldSessionsObserved < 3` OR the fluency-fade rule §2.3 below.

**Special case — Marian's transition from "no-scaffold" → "scaffold-on".** Marian has run dozens of `add-to-10` sessions before this spec ships. **The scaffold is NEW to her on the day this PR merges**, so her `subitisingScaffoldSessionsObserved` field starts at 0. Her first 3 post-merge sessions will be unconditional-scaffold. This is correct and intentional: she IS encountering the subitising affordance for the first time, even though she is not new to `add-to-10`. The session-count gate measures **exposure to the scaffold**, not exposure to the tier.

### 2.3 Fluency-fade rule (LOCKED)

After the first 3 scaffolded sessions, the scaffold transitions to **fluency-fade mode**: it fires on a fraction of in-scope problems rather than all of them, scaling down as Marian's EASY-band fluency rises.

**Signal source: the Leitner box, per-band aggregate.** `mathFactsLeitner` (Progress doc) carries per-fact box assignments (boxes 1-5; box 1 = least familiar, box 5 = mastered). The EASY-band facts are the 9 facts with sums 3-5 (per §2.1 C3). Define:

```
easyBandLeitnerMeanBox =
  mean({ leitnerBoxOf(fact) | fact ∈ EASY_BAND_FACTS_SEEN })
```

Where `EASY_BAND_FACTS_SEEN` is the subset of the 9 EASY-band facts Marian has actually encountered in at least one session (un-seen facts are excluded so a partially-explored band doesn't deflate the mean).

**Fade-probability schedule (LOCKED):**

| `easyBandLeitnerMeanBox` | P(scaffold fires on an in-scope problem) | Pedagogical intent |
| --- | --- | --- |
| `< 2.0` | **1.0** (always fire) | Marian is still mostly counting on EASY facts; scaffold remains a structural prompt. |
| `[2.0, 3.0)` | **0.66** (fire 2 of every 3 in-scope problems) | First fluency signal; scaffold becomes intermittent so Marian's brain has practice recalling without it on some problems. |
| `[3.0, 4.0)` | **0.33** (fire ~1 of every 3 in-scope problems) | Strong fluency on EASY band; scaffold is a periodic refresher, not a structural prompt. |
| `≥ 4.0` | **0.0** (never fire) | EASY band is at automaticity; scaffold has done its work. Marian sees flowers alone. |

**Determinism.** The probability is per-session, not per-problem — within a single session, the scaffold either fires on EVERY in-scope problem OR on NONE. The reason: predictability for Marian. Per-problem randomness would mean "the dots appeared on problem 2 but not problem 5", which feels arbitrary and breaks the implicit contract. Per-session randomness means "today the dots showed up; tomorrow they didn't" — that reads as variety, not noise.

**Per-session decision rule:**

```pseudocode
function shouldScaffoldThisSession(
  easyBandLeitnerMeanBox: number,
  rng: () => number,  // seedable for testability
): boolean {
  if (easyBandLeitnerMeanBox < 2.0) return true
  if (easyBandLeitnerMeanBox >= 4.0) return false
  if (easyBandLeitnerMeanBox < 3.0) return rng() < 0.66
  return rng() < 0.33  // [3.0, 4.0)
}
```

The RNG seed should be derived from `(sessionStartISO, focusNode)` so the decision is reproducible per session. **This avoids dark-pattern variable-ratio** because the per-problem-within-session schedule is fully deterministic (all-or-nothing). The per-session randomness is structural (not slot-machine-like) — it's a stable feature of each session that Marian experiences as "today is a dots day or it isn't".

### 2.4 Hint-on-tap (open-question default: NO)

Dispatch brief asked: should Marian get a tap-to-reveal scaffold as a hint if she says "I need help"?

**Default: NO — see §7.5 for the deferred Thomas-decision.** The current Math screen has no explicit "I need help" affordance; the hint state arrives automatically after 2 wrong taps via flower-group pulse (per `screen-3-math.md` § Wrong-answer policy). Surfacing a tap-to-reveal scaffold during the hint state would:

1. Conflict with the existing flower-group-pulse hint mechanic (the existing hint IS the targeted-feedback mechanism).
2. Require a new UI affordance (a tappable "show me" button somewhere on the chip row or HUD).
3. Re-introduce a scaffold the §2.3 fluency-fade rule may have already faded out — which would conflict with the "faded" signal Marian has just internalised.

**v1 ships without hint-on-tap.** The §2.3 fade rule fires the scaffold on a per-session basis; if Marian needs more support today, the §2.3 rule increases scaffold frequency by virtue of low `easyBandLeitnerMeanBox`. If Thomas approves the hint-on-tap idea later, it can be added as a screen-layer enhancement without touching the content-tier rules in this spec.

### 2.5 Parent-settings opt-out — DEFERRED to v2

A future `parentSettings.subitisingScaffold?: 'on' | 'off' | 'auto'` field would expose:
- `'on'` → force-fire on every in-scope problem regardless of §2.3 (override the fade).
- `'off'` → never fire (hard kill switch).
- `'auto'` (default) → use the §2.3 fluency-fade rule.

**Rationale for deferral:** We don't have data yet on whether parents would tune this. The screen-layer spec § "Flash-duration parent tunability — DEFERRED to v2" applies the same reasoning. **Both deferrals land together in a single v2 ParentSettings PR if/when Thomas requests it.**

For v1, condition C5 (`parentSettings.subitisingScaffold !== 'off'`) is always TRUE because the field is absent / undefined. The predicate is forward-compatible.

---

## 3. Interaction model — auto-reveal, static, silent visual

> **Authority:** Screen-layer spec § "Motion" + § "Copy / TTS script" + § "Anti-dark-pattern audit" lock the interaction surface. This section ratifies from the content-tier perspective and explicitly addresses the dispatch brief's interaction questions.

### 3.1 Pattern of reveal — LOCKED: auto-reveal, static-from-start, time-bounded

| Choice | Mechanic | Verdict |
| --- | --- | --- |
| **Auto-reveal, static from t=0 (both pips visible simultaneously)** | Both addend cells render at problem-mount; spring fade-in 200ms; hold 700ms; fade-out 200ms. Marian sees both quantities at once and her brain pattern-matches in parallel. | **Selected** — screen-layer spec locks this. |
| Animated reveal, one-at-a-time | Cell A fades in, then 300ms later Cell B fades in. Mirrors Emma's audio order ("three plus two"). | Rejected — adds 300-500ms to lifecycle without pedagogical gain. Parallel-pattern-matching is the subitising mechanism; sequencing undermines it. |
| Tap-to-reveal | Marian taps the empty cell to see the pips. | Rejected — interactive scaffolds increase cognitive load at decision time (Dave's research § Recommendations). Decision-time cognitive load is what we're trying to reduce. |

**Net:** auto-reveal, static, time-bounded. Marian does not tap, drag, hover, or otherwise interact with the dot-card. She looks. The recognition happens or it doesn't; either way the cells fade and the flowers arrive.

### 3.2 Audio narration — LOCKED: silent visual, no parallel Emma line

> **Decision: NO new TTS line for the dot-card. Emma's existing `math.p{N}.read` ("Three plus two. How many?") plays unchanged over the dot-card window.**

The dispatch brief asked: should Emma's voice change for subitising vs counting? Should she say "1, 2, 3 dots — three!" or similar?

**Rationale for silent visual** (consolidated from screen-layer spec § "Copy / TTS script" + Dave's research § 3 Mammarella 2023 working-memory note):

1. **Two simultaneous phonological streams overload working memory.** The existing read-line "Three plus two. How many?" already names both addends. Adding "1, 2, 3 dots — three!" as a parallel narration would force Marian's auditory working memory to handle two competing strings in the same 1500ms window. State-anxiety risk per Mammarella et al. (2023) — and a working-memory hit per Geary et al. (2004) — exactly the failure mode subitising is supposed to RELIEVE.
2. **Counting the dots out loud DEFEATS the purpose.** Subitising is *recognition without counting*. Emma saying "1, 2, 3" trains Marian to count the dots, which is the opposite of what the dots are for. The whole point is that her brain perceives "3" instantly because of the canonical pip pattern.
3. **The existing read-line already names the quantities.** "Three plus two" names both quantities Marian needs to subitise. The dot-card is the visual reinforcement of the same quantities Emma is saying. No new audio is needed; the meaning is fully carried.
4. **Cost-avoidance on canon bake.** New utterances require canon regen via Azure TTS (Anthropic budget + Azure REST cost). Zero net pedagogical gain → zero net spend.

**Voice for subitising vs counting:** no change. Emma's voice (`en-US-EmmaMultilingualNeural`, rate `-10%`) is constant across all tiers, all problem types, and all session states. There is no "subitising voice" and there should not be one — voice consistency anchors Marian's relationship with Emma as a character. Changing voice for a subset of problems would introduce a "different Emma" that erodes character coherence.

### 3.3 Caption ribbon — unchanged

The on-screen caption ribbon mirrors `math.p{N}.read` word-by-word, exactly as today. The dot-card does NOT trigger a caption change. (Screen-layer spec § "Caption ribbon behaviour" locks this.)

### 3.4 What Marian does with her attention

Optional but useful for Devon/Jessica to internalise the intent:

- **Eyes:** drift up to the dot-card overlay at problem-mount (~200ms into the read-aloud). The dot-card is centre-of-mass on the upper-mid screen during its 1100ms lifecycle.
- **Brain:** parallel quantity recognition (no counting). If recognition lands → "oh, three and two, that's five" emerges before Emma finishes the line. If it doesn't land → eyes track down to the flower row that fades in at t=900ms; counting strategy proceeds as today.
- **Hands:** chips are disabled per the existing `readAloudPlayed` gate during the dot-card window. There is no "race to tap before the dots fade" risk.
- **No prompted action.** Marian doesn't need to *do* anything with the dot-card. The scaffold is passive — recognition either happens or doesn't; either pathway proceeds to a normal chip-tap. This is critical for anti-dark-pattern compliance: there is no quiz, no extra-tap, no consequence to ignoring the dots.

---

## 4. Progression — how the scaffold fades as fluency builds

> **Authority:** This spec owns the progression contract. The screen-layer spec deliberately deferred this question; §2.3 above gave the trigger-side rule; this section gives the **what does the fade look like across the curriculum** view.

### 4.1 Per-band, NOT per-fact

The fade is gated on the **EASY-band aggregate Leitner mean box** (§2.3 formula), NOT on per-fact Leitner state. Per-fact gating was explicitly rejected for three reasons:

1. **Predictability.** A scaffold that fires for `2 + 3` but not `3 + 2` (because Marian's Leitner box on the former is 1 and the latter is 4) would feel arbitrary — same visual pattern, different scaffolding. The band-aggregate signal smooths this.
2. **Cross-fact reinforcement.** Subitising builds the underlying quantity-image. Even if `2 + 3` is at Leitner box 5, seeing `2`-pips and `3`-pips reinforces the quantity images that support OTHER facts in the band. Per-fact gating would prematurely starve adjacent facts.
3. **Implementation simplicity.** Band-aggregate is one number per session; per-fact would require 9 lookups + thresholds + the same per-problem-within-session feels-arbitrary trade-off as §2.3.

### 4.2 Leitner-box-tied (not session-count-tied after first 3)

The §2.2 first-encounter gate is session-count-tied (sessions 1-3 unconditional). After that, the §2.3 fluency-fade uses **Leitner box mean** as the signal, not session count.

**Why Leitner-mean and not session-count after the first 3?** Session count is a *proxy for exposure*, but exposure doesn't equal mastery. A child could run 20 sessions and still have low Leitner-box averages if the spaced-retrieval rotation keeps box-1 facts present. A child could also run 5 sessions and have high Leitner-box averages if all 9 EASY-band facts hit M3 quickly. Leitner-mean is a direct mastery signal; session-count is not. The first-encounter gate uses session-count because the Leitner box's reliability at 0-2 sessions is too noisy (not enough fact-sampling); after 3 sessions we have enough fact-coverage to trust the Leitner signal.

### 4.3 Fade-progression timeline (illustrative, not normative)

Assuming a hypothetical Marian who runs 1 `add-to-10` session per day from the spec ship date:

| Day | Session # | `easyBandLeitnerMeanBox` (illustrative) | P(scaffold fires) | Marian's experience |
| --- | --- | --- | --- | --- |
| 1 | 1 | 1.0 (everything box-1) | 1.0 (first-encounter gate) | Sees dots on every EASY problem. |
| 2 | 2 | 1.2 | 1.0 (first-encounter gate) | Dots every EASY problem. |
| 3 | 3 | 1.4 | 1.0 (first-encounter gate) | Dots every EASY problem. |
| 4 | 4 | 1.6 | 1.0 (mean < 2.0) | Dots every EASY problem. |
| 6 | 6 | 2.1 | 0.66 (mean in [2.0, 3.0)) | This session might be dots-day, or might be flowers-only. |
| 10 | 10 | 3.2 | 0.33 (mean in [3.0, 4.0)) | Today is unlikely to be dots-day; some sessions still are. |
| 15 | 15 | 4.1 | 0.0 (mean ≥ 4.0) | No dots ever again on `add-to-10`. Flowers alone. |

This is an illustrative trajectory, not a contract. Marian's actual fade timeline depends on her Leitner box trajectory, which depends on her per-fact correctness streaks (which is exactly the spaced-retrieval signal we want driving the fade).

### 4.4 What if the fade reverses (Leitner mean drops back)?

Possible scenario: Marian's EASY-band mean rises to 3.5, scaffold goes to P=0.33; then she has a rough session and the Leitner mean drops back to 2.8. **The scaffold's per-session probability should re-rise to 0.66 on the next session.** No hysteresis. No "once-faded, always-faded" stickiness.

**Rationale:** the scaffold's purpose is to bridge counting-to-recall. If Marian's recall regresses (which is normal — overlapping-waves model, Siegler 1996), the scaffold should reappear to restore the recognition pathway. The fluency-fade is a **state-dependent rule**, not a one-way ratchet.

This means a session where Marian saw dots, then doesn't see them for several sessions, then sees them again is a normal trajectory. Marian doesn't need to be told this; the scaffold's predictability-within-session (§2.3) and Emma's character-coherent voice make the variation feel natural, not punitive.

### 4.5 What happens after the scaffold permanently fades

When `easyBandLeitnerMeanBox >= 4.0` AND the previous session also had `≥ 4.0` (defense against single-session fluctuation pushing it temporarily over the line), the scaffold can be considered "graduated" for Marian on this tier. Operational consequence: no special event fires; no celebration; she simply stops seeing the dots. The flowers were always the durable affordance; the dots quietly leave.

**No "graduation moment" celebration.** Adding a "you don't need the dots anymore!" celebration would surface the fade as a milestone — which it isn't. It's a quiet, gradient fluency emergence, not a binary level-up. The anti-dark-pattern audit explicitly bans manufactured progression moments (CLAUDE.md non-negotiables).

---

## 5. Accessibility

> **Authority:** Screen-layer spec § "Accessibility notes" is the canonical accessibility contract for the dot-card visual primitive. This section adds the **content-tier accessibility considerations** the screen-layer spec deferred or didn't cover.

### 5.1 Touch targets — N/A (decorative, non-interactive)

The dot-card is non-interactive (no tap, no hover, no focus). iOS HIG 44pt touch-target floor does not apply — there are no touch targets in the dot-card. The 80pt × 80pt cell size is a **visual** dimension (legibility floor), not a touch dimension.

### 5.2 Color — color-blind safe

Pip fill: `--ink` (dark, near-black) on `--card-bg` (white). High contrast under any color-vision profile. Cell border: `--my-pink` decorative — not load-bearing on the recognition (recognition is shape-of-pip-pattern + count, not color). Color-blind users see the pip pattern identically.

**WCAG AA verified** (screen-layer spec § "Colour contrast"): 12pt dot on white passes AA at the spec'd dot diameter.

### 5.3 Audio narration — LOCKED NO (see §3.2)

ARIA: each `<DotCard>` cell has `role="img"` with `aria-label="three"` etc. (the spelled English word matching Emma's read-aloud). The container `<div data-testid="math-dot-card">` is `aria-hidden="true"` so VoiceOver focus stays on the caption ribbon (the dot-card is **decorative reinforcement** at the screen-reader level — the read-aloud and caption already carry the meaning).

**This is hygiene, not a Marian need.** Marian does not use VoiceOver today (per orchestrator observation). The ARIA is for future-proofing.

### 5.4 Reduced motion — honoured via screen-layer spec

`usePrefersReducedMotion()` collapses the dot-card to opacity-only fade (no scale spring), per `screen-math-subitising-prompt.md` § "Motion → Reduced-motion path". Total visible duration is preserved (1100ms ±50ms); only the in/out flourishes are skipped. Marian-with-reduce-motion still gets the recognition window.

### 5.5 Cognitive load — no parallel narration, single visual

The §3.2 lock (no new TTS) is the cognitive-load contract: one phonological stream (Emma's read-aloud) + one visual stream (dot-card → flowers). Working-memory headroom preserved for the actual problem.

### 5.6 Font / typography — N/A

Dot-card uses no text. The pip pattern is the entire stimulus. Captions render in the existing caption ribbon (unchanged).

### 5.7 Iconography / cultural neutrality

Dice pips are cross-culturally recognised (board games, gaming history spanning millennia). No Tagalog-English friction. No US-curricular artefact (unlike ten-frames). Marian's L2 status does not impact dot-card comprehension.

---

## 6. Tests — proving the scaffold works

> **Audience:** Jessica (QA), Devon (impl-test seams), Kevin (review of test coverage).

### 6.1 Unit tests — `<DotCard>` component

Per screen-layer spec § "Open questions for Devon" item 8. Covered there; this spec does not re-derive.

Required:
- 5 unit tests, one per `pips ∈ {1, 2, 3, 4, 5}`, asserting correct dot count + dot positions.
- 1 unit test asserting `aria-label` text matches expected English spelling.

### 6.2 Trigger predicate unit tests — `shouldShowSubitisingScaffold()`

NEW (this spec). Test seams:

```typescript
// src/screens/Math/subitisingScaffold.ts (NEW module - Devon owns)
export function shouldShowSubitisingScaffold(
  problem: { a: number; b: number },
  focusNode: string,
  subitisingScaffoldSessionsObserved: number,
  easyBandLeitnerMeanBox: number,
  rng: () => number,
): boolean { /* … per §2.1 + §2.2 + §2.3 */ }
```

Required test cases (one per row of the §2.3 fade-probability schedule + boundary conditions):

| Scenario | `focusNode` | `(a, b)` | `subitisingScaffoldSessionsObserved` | `easyBandLeitnerMeanBox` | `rng()` mock | Expected |
| --- | --- | --- | --- | --- | --- | --- |
| Non-`add-to-10` focus node | `'sub-to-10'` | `(2, 3)` | 0 | 1.0 | 0.5 | `false` (C1 fails) |
| Addend > 5 | `'add-to-10'` | `(6, 1)` | 0 | 1.0 | 0.5 | `false` (C2 fails) |
| First-encounter session 1 | `'add-to-10'` | `(2, 3)` | 0 | 5.0 | 0.99 | `true` (C4 first-encounter override) |
| First-encounter session 3 | `'add-to-10'` | `(2, 3)` | 2 | 5.0 | 0.99 | `true` (C4 first-encounter override) |
| Fade-mode boundary, mean = 2.0 exactly | `'add-to-10'` | `(2, 3)` | 5 | 2.0 | 0.0 | `true` (in `[2.0, 3.0)`, rng < 0.66) |
| Fade-mode, mean = 2.0, rng = 0.99 | `'add-to-10'` | `(2, 3)` | 5 | 2.0 | 0.99 | `false` (rng ≥ 0.66) |
| Fade-mode, mean = 3.99, rng = 0.0 | `'add-to-10'` | `(2, 3)` | 5 | 3.99 | 0.0 | `true` (in `[3.0, 4.0)`, rng < 0.33) |
| Permanently faded, mean = 4.0 | `'add-to-10'` | `(2, 3)` | 5 | 4.0 | 0.0 | `false` (mean ≥ 4.0) |
| `5 + 5` edge case (open question §7.4) | `'add-to-10'` | `(5, 5)` | 0 | 1.0 | 0.5 | **OPEN** — see §7.4 |

### 6.3 Playwright e2e tests — `e2e/subitising-scaffold-first-encounter.spec.ts` (NEW)

Required scenarios (Jessica writes failing-first per `feedback_progression_e2e_mandatory.md`):

| Test | Seed | Assertion |
| --- | --- | --- |
| **First-encounter session 1 — every EASY problem shows dot-card** | Fresh storage; `subitisingScaffoldSessionsObserved = 0`; force focus to `add-to-10` | On every problem with both addends ≤ 5, `[data-testid="math-dot-card"]` is visible during the read-aloud window. |
| **Out-of-scope problem hides dot-card** | Same | On a problem with `(6, 3)` or similar (addend > 5), `[data-testid="math-dot-card"]` count = 0 throughout the problem. |
| **After 3 sessions, scaffold respects Leitner** | Seed `subitisingScaffoldSessionsObserved = 3`; set `easyBandLeitnerMeanBox = 5.0` (mock Progress doc); deterministic RNG returning 0.5 | Dot-card does NOT render on any in-scope problem (P = 0). |
| **Fade-mode at mean = 2.5** | Seed `subitisingScaffoldSessionsObserved = 5`; `easyBandLeitnerMeanBox = 2.5`; deterministic RNG returning 0.5 (under 0.66 threshold) | Dot-card renders on every in-scope problem of this session (per-session all-or-nothing). |
| **Fade-mode at mean = 2.5, rng = 0.7** | Same but RNG returns 0.7 (above 0.66 threshold) | Dot-card does NOT render on any in-scope problem of this session. |
| **`shouldScaffold` decision is sticky within a session** | Any seed that produces `shouldScaffold = true`; record dot-card visibility on each of 8 problems | If problem 1 shows the dot-card, problems 2-8 (in-scope) also show it. NO mid-session toggling. |

Where the e2e DOM-readability requires count-based selectors per `feedback_count_assertions_on_regression_tests.md`:

```typescript
expect(await page.locator('[data-testid="math-dot-card"]').count()).toBe(0) // not visible
expect(await page.locator('[data-testid="math-dot-card-cell"]').count()).toBe(2) // both addend cells
```

### 6.4 Visual / snapshot tests — DEFERRED to follow-up

Pip-pattern rendering accuracy is best covered by visual-regression snapshots (Percy/Chromatic-style). The project does not currently have visual-snapshot infrastructure. **Out of scope for this PR**; track as a follow-up in §8.

In lieu of pixel snapshots, the unit tests in §6.1 assert pip count + relative positions via DOM attribute inspection (`data-pips={n}` + per-pip `data-position={'top-left' | 'centre' | ...}`).

### 6.5 Drift-guards

To prevent silent regression of the §2.3 fade-probability schedule (a common failure mode when constants drift across PRs), add a constant-pinning test:

```typescript
// src/screens/Math/subitisingScaffold.test.ts
describe('fluency-fade schedule constants', () => {
  it('FADE_THRESHOLD_FULL = 2.0', () => {
    expect(FADE_THRESHOLD_FULL).toBe(2.0)
  })
  it('FADE_THRESHOLD_MEDIUM = 3.0', () => {
    expect(FADE_THRESHOLD_MEDIUM).toBe(3.0)
  })
  it('FADE_THRESHOLD_OFF = 4.0', () => {
    expect(FADE_THRESHOLD_OFF).toBe(4.0)
  })
  it('FADE_PROB_MEDIUM = 0.66', () => {
    expect(FADE_PROB_MEDIUM).toBeCloseTo(0.66, 2)
  })
  it('FADE_PROB_LOW = 0.33', () => {
    expect(FADE_PROB_LOW).toBeCloseTo(0.33, 2)
  })
  it('FIRST_ENCOUNTER_SESSIONS = 3', () => {
    expect(FIRST_ENCOUNTER_SESSIONS).toBe(3)
  })
})
```

This pattern matches the §2.5 drift-guard precedent in `add-to-10-content.md` and `sub-to-10-content.md` (RULE-identity tests). Any change to these constants must come with a fresh research note + Thomas decision (per the spec-amendment pattern in those tiers).

### 6.6 Anti-dark-pattern checklist (re-verified per `screen-math-subitising-prompt.md`)

- [ ] No variable-ratio reward — fade probability is per-session not per-problem, and the per-session-within-session schedule is deterministic.
- [ ] No streak shame — no streak interaction.
- [ ] No fake urgency — fixed 1100ms lifecycle, no countdown.
- [ ] No social pressure — no comparison.
- [ ] No infinite content — fades to nothing as fluency builds; explicit `easyBandLeitnerMeanBox ≥ 4.0` graduation.
- [ ] No "watch the dots!" prompt — silent visual, Emma never references the dots.
- [ ] No stardust delta — dot-card is learning affordance, not reward.
- [ ] No "graduation moment" celebration when scaffold permanently fades — quiet emergence, not a manufactured milestone.

---

## 7. Open questions — explicit, for Thomas's review at landing

### 7.1 `5 + 5` edge case — does the scaffold fire on the single HARD-band both-addends-≤-5 fact?

**The question.** `5 + 5` is the only fact where `max(a, b) = 5` AND `sum > 5`. By §2.1 C2 (both addends ≤ 5) it's in-scope. By §2.1 C3 (EASY-band gate) it would be out-of-scope (it's HARD-band sums-to-10).

**Recommendation.** Treat `5 + 5` as **IN-scope** — fire the dot-card. Rationale:

1. Dice-pip rendering works for `5 + 5` (two `5`-pip cells side-by-side). No visual vocabulary collision.
2. `5 + 5 = 10` is the "single most important double" per Dave's research § Intervention D — the make-10 anchor. Subitising both `5`s reinforces the make-10 mental model.
3. The §2.1 C3 wording ("EASY band gate") was descriptive (a self-consistency check) not prescriptive — the operational predicate in C2 (both addends ≤ 5) is what the implementation enforces. The C3 note can be relaxed without changing the implementation.

**Decision needed:** Thomas confirms or rejects. If rejected, C2 becomes `(a ≤ 5 && b ≤ 5 && sum ≤ 5)` and the spec's §1.2 wireframes' "side-by-side rendering" example for `5+5` becomes hypothetical only.

### 7.2 Does subitising extend to `sub-to-10` EASY band?

**The question.** `sub-to-10` is the NEXT math tier in the curriculum. Its EASY band contains facts like `5 - 5 = 0`, `8 - 4 = 4`, `6 - 3 = 3`, `9 - 1 = 8` (per `sub-to-10-content.md` §1.1). Subitising could pre-render the minuend as pips before Emma reads the line.

**Recommendation.** **Out of scope of v1; revisit when `sub-to-10` ships.** Two reasons:

1. **Different mental model.** Addition is *combine two quantities*; subtraction is *take from one quantity*. A subitising affordance for subtraction would show ONE pip-cell (the minuend) — different from the two-cell add-to-10 layout. The visual primitive would need to render the "take-away" semantics somehow (e.g. fade some pips out as the subtrahend is named?). That's a fresh design.
2. **Empirical data first.** Ship the add-to-10 scaffold, see whether it helps Marian, then propose a sub-to-10 analogue informed by what we learned. The cost of premature commitment is a screen-spec that doesn't fit her actual learning.

**Decision needed:** Thomas confirms "defer to post-sub-to-10-ship", OR requests a parallel sub-to-10 subitising spec now.

### 7.3 Does subitising extend to multiplication concept (repeated addition)?

**The question.** The multiplication tier ("x2/x5/x10 → x3/x4 → x6-9") begins with repeated addition. A visual grouping affordance (e.g. "three groups of two pips") could pre-render the multiplicand structure.

**Recommendation.** **Out of v1 scope; future spec.** Multiplication is conceptually different (groups-of-N, not combine-quantities); a dot-card affordance would need fresh research and a fresh spec. The dice-pip vocabulary tops at 5; multiplication concepts can go higher. Different visual primitive (array grid? ten-frame grouping?) likely needed.

**Decision needed:** Thomas acknowledges deferral; track as §8 follow-up.

### 7.4 What is the relationship to the existing dot-card affordance?

**The question.** `screens-and-flows.md § Math` references a "dot card affordance" in the existing Math screen. Is this spec's subitising scaffold the same thing or a separate primitive?

**Recommendation.** **Same primitive.** The cross-reference in `screens-and-flows.md` and the existing `screen-math-subitising-prompt.md` describe the SAME `<DotCard>` component. This content-tier spec adds the trigger/progression rules on top of the existing screen-layer visual primitive. **No new primitive proposed.** Devon implements `shouldShowSubitisingScaffold()` (the trigger predicate) and consumes the existing `<DotCard>` and `<DotCardOverlay>` components from the screen-layer spec.

**Decision needed:** Thomas confirms unified affordance interpretation. (If "no, these are separate features" is the answer, this spec needs a renaming pass.)

### 7.5 Should Emma's voice change for subitising vs counting? (Dispatch-brief explicit question)

**The question.** Should Emma sound different when the scaffold is firing vs when it isn't?

**Recommendation.** **NO — voice consistency. Locked at §3.2.** Emma is a character; her voice is constant. Voice-based bifurcation would erode character coherence. No voice change, no narration change, no parallel utterance. `math.p{N}.read` plays unchanged.

**Decision needed:** Thomas confirms the §3.2 lock.

### 7.6 Should "I need help" tap-to-reveal the scaffold? (Dispatch-brief explicit question)

**The question.** Should Marian have an explicit "help me" affordance that reveals the dot-card on demand?

**Recommendation.** **NO — defer to §2.4 / §8 follow-up.** v1 ships without an explicit help button. If empirical signal suggests it's needed, add as a screen-layer enhancement in a future PR; the content-tier rules in this spec are forward-compatible.

**Decision needed:** Thomas confirms deferral.

---

## 8. Tracked follow-ups

| # | Title | Owner | When | Rationale |
| --- | --- | --- | --- | --- |
| 8.1 | **Subitising for `sub-to-10` EASY band** | Kyle (spec) → Dave (research) | Post-`sub-to-10` ship + 4 weeks of Marian data | Per §7.2. Different mental model; needs fresh visual primitive design. |
| 8.2 | **Subitising for multiplication concept** | Kyle (spec) → Dave (research) | Post-`add-to-20` ship | Per §7.3. Different visual primitive; fresh research required. |
| 8.3 | **Ten-frame v2 option** | Kyle (spec) | If Marian's empirical signal suggests dice pips insufficient | Per §1.1. Ten-frame is a strong US-curricular precedent; could revisit if dice pips don't land. |
| 8.4 | **Parent-settings opt-out** (`subitisingScaffold?: 'on' \| 'off' \| 'auto'`) | Kevin (impl) + Kyle (spec touch) | If Thomas requests after v1 ship | Per §2.5. Forward-compatible hook in place via §2.1 C5. |
| 8.5 | **Visual-regression snapshot infrastructure** | Devon (impl) + Jessica (QA) | When the project adopts Percy/Chromatic | Per §6.4. Until then, DOM-attribute unit tests carry the visual-correctness load. |
| 8.6 | **"I need help" tap-to-reveal scaffold** | Kyle (spec) | If empirical signal suggests Marian asks for help | Per §2.4 + §7.6. Screen-layer enhancement; content-tier rules unchanged. |
| 8.7 | **Random-arrangement v3** (true subitising research stimulus) | Dave (research) → Kyle (spec) | If Marian masters dice-pip recognition and Thomas wants to push further | Per §1.1. Honors original Clements subitising literature but increases cognitive demand; only worth doing if there's data Marian needs it. |
| 8.8 | **Cross-tier scaffold-fade aggregation** | Kevin (impl) | If §8.1 / §8.2 ship and we have 2+ tiers with subitising | Today the `easyBandLeitnerMeanBox` signal is tier-local. If multiple tiers use subitising, the per-tier fade rules need to share infrastructure (`subitisingScaffoldSessionsObserved` may need to become per-tier). |
| 8.9 | **Empirical-fluency study after 4 weeks** | Thomas (observation) | 4 weeks post-ship | Does Marian's counting-to-recall trajectory actually accelerate with the scaffold on? The §4.3 illustrative trajectory is hypothetical — real data will inform §8.3 (ten-frame revisit) and §8.7 (random-arrangement v3). |

---

## 9. Cross-references and prior art

- **Sibling screen-layer spec:** [`design/screen-math-subitising-prompt.md`](../screen-math-subitising-prompt.md) (Kyle, 2026-05-09, ticket `86c9pwghh`). Owns the dot-card visual primitive, motion envelope, flower-coordination.
- **Research authority:** [`design/research/add-to-10-counting-to-recall.md`](../research/add-to-10-counting-to-recall.md) (Dave, 2026-04-29, ticket `86c9pr4t8`). §2 Intervention A "Subitising / dot-card visual patterns" + §4 ROI table ranking subitising as **High** priority + §Recommendations Priority 2.
- **Sibling content-tier spec (parent template):** [`design/math/add-to-10-content.md`](./add-to-10-content.md) (Kyle, 2026-05-16). Same §-structure; this spec mirrors it.
- **Sibling content-tier spec (subtraction):** [`design/math/sub-to-10-content.md`](./sub-to-10-content.md) (Kyle, 2026-05-15 + 2026-05-16 amendments). Reference for the §-shape and the precedent of per-tier content rules.
- **Distractor + streak research:** [`design/research/math-distractor-and-streak-decisions.md`](../research/math-distractor-and-streak-decisions.md) (Dave, 2026-04-25). Not directly load-bearing on this spec but provides the "gentle ramp through P3" precedent that the dot-card lifecycle respects (no scaffold-pressure in P1-P3 of a session; the scaffold is structural, not assessment-related).
- **Math screen canonical spec:** [`design/screen-3-math.md`](../screen-3-math.md) (Kyle, ticket `86c9grn9c`). The canonical Math screen contract. This spec is additive to it; nothing in §3-§5 conflicts.
- **Architecture brief:** `.claude/docs/screens-and-flows.md` § "Math" — references the "dot card affordance" that §7.4 confirms is the same primitive as this spec covers.
- **Progression infrastructure:** `.claude/docs/progress-and-persistence.md` — Leitner box mechanics, focus-node `firstEncounterGate`, the `mathFactsLeitner` field, and `recordProgressOnSessionEnd`. This spec's §2.2 + §2.3 + §4 consume these.
- **Anti-dark-pattern principles:** `CLAUDE.md` non-negotiables. Re-verified in §6.6.

---

## 10. Spec-authoring conventions used here

Following `screens-and-flows.md § Math` § "Spec-authoring convention" (Devon's PR #163 review): this spec **anchors all implementation references by stable name primitives** (component names `<DotCard>`, `<DotCardOverlay>`, gate predicates `shouldShowSubitisingScaffold()`, named refs `easyBandLeitnerMeanBox`, data-testid `math-dot-card`), NOT by line numbers in `Math.tsx`. Line-number drift across PRs is non-load-bearing for cross-file specs.

This spec also follows the precedent of `add-to-10-content.md` and `sub-to-10-content.md`:
- Single-flat top-level `§N. Title` numbering.
- Locked decisions tagged `LOCKED` inline; open questions consolidated in §7.
- Tracked follow-ups in §8 with explicit owner + trigger conditions.
- Cross-references in §9.

No new conventions introduced.

---

## 11. Provenance

- Brief: dispatch task `tkt-subitising-scaffold-spec` (Matt, 2026-05-16).
- Research anchor: `design/research/add-to-10-counting-to-recall.md` § Recommendations Priority 2 (Dave, 2026-04-29).
- Screen-layer prior art: `design/screen-math-subitising-prompt.md` (Kyle, 2026-05-09).
- Structural template: `design/math/add-to-10-content.md` (Kyle, 2026-05-16).
- Sibling-tier reference: `design/math/sub-to-10-content.md` (Kyle, 2026-05-15 + 2026-05-16).

---

## 12. Non-obvious findings to surface

For the `maintain-docs` Stop hook to consider promoting:

1. **The fluency-fade is per-session, not per-problem.** Per-problem randomness would feel like a slot machine; per-session randomness reads as variety. Anti-dark-pattern compliance pivots on this choice; future spec authors should default to per-session for any other "intermittent reinforcement" mechanic in the app.
2. **Leitner-mean is a better fluency signal than session-count after the first 3 sessions.** Session count is a proxy for exposure; Leitner-mean is a direct mastery signal. Same principle likely applies to any future scaffold-fade rules in other tiers (§8.8 cross-tier aggregation).
3. **First-encounter gate is scoped to scaffold-exposure, not tier-exposure.** Marian has run dozens of `add-to-10` sessions, but the day this PR ships she's encountering the scaffold for the first time. The session-count gate measures **exposure to the new affordance**, which is the correct semantics — and a precedent for any other affordance retrofitted onto an already-active tier in the future.
4. **No "graduation moment" when scaffold permanently fades.** Manufactured progression milestones are a dark-pattern flavour; quiet emergence is the right tone. This applies to any other scaffold-fade in the app (training-wheels affordances, hint mechanics, etc.).
5. **Hysteresis is intentionally absent.** A scaffold that re-appears when Marian regresses is a feature, not a bug. Overlapping-waves model (Siegler 1996) predicts retrieval and counting strategies fluidly co-exist; the scaffold should match that fluidity, not impose a one-way ratchet.
6. **Dice pips beat ten-frames for Marian specifically because of L2 + cultural-neutrality, not pedagogical-evidence superiority.** Ten-frame is the stronger US-curricular precedent; for a child without exposure to that vocabulary, dice are the lower-friction choice. Future scaffolds for L2-primary children should default to cross-culturally-recognisable visual primitives.
7. **The C3 "EASY band gate" predicate is descriptive, not prescriptive.** Implementation enforces C2 (both addends ≤ 5). The wording in §2.1 reflects this layering; the §7.1 open question is whether C3 should become prescriptive for the `5+5` edge case.
