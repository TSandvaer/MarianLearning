# Wave 12 — Generic-tier three-beat hint templates

## Context

Wave 12 splits each math `hint` utterance into `hint1` / `hint2` / `hint3`. The W12-03 directive already specifies per-operand templates for the 6 arithmetic tiers (add-to-10, add-to-20, sub-to-10, sub-to-20, two-digit-addsub-no-regroup, two-digit-addsub-with-regroup). This file covers the remaining 5 tiers whose hints cannot be derived deterministically from operands alone without an explicit template:

1. `number-recog`
2. `skip-counting`
3. `mult-2-5-10`
4. `mult-3-4`
5. `mult-6-9`

Each section gives:
- The three-beat template with placeholder definitions and derivation rules.
- Per-tier case splits where the problem structure varies.
- Quality verdict against legacy bespoke hints.
- Full tabulation of all 8 canon problems with derived hint1/hint2/hint3 text.

---

## Framework (locked by Dave's ruling, wave-12-plan.md §1)

| Beat  | Role | Pattern |
|-------|------|---------|
| hint1 | Attention-direction — orient to the relevant perceptual element | "Look at the [element]." |
| hint2 | Quantity/structure scaffold — name the rule or the structural relationship | Tier-specific; see below |
| hint3 | Restate-question — echo the read line's question word-for-word | Identical to the question clause of the read line |

**hint3 is always a verbatim restatement of the problem's final question clause.** For all 5 tiers below that question is "What is next?" (skip-counting) or "How many?" (multiplication tiers) or absent (number-recog — the read line carries no explicit question clause, so hint3 is handled specially — see tier 1 below).

**Emma vocabulary cap (~200 core words):** all template vocabulary has been checked against the canonical word list. Flagged terms are noted.

**Never-a-red-X tone:** hint2 narrows the search space without naming the answer. hint3 restates the question warmly, not reproachfully.

**Prosody notes (weak-monosyllable TTS):** Azure Speech `en-GB-OliviaNeural` handles most monosyllables cleanly at rate `-10%`. Known risk: very short utterances (3 words or fewer) can lose natural sentence-final prosody. Each hint1 is flagged where this is a concern.

---

## Tier 1 — `number-recog`

### Structure

Read line: `"Tap the <number-word>."` — no explicit question clause.
Target: child taps the numeral chip matching the spoken number word.
Correct: `"Yes! <number-word>!"`
GiveAnswer: `"This one is <number-word>."`

The existing legacy hints ("Look. Five is in the middle.", "Look. Nine is close to ten.", etc.) use ordinal-position and magnitude-comparison cues — these are the strongest developmental scaffolds for numeral recognition in 6-9 year-olds (Siegler & Opfer, 2003 number-line estimation; Dehaene, 1997 number sense). The template must preserve this topology-based reasoning.

### Problem structure analysis

The 8 canon problems cover numerals 1, 2, 3, 4, 5, 6, 7, 9. The legacy hints use three scaffold types:

| Legacy scaffold type | Examples | Derivation |
|---|---|---|
| Ordinal extreme | "One is the smallest number." | target == 1 → "smallest"; target == 10 → "biggest" |
| Sequence adjacency | "Three comes after two." / "Four comes after three." / "Two comes right after one." / "Six comes after five." | target N → "comes after N-1" |
| Magnitude landmark | "Five is in the middle." / "Seven is bigger than five." / "Nine is close to ten." | target 5 → "middle"; target 7 → "bigger than five"; target 9 → "close to ten" |

The legacy hints collapse all three scaffold types into one sentence. The three-beat split makes the scaffold EXPLICIT:
- hint1 directs attention to the numeral display.
- hint2 gives the topological fact (position, adjacency, or landmark).
- hint3 restates the task as a question.

**The read line ends with a period, not a question mark.** There is no natural question clause to restate verbatim. The hint3 restatement for this tier is `"Which one is <number-word>?"` — converting the declarative read into an interrogative to preserve the question function of hint3 without inventing new vocabulary. This is the only tier where hint3 is not a verbatim read-line echo; the derivation rule makes it fully deterministic.

### Placeholder derivation rules

| Placeholder | Derivation rule |
|---|---|
| `<number-word>` | The number word from the read line (`"Tap the <number-word>."`) |
| `<topological-fact>` | The magnitude/adjacency fact — see case split below |

