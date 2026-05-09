# Word Song — cross-vowel distractor mixing v1 spec

> **One-line summary.** Once Marian has consolidated short-a + short-o + short-u as `mastered`, this spec flips the same-vowel-only constraint locked in `short-o-pool-expansion.md` §8 and `short-u-pool-expansion.md` §8 into a **controlled mixed-vowel matrix** so chip trios can deliberately exercise vowel-discrimination — adding `TARGET_PAIRINGS_CROSSVOWEL` rows, gating cross-vowel chips on a `crossVowelMixingEnabled` predicate driven by per-track mastery state, and codifying how the new matrix respects the existing `FORBIDDEN_PAIRS` set without adding new entries.

**Ticket:** `86c9m3aek` (this spec) — implementation ticket downstream (Kevin handles `wordPack.ts` matrix extension + `wordDistractors.ts` predicate + planner gating + canon flag wiring; Devon handles e2e regression spec). **Spec only — no code, no canon, no tests.**
**Status:** Draft for Thomas review.
**Author:** Marian Tutor design persona.
**Predecessors:** PR #135 (cvc-words first-class shipped), PR #139 (developmental review merged 2026-05-02), PR #141 (short-o pool expansion spec, locked 2026-05-04), PRs #150–#157 (short-o impl + canon + picture pack), PR #170 (short-u picture pack — embed 11 PNG-in-SVG assets, merged 2026-05-09 as commit `ba08b69`), PR `86c9q9ben` (short-u canon-wiring follow-up, in flight at spec time).
**Companion specs:** `design/word-song/short-o-pool-expansion.md` §8 (locked the same-vowel-only constraint this spec flips), `design/word-song/short-u-pool-expansion.md` §8 (restated the lock for short-u; this spec is the explicit "later" referenced there), `design/word-song/probe-word-picture-pack.md` §4 (sibling design pattern — gated planner-side selection logic on a session-flag predicate; this spec uses the same shape for cross-vowel gating), `design/research/phonics-sequence-marian.md` §Q1 (vowel-discrimination evidence) and §Application (`/u/` vs `/ʌ/` minimal-pair scaffolding pattern).

---

## 1. Why this spec, why now

### Why now

The same-vowel-only constraint was a v1 simplification to keep the picker, planner, and `TARGET_PAIRINGS` matrix all single-vowel-deterministic while Marian was still consolidating individual vowel tiers. Per `design/word-song/short-o-pool-expansion.md` §8 (locked 2026-05-04, restated verbatim in `short-u-pool-expansion.md` §8):

> Cross-vowel distractor work is a separate downstream design (Ticket 4 in Matt's filing). Lock the v1 short-o scope as **same-vowel distractors only, mirroring how cvc-words works today.** Practically: the short-o trio always draws from the 8 short-o pool words, never mixing in short-a chips.

That ticket was filed as `86c9m3aek` — this spec.

The trigger for designing it now (rather than later) is twofold:

1. **Short-u is the third consolidated vowel.** With short-a, short-o, and short-u all in flight (short-u canon-wiring is in PR `86c9q9ben` at spec time, picture pack landed in PR #170 = commit `ba08b69` on main), Marian will reach the "three consolidated vowels" state on a realistic 3–5-week horizon — exactly the timeline at which Dave's review §6 P2 says cross-vowel distractor work is appropriate. Designing the spec at the trailing edge of short-u canon-wiring leaves Kevin's impl-ticket time to land before Marian saturates same-vowel sessions.

2. **The same-vowel-only matrix has a saturation ceiling.** Each tier with `n` words yields exactly `n × C(n−1, 2)` possible same-vowel trios (each target picks 2 distractors from `n−1` siblings). For short-o `n=8` → 168 trios; for short-u `n=11` → 495 trios. Within an 8-problem session, the planner picks 8 trios from the live tier — that's plenty for one session, but across many sessions the trios become familiar. Cross-vowel mixing increases the trio space combinatorially (a short-u target can pair with a short-a or short-o distractor, multiplying the effective pool) and — more importantly — it shifts the cognitive demand from intra-vowel onset/coda discrimination to **vowel discrimination**, which is the next harder skill in the structured-literacy progression (Dave §2, `phonics-sequence-marian.md` §Q1).

### What this spec achieves

- Defines the **triggering condition** that flips a session from same-vowel-only to mixed-vowel: a per-track predicate read at session-start, gated on `skillLevels` — short-a + short-o + short-u all `mastered`.
- Defines the **distractor-matrix shape** under mixing: a new `TARGET_PAIRINGS_CROSSVOWEL` extension keyed by target, carrying gentle + trap distractor pairs that may include cross-vowel words. Existing same-vowel `TARGET_PAIRINGS` rows stay unchanged; the planner reads which matrix to use based on the predicate.
- Defines the **constraint set** mixing must respect: existing `FORBIDDEN_PAIRS` honoured (no new entries needed — the audit in §4 below verifies coverage), distinctness rules unchanged, gentle/trap tier semantics carry over with vowel-distance acting as a third axis.
- Cites the **pedagogical justification** for cross-vowel discrimination work at this stage, with a flag where Dave's existing research is silent on the timing question and a follow-on research-ticket recommendation.

### What this spec does NOT propose

- Not impl. Kevin's impl ticket (downstream of this spec landing) writes the matrix rows, the planner branch, the predicate, and the regression test. This spec defines the contract; the impl is mechanical.
- Not canon-bake. The canon-bake plan is straightforward (one new flag in the canon key under graduation-style bypass) but the actual JSON regen ships with Kevin's impl PR.
- Not new picture-pack work. Every picture this spec references is already on `main` post-PR #170 — short-a (14 target + 4 probe + 8 distractor-only-but-now-target-of-short-o), short-o (4 wholly-new + 4 promoted), short-u (8 wholly-new + 3 retraced). **Picture-pack implications: NONE.**
- Not a planner-prompt-copy refresh beyond the cross-vowel matrix branch. The Emma chatter, hint, giveAnswer templates stay verbatim from the same-vowel-only paths.

---

## 2. Triggering condition — when does mixing kick in?

### The predicate

**Locked: cross-vowel mixing turns on for a session when ALL of the following hold.**

1. The session's `focusNode` is a CVC tier — `cvc-words`, `cvc-words-short-o`, or `cvc-words-short-u` (the three consolidated vowel tiers in v1 scope).
2. The Progress doc's `skillLevels` shows `cvc-words === 'mastered'` AND `cvc-words-short-o === 'mastered'` AND `cvc-words-short-u === 'mastered'`.
3. The `parentSettings.crossVowelMixingEnabled` flag is `true` (default `true` once T1 ships — Thomas can flip OFF if real-iPad signal shows Marian struggling with the discrimination jump; flag exists as a safety lever, not a default-OFF setting; Q1 in §10 confirms the default).

When ALL three are satisfied, the planner emits cross-vowel distractor pairs from the new matrix. When ANY of the three fails, the planner falls through to the existing same-vowel-only matrix verbatim — no behavioural change for tiers that haven't all reached mastery.

### Per-tier vs. per-aggregate-mastery — which gating shape?

Two candidate shapes considered:

| Option | Predicate | Effect |
|---|---|---|
| **A. Per-aggregate (LOCKED).** | `cvc-words` AND `cvc-words-short-o` AND `cvc-words-short-u` all `mastered`. | Mixing turns on for ALL three tiers simultaneously, the moment short-u (the last in declaration order today) masters. Sessions on any of the three tiers can draw cross-vowel distractors from the union pool. |
| B. Per-tier. | Mixing turns on for tier `T` when EVERY tier T' with `T' ≠ T` is `mastered`. So short-a sessions could mix short-o/short-u distractors as soon as short-o + short-u are both mastered, regardless of whether short-a itself is still `practicing`. | Earlier mixing on the longer-mastered tiers; complicated branching; unclear pedagogical benefit (mixing into a tier Marian is still consolidating dilutes the in-tier work). |

**Decision: Option A.** Per-aggregate mastery is the cleanest gate. Reasons:

- **Pedagogical alignment.** Per Dave's §2 (cited in `phonics-sequence-marian.md` and §3 below), cross-vowel discrimination is "appropriate once short-a is consolidated" — the implicit "and so is the contrasting vowel." Mixing into a tier Marian is still working through (Option B's edge case) re-introduces unfamiliar items at the moment she's trying to consolidate the current vowel. That's friction without payoff.
- **Implementation surface.** Option A reads three boolean fields and AND's them. Option B requires per-tier branching that compounds when short-i and short-e land. The simpler shape ages better.
- **Aligns with the existing graduation-gate posture.** The `cvc-words` graduation gate (`isGraduationSessionPending`, `progress-and-persistence.md` §"Graduation gate") is a per-aggregate predicate that gates a behaviour change on a complete state. Mirrors the same shape.

The predicate name in Kevin's impl spec: `crossVowelMixingEnabled(progress, focusNode, parentSettings)` returning a boolean. Implementation detail; name is a recommendation, not load-bearing.

### What about short-i and short-e?

**Out of v1 cross-vowel scope.** When short-i ships (next vowel in the locked order `o → u → i → e` per `phonics-sequence-marian.md` §Q1), the predicate widens to require `cvc-words-short-i === 'mastered'` as well (Kevin updates one constant). When short-e ships, same widening pattern. The shape doesn't change; the constant does.

This v1 spec covers the **3-vowel cross-vowel-mixing case** (short-a × short-o × short-u). Subsequent vowels arrive AFTER additional same-vowel tiers ship and master, so the cross-vowel matrix expansion to 4 or 5 vowels is a future enhancement on the same shape. No design rework needed at that point — only matrix-row authoring and predicate-constant widening. §8 calls this out explicitly.

### Idempotency and bypass

- Same canon + cache bypass posture as graduation-session (`progress-and-persistence.md` §"Graduation-session bypass") and Leitner-active (§"M4 session-gen wiring"). When `crossVowelMixingEnabled === true`, both canon AND in-memory cache are bypassed at the planner. The combinatorial expansion of trios under mixing means a cached non-mixed plan would emit same-vowel-only distractors for a session that was supposed to mix. Live planner run is the right posture; cost is one Haiku call + ~59 Azure TTS renders ≈ ~$0.0022 per session, capped per-IP by the existing 6/60s rate limiter.
- The existing canon JSON files (`public/canon/word-song/level-1/cvc-words.json`, `cvc-words-short-o.json`, `cvc-words-short-u.json`) stay valid for sessions where the predicate is `false`. Marian's first ~3-5 weeks on the app (before all three vowels master) hit canon as today — zero cost change.

---

## 3. Pedagogical justification

### Direct citation from Dave's review

Cross-vowel distractor work was forecast in `design/research/cvc-words-developmental-review.md` §2 (cited in `short-o-pool-expansion.md` §8 line 314):

> If and when the pool expands to include short-o words, cross-vowel distractors (e.g., cat / mop / fan) should also be available — they test a different and slightly harder skill (vowel discrimination), which is appropriate once short-a is consolidated.

Dave §6 P2 lists the cross-vowel mixing work as the next pedagogical step beyond same-vowel-only CVC, framed as a follow-on after at least one alternative vowel tier consolidates.

### Indirect citations on vowel-discrimination timing

`design/research/phonics-sequence-marian.md` §Q1 (revised vowel order locked 2026-04-26) sources the importance of short-vowel discrimination work but does NOT explicitly time when *cross-vowel chip discrimination* (as a session-design feature) becomes appropriate. The closest evidence is Source 4 (Reading Universe / Really Great Reading on ELL short vowels) at lines 57–60 of the phonics doc:

> Recommends illustrated word pairs with contrasting vowel sounds and explicit meaning-instruction alongside phoneme work.

That language (illustrated word pairs with contrasting vowel sounds) is a structured-literacy primitive — and it matches what cross-vowel mixing surfaces inside the chip trio (target with vowel V1, distractor with vowel V2). So the principle is endorsed; the *timing* (post-consolidation of multiple same-vowel tiers) is consistent with the §Application short-vowel introduction sequence at lines 159–171, but is not directly stated.

Source 13 (Brookes / Cardenas-Hagan, lines 117–120) on ELL pacing also doesn't directly address cross-vowel chip-discrimination timing; it speaks to pacing of new pattern *introduction*, not pacing of *contrastive trial design*.

### Gap — recommended follow-on research ticket

**Dave's research is partially silent on the precise cross-vowel-discrimination timing question.** §2 of his developmental review supports the *concept* but doesn't pin the *threshold* (e.g., does Marian need 90/3 mastery on each of the 3 vowels before cross-vowel? Does she need novel-pool generalization on each? Or is multi-tier mastery the right gate?).

**Recommendation: file a follow-on research ticket** for Dave (or whoever owns the next phonics-research deliverable) — *"Cross-vowel discrimination-task readiness: when does the mastery threshold per vowel meet the threshold for vowel-contrast chip work?"* The output should clarify whether per-aggregate mastery is sufficient (Option A here, the locked default) OR whether each consolidated vowel additionally needs a novel-pool generalization probe (mirroring `cvc-words` §"Graduation gate" behaviour). Until that research lands, this v1 spec uses **per-aggregate mastery** as the safest no-extra-gate posture; the gate can tighten later without breaking the matrix shape.

Suggested ticket title: *"Research: cross-vowel discrimination readiness threshold (consult to ticket `86c9m3aek` v2)."* Matt to file under `research/` with Dave as owner.

### Why per-aggregate mastery is a reasonable v1 gate without that research

- **It mirrors the gate Dave does endorse.** Same-vowel mastery at 90/3 is the per-tier rule Dave's review §6 explicitly approves (`cvc-words-developmental-review.md`); cross-vowel mixing stacks on top of three independent 90/3 gates. The probability of accidentally over-gating a child (mixing too late) is low; the probability of under-gating (mixing while a vowel is still emergent) is mitigated by Option A's "all three mastered" requirement.
- **It's reversible.** `parentSettings.crossVowelMixingEnabled` flag (default `true`, see §10 Q1 lock) lets Thomas turn it off if real-iPad signal shows Marian regressing on a tier when cross-vowel chips arrive. The cost of a misjudged threshold is one settings toggle, not a stuck progression.
- **It honours Marian's specific risk profile.** The diagnostic (April 2026) flagged short-/i/ as her weakest vowel; the locked sequence is `o → u → i → e` so she meets short-i AFTER all three v1 cross-vowel-tier vowels. The cross-vowel mixing doesn't affect short-i intro work because short-i isn't in the v1 cross-vowel pool yet.

### What the chip surface tests under mixing

Per Dave §2 and `phonics-sequence-marian.md` §Application line 207 (`/u/` vs `/ʌ/` contrast pattern): cross-vowel discrimination forces Marian to attend to the **vowel** as a load-bearing decoding dimension, not just the consonant frame. A trio of `[bug, bag, beg]` (cross-three-vowel, hypothetical when short-e ships) requires reading the vowel, not pattern-matching on `b_g`. In the v1 pool (3 vowels), the equivalent pressure is `[hat, hot, hut]` or `[man, mom, mum]`-shaped — and not every 3-letter cross-vowel triple yields a real picturable word in our pack, so the matrix will lean on what's available rather than synthetically constructing minimal pairs the picture pack doesn't support. §4 below works through which cross-vowel pairs actually exist in the pack today.

---

## 4. Distractor matrix changes (mechanical shape, with example rows)

### Existing matrix shape (unchanged)

`src/screens/WordSong/wordPack.ts TARGET_PAIRINGS` is keyed `target.word → { gentle: [d1, d2], trap: [d1, d2] }`. The same-vowel-only rule is enforced at the matrix-row authoring level — every row's distractor pair is drawn from the target's own vowel pool. Per `wordDistractors.ts:96–131`, `pickDistractors(target, problemIndex)` reads the matrix, picks the gentle or trap pair based on `pickTier(problemIndex)`, and runs `assertNotForbidden` defensively. Same-vowel rows continue to ship in v1 and stay verbatim — they're the fallback when the predicate is `false`.

### Proposed: parallel `TARGET_PAIRINGS_CROSSVOWEL` matrix

Add a sibling matrix with the same shape, keyed by the same `target.word` but containing distractor pairs that may cross vowel pools. Switching between matrices is the planner's job (when to read one vs. the other) and `wordDistractors.ts`'s job (which matrix to pass to `pickDistractors`). The matrix-row authoring constraints follow:

```ts
// Sibling of TARGET_PAIRINGS in src/screens/WordSong/wordPack.ts
//
// Active when crossVowelMixingEnabled(progress, focusNode, parentSettings) === true.
// Each row's distractors MAY cross vowel pools (short-a / short-o / short-u). The
// gentle vs trap rule still holds:
//   - gentle (problems 1-3): clearly different from target on multiple axes
//     — different category, different starting consonant, AND different vowel
//     (the cross-vowel difference replaces the same-vowel "different vowel SOUND"
//      constraint that was vacuous under same-vowel-only).
//   - trap   (problems 4-8): shares at least one axis with target — could be
//     onset (alliteration), coda (rhyme family across vowels — e.g. `bat/hot`
//     share /æt/ vs /ɒt/), or category. Vowel difference is the discriminative
//     load.
//
// FORBIDDEN_PAIRS are honoured. The audit in §4.3 confirms no new pairs needed.
export const TARGET_PAIRINGS_CROSSVOWEL: Readonly<Record<string, TargetPairings>> = {
  // ── Short-a targets (cross-vowel distractors from short-o + short-u) ──
  cat:  { gentle: ['mom', 'sun'], trap: ['hot', 'nut'] },
  hat:  { gentle: ['log', 'bug'], trap: ['hot', 'hut'] },
  bat:  { gentle: ['mom', 'cup'], trap: ['hot', 'bus'] },
  // ... etc (Kevin authors all 33 rows under the impl ticket)
}
```

Per-row constraints, applied during matrix authoring:

1. **Vowel mix rule.** Each row's TWO distractors should EACH carry a *different* vowel from the target. So a short-a target's gentle/trap distractors are EITHER `[short-o, short-u]` OR `[short-o, short-o]` OR `[short-u, short-u]` etc. — *not* both same-vowel-as-target. (At least one cross-vowel chip; ideally both.) For trap-tier specifically, prefer a *vowel-contrast* pair (`[short-o, short-u]`) because that maximises the discriminative pressure.
2. **Forbidden-pair guards.** Existing `FORBIDDEN_PAIRS` are honoured — `assertNotForbidden(target, d1)`, `(target, d2)`, `(d1, d2)`. The cross-vowel pool extends the silhouette-collision space; §4.3 audits whether any new pairs are needed. **Result: no new entries needed**, the existing 6 entries cover the new combinations because all the at-risk pairs were already captured (e.g., `[cat, dog]` was added in v1, and the cross-vowel matrix never tries to pair a short-a target with `dog` AND `cat`-the-target — distinctness rule already excludes that).
3. **Distinctness rule.** `d1 ≠ d2`, `d1 ≠ target`, `d2 ≠ target`. Same as same-vowel matrix.
4. **Picture-availability rule.** Every word referenced in a row must have a `getWordEntry()`-resolvable entry in `wordPack.ts` AND a corresponding picture-pack SVG on disk. As of 2026-05-09 post-PR #170, this means: 14 short-a target + 4 probe + 8 short-o + 11 short-u = 37 words total. (Probe words are in `TARGET_WORDS` but only emit on graduation runs — they should NOT be cross-vowel distractors because that breaks their generalization-probe-only invariant. **Cross-vowel matrix EXCLUDES the 4 probe words** as distractor candidates. Same exclusion as the regular distractor pool today.) Effective cross-vowel candidate pool: **33 words** (14 short-a target + 8 short-o + 11 short-u).
5. **Category-spread preference for gentle tier.** Per the existing matrix's gentle-tier rule (`wordPack.ts:387`), gentle distractors are clearly different from target. With cross-vowel mixing, "different vowel" is automatic for the cross-vowel chip; the additional axes (different category, different starting consonant) should still hold. Trap-tier can share category or onset since the discriminative load is on the vowel.

### Three example rows, fully resolved

These show how the matrix expands. Kevin authors the full 33 rows under his impl ticket using these shapes as templates.

#### Example 1 — `hat` (short-a target)

```
gentle: ['log', 'bug']   // log: short-o, object, different category, different onset.
                         // bug: short-u, animal, different category, different onset.
                         // Both clearly different from hat (clothing, /æt/, h-onset).
                         // FORBIDDEN_PAIRS audit: [hat, log] OK; [hat, bug] OK;
                         //   [log, bug] OK.
trap:   ['hot', 'hut']   // hot: short-o, /ɒt/ — rhyme-family across vowels with hat /æt/.
                         // hut: short-u, /ʌt/ — rhyme-family across vowels with hat.
                         // All three share /-t/ coda + h-onset. Vowel is the
                         // load-bearing discriminator. This is exactly the
                         // [hat / hot / hut] cross-vowel minimal-triplet Dave
                         // §2 implies — and it lines up perfectly with the
                         // pack today.
                         // FORBIDDEN_PAIRS audit: [hat, hot] OK; [hat, hut] OK;
                         //   [hot, hut] OK.
```

The trap row is the textbook cross-vowel minimal-triplet result — and `hat`/`hot`/`hut` is one of the rare 3-letter cross-three-vowel triples where every word resolves to a real picturable noun in our pack (hat = head-cover, hot = steaming bowl, hut = A-frame dwelling). The picture-side discriminators are strong (clothing vs. food vs. building), so even the trap-tier passes the silhouette gate at 96pt.

#### Example 2 — `dog` (short-o target)

```
gentle: ['hat', 'cup']   // hat: short-a, clothing, different category, different onset.
                         // cup: short-u, vessel, different category, different onset.
                         // Both clearly different from dog (animal, /ɒg/, d-onset).
                         // FORBIDDEN_PAIRS audit: [dog, hat] OK; [dog, cup] OK;
                         //   [hat, cup] OK.
                         //   Note: [dog, cat] IS forbidden (existing pair); we
                         //   never use `cat` as a distractor for `dog` regardless
                         //   of vowel mode.
trap:   ['bag', 'bug']   // bag: short-a, /æg/ — rhyme-family across vowels with dog /ɒg/.
                         // bug: short-u, /ʌg/ — rhyme-family across vowels with dog.
                         // All three share /-g/ coda. Different onsets (d-/b-/b-)
                         // mean the trap is genuinely vowel-discriminative,
                         // not onset-pattern.
                         // FORBIDDEN_PAIRS audit: [dog, bag] OK; [dog, bug] OK;
                         //   [bag, bug] OK.
```

Trap row maps to the 3-vowel `/g/`-coda family — `bag` (short-a) / `dog` (short-o) / `bug` (short-u) — also a clean cross-three-vowel triplet that lines up with real pack words.

#### Example 3 — `sun` (short-u target)

```
gentle: ['mat', 'mom']   // mat: short-a, household, different category from sun (celestial).
                         // mom: short-o, person, different category.
                         // Different onsets (m-/m-) repeats but onset-on-distractors
                         // is allowed (the constraint is target ≠ distractor onset).
                         // FORBIDDEN_PAIRS audit: [sun, mat] OK; [sun, mom] OK;
                         //   [mat, mom] OK.
trap:   ['bun', 'man']   // bun: short-u, /ʌn/, rhyme-family in-pool — same-vowel.
                         //   Wait — that's same-vowel-as-target, violating rule (1).
                         //   REPLACEMENT: ['fan', 'mom']
                         // fan: short-a, /æn/ — rhyme across vowels with sun /ʌn/.
                         // mom: short-o, /ɒm/ — onset/coda nudge but vowel-distinct.
                         //   Hmm — mom is /ɒm/, not /ɒn/. The rhyme-family-across-
                         //   vowels for /ʌn/ is short-a `fan/man/can/pan/van` and
                         //   short-o (no `/ɒn/` word in pool — `son/con` not in pack).
                         //   FINAL: trap: ['fan', 'man'] would be both short-a, also
                         //   violating rule (1) preference for cross-vowel pair.
                         //   BEST: trap: ['fan', 'mom'] — short-a /æn/ rhyme-bridge
                         //   + short-o non-rhyme onset-share. Acceptable; vowel
                         //   discrimination still load-bearing (fan vs sun = vowel;
                         //   mom vs sun = vowel + onset).
                         // FORBIDDEN_PAIRS audit: [sun, fan] OK; [sun, mom] OK;
                         //   [fan, mom] OK.
```

This example is preserved with the working-out visible because it shows where the matrix authoring genuinely has tradeoffs. The /ʌn/ rhyme family doesn't extend to short-o in the v1 pool, so the textbook minimal-triplet is unavailable; the matrix author has to settle for partial-rhyme + vowel-contrast. **Kevin's impl ticket inherits this constraint** — for some short-u targets, the trap-tier cross-vowel pair won't be a perfect minimal triplet. That's fine; rule (1)'s preference for vowel-contrast pair is a *preference*, not a hard rule. Where rule (1) and a clean minimal-triplet conflict, prefer the minimal-triplet's pedagogical clarity over forced cross-vowel-pair purity (i.e., a `[fan, can]` trap for `sun` would be *both short-a* but is a textbook /n/-coda discrimination drill — acceptable as a fallback).

### Matrix coverage — full 33 rows TBD, but planning is mechanical

Kevin's impl ticket authors the full `TARGET_PAIRINGS_CROSSVOWEL` matrix (33 rows: 14 short-a + 8 short-o + 11 short-u). This spec defines the constraints; the per-row authoring is mechanical against:

1. The vowel-mix preference (rule 1).
2. The forbidden-pair guards (rule 2 — all 6 existing pairs honoured).
3. Distinctness (rule 3).
4. Picture availability (rule 4 — 33-word effective pool).
5. Category-spread preference for gentle tier (rule 5).

A full audit of all 33 rows would land in Kevin's PR description as a checklist — same shape as `wordPack.ts:393–450`'s same-vowel matrix's per-row commentary today. **Spec defers the per-row specifics to impl** because the matrix is mechanical given the constraints; a spec-level matrix would just duplicate Kevin's work and risk drift.

### What pairs are NOT possible / NOT useful

For completeness, the cross-vowel pool intentionally LACKS some intuitive minimal triplets because the v1 picture pack doesn't support them:

- `cat / cot / cut` — `cot` is short-o but NOT in the short-o pool (rejected from §1 audit per `short-o-pool-expansion.md` for vocab-cap risk). No cross-vowel triplet possible on `c_t`.
- `pat / pot / put` — `pat` not in short-a pool; `put` not in short-u pool (verb-class). No triplet.
- `man / mon / mun` — `mon`/`mun` not English. N/A.
- `pan / pon / pun` — `pon`/`pun` not in pools. N/A.

These gaps are acceptable. The matrix doesn't need exhaustive minimal triplets to do its work; it needs *enough* contrastive pairs across the 33 targets that every gentle and trap row is well-formed against the constraints. Kevin's authoring exercise will reveal where the pack genuinely runs out — at that point a follow-up ticket can extend the picture pack (e.g., adding `cot` would unlock several minimal triplets), but it's not blocking for v1 cross-vowel mixing to ship.

### Distractor selection runtime — the read path

Concrete change in `wordDistractors.ts:pickDistractors(target, problemIndex)`:

```ts
// Existing signature stays. New optional argument widens the contract:
export function pickDistractors(
  target: WordEntry,
  problemIndex: number,
  options?: { crossVowel?: boolean },
): [WordEntry, WordEntry] {
  const tier = pickTier(problemIndex)
  const matrix = options?.crossVowel
    ? TARGET_PAIRINGS_CROSSVOWEL
    : TARGET_PAIRINGS
  const pairings = matrix[target.word]
  if (!pairings) {
    throw new Error(/* ... */)
  }
  // ... rest of existing logic unchanged: read pair, getWordEntry, audit.
}
```

The caller (`WordSong.tsx`'s problem-render path) reads the `crossVowelMixingEnabled` predicate at session-start (passed in from the planner response or computed at session-mount from `Progress`) and threads `{ crossVowel: true | false }` into every `pickDistractors` call for the session. A session is uniformly cross-vowel or uniformly same-vowel — never half-and-half.

The "uniform per session" rule keeps the matrix-shape read deterministic and avoids the "I got 2 cross-vowel chips and 6 same-vowel chips and I can't tell why" cognitive-load risk for Marian.

---

## 5. Forbidden-pair audit — no new entries needed

The existing `FORBIDDEN_PAIRS` set (`wordPack.ts:357–365`) at spec time:

```ts
['cat', 'dog'],   // both four-legged animals in side profile
['bus', 'van'],   // both vehicles in side view
['pan', 'pot'],   // both cooking vessels in three-quarter view
['cap', 'hat'],   // both head-coverings, similar mass at 96pt
['man', 'dad'],   // both human figures
['mom', 'dad'],   // parent-with-child compositions; differ on hair/outfit
```

Plus two pairs locked in `short-u-pool-expansion.md` §3 / §10 Q3 (LOCKED 2026-05-08), which the in-flight short-u canon-wiring PR (`86c9q9ben`) ships — this spec assumes them on `main` once that PR merges:

```ts
['rug', 'mat'],   // flat-rectangular floor coverings, fringe vs. plain
['tub', 'cup'],   // vessels in side profile
```

Total v1 + v2 + v3 forbidden pairs: **8** (counting both short-u pairs).

### Cross-vowel hazard catalogue

A "cross-vowel hazard" is a pair (a, b) where `a.vowel ≠ b.vowel` AND a + b in the same trio under the new mixing matrix would silhouette-collide at 96pt. Audit:

| Pair | Vowel mix | Silhouette-collision at 96pt? | Already in FORBIDDEN_PAIRS? | Action |
|---|---|---|---|---|
| `[cat, dog]` | short-a × short-o | YES — both four-legged side-profile mammals. | YES (existing) | None — already covered. |
| `[cat, fox]` | short-a × short-o | YES — both small four-legged animals; fox has bushy tail + pointed ears as discriminator, but at 96pt borderline. | NO | **Recommend add** as cross-vowel hygiene? See below. |
| `[cat, rat]` | short-a × short-a | (within probe-pack — already covered by probe-pack §3, which added `[rat, cat]`). | YES (probe-pack PR) | None — already covered if probe-pack §3 lands. |
| `[cat, bug]` | short-a × short-u | NO — cat is mammal, bug is insect (oval body, six legs, antennae). Distinct silhouettes. | NO | None needed. |
| `[dog, rat]` | short-o × short-a | YES — both four-legged side-profile mammals. | YES (probe-pack §3 adds `[rat, dog]`) | None — already covered if probe-pack ships. |
| `[dog, fox]` | short-o × short-o | (same-vowel — covered by short-o spec.) | NO direct entry, but never co-paired in matrix | None — same-vowel rule prevents trio. |
| `[dog, bug]` | short-o × short-u | NO — dog is mammal, bug is insect. Distinct. | NO | None needed. |
| `[bus, jug]` | short-u × short-u | (same-vowel — covered by short-u spec.) | NO | None needed. |
| `[bus, log]` | short-u × short-o | NO — bus is rectangular vehicle with windows, log is brown cylinder with bark. Distinct. | NO | None needed. |
| `[pan, pot]` | short-a × short-o | YES — both cooking vessels three-quarter view. | YES (existing) | None — already covered. |
| `[pan, cup]` | short-a × short-u | YES-borderline — both handled vessels but pan is shallow disc with horizontal handle, cup is small handled drinking vessel. Discriminators hold. | NO | **Marginal** — leave out; if Phase 2 review of cross-vowel chip pairs reveals a collision at 96pt, add then. Cost-asymmetry favours wait-and-see (matrix author can avoid this pair if needed). |
| `[pan, jug]` | short-a × short-u | YES-borderline — both handled vessels. Jug has vertical body + spout, pan has horizontal handle. Discriminators hold. | NO | Same as `[pan, cup]` — wait. |
| `[pot, jug]` | short-o × short-u | YES-borderline — both deep open vessels. Jug has handle + spout, pot has lid + handles. Discriminators hold. | NO | Same — wait. |
| `[pot, tub]` | short-o × short-u | YES-borderline — short-u spec §5 noted "pot has lid + handles, tub has feet + larger; low risk with same-vowel constraint." Cross-vowel mode lifts the same-vowel constraint. **Reconsider.** | NO | **Marginal — recommend the matrix author SHOULD avoid this pair**; if that's not enforceable structurally, add `[pot, tub]` to FORBIDDEN_PAIRS. See decision below. |
| `[pot, cup]` | short-o × short-u | YES-borderline — short-u spec already locked `[tub, cup]`; `[pot, cup]` is the parallel concern. Cup is small handled drinking vessel; pot is large two-handled cooking vessel. Discriminators hold (size + handle count + lid). | NO | Wait — discriminators stronger here than `[pot, tub]`. |
| `[mom, mat]` | short-o × short-a | NO — mom is parent-with-child composition, mat is flat rectangular rug. Different shapes. | NO | None needed. |
| `[mom, man]` | short-o × short-a | YES — both human figures. | NO | **Recommend add as cross-vowel hygiene** — see decision below. |
| `[hat, hut]` | short-a × short-u | NO-borderline — hat has brim + crown (compact, hand-sized at chip), hut has A-frame walls + door (architectural). Discriminators hold per short-u spec §5 audit. | NO | None needed. |
| `[hot, hut]` | short-o × short-u | NO — hot is steaming bowl, hut is A-frame house. Different shapes. | NO | None needed. |

### Decision on the marginal cases

Three pairs sit on the borderline: `[cat, fox]`, `[mom, man]`, `[pot, tub]`. Cost-asymmetry analysis:

- **Cost of adding now:** one line each in `FORBIDDEN_PAIRS`. Eliminates the matrix author's option to use this pair (small cost).
- **Cost of adding later (after Phase 2 visual review):** one PR with two changes — the FORBIDDEN_PAIRS line + the matrix row that referenced the pair. Plus the iPad-smoke or e2e regression to catch the collision.
- **Cost of wait-and-see + matrix author avoids the pair:** zero — matrix author is constrained by the gentle/trap rule and many alternative pairs are available.

**Recommendation: NO new entries to FORBIDDEN_PAIRS.** Reasons:

1. The matrix author has 33 targets × multiple per-target candidates; avoiding three borderline pairs is trivial.
2. Marian's actual at-iPad signal post-cross-vowel ship is the right time to add a forbidden pair, not pre-emptive matrix-author-blocking-flagging.
3. Cross-vowel mixing has many unknowns; over-constraining the matrix with speculative forbidden pairs trades real flexibility for speculative protection.
4. The 8 existing pairs already cover the most-known collisions — the audit confirms 5 of the 8 already-collisions ARE captured. The 3 borderline cases are genuinely "matrix author judgement call" territory.

**However, this spec FLAGS the three borderline pairs to Kevin's impl ticket as known-hazards.** Kevin's authoring of `TARGET_PAIRINGS_CROSSVOWEL` should note that these three pairs were considered and avoided (per spec §5 audit). If the impl-PR's matrix draft uses any of these pairs, Jessica's review or Thomas's iPad-smoke flags it for adjustment. This is safer than a hard prohibition that would bind future maintainers without context.

### Net forbidden-pair changes on this spec PR

**Zero.** The spec proposes the cross-vowel matrix shape; FORBIDDEN_PAIRS stays unchanged. If Phase 2 visual review or real-iPad signal reveals a collision, that's a follow-up ticket — same shape as the `[tub, cup]` lock-now decision in short-u spec §10 Q3.

---

## 6. Out of scope / what this spec does NOT propose

Mirroring `short-u-pool-expansion.md` §8's structure for consistency:

### Out of scope (deferred to other tickets)

- **Picture-pack work for cross-vowel mixing.** No new pictures needed. Every word the cross-vowel matrix draws from is already on `main` post-PR #170. The 33-word effective pool covers the matrix's authoring needs.
- **Sight words, digraphs, simple-sentences nodes.** Cross-vowel mixing applies ONLY to the three CVC tiers (`cvc-words`, `cvc-words-short-o`, `cvc-words-short-u`). `digraphs`, `sight-words`, `simple-sentences` get their own design treatment when they reach impl scope; cross-vowel mixing across digraphs (e.g., `shop` × `chip` × `that`) is a separate downstream design — not in scope here.
- **Short-i and short-e cross-vowel rows.** When short-i lands, the cross-vowel matrix widens (Kevin adds short-i target rows + short-i words become candidate distractors); the predicate constant adds `cvc-words-short-i === 'mastered'`. Same for short-e. Out of v1 cross-vowel scope; the design carries forward without rework.
- **Per-vowel-pair training mode.** A bespoke "vowel-discrimination drill" mode (e.g., session focused exclusively on `/æ/ vs /ɒ/`) is a different feature from cross-vowel mixing-within-CVC-sessions. Out of scope.
- **Adaptive cross-vowel difficulty based on per-session accuracy.** When this spec ships, every cross-vowel-eligible session gets cross-vowel chips. A future "if Marian misses 3 cross-vowel trials in a row, fall back to same-vowel for the rest of this session" adaptive layer is a follow-on; out of v1.
- **Probe words in the cross-vowel matrix.** The 4 novel-pool probes (`nap, rat, map, tap`) stay graduation-session-only. They are NOT candidates for cross-vowel distractor slots — that would break the generalization-probe-only invariant.
- **Cross-vowel mixing in `STATIC_WORD_SONG_PLANS` (the offline fallback).** The static plans rotate same-vowel only; live planner is the only cross-vowel emit-path. If the planner can't reach (network failure → static fallback), Marian gets a same-vowel session — graceful degradation.
- **First-encounter Emma scaffolding for cross-vowel.** Mirroring short-o `box`/`fox` and short-u `/u/` vs `/ʌ/`, a one-time "Now we're going to mix vowels!" first-session opener could be in scope. **Decision: NOT in v1 cross-vowel spec.** Marian arrives at cross-vowel mode having mastered three vowels — she has the receptive vocabulary; the cognitive-load shift is in the chip-trial discrimination, not in conceptual introduction. Out of scope. (Open as Q3 in §10 if Thomas wants this.)
- **Canon JSON for cross-vowel sessions.** Per §2 "Idempotency and bypass," cross-vowel-enabled sessions bypass canon (mirroring graduation-session and Leitner-active bypass). No new canon JSON file needed; the existing canon JSONs cover the same-vowel path. If Thomas later wants to bake cross-vowel canon for cost-reduction (the 6/60s rate-limiter is plenty for steady-state Marian), that's a follow-up — additive, no rework.

### Cross-vowel mix preview (this spec IS the preview from earlier specs)

`short-o-pool-expansion.md` §8 (Cross-vowel mix preview) and `short-u-pool-expansion.md` §8 (same restatement) both forecast this spec. **This document IS the v1 cross-vowel mix design.** The "tracked as ticket `86c9m3aek`" comment in those specs resolves here. Future cross-vowel work (per-vowel-pair drills, adaptive difficulty, etc.) is the next-level forecast — captured under "Out of scope" above.

---

## 7. Acceptance criteria

Kevin and Thomas use these. Jessica validates against them. Mirrors `short-u-pool-expansion.md` §9 structure verbatim where applicable.

- [ ] **AC1.** A new `crossVowelMixingEnabled(progress, focusNode, parentSettings)` predicate ships in `src/lib/progress/` (location TBD; recommend `mastery.ts` next to `isGraduationSessionPending`). Returns `true` iff: (a) `focusNode ∈ { 'cvc-words', 'cvc-words-short-o', 'cvc-words-short-u' }`, AND (b) `skillLevels` shows all three tiers `'mastered'`, AND (c) `parentSettings.crossVowelMixingEnabled === true` (default `true`). Pure function; unit-tested for all three boolean axes. Mirrors `isGraduationSessionPending` shape.
- [ ] **AC2.** `parentSettings.ts ParentSettings` interface gains `crossVowelMixingEnabled: boolean` field. `DEFAULT_PARENT_SETTINGS` carries `crossVowelMixingEnabled: true`. Read path (`getSettings(progress)`) defaults missing key to `true` so old blobs round-trip cleanly. Schema does NOT bump (additive optional field, mirrors `parentSettings` itself which is additive).
- [ ] **AC3.** ParentSettings UI exposes a toggle for `crossVowelMixingEnabled`. Visual treatment matches the existing `autoPromote` toggle row (rationale: parent-facing control, deliberate-friction surface; not Marian-visible). Label copy: "Mix vowels in chip trios (after all three vowels mastered)" — Kyle confirms exact copy in Kevin's impl PR. Default ON.
- [ ] **AC4.** `src/screens/WordSong/wordPack.ts` exports a new `TARGET_PAIRINGS_CROSSVOWEL: Readonly<Record<string, TargetPairings>>` matrix with one row per target across the three CVC tiers (14 short-a + 8 short-o + 11 short-u = **33 rows**). Rows comply with §4 constraints: vowel-mix preference, FORBIDDEN_PAIRS, distinctness, picture availability (33-word effective pool excluding the 4 probe words), category-spread for gentle. The 4 probe words (`nap, rat, map, tap`) are NOT cross-vowel distractor candidates.
- [ ] **AC5.** No additions to `wordPack.ts FORBIDDEN_PAIRS`. The §5 audit confirms existing 8 pairs cover known collisions; the 3 borderline pairs (`[cat, fox]`, `[mom, man]`, `[pot, tub]`) are matrix-author-avoided per the spec note.
- [ ] **AC6.** `src/screens/WordSong/wordDistractors.ts pickDistractors(target, problemIndex, options?)` widens to accept an optional `{ crossVowel?: boolean }` argument. When `options.crossVowel === true`, reads from `TARGET_PAIRINGS_CROSSVOWEL`; otherwise reads from `TARGET_PAIRINGS` (existing behaviour). Defaults to `false` for back-compat.
- [ ] **AC7.** `WordSong.tsx`'s problem-render path threads the `crossVowelMixingEnabled` boolean — computed once at session-start from the live `Progress` snapshot — into every `pickDistractors` call for the session. A session is uniformly cross-vowel or uniformly same-vowel.
- [ ] **AC8.** `api/_planner.ts WORD_SONG_TRACK_GUIDE` gains a cross-vowel branch for the three CVC tiers: when the request payload's `progress.crossVowelMixingEnabled === true` AND the resolved focus is one of the three CVC tiers, the planner is allowed to emit cross-vowel distractor pairs in the canonical-shape problem responses. Same-vowel branch is the default. The browser's request payload gains an additional optional field `progress.crossVowelMixingEnabled?: boolean` that mirrors the local predicate (off by default; ships with payload only when the predicate evaluates `true` locally — same posture as `isGraduationSession` and `leitner` non-empty).
- [ ] **AC9.** Cross-vowel-active sessions BYPASS canon and the in-memory cache (mirrors `isGraduationSession` and `leitner` non-empty bypass posture per `progress-and-persistence.md` and `planner-and-canon.md`). Live Haiku run + 59 Azure TTS renders per cross-vowel session. Cost ≈ ~$0.0022; rate-limited per existing 6/60s.
- [ ] **AC10.** Existing canon JSONs (`cvc-words.json`, `cvc-words-short-o.json`, `cvc-words-short-u.json`) stay byte-for-byte unchanged — cross-vowel matrix never affects same-vowel sessions. Snapshot regression confirms zero diff.
- [ ] **AC11.** No regression on existing CVC sessions while cross-vowel predicate is `false`. Pre-mastery sessions (Marian still consolidating one of the three tiers) continue to use `TARGET_PAIRINGS` and same-vowel-only behaviour. Snapshot regression on `STATIC_WORD_SONG_PLANS` and on `wordDistractors.test.ts` stays green.
- [ ] **AC12.** Planner-output regression tests (`api/_planner.test.ts` + `src/screens/WordSong/plannerRoundTrip.test.ts`) cover: (a) cross-vowel-flagged session emits trios with at least one cross-vowel distractor per problem (vowel diversity assertion), (b) same-vowel session (cross-vowel flag false) emits same-vowel-only trios, (c) every distractor pair passes the existing forbidden-pair audit, (d) probe words never appear in cross-vowel distractor slots, (e) every target's matrix row resolves a gentle + trap pair without throwing.
- [ ] **AC13.** New e2e regression spec `e2e/cvc-cross-vowel-mix-regression.spec.ts` covers: debug-seed routing into a "all three CVC tiers mastered + on cvc-words-short-u practising next-tier" state, planner request shape includes `crossVowelMixingEnabled: true`, chip render shows multi-vowel trio, session walk-through advances normally. WebKit `test.skip` from test 3 onward (read-aloud-dependent), per `.claude/docs/testing-and-ci.md` §8.3.1.
- [ ] **AC14.** Debug seed `cvc-cross-vowel` added to `src/lib/debug/debugSeed.ts SEEDS` table — marks `letter-names`, `letter-sounds`, `blending-cv`, `cvc-words`, `cvc-words-short-o`, `cvc-words-short-u` all as `'mastered'`; sets parent-settings `crossVowelMixingEnabled: true`. Skips Greet (sessionCount → 1). Routes Marian into the first cross-vowel-enabled session (the next CVC focus node still in `practicing` state — Kevin's call which tier the seed lands on; recommend `cvc-words-short-u` for visual richest mix).
- [ ] **AC15.** `e2e/_helpers/seedStorage.ts DEFAULT_SKILL_LEVELS` is unaffected (no new SkillNode added). `defaults.ts SCHEMA_FLOOR_NODES` is unaffected. `cloudSync.ts`'s private `withDefaultedSkillLevels` mirror is unaffected. The 5-place sync rule does NOT trigger because this spec adds no new SkillNode — only a parent-settings field and a matrix sibling. (`parentSettings` defaulting goes through `getSettings` which already handles missing keys per `parentSettings.ts:99`.)

---

## 8. Open questions for Thomas

Mirrors `short-u-pool-expansion.md` §10 in the same locked-decisions-with-rationale-and-cost-asymmetry format. Two are pre-locked-with-rationale (Q1, Q2); two are flagged as genuine open questions (Q3, Q4) for Thomas to confirm.

**Q1. Default value of `parentSettings.crossVowelMixingEnabled`.** **LOCKED ON (default `true`) per cost-asymmetry analysis below.** When all three CVC tiers (`cvc-words`, `cvc-words-short-o`, `cvc-words-short-u`) reach `'mastered'`, cross-vowel mixing kicks in automatically. Rationale: (a) the per-aggregate gate already encodes "she's ready for harder discrimination work" — a default-OFF setting would require Thomas to flip a hidden toggle to unlock the pedagogically appropriate next step, which is a parent-friction failure mode. (b) The mechanism is reversible — if Marian struggles, Thomas flips the toggle off; cost is one settings tap. (c) Mirrors the `autoPromote: true` default, which similarly defaults to "engine drives Marian forward unless parent intervenes." Cost-asymmetry: cost-of-default-ON-when-Marian-isn't-ready = one settings flip after one struggle session. Cost-of-default-OFF = Marian sits at consolidated-three-vowels indefinitely with no harder material until Thomas notices and flips. Default ON wins.

**Q2. Per-aggregate vs. per-tier mastery gating.** **LOCKED Per-aggregate (Option A in §2)** per the §2 analysis — same-shape as `isGraduationSessionPending`, simpler to reason about, ages cleanly when short-i + short-e land. Cost-asymmetry: cost-of-Option-A-being-too-conservative = a few extra weeks of same-vowel sessions on the longer-mastered tier (low cost, Marian still progresses on the un-mastered tier). Cost-of-Option-B-being-too-aggressive = mixing fires while Marian is still consolidating a vowel, dilutes the consolidation, possibly regresses. Option A wins.

**Q3. Should cross-vowel mode ship with a one-time Emma "we're mixing vowels now" first-session opener?** **LOCKED 2026-05-09 by Thomas (option A — no opener for v1).** Marian arrives at cross-vowel mode having mastered three vowels (short-a + short-o + short-u) — the receptive vocabulary and the discrimination skills are ready; an explanatory line risks reading as a "this is harder" cue that primes her for friction rather than letting her experience the natural progression as competence. Cross-vowel mixing fires only after the three same-vowel tiers are all `mastered` per Q2's per-aggregate gate, so by the time Marian sees a mixed trio she has the consolidation behind her. Spec ships at v1 with **no first-encounter opener** for cross-vowel mode; if real-Marian usage signal later shows confusion-on-introduction, a one-time opener can be added under a follow-up ticket as additive change to `WORD_SONG_TRACK_GUIDE` (same lifetime-once mechanism short-o `box`/`fox` and short-u `/u/`-vs-`/ʌ/` use). AC items unchanged — Q3 lock is a no-op on the matrix or the planner-template constants.

**Q4. Cross-vowel discrimination-readiness research follow-on.** **LOCKED 2026-05-09 by Thomas (option A — file the Dave research ticket).** Matt creates a follow-on Dave research ticket scoped to: "When is cross-vowel discrimination developmentally appropriate — is per-aggregate-mastery sufficient, or does each consolidated vowel additionally need a novel-pool probe (mirroring `cvc-words` graduation gate)?" v1 of this spec ships with per-aggregate-mastery as the threshold per Q2 lock; if Dave's research later returns "cross-vowel work needs per-vowel novel-pool generalization on each vowel," the gate tightens via one predicate constant change in `mastery.ts` — additive, non-breaking. AC items reflect the v1 (per-aggregate) gate; the research ticket informs whether v2 is needed.

All four questions are now locked. Q1 + Q2 carried strong recommendations with cost-asymmetry rationale; Q3 + Q4 were genuine asks resolved by Thomas on 2026-05-09. AC items in §7 reflect Q1/Q2 locks (default-ON cross-vowel; per-aggregate gate); Q3 lock is a no-op on AC; Q4 lock surfaces a Matt-driven follow-on ticket but no AC change in this spec.

---

## 9. Provenance

- **Triggering doc:** ticket `86c9m3aek` brief (this PR's design surface). Forwarded from `short-o-pool-expansion.md` §8 (locked 2026-05-04) + `short-u-pool-expansion.md` §8 (locked 2026-05-09 by Thomas).
- **Pedagogical anchor (direct):** `design/research/cvc-words-developmental-review.md` §2 + §6 P2 (Dave, merged in PR #139, 2026-05-02).
- **Pedagogical anchor (indirect):** `design/research/phonics-sequence-marian.md` §Q1 + §Application (Dave, merged 2026-04-26). Source 4 (Reading Universe / Really Great Reading) at lines 57–60 endorses contrastive vowel work for ELL learners; the spec extends that primitive into the chip-trio surface.
- **Predecessor specs (structural template):**
  - `design/word-song/short-o-pool-expansion.md` (locked the same-vowel-only constraint this spec flips; §8 forecast this ticket).
  - `design/word-song/short-u-pool-expansion.md` (restated §8 forecast verbatim; this spec is the named follow-up).
  - `design/word-song/probe-word-picture-pack.md` §4 (sibling design pattern — gated planner-side selection logic on a session-flag predicate; this spec uses the same shape for cross-vowel gating).
- **Locked memories:**
  - `project_planner_parser_contract` (parser before planner — N/A, no parser change; the cvc-word `"Read the <word>."` template is unchanged for cross-vowel mode).
  - `project_canon_commit_strategy` (canon committed to repo, manual regen — cross-vowel-active sessions bypass canon, so no regen needed at v1 ship).
  - `project_anthropic_billing_constraint` (cost surface analysis — cross-vowel session cost ≈ ~$0.0022 same as graduation/Leitner-active; well within budget).
  - `project_spec_drift_decisions` (existing locks carried forward unchanged).
- **Word-list and matrix source-of-truth files referenced:**
  - `src/screens/WordSong/wordPack.ts TARGET_WORDS / FORBIDDEN_PAIRS / TARGET_PAIRINGS` (existing same-vowel matrix; this spec adds the `TARGET_PAIRINGS_CROSSVOWEL` sibling).
  - `src/screens/WordSong/wordDistractors.ts pickDistractors / pickTier` (caller path; widening the signature to accept the cross-vowel option).
  - `src/lib/progress/parentSettings.ts ParentSettings / DEFAULT_PARENT_SETTINGS / getSettings` (the new `crossVowelMixingEnabled` field + read-path defaulter).
- **Tree source-of-truth:** `src/lib/progress/types.ts WordSongNode`, `src/lib/progress/mastery.ts LITERACY_TREE`, `src/lib/progress/focusNode.ts WORD_SONG_NODES_IN_ORDER` — UNCHANGED (no new node).
- **Picker source-of-truth:** `src/lib/progress/focusNode.ts pickFocusNode` — unchanged. The picker walks the tree as today; cross-vowel mixing is a per-session distractor mode, not a new node.
- **Canon source-of-truth:** `scripts/generateSessionCanon.ts WORD_SONG_FOCUS_NODES` — UNCHANGED (cross-vowel-active sessions bypass canon, no new combo to bake).
- **Planner source-of-truth:** `api/_planner.ts WORD_SONG_TRACK_GUIDE / generateSessionPlan / VALID_WORD_SONG_FOCUS_NODES` — gains a cross-vowel branch under `WORD_SONG_TRACK_GUIDE` and a payload field handler in the request validator. `VALID_WORD_SONG_FOCUS_NODES` UNCHANGED.
- **In-flight short-u state:** PR #170 (commit `ba08b69`) merged the short-u picture pack on 2026-05-09 (today). PR `86c9q9ben` is the in-flight short-u canon-wiring follow-up; this spec assumes that PR has merged before Kevin's cross-vowel impl ticket dispatches. If `86c9q9ben` ships independently or is delayed, Kevin's impl ticket explicitly cross-references it as a hard prerequisite (`[tub, cup]` and `[rug, mat]` FORBIDDEN_PAIRS need to be on `main` first).
- **Marian's literacy levels:** `CLAUDE.md` §"Marian's current levels"; `project_diagnostic_results` memory (April 2026); 2026-05-08 iPad signal: progressing on short-a, on track for short-o → short-u transition. Cross-vowel mixing engages 3–5 weeks after short-u tier ships.
- **Five-place sync rule:** `.claude/docs/progress-and-persistence.md` §"Five sync points when widening `SkillNode`" + `.claude/docs/testing-and-ci.md` §4.1.1 — does NOT trigger here (no new SkillNode added; `parentSettings` field is additive via `getSettings` defaulter).