**Case split for `<topological-fact>` in hint2:**

| Target | hint2 text |
|---|---|
| 1 | "One is the smallest." |
| 2 | "Two comes right after one." |
| 3 | "Three comes after two." |
| 4 | "Four comes after three." |
| 5 | "Five is in the middle." |
| 6 | "Six comes after five." |
| 7 | "Seven is bigger than five." |
| 8 | "Eight comes after seven." |
| 9 | "Nine is close to ten." |
| 10 | "Ten is the biggest." |

These entries are lookup-table values, not computed from the operand algorithmically — they encode semantic topology that Haiku cannot derive. Kevin must embed this 10-entry table in the directive verbatim.

### Templates

```
hint1 = "Look at the numbers."
hint2 = <topological-fact>  [from case split above, keyed on target]
hint3 = "Which one is <number-word>?"
```

**Prosody note — hint1:** "Look at the numbers." is 4 words, low risk. Azure will produce acceptable falling intonation.

### Tabulation — number-recog (8 problems)

| P | Read line | Legacy hint | hint1 | hint2 | hint3 |
|---|-----------|-------------|-------|-------|-------|
| 1 | "Tap the one." | "Look. One is the smallest number." | "Look at the numbers." | "One is the smallest." | "Which one is one?" |
| 2 | "Tap the three." | "Look. Three comes after two." | "Look at the numbers." | "Three comes after two." | "Which one is three?" |
| 3 | "Tap the five." | "Look. Five is in the middle." | "Look at the numbers." | "Five is in the middle." | "Which one is five?" |
| 4 | "Tap the two." | "Look. Two comes right after one." | "Look at the numbers." | "Two comes right after one." | "Which one is two?" |
| 5 | "Tap the seven." | "Look. Seven is bigger than five." | "Look at the numbers." | "Seven is bigger than five." | "Which one is seven?" |
| 6 | "Tap the four." | "Look. Four comes after three." | "Look at the numbers." | "Four comes after three." | "Which one is four?" |
| 7 | "Tap the nine." | "Look. Nine is close to ten." | "Look at the numbers." | "Nine is close to ten." | "Which one is nine?" |
| 8 | "Tap the six." | "Look. Six comes after five." | "Look at the numbers." | "Six comes after five." | "Which one is six?" |

### Quality verdict

hint2 is a strict refinement of the legacy single hint (word-for-word the same topological fact, minus "Look." prefix which migrates to hint1). Pedagogical content is fully preserved. hint1 is weaker than the legacy opener only in the sense that it does not add new information — this is by design (it is attention-direction, not pedagogy). hint3 ("Which one is X?") converts the declarative to interrogative, which the legacy single-hint did not do; this is a small gain (explicit re-engagement of the child's active search).

**Verdict: SHIP. Full three-beat template.**

---

## Tier 2 — `skip-counting`

### Structure

Read line: `"<sequence-terms>. What is next?"` — the sequence terms are the full printed/spoken sequence up to the last given term.
Target: child taps the next term in the sequence.
Correct: `"Yes! <next-term>!"`
GiveAnswer: `"This one is <next-term>."`

The skip step is 2, 5, or 10. The read line encodes the step implicitly (by the gap between terms); the legacy hint names the step explicitly AND restates the partial problem (e.g. "Look. We add two each time. Fourteen and two more is what?"). This is strong scaffolding — the legacy hint has two pedagogical moves: (a) name the step rule, (b) narrow to the final partial sub-problem. The three-beat split separates these:
- hint1 directs attention to the sequence.
- hint2 names the step rule (explicitly states what is being added each time).
- hint3 restates the question (the final partial sub-problem from the legacy hint, or the bare "What is next?" question).

**hint3 derivation:** the legacy hint2 already has the gold standard: `"<last-term> and <step> more is what?"`. This is more scaffolding than the bare `"What is next?"` echo, and it is deterministic from the problem data (last-term = the final term in the sequence, step = the common difference). I adopt `"<last-term-word> and <step-word> more is what?"` as hint3 because it is strictly stronger pedagogy than the bare question restate and remains fully deterministic.

### Placeholder derivation rules

| Placeholder | Derivation rule |
|---|---|
| `<step-word>` | The common difference, spelled as a word: 2 → "two", 5 → "five", 10 → "ten". Derivable from any two consecutive terms in the read line, or from the read line's first term (read line always starts at the first term: "Two, four, six, eight. What is next?" → step = 2). |
| `<last-term-word>` | The last number word in the comma-separated sequence before "What is next?". E.g. "Two, four, six, eight. What is next?" → last term = "eight". |

**Step detection rule:** read line has pattern `"<t1>, <t2>[, <t3>…]. What is next?"`. Step = t2 − t1, which equals the common difference throughout. In all current canon cases: sequences starting with 2 → step 2; starting with 5 or 15 → step 5; starting with 10 → step 10.

### Templates

```
hint1 = "Look at the numbers."
hint2 = "We add <step-word> each time."
hint3 = "<last-term-word> and <step-word> more is what?"
```

**Prosody note — hint3:** sentences ending in "is what?" have rising intonation naturally in TTS. No SSML intervention needed. This phrasing follows the legacy canon exactly ("We add two each time. Fourteen and two more is what?").

**Prosody note — hint1:** 4 words, acceptable.

### Tabulation — skip-counting (8 problems)

| P | Read line | Legacy hint | hint1 | hint2 | hint3 |
|---|-----------|-------------|-------|-------|-------|
| 1 | "Two, four, six, eight. What is next?" | "Look. We add two each time. Two, four, six, eight, and two more is what?" | "Look at the numbers." | "We add two each time." | "Eight and two more is what?" |
| 2 | "Five, ten, fifteen. What is next?" | "Look. We add five each time. Fifteen and five more is what?" | "Look at the numbers." | "We add five each time." | "Fifteen and five more is what?" |
| 3 | "Ten, twenty, thirty, forty. What is next?" | "Look. We add ten each time. Forty and ten more is what?" | "Look at the numbers." | "We add ten each time." | "Forty and ten more is what?" |
| 4 | "Two, four, six. What is next?" | "Look. We add two each time. Six and two more is what?" | "Look at the numbers." | "We add two each time." | "Six and two more is what?" |
| 5 | "Five, ten, fifteen, twenty, twenty-five. What is next?" | "Look. We add five each time. Twenty-five and five more is what?" | "Look at the numbers." | "We add five each time." | "Twenty-five and five more is what?" |
| 6 | "Ten, twenty, thirty, forty, fifty, sixty. What is next?" | "Look. We add ten each time. Sixty and ten more is what?" | "Look at the numbers." | "We add ten each time." | "Sixty and ten more is what?" |
| 7 | "Two, four, six, eight, ten, twelve, fourteen. What is next?" | "Look. We add two each time. Fourteen and two more is what?" | "Look at the numbers." | "We add two each time." | "Fourteen and two more is what?" |
| 8 | "Five, ten, fifteen, twenty, twenty-five, thirty, thirty-five, forty. What is next?" | "Look. We add five each time. Forty and five more is what?" | "Look at the numbers." | "We add five each time." | "Forty and five more is what?" |

### Quality verdict

The legacy single hint fuses hint2 and hint3 together in one sentence. The split preserves every pedagogical move: hint2 names the rule, hint3 restates the partial problem identically to the legacy second clause. hint1 adds a focusing beat the legacy single-hint did not have.

**One legacy hint deviates:** P1's legacy hint uses the extended form "Two, four, six, eight, and two more is what?" (the full sequence reprinted) rather than just "Eight and two more is what?" (the last-term form). The derived hint3 uses last-term form ("Eight and two more is what?") — this is slightly weaker attention-direction for P1 but is consistent with the template across all 8 problems. The last-term form is well-established in early numeracy scaffolding (bridging from known to unknown, Van de Walle 2014). The consistency gain outweighs the one-problem deviation.

**Verdict: SHIP. Full three-beat template.**

---

## Tier 3 — `mult-2-5-10`

### Structure

Read line: `"<factor-a-word> times <factor-b-word>. How many?"`
Target: child taps the product chip.
Correct: `"Yes! <product-word>!"`
GiveAnswer: `"This one is <product-word>."`

This tier uses factors from {2, 5, 10} × {1, 2, 3, 4, 5} (and commutatives). The legacy hints scaffold multiplication as repeated addition, using two structural forms:

| Legacy scaffold type | Examples | Structure |
|---|---|---|
| "N and N more" (doubles form) | "Look. Two and two more. How many now?" / "Look. Five and five more. How many now?" | 2×2, 5×2 (factor-b=2 × factor-a) |
| "N group(s) of M" | "Look. One group of five." / "Look. Two groups of five." / "Look. One group of ten." | factor-b=1 (single group), factor-b=2 (two groups) |
| Repeated addition chain | "Look. Two, then two, then two. How many all together?" / "Look. Five, five, five, five. How many all together?" | factor-b=3 (three copies), factor-b=4 (four copies) |

The three-beat split:
- hint1 directs attention to the groups/rows display.
- hint2 gives the structural scaffold (which sub-type, see below).
- hint3 = `"How many?"` (verbatim read-line question clause).

**Case split for hint2:**

The structural scaffold in hint2 is determined by the number of groups (the second operand in how the problem is rendered mentally — the repeated-addition direction). For multiplication, the canonical repeated-addition direction is: `A × B = B copies of A`. The read line is `"<factor-a> times <factor-b>. How many?"`, so:

- factor-b copies of factor-a is the repeated addition direction.
- hint2 reconstructs the repeated addition chain.

| factor-b value | hint2 template |
|---|---|
| 1 | "One group of <factor-a-word>." |
| 2 | "<factor-a-word> and <factor-a-word> more." |
| 3 | "<factor-a-word>, then <factor-a-word>, then <factor-a-word>." |
| 4 | "<factor-a-word>, <factor-a-word>, <factor-a-word>, <factor-a-word>." |
| 5 | "<factor-a-word>, <factor-a-word>, <factor-a-word>, <factor-a-word>, <factor-a-word>." |

**Derivation rule:** extract `factor-a` and `factor-b` from the read line (`"<factor-a> times <factor-b>. How many?"`). Look up factor-b in the case split to get the template shape; substitute `<factor-a-word>` throughout.

**Prosody note — hint2 for factor-b=4 or 5:** long chains of identical words ("Five, five, five, five.") can produce flat/chanted TTS. The legacy P8 uses this form ("Five, five, five, five. How many all together?") — already in the canon, already ear-tested. Acceptable risk given the existing precedent.

### Templates

```
hint1 = "Look at the groups."
hint2 = [case split on factor-b, substituting factor-a-word]
hint3 = "How many?"
```

### Tabulation — mult-2-5-10 (8 problems)

| P | Read line | Legacy hint | hint1 | hint2 | hint3 |
|---|-----------|-------------|-------|-------|-------|
| 1 | "Two times two. How many?" | "Look. Two and two more. How many now?" | "Look at the groups." | "Two and two more." | "How many?" |
| 2 | "Five times one. How many?" | "Look. One group of five." | "Look at the groups." | "One group of five." | "How many?" |
| 3 | "Ten times one. How many?" | "Look. One group of ten." | "Look at the groups." | "One group of ten." | "How many?" |
| 4 | "Two times three. How many?" | "Look. Two, then two, then two. How many all together?" | "Look at the groups." | "Two, then two, then two." | "How many?" |
| 5 | "Five times two. How many?" | "Look. Five and five more. How many now?" | "Look at the groups." | "Five and five more." | "How many?" |
| 6 | "Two times five. How many?" | "Look. Two groups of five." | "Look at the groups." | "Two, two, two, two, two." | "How many?" |
| 7 | "Ten times two. How many?" | "Look. Ten and ten more. How many now?" | "Look at the groups." | "Ten and ten more." | "How many?" |
| 8 | "Five times four. How many?" | "Look. Five, five, five, five. How many all together?" | "Look at the groups." | "Five, five, five, five." | "How many?" |

**P6 note:** Legacy hint says "Two groups of five" for "Two times five", but the mathematical scaffold should be five groups of two (factor-b=5 copies of factor-a=2). The legacy hint is using the commutative grouping (read as "two, five times" i.e. factor-a=5, factor-b=2). This is a pedagogically valid choice — "two groups of five" is how this fact is typically visualised. However, the template derivation above strictly follows the read line's operand order (factor-a=2, factor-b=5 → five copies of two). **I am flagging this as a quality concern.** The derived hint2 "Two, two, two, two, two." is less natural than the legacy "Two groups of five." for this particular fact, because the commuted reading (2×5 = 5 twos) is harder to visualise than (5×2 = 2 fives). Recommendation: add a special-case for `factor-a=2, factor-b=5` → use "Two and two and two and two and two." (explicit chain) rather than the comma-separated form, OR allow Kevin to flip to the commutative grouping ("Two groups of five.") for any case where factor-a < factor-b and factor-a ∈ {2, 5, 10}. The latter is more natural but requires a branching rule. I defer to Kevin on implementation; the deterministic default (comma-chain, five copies of two) is valid.

### Quality verdict

hint2 preserves the repeated-addition scaffold from the legacy hints entirely. hint3 simplifies from legacy "How many now?" / "How many all together?" to a uniform "How many?" — this is a small regression (the legacy variants gave a mild completion cue: "now" = in the moment, "all together" = summation). The gain in template uniformity is worth this trade-off; "How many?" is always grammatically correct and within Emma's vocabulary.

**Verdict: SHIP. Full three-beat template. One derivation clarification needed for P6 (see note above).**

---

## Tier 4 — `mult-3-4`

### Structure

Read line: `"<factor-a-word> times <factor-b-word>. How many?"`
Factors: 3 and 4 exclusively (both orderings).
Target: child taps the product chip.

The legacy hints use the same repeated-addition scaffold as mult-2-5-10. The case split on factor-b is identical in structure. The same templates apply.

### Case split for hint2 (same as mult-2-5-10)

| factor-b | hint2 template |
|---|---|
| 2 | "<factor-a-word> and <factor-a-word> more." |
| 3 | "<factor-a-word>, then <factor-a-word>, then <factor-a-word>." |
| 4 | "<factor-a-word>, <factor-a-word>, <factor-a-word>, <factor-a-word>." |

All 8 canon problems use factor-b ∈ {2, 3, 4} — the small-multiplier side. No factor-b=1 or factor-b=5 appears in this canon.

### Templates

```
hint1 = "Look at the groups."
hint2 = [same case split on factor-b as mult-2-5-10]
hint3 = "How many?"
```

### Tabulation — mult-3-4 (8 problems)

| P | Read line | Correct | Legacy hint | hint1 | hint2 | hint3 |
|---|-----------|---------|-------------|-------|-------|-------|
| 1 | "Two times three. How many?" | Six | "Look. Three and three more. How many now?" | "Look at the groups." | "Two, then two, then two." | "How many?" |
| 2 | "Three times two. How many?" | Six | "Look. Two and two and two. How many?" | "Look at the groups." | "Three and three more." | "How many?" |
| 3 | "Three times three. How many?" | Nine | "Look. Three and three and three. How many?" | "Look at the groups." | "Three, then three, then three." | "How many?" |
| 4 | "Four times two. How many?" | Eight | "Look. Two and two and two and two. How many?" | "Look at the groups." | "Four and four more." | "How many?" |
| 5 | "Two times four. How many?" | Eight | "Look. Four and four more. How many now?" | "Look at the groups." | "Two, two, two, two." | "How many?" |
| 6 | "Three times four. How many?" | Twelve | "Look. Four and four and four. How many?" | "Look at the groups." | "Three, three, three, three." | "How many?" |
| 7 | "Four times three. How many?" | Twelve | "Look. Three and three and three and three. How many?" | "Look at the groups." | "Four, then four, then four." | "How many?" |
| 8 | "Four times four. How many?" | Sixteen | "Look. Four and four and four and four. How many?" | "Look at the groups." | "Four, four, four, four." | "How many?" |

**P1/P2 asymmetry note:** "Two times three" (P1) and "Three times two" (P2) are commutative but present differently: hint2 for P1 is "Two, then two, then two." (three copies of two), while P2 is "Three and three more." (two copies of three). The legacy hints show the same asymmetry ("Three and three more" for P1, "Two and two and two" for P2 — note the legacy appears to use the commuted direction for P1 while the template uses the read-line-order direction). This is a teachable moment: the template consistently follows the read-line operand order, which may differ from the legacy hint's more natural grouping. Kevin should note this in the directive.

**Pedagogical note on P1 legacy vs template:** The legacy hint for P1 ("Three and three more. How many now?") uses factor-b=2 reading of 2×3 (i.e., treats the problem as 3+3), which is the most natural way to visualise 2×3. The template gives "Two, then two, then two." (three copies of two). Both are correct; the legacy is more natural for small multipliers. This is an acceptable trade-off for template uniformity. The full case split is still deterministic.

### Quality verdict

hint2 preserves the repeated-addition scaffold. The same asymmetry as P6 of mult-2-5-10 appears when factor-a < factor-b; the template is still valid, just occasionally less natural than the commuted grouping. No pedagogy is lost; it is simply reordered.

**Verdict: SHIP. Full three-beat template.**

---

## Tier 5 — `mult-6-9`

### Structure

Read line: `"<factor-a-word> times <factor-b-word>. How many?"`
Factors: 6, 7, 8, 9 × {2, 3} (the harder multiplication facts).
Target: child taps the product chip.

At this tier, the products range from 12 to 27. Marian is encountering these at the conceptual stage (repeated addition, not automatic recall). The legacy hints use the same repeated-addition chain form as the lower tiers, but the chains are always short (factor-b ∈ {2, 3}) because the large-factor tier uses small multipliers.

### Case split for hint2

| factor-b | hint2 template |
|---|---|
| 2 | "<factor-a-word> and <factor-a-word> more." |
| 3 | "<factor-a-word>, then <factor-a-word>, then <factor-a-word>." |

No factor-b > 3 in current canon.

### Templates

```
hint1 = "Look at the groups."
hint2 = [case split on factor-b as above]
hint3 = "How many?"
```

**Prosody note:** "Six and six more." — the word "six" is a single syllable with a voiced fricative onset. Azure renders it cleanly. "Eight and eight more." — double "eight" can produce flat prosody; this is low-risk given the -10% rate. No SSML intervention needed.

### Tabulation — mult-6-9 (8 problems)

| P | Read line | Correct | Legacy hint | hint1 | hint2 | hint3 |
|---|-----------|---------|-------------|-------|-------|-------|
| 1 | "Six times two. How many?" | Twelve | "Look. Six. And six more. How many now?" | "Look at the groups." | "Six and six more." | "How many?" |
| 2 | "Seven times two. How many?" | Fourteen | "Look. Seven and seven. How many?" | "Look at the groups." | "Seven and seven more." | "How many?" |
| 3 | "Eight times two. How many?" | Sixteen | "Look. Eight and eight. How many?" | "Look at the groups." | "Eight and eight more." | "How many?" |
| 4 | "Six times three. How many?" | Eighteen | "Look. Six and six and six. How many?" | "Look at the groups." | "Six, then six, then six." | "How many?" |
| 5 | "Seven times three. How many?" | Twenty-one | "Look. Seven and seven and seven. How many?" | "Look at the groups." | "Seven, then seven, then seven." | "How many?" |
| 6 | "Nine times two. How many?" | Eighteen | "Look. Nine and nine. How many?" | "Look at the groups." | "Nine and nine more." | "How many?" |
| 7 | "Eight times three. How many?" | Twenty-four | "Look. Eight and eight and eight. How many?" | "Look at the groups." | "Eight, then eight, then eight." | "How many?" |
| 8 | "Nine times three. How many?" | Twenty-seven | "Look. Nine and nine and nine. How many?" | "Look at the groups." | "Nine, then nine, then nine." | "How many?" |

**Legacy P1 note:** "Look. Six. And six more. How many now?" — the legacy uses a dramatic pause after "Six." This is good prosody design (names the first group, then adds). The template hint2 "Six and six more." collapses the pause into a conjunction. This is a minor prosody loss; consider whether Kevin should add a period after the first occurrence ("Six. And six more.") in the directive to reproduce the pause. I am flagging this as a low-priority prosody concern only; it does not affect pedagogy.

### Quality verdict

hint2 faithfully reproduces the repeated-addition scaffold. The range of products (12-27) is larger than lower tiers but the chain length (factor-b=2 or 3) is always short, so the chains remain at Emma's vocabulary ceiling. No exotic number words are needed.

**Verdict: SHIP. Full three-beat template.**

---

## Cross-tier implementation contract for Kevin (W12-03)

### Templates summary

| Tier | hint1 | hint2 | hint3 |
|------|-------|-------|-------|
| number-recog | "Look at the numbers." | Lookup table (10 entries, see §Tier 1) | "Which one is `<number-word>`?" |
| skip-counting | "Look at the numbers." | "We add `<step-word>` each time." | "`<last-term-word>` and `<step-word>` more is what?" |
| mult-2-5-10 | "Look at the groups." | Repeated-addition chain, case split on factor-b | "How many?" |
| mult-3-4 | "Look at the groups." | Repeated-addition chain, case split on factor-b | "How many?" |
| mult-6-9 | "Look at the groups." | Repeated-addition chain, case split on factor-b | "How many?" |

### Shared case split for mult-* hint2 (factor-b = number of copies)

| factor-b | hint2 form |
|---|---|
| 1 | "One group of `<factor-a-word>`." |
| 2 | "`<factor-a-word>` and `<factor-a-word>` more." |
| 3 | "`<factor-a-word>`, then `<factor-a-word>`, then `<factor-a-word>`." |
| 4 | "`<factor-a-word>`, `<factor-a-word>`, `<factor-a-word>`, `<factor-a-word>`." |
| 5 | "`<factor-a-word>`, `<factor-a-word>`, `<factor-a-word>`, `<factor-a-word>`, `<factor-a-word>`." |

**factor-a and factor-b derivation:** from `"<factor-a-word> times <factor-b-word>. How many?"` — `factor-a` is the first word-number, `factor-b` is the second word-number. Both are already spelled as words in the read line.

### Placeholder derivation for number-recog

`<number-word>` = the word-number in the read line `"Tap the <number-word>."`.
`<topological-fact>` in hint2 = embedded lookup table:

```
1 → "One is the smallest."
2 → "Two comes right after one."
3 → "Three comes after two."
4 → "Four comes after three."
5 → "Five is in the middle."
6 → "Six comes after five."
7 → "Seven is bigger than five."
8 → "Eight comes after seven."
9 → "Nine is close to ten."
10 → "Ten is the biggest."
```

### Placeholder derivation for skip-counting

`<step-word>` = the common difference between consecutive terms, spelled as a word ("two" / "five" / "ten"). Derived by subtracting the first term from the second term in the sequence.

`<last-term-word>` = the final word-number in the comma-separated sequence, immediately before ". What is next?".

---

## RE-DEFER verdicts

**None.** All five tiers receive a deterministic three-beat template. No tier requires RE-DEFER.

The number-recog hint2 lookup table (10 entries) is the only non-algorithmic element — it requires an embedded table in the directive rather than a formula. This is still deterministic (table lookup is a pure function of the target) and is the only correct pedagogical approach for numeral topology, which is semantic, not arithmetic.

---

## Risks and open questions for Kevin

1. **number-recog hint3 phrasing:** "Which one is one?" contains consecutive "one" — this sounds slightly awkward in speech. Consider "Which number is one?" as an alternative. Either is deterministic from the template; I prefer "Which one is X?" for vocabulary economy (avoids introducing "number" as a new word in the hint), but Kevin should flag this to Thomas if it surfaces in ear-test.

2. **mult hint2 commutative direction:** The template always uses the read-line operand order (factor-a copies × factor-b repetitions). Some problems are more naturally visualised in the commuted direction (e.g. "Two times five" → "two groups of five" is more natural than "two, two, two, two, two"). This does not affect correctness. Kevin may add a commutative-grouping override rule in the directive for cases where factor-a ≤ 3 and factor-b ≥ 4; this would give more natural prose but requires a branching rule. Flagged, not required.

3. **P6 (mult-2-5-10): "Two times five"** — see quality note in §Tier 3. The derived hint2 "Two, two, two, two, two." is technically correct but visually dense as TTS. The legacy hint says "Two groups of five." which uses the commuted grouping. Both are valid; Kevin should use whichever is in the directive for consistency once the commutative question is resolved.

4. **skip-counting hint3 with two-word last terms:** "Twenty-five and five more is what?" — "twenty-five" is a compound number word, within Emma's vocabulary cap (she already speaks it in read lines). No issue.
