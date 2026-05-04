# Word Song — short-o pool expansion (v2 vowel tier)

**Ticket:** TBD (Matt is filing the spec ticket and the implementation ticket in parallel — this doc is the design surface; impl is downstream).
**Status:** Locked — decisions captured 2026-05-04 (Thomas).
**Author:** Marian Tutor design persona.
**Predecessors:** PR #132 (parser widening), PR #135 (cvc-words first-class shipped), PR #139 (developmental review merged 2026-05-02).
**Companion specs:** `design/word-song/parser-widening-plan.md`, `design/word-song/README.md`.

---

## Why this spec, why now

Dave's developmental review (`design/research/cvc-words-developmental-review.md`, merged in PR #139) flags the all-short-a pool ceiling as a **P0 roadmap risk for the August 2026 goal**:

> The current 8-word all-short-a pool will be mastered (or over-familiar) within a few weeks of regular use. The graduation mechanism to short-o words must be designed and ticketed now, before Marian has repeated sessions on a pool she can navigate from memory rather than decoding. … with daily or near-daily use, the ceiling arrives within 3–5 weeks. (§6, P0)

The current `cvc-words` pool is **8 short-a words**: bag, bat, cat, fan, hat, jam, pan, van (per `api/_plannerWordList.ts` `WORD_SONG_TARGET_WORDS_FOR_PROMPT` — 14-word client pack with planner-side narrowing to the 8 most concrete items in PR #135). Familiarity navigation will start substituting for decoding within 3–5 weeks; this spec is the design surface that unblocks Kevin's planner-widen + canon-bake work for the next vowel tier.

Per the established phonics sequence (`design/research/phonics-sequence-marian.md` §Q1 — revised order `o → u → i → e`), short-o is the next tier. Short-a CVC sources used here cross-check against Big City Readers (source 5 in the phonics doc) and Dave's developmental review (§1, §6).

**Scope of this spec:** word selection, focus-node naming, picture-pack requirements, mastery progression flow into short-o, canon-bake plan, visual-design delta. Out-of-scope items are listed at the end.

---

## 1. Word selection — the 8 short-o words

### Audit of Dave's suggested 8

Dave proposed `dog, mop, top, log, hop, pot, box, fox`. Audit against the v1 word-pack constraints (concrete-noun referent, true CVC pattern, picturable for an L2 8-year-old, vocabulary-cap aware per CLAUDE.md, distinct silhouette at 96pt):

| Word | CVC pattern | Concrete | Picturable | In ~200-word vocab cap | Silhouette risk | Verdict |
| ---- | ----------- | -------- | ---------- | ---------------------- | --------------- | ------- |
| dog  | C-V-C ✓     | ✓        | ✓ (already shipped as `pic-dog.svg`) | High-frequency, familiar to Marian (Tagalog *aso* — needs the picture to anchor) | Already pairs with `cat` in `FORBIDDEN_PAIRS` | **KEEP** — re-purpose distractor → target |
| mop  | C-V-C ✓     | ✓        | ✓          | Tagalog homes have mops; high recognition | Distinct (long handle + fringe) | **KEEP** |
| top  | C-V-C ✓     | ✓        | ⚠ ambiguous — "top" can read as spinning toy, or as a t-shirt, or as "the top of" something. Spinning-toy referent is fine but is the toy still common in 2026 for a Manila 8yo? | Borderline — *spinning top* is not high-frequency vocabulary in 2026, but it is concrete and picturable | Distinct silhouette (cone shape) | **REPLACE** — see substitution below |
| log  | C-V-C ✓     | ✓        | ✓ (already shipped as distractor `pic-log.svg`) | Borderline — needs picture to anchor (forest log, not "log in") | Distinct (cylinder, brown) | **KEEP** — re-purpose distractor → target |
| hop  | C-V-C ✓     | ✗ — *hop* is a verb, not a noun. The picture has to depict an action (a child mid-hop, a frog mid-hop). Verbs are not picturable as still chips the way nouns are; the chip would have to depict a frog and Marian would read it as "frog." | Verb. The whole pack is concrete-noun. | n/a — wrong word class | **REPLACE** |
| pot  | C-V-C ✓     | ✓        | ✓ (already shipped as distractor `pic-pot.svg`) | Cooking pot, high-frequency | Already pairs with `pan` in `FORBIDDEN_PAIRS` | **KEEP** — re-purpose distractor → target |
| box  | C-V-C ✓ (technically — `b-o-x` where `x` is `/ks/`, a single-letter-two-phoneme code, but the spelling pattern is CVC) | ✓ | ✓        | High-frequency | Distinct (rectangular) | **KEEP — with note** (see decoding-load note below) |
| fox  | C-V-C ✓ (same `x = /ks/` note as `box`) | ✓ | ✓ (already shipped as distractor `pic-fox.svg`) | Familiar from picture books, but not a Tagalog-frequent animal. Picture carries it. | Distinct (pointed ears, bushy tail) | **KEEP — with note** |

**Notes on the `box` / `fox` exception.** The `x` in `box` and `fox` decodes as `/ks/` — a two-phoneme grapheme. Strictly, these are not pure C-V-C from a phoneme standpoint; they are C-V-CC. They are universally listed as short-o CVC words in practitioner phonics curricula (UFLI, OG-based programs) because the *spelling pattern* is three letters and short-o word lists without `box`/`fox` are short. Decoding-load is fractionally higher. **Decision (locked 2026-05-04):** keep both, and have Emma's first-introduction line for each name the trick explicitly: *"Box. The x sounds like /ks/."* This is the same kind of one-time scaffolding short-a got with `jam` (silent expectation that `j` says `/dʒ/`) — fine for Marian. Alternatives (`cob, jog`) were weaker — `cob` carries L2 vocab risk, `jog` is a verb.

### Substitutions for `top` and `hop`

Replacement candidates from the phonics doc's tentative short-o pool (`design/word-song/README.md` §Future work table) and standard short-o CVC lists:

| Candidate | CVC | Concrete noun | Picturable | Vocab-cap | Silhouette risk | Verdict |
| --------- | --- | ------------- | ---------- | --------- | --------------- | ------- |
| cob (corn cob) | ✓ | ✓ | Marginal — corn-on-the-cob picture. Less universal than rice-eating Filipino home. | Borderline | Distinct (yellow cylinder, kernels) | Skip — vocab risk |
| mom | ✓ | ✓ (person) | ✓ | High-frequency, parallels `dad` from short-a pack | Pairs visually with `dad` (parent figure) — would need composition discriminator like `man↔dad` | **STRONG candidate** — gender-balances `dad` |
| sock | ✗ — CVCC (`-ck` digraph) | — | — | — | — | Skip — not CVC |
| jog | ✓ | Verb | — | — | — | Skip — same problem as `hop` |
| nod | ✓ | Verb | — | — | — | Skip — verb |
| ox  | ✗ — VC, two letters | — | — | — | — | Skip — not CVC |
| dot | ✓ | ✓ | ✓ (a single dot, e.g. polka dot) | Borderline — abstract | Distinct (small filled circle) | Possible, but weak vocabulary anchor |
| rod | ✓ | ✓ (fishing rod) | ✓ | Low-frequency for 8yo | Distinct | Skip — vocab risk |
| pop | ✓ | ✓ (lollipop, popcorn, soda pop in US English — but a "pop" alone is not concrete) | Marginal | Borderline | n/a | Skip — referent unclear |
| cot | ✓ | ✓ (small bed) | Marginal — "cot" is unfamiliar to a Manila 8yo (Tagalog uses *kuna* for crib, *kama* for bed). | Low-frequency | Distinct | Skip — vocab risk |

**Two replacements chosen:**

1. **`mom`** replaces `top`. Rationale:
   - High-frequency vocabulary (universal across Tagalog/English households — Marian uses *Mama* but knows *mom* from English media).
   - Gender-balances the existing `dad` target in the short-a pack — pedagogically clean parallelism.
   - Picturable as parent-with-child composition (mirroring the `dad` distinguisher rule from `wordPack.ts FORBIDDEN_PAIRS`). The composition rule generalises: `mom`/`dad` are both two-figure parent-with-child compositions, and the discriminator becomes hair length / outfit / pose. **NEW FORBIDDEN_PAIR proposed: `mom ↔ dad`** — same single-discriminator rule we apply elsewhere. Documented in §Picture-pack requirements below.

2. **`hot`** replaces `hop`. Rationale:
   - True CVC, no `x` exception.
   - Higher L2 vocabulary value than `dot` — `hot` is a high-frequency English property word Marian will hear daily (food, weather, drinks); `dot` is a low-frequency abstract.
   - Picture-grounds as an obvious hot-food steam-rising icon (a steaming bowl). `hot` is an adjective, but unlike `hop` (a verb) the picture-chip can stably depict a *hot thing* (steaming bowl) and the word reads as the property of the depicted object. This is the same logical move that lets `bag`, `tag`, `jam` work as nouns even when their semantic form is closer to mass/abstract (jam-the-substance is fine because jam-in-a-jar is depictable).
   - Distinct silhouette from the rest of the pack — and specifically from `pot` (the closest collision risk) via open-bowl + steam-curls vs. pot's lid + handles. May need a `hot ↔ pot` discriminator entry in `FORBIDDEN_PAIRS` pending visual review (see §3).

### Final v1 short-o pool (8 words)

| # | Word | Picture-key | Vowel | Category | Notes |
| - | ---- | ----------- | ----- | -------- | ----- |
| 1 | dog  | dog         | o     | animal   | Re-purposed from distractor; `pic-dog.svg` already exists, may need re-trace per `picture-pack-iteration-plan.md` |
| 2 | mop  | mop         | o     | household | New picture |
| 3 | log  | log         | o     | object   | Re-purposed from distractor; placeholder SVG today |
| 4 | pot  | pot         | o     | kitchen  | Re-purposed from distractor; placeholder SVG today |
| 5 | box  | box         | o     | object   | New picture; first-time `x = /ks/` introduction |
| 6 | fox  | fox         | o     | animal   | Re-purposed from distractor; placeholder SVG today |
| 7 | mom  | mom         | o     | person   | New picture; parent-with-child composition (gender-balances `dad`) |
| 8 | hot  | hot         | o     | property | New picture; steaming bowl with rising steam-curls; needs `hot ↔ pot` collision audit (see §3) |

**Pool composition cross-check:**

- All 8 are concrete-noun (or noun-like, in the case of `hot` — adjective whose picture-chip stably depicts a *hot thing*, the steaming bowl) — no verbs.
- All 8 are CVC by spelling; `box` and `fox` carry the `x = /ks/` decoding note (Emma scaffolds on first encounter — see §4).
- 4 of the 8 are already in the v1 distractor pool (`dog, log, pot, fox`) — picture assets exist as placeholders today, will be upgraded to real Midjourney pictures alongside the new 4 (`mop, box, mom, hot`).
- `hot` is the only wholly-new word with no prior pool footprint (the other three new entries — `mop, box, mom` — are wholly new pictures but the words slot into the same noun-shape the existing pack already uses).
- 2 animals (`dog, fox`), 1 object (`log`), 1 household (`mop`), 1 kitchen (`pot`), 1 person (`mom`), 1 multi-purpose object (`box`), 1 property word (`hot`). Category spread mirrors the short-a pack's variety.

---

## 2. Focus-node naming

**Three options on the table:**

| Option | Shape | Backward-compat impact | Conceptual clarity | Planner / picker complexity |
| ------ | ----- | ---------------------- | ------------------ | --------------------------- |
| A. Sibling node `cvc-words-short-o` (parallel to `cvc-words` which becomes implicitly short-a) | New node added to `WordSongNode`, `LITERACY_TREE`, `WORD_SONG_NODES_IN_ORDER` between current `cvc-words` and `digraphs` | None — existing user `Progress` documents (Marian's local-storage) keep their `cvc-words` skill-level entry untouched. The new node lands as `'locked'` until `cvc-words` is mastered. | Mid — two CVC nodes feels right, but the asymmetry (`cvc-words` is implicitly short-a vs. `cvc-words-short-o` is explicit) is a code smell that compounds when short-u/i/e land. | Low — picker walks the same way; planner gets one new branch in `WORD_SONG_TRACK_GUIDE`. |
| B. Rename `cvc-words` → `cvc-words-short-a`, add sibling `cvc-words-short-o` | `WordSongNode` union changes; existing `Progress.skillLevels[node]` keys must migrate (`cvc-words` → `cvc-words-short-a`). Migration is a one-shot localStorage rewrite at app boot. | Cleanest — symmetric naming. | Medium — needs a migration shim in `src/lib/progress/` that runs once on load. The shim is small but it's a new failure surface (e.g., what if Marian's iPad has the app open in two tabs during the rewrite? Negligible for single-user, but the shim still has to land cleanly). |
| C. Keep `cvc-words` as a multi-vowel node, let the planner pick from a wider pool | No new node. `WORD_SONG_NODES_IN_ORDER` unchanged. | High — but only because mastery-graduation logic now has to decide *which subset of vowels* counts as "mastered cvc-words." A 90%-accuracy session on short-a only does not certify short-o decoding ability. | Lowest at first glance, but the mastery-rule logic balloons (per-vowel sub-thresholds, vowel-mix tracking in `Progress.history.skillFocus`). | High — the whole point of focus nodes is "one focus per session"; conflating short-a + short-o under one node breaks that contract. |

**Recommendation: Option A — sibling node `cvc-words-short-o`.**

Rationale:

1. **Backward-compat wins.** Marian's local-storage already has a `cvc-words` entry. A rename (Option B) means a migration shim — small, but a new failure surface for zero pedagogical benefit. The asymmetry of `cvc-words` (implicit short-a) vs. `cvc-words-short-o` (explicit) is a *naming* smell, not a *behaviour* smell, and naming smells are cheap to live with.
2. **Mastery-graduation stays surgical.** Each node has its own `skillFocus` filter in `applyMasteryRule` (per `src/lib/progress/mastery.ts`). Adding a sibling means the existing 90/3 rule for `cvc-words` doesn't change, and the new node gets its own 90/3 sweep. No conditional logic, no per-vowel sub-thresholds.
3. **Planner stays one-content-mode-per-focus-node.** This preserves the planner-parser contract that PR #117 → #118 fought for. `cvc-words` and `cvc-words-short-o` both emit `"Read the <word>."` content; the only delta is the word-list passed to the planner (`WORD_SONG_TARGET_WORDS_SHORT_A` vs. `WORD_SONG_TARGET_WORDS_SHORT_O`). This is the smallest possible widening.
4. **Aligns with the README's already-documented future-work skeleton.** `design/word-song/README.md` §Future work already calls out per-vowel pack files (`picture-pack-prompts-short-o.md`, etc.). Sibling nodes match the per-vowel pack convention without new precedent.

**Naming consequence — what does `cvc-words` mean going forward?** Treat `cvc-words` as the implicit short-a node. Add a one-line comment in `types.ts` and `mastery.ts` clarifying this so future-Kevin doesn't second-guess it:

```ts
// cvc-words = short-a CVC. Subsequent vowels get sibling nodes
// (cvc-words-short-o, cvc-words-short-u, …). This was a deliberate
// backward-compat choice — see design/word-song/short-o-pool-expansion.md §2.
```

The renaming option (B) is *not foreclosed*. If Marian's progress doc gets cleared (e.g. she switches to a new iPad) before short-o ships, the rename becomes free and is the cleaner option. The migration tradeoff is the only thing keeping us off it.

---

## 3. Picture-pack requirements

### Existing assets (audited)

Per `public/assets/pictures/` (audited 2026-05-02): only `pic-dog.svg` ships as a real illustration. The other 21 v1 pictures are inline-SVG silhouettes rendered by `wordPictures.tsx`. The picture-pack project (`design/word-song/README.md`) is in Phase 1 — Thomas's Midjourney generation pass for the short-a pack has not started.

**Path:** `public/assets/pictures/` (verified — no nested `wordsong/pictures/` dir; the brief's path was a guess and the canonical location is the flat `pictures/` dir at the asset root).

### Asset format

Match the short-a pack's locked decision: **SVG vector** (per `project_pic_dog_svg` memory). Phase 3 Midjourney → SVG trace is the established pipeline. Same format for short-o keeps the renderer (`<img src="/assets/pictures/picture-{key}.svg" />`) un-touched.

### Required new pictures

| # | Word | Status | Path | Notes |
| - | ---- | ------ | ---- | ----- |
| 1 | dog  | EXISTS as `pic-dog.svg`, but per `design/word-song/README.md` §"Why not o/u/e/i in v1" recommendation, re-generate alongside the new pack to avoid stylistic drift. Phase 3 trace replaces the existing file. | `public/assets/pictures/picture-dog.svg` (canonical name; the existing `pic-dog.svg` is the legacy filename — Devon to confirm whether `picture-dog.svg` and `pic-dog.svg` cohabit or one supersedes the other in `wordPictures.tsx`) | Style-match short-o session pictures |
| 2 | mop  | NEW | `public/assets/pictures/picture-mop.svg` | Long handle, fringe head, single subject |
| 3 | log  | NEW (silhouette placeholder today) | `public/assets/pictures/picture-log.svg` | Brown cylinder with bark texture, single subject |
| 4 | pot  | NEW (silhouette placeholder today) | `public/assets/pictures/picture-pot.svg` | Cooking pot — already has a `pan↔pot` distinguisher rule (handle count + depth). When `pot` is now a target word, the same distinguisher applies in reverse. |
| 5 | box  | NEW | `public/assets/pictures/picture-box.svg` | Cardboard box with closed flaps, three-quarter view |
| 6 | fox  | NEW (silhouette placeholder today) | `public/assets/pictures/picture-fox.svg` | Pointed ears, bushy tail, side profile |
| 7 | mom  | NEW | `public/assets/pictures/picture-mom.svg` | Parent-with-child composition. **NEW FORBIDDEN_PAIR with `dad`** — both two-figure compositions; distinguisher is hair-length + outfit silhouette (mom = longer hair, skirt-or-dress silhouette; dad = shorter hair, pants silhouette). Both deliberately stylised, ethnicity-neutral, per the §Anti-dark-pattern audit rules in the picture-pack README. |
| 8 | hot  | NEW | `public/assets/pictures/picture-hot.svg` | Steaming bowl with three rising steam-curls; collision audit vs. picture-pot — pot has lid + handles, hot is open bowl + steam. **Possible NEW FORBIDDEN_PAIR `hot ↔ pot`** depending on visual review (both are kitchen vessels in side-profile). |

**Total new SVG assets needed: 7** (`mop, box, mom, hot` are wholly new; `log, pot, fox` upgrade silhouette placeholders to real SVGs; `dog` is a re-trace for stylistic consistency, debatable whether it's "new" — Phase 3 reviews this).

### Pipeline for the 7 short-o pictures

Same 3-phase pipeline as the short-a pack (`design/word-song/README.md` Phase model):

| Phase | Owner | Output | Blocking dependency |
| ----- | ----- | ------ | ------------------- |
| 1. Prompt sheet | Kyle | `design/word-song/picture-pack-prompts-short-o.md` (per the future-work skeleton in the README) | Short-a pack's `picture-pack-style-anchor.md` — the style frame is shared, so short-o inherits without re-derivation. |
| 2. Midjourney generation | Thomas | 7 source PNGs (≥1024×1024) | Phase 1 merged. **Cost note:** Thomas's Midjourney subscription is the source per `design/word-song/README.md` §"Source decision". 7 pictures at ~4 grids × 4 variations + iteration overhead. Empirically (per the short-a pack iteration plan), budget ~30–60 min of generation time. No incremental subscription cost beyond what the short-a pack consumes. |
| 3. SVG trace + integration | Kyle (trace direction) + Devon (integration) | 7 `picture-{word}.svg` files at `public/assets/pictures/` + `wordPictures.tsx` updates (new keys + renderer wiring) | Phase 2 merged. **No new wordPack.ts entries needed** for `dog/log/pot/fox` (already in `DISTRACTOR_ONLY_WORDS` — they switch to `isTarget: true` in a separate code change tracked under the impl ticket); 4 wholly new entries needed for `mop, box, mom, hot`. |

**Internal SVG drafts as v1 stopgap?** Not recommended. The short-a pack is already gated on Thomas's Midjourney pipeline (`design/word-song/README.md` Phase model) and the merge cadence is fast — phase 1 spec → phase 2 generation → phase 3 trace is on the order of days, not weeks. Shipping internal SVG drafts for short-o would create exactly the "21 fresh + 1 vintage" style mismatch the README explicitly avoids. **Recommendation:** short-o ships its picture pack through the same Midjourney pipeline; the impl ticket for the planner widening is gated on phase 3 of the short-o pack.

---

## 4. Mastery progression flow — the 3-stage graduation

This is the canonical hand-off between `cvc-words` (short-a) and `cvc-words-short-o`. Per Dave's review §6 P1 (generalization-check requirement) and the planner-parser contract (parser-first widening).

### Stage definitions

```
Session N    : cvc-words (short-a) — canonical 8-word pool
Session N+1  : cvc-words (short-a) — graduation session with novel-word probe
Session N+2  : cvc-words-short-o   — first short-o session
```

**Stage 1 — Mastery accumulation (Sessions 1..N).**
Marian works through the standard 8-word short-a pool. Each session is 8 problems, picker uses `pickFocusNode` to land on `cvc-words`. Accuracy logged via `recordProgressOnSessionEnd`. Mastery rule (per `applyMasteryRule` in `src/lib/progress/mastery.ts`) requires 90% accuracy across 3 sessions to flip `cvc-words` from `practicing` to `mastered`. Standard behaviour today, no change.

**Stage 2 — Graduation session (Session N+1).**
Triggered when `cvc-words` *just qualified* for promotion under the existing rule. The next `cvc-words` session is the graduation gate. Per Dave §6 P1, the planner mixes 2–3 novel short-a words (drawn from Big City Readers' extended short-a list — `nap, cap, rat, map, tap` are the candidates from `phonics-sequence-marian.md` §Q2; **`cap` is already in the v1 14-word pack**, so use `nap, rat, map, tap` as the novel set) into the 8-problem session.

Concretely:
- 5–6 problems from the canonical short-a pool (`bag, bat, cat, fan, hat, jam, pan, van`).
- 2–3 problems from the novel-short-a probe set (`nap, rat, map, tap`).
- Novel items are flagged in the planner output as `isProbe: true` (or equivalent — Kevin's call on the wire-shape detail; the constraint is that the probe items do not affect the main `successRate` written to history).
- Probe-item picture chips are required: **`nap, rat, map, tap` need pictures**. These are NOT the same chips as the canonical pool; they are short-a words that will eventually graduate into the main pool. Authoring is in scope for the impl ticket but **the pictures themselves are gated on a separate Kyle ticket** (P1 from Dave's review — see §5 below).
- **Generalization gate:** if Marian scores ≥50% on the probe items (≥1/2 or ≥2/3, per Dave's evidence: "50% correct on 2 novel items is a reasonable generalization signal"), she advances. If she scores below the gate, `cvc-words` stays at `practicing` for one more cycle and the picker keeps her on short-a; the next graduation session repeats with a fresh probe sample.

**Stage 3 — First short-o session (Session N+2).**
Picker walks past `cvc-words` (now `mastered`) and lands on `cvc-words-short-o` (now `intro`). First-encounter behaviour:
- Emma's session-open chatter introduces the new vowel: *"This one says /ɒ/, like 'dog'."* — sourced from Dave's review §1 example. Each NEW short-o word also gets a one-time scaffolded introduction the first time it appears across Marian's career, e.g. *"Box. The x sounds like /ks/."* (per the `box`/`fox` decoding-load note in §1). The "first time across her career" tracking is a `Progress` field — open question for Kevin's impl spec.
- After the first short-o session, the node moves to `practicing` per the standard intro→practicing rule (see `mastery.ts`).

### Picker / planner sequencing

The picker's job (`pickFocusNode`) does not change for short-o vs. short-a — it walks `WORD_SONG_NODES_IN_ORDER` and stops at the first non-`mastered` node. Adding `cvc-words-short-o` between `cvc-words` and `digraphs` automatically routes Marian to short-o once short-a is mastered. **No bespoke graduation logic in the picker** — the mastery rule does the work, the picker just reads `skillLevels`.

The planner gets the only new logic: when `focusNode === 'cvc-words-short-o'`, emit `"Read the <word>."` problems drawn from the short-o word list (`api/_plannerWordList.ts` adds `WORD_SONG_TARGET_WORDS_SHORT_O = 'dog, mop, log, pot, box, fox, mom, hot'`).

### Why "first short-o session" is not gated on probe

The graduation probe (Stage 2) verifies generalization within short-a. Promoting Marian to short-o is then a separate (and much smaller) step: it's the next vowel, with explicit Emma scaffolding for each new word. The probe is the protection against false-mastery; once that protection has fired, the `intro` level on `cvc-words-short-o` provides additional scaffolding (Emma's first-encounter introduction + heavy review per UFLI principles in `phonics-sequence-marian.md` §Q5). **No second probe is needed** at the short-a → short-o boundary because the probe already happened on the boundary that mattered.

### What is NOT in this flow

- No "cool-down" gap between `cvc-words` mastery and `cvc-words-short-o` start. The next session after graduation is the first short-o session.
- No mixed-vowel sessions. `cvc-words-short-o` is short-o-only in v1. Cross-vowel mixing is Ticket 4 (see §7 below).
- No re-test of short-a inside short-o sessions. If Marian regresses on short-a after short-o starts, the Leitner spaced-review system (out of scope here) handles the maintenance load.

---

## 5. Probe-word picture-pack requirements

The graduation-session probe (Stage 2) requires picture chips for the novel-short-a probe words. Authoring is **NOT in scope for this spec** — the probe-word pack is its own Kyle ticket (filed separately as part of Dave's P1 generalization-check work).

**Pre-requisites the impl ticket inherits from this spec:**

- 4 probe words: `nap, rat, map, tap`.
- Asset path: `public/assets/pictures/picture-{word}.svg` (same pipeline as the rest).
- Format: SVG, same Midjourney + trace pipeline.
- Forbidden-pair audit: probe words must not visually collide with the canonical short-a pool. `rat` ↔ `cat`/`bat` is the obvious silhouette risk (all four-legged animals in side profile). `map` ↔ `mat` is a vowel-rhyme collision and a flat-rectangular-thing collision; needs a clear discriminator (paper sheet with country outlines vs. rug/floor mat). `nap` ↔ no obvious collision (sleeping figure). `tap` ↔ no obvious collision (faucet).

These constraints land in the probe-word picture-pack ticket. Flagging them here so they don't get lost.

---

## 6. Canon-bake plan

Following PR #135's pattern, `cvc-words-short-o` needs a baked canon JSON to keep cold-start session-fetch under 500ms.

### File path

`public/canon/word-song/level-1/cvc-words-short-o.json` — mirrors the existing `public/canon/word-song/level-1/cvc-words.json` (audited 2026-05-02; that file ships in PR #135).

### Bake-list addition

`scripts/generateSessionCanon.ts` currently hardcodes:

```ts
const WORD_SONG_FOCUS_NODES: readonly string[] = ['blending-cv', 'cvc-words']
```

Append `'cvc-words-short-o'`:

```ts
const WORD_SONG_FOCUS_NODES: readonly string[] = [
  'blending-cv',
  'cvc-words',
  'cvc-words-short-o',
]
```

The `generateSessionCanon.test.ts` regression test already pins this list against `_planner.ts VALID_WORD_SONG_FOCUS_NODES` — the planner change has to land in the same PR for CI to stay green. (This is a one-PR delta; the parser already accepts `"Read the <word>."` per PR #132 step 1, so the planner-first concern from `parser-widening-plan.md` does not apply here. The new word *list* is what's widening, not the *content type*.)

### Bake cost

Per `scripts/generateSessionCanon.ts` header §Cost: ~1 Haiku call + ~59 Azure TTS S0 calls per combo. Adding one combo (level-1 × cvc-words-short-o × childName="Marian") costs:

- Haiku: ~$0.005–$0.01 per combo (input + output ~2k tokens).
- Azure TTS S0: ~59 short utterances × ~50 chars ≈ 2.9k chars × $16/1M chars = ~$0.05.
- **Total: ~$0.05–$0.06 per bake regen for this one combo.**

This matches Dave's earlier ballpark of "~5–10¢ per bake" — well within the Anthropic billing constraint (`project_anthropic_billing_constraint`) since canon is rare-regen.

### Bake trigger

A canon regeneration is required when:
- The planner system prompt changes the short-o word list, problem template, or chatter shape.
- Emma's voice config changes (rare).
- The 3-stage graduation flow's "first short-o session" Emma intro line is finalised (per §4 Stage 3).

The first regen happens with the impl PR. Subsequent regens are part of normal canon hygiene.

---

## 7. Visual design — same as v1 cvc-words

**Default: keep the visual layout identical to the existing `cvc-words` screen.** The screen is text-card (the printed CVC word) + 3 picture chips below, per the shipped layout in PR #135.

### Why the default is the right call for v2

The cognitive-load argument from Dave's review §1 cuts both ways: when introducing a new vowel, *don't change the screen too*. The whole point of holding format constant across vowels is that Marian arrives at `cvc-words-short-o` with one new thing to learn (the vowel) and the rest of the surface unchanged. A re-themed screen for the new vowel would itself become a cognitive-load cost — pure friction with no pedagogical return.

### One small visual exception — first-encounter highlight

Considered and **rejected for v1**: highlighting the `o` letter in a different colour to draw attention to the new vowel (e.g., `d<span style="color:var(--my-rose)">o</span>g`).

Rationale for rejection:
- Inconsistent with how short-a was introduced (the `a` was never highlighted).
- The highlight risks reading as a *correction prompt* rather than a *learning aid* — and "never a red X" energy carries over: any visual emphasis on a single grapheme can read as "this letter is wrong" to an 8-year-old.
- Emma's verbal scaffolding (*"This one says /ɒ/, like 'dog'."*) is the right channel for vowel-attention work. It's audio-first, in-character, and does the job without re-coding the visual surface.

If Thomas wants the highlight, it should be applied symmetrically across all vowels (highlight `a` in short-a, `o` in short-o, etc.) — that's a separate "vowel-emphasis" feature, not a short-o-only thing.

### Other visual candidates considered

- **New background colour for short-o sessions** (e.g., warmer pinks → cooler greens). Rejected — adds variety for variety's sake; CLAUDE.md "Backgrounds (v1): 3 total — pick for emotional variety, not just visual variety" rule applies.
- **A "new vowel" badge on the session-open card.** Rejected — adds chrome and reading load. Emma's verbal intro replaces it.
- **A printed-text font weight bump for the new vowel** (e.g., bold the `o`). Same reasoning as the colour highlight — rejected.

**Net visual delta vs. shipped cvc-words: zero.** The only changes are the word pool and the picture-pack contents. This is the smallest viable v2 surface.

---

## 8. Out of scope / cross-vowel mix preview

This spec covers the same-vowel-only short-o pool. **Cross-vowel distractors** (per Dave's review §6 P2 and the future-work table in `design/word-song/README.md`) are explicitly OUT OF SCOPE here. Quoting Dave §2:

> If and when the pool expands to include short-o words, cross-vowel distractors (e.g., cat / mop / fan) should also be available — they test a different and slightly harder skill (vowel discrimination), which is appropriate once short-a is consolidated.

Cross-vowel distractor work is a separate downstream design (Ticket 4 in Matt's filing). Lock the v1 short-o scope as **same-vowel distractors only, mirroring how cvc-words works today.** Practically: the short-o trio always draws from the 8 short-o pool words, never mixing in short-a chips.

The `wordPack.ts` `TARGET_PAIRINGS` matrix needs new entries for the 8 short-o words, but those entries draw from the short-o pool only. Distractor picking inside short-o trios uses the same gentle/trap tier rules as today; the matrix expansion is a mechanical add. (This is a §1 §3 §4 mechanical follow-up to this spec inside the impl ticket — not a separate design piece.)

Also out-of-scope:

- React component changes (Kevin's job — the existing `cvc-words` screen renders short-o without modification; the only React-side delta is the wordPack additions).
- Picture-pack art authoring (Thomas's MJ pipeline, Kyle's trace direction; tracked in the future-work skeleton in the README).
- Probe-word picture pack for `nap, rat, map, tap` (separate Kyle ticket).
- Wider literacy-tree expansion — `digraphs`, `sight-words`, `simple-sentences` are gated on later vowel tiers and stay as `letter-sounds`-style stubs in the planner (see `parser-widening-plan.md` §"Future tiers").
- Audio-before-text "silent text window" intervention from Dave's review §6 P1 (separate Kyle ticket — not blocking this spec).

---

## 9. Acceptance criteria

Kevin and Thomas use these. Jessica validates against them.

- [ ] **AC1.** `WordSongNode` union in `src/lib/progress/types.ts` includes `'cvc-words-short-o'`. `LITERACY_TREE` and `WORD_SONG_NODES_IN_ORDER` both have `'cvc-words-short-o'` between `'cvc-words'` and `'digraphs'`.
- [ ] **AC2.** `api/_planner.ts WORD_SONG_TRACK_GUIDE` adds a `cvc-words-short-o` branch emitting `"Read the <word>."` problems from the 8-word short-o pool. The 8 words match this spec §1 final pool exactly. `VALID_WORD_SONG_FOCUS_NODES` and `WORD_SONG_FIRST_CLASS_FOCUS_NODES` both gain the new node.
- [ ] **AC3.** `api/_plannerWordList.ts` exports a new `WORD_SONG_TARGET_WORDS_SHORT_O` constant matching the 8 words from §1. The smoke test in `claude.test.ts` is extended to assert short-o words round-trip.
- [ ] **AC4.** `src/screens/WordSong/wordPack.ts` adds 8 short-o entries: 4 new (`mop, box, mom, hot`) plus 4 promoted-from-distractor (`dog, log, pot, fox` flip `isTarget: true`). The 4 promoted entries also retain their old role (still pickable as distractors when the focus is short-a) — `isTarget: true` and distractor-pool membership are independent flags.
- [ ] **AC5.** `wordPack.ts FORBIDDEN_PAIRS` adds `['mom', 'dad']` (composition collision per §3).
- [ ] **AC6.** `wordPack.ts TARGET_PAIRINGS` adds 8 entries for the short-o targets, drawing distractors from the short-o pool only (same-vowel constraint per §8).
- [ ] **AC7.** 7 new SVG picture assets at `public/assets/pictures/picture-{mop,log,pot,fox,box,mom,hot}.svg`, plus a re-traced `picture-dog.svg` per §3. `wordPictures.tsx` resolves all 8 short-o keys without hitting the inline-SVG fallback.
- [ ] **AC8.** `scripts/generateSessionCanon.ts WORD_SONG_FOCUS_NODES` includes `'cvc-words-short-o'`. `generateSessionCanon.test.ts` regression stays green.
- [ ] **AC9.** Canon JSON ships at `public/canon/word-song/level-1/cvc-words-short-o.json` after a fresh bake. The PWA cold-start session-fetch for short-o is under 500ms (matches the existing cvc-words canon-hit benchmark).
- [ ] **AC10.** `src/lib/progress/mastery.ts applyMasteryRule` promotes `cvc-words-short-o` from `practicing` to `mastered` under the same 90/3 rule used for `cvc-words` (no special-casing). The downstream `digraphs` node moves from `locked` to `intro` on promotion.
- [ ] **AC11.** Stage-2 graduation logic (per §4 — novel short-a probe insertion in the cvc-words session that just qualified for promotion) lands as a separate impl ticket (P1 from Dave §6). This spec lists the requirement but does NOT block on its implementation. The short-o tier ships independently and the graduation probe is layered on later. Kevin's impl ticket explicitly cross-references the probe ticket so the sequencing is clear.
- [ ] **AC12.** No regression on existing `cvc-words` (short-a) sessions. PR #135's behaviour is preserved bit-for-bit for sessions where `focusNode === 'cvc-words'`. Snapshot of `cvc-words.json` canon stays unchanged across the short-o-adding PR.
- [ ] **AC13.** Planner-output regression tests (`api/_planner.test.ts`) cover: (a) `cvc-words-short-o` focus emits 8 short-o problems, (b) every problem's read line matches `"Read the <word>."` and the word is in the short-o pool, (c) no short-a words leak into short-o sessions in v1.

---

## 10. Resolved decisions (locked 2026-05-04)

**Q1. `box`/`fox` decoding load.** Keep these two `x = /ks/` words in the pool, or replace with a stricter pair (e.g., `cob, jog`)?
**DECIDED: KEEP** — Emma scaffolds on first encounter (*"Box. The x sounds like /ks/."*). Alternatives (`cob, jog`) were weaker — `cob` has L2 vocab risk, `jog` is a verb.

**Q2. `dot` vs. `hot` for the 8th slot.** Which word fills the slot vacated by `hop`?
**DECIDED: HOT** — higher L2 vocabulary value than `dot`; picture-grounds as steaming bowl; distinct silhouette from `pot` via open-bowl + steam-curls (FORBIDDEN_PAIRS may need a discriminator if visual review confirms collision risk).

**Q3. Focus-node naming — sibling vs. rename.** Add `cvc-words-short-o` as a sibling of `cvc-words`, or rename `cvc-words` → `cvc-words-short-a` and migrate localStorage?
**DECIDED: SIBLING (Option A)** — `cvc-words-short-o` lands as a sibling of `cvc-words`. No localStorage migration. The asymmetric naming (implicit short-a) is a documented smell, not a behavior smell. Rename remains an option later if Marian's progress doc gets cleared.

---

## 11. Provenance

- **Triggering doc:** `design/research/cvc-words-developmental-review.md` (Dave, merged in PR #139, 2026-05-02) — §6 P0 ("pool expansion plan must exist before the pool becomes trivial"), §1 (recommended short-o set), §2 (cross-vowel distractor deferral), §6 P1 (generalization probe).
- **Phonics sequence:** `design/research/phonics-sequence-marian.md` (Dave) — §Q1 revised vowel order `o → u → i → e`, §Q2 short-a CVC list source (Big City Readers), §Q5 session pacing (UFLI one-new-concept-per-session).
- **Predecessor specs:** `design/word-song/parser-widening-plan.md` (parser-first contract), `design/word-song/README.md` (per-vowel future-work skeleton, Midjourney pipeline).
- **Locked memories:** `project_planner_parser_contract` (parser before planner), `project_pic_dog_svg` (SVG vector for all CVC pictures), `project_spec_drift_decisions` K (Sanrio-style friendly bat — applies forward to all animal pictures including `fox`), `project_anthropic_billing_constraint` (canon bake cost ceiling).
- **Word-list source-of-truth files:** `api/_plannerWordList.ts WORD_SONG_TARGET_WORDS_FOR_PROMPT`, `src/screens/WordSong/wordPack.ts TARGET_WORDS / DISTRACTOR_ONLY_WORDS / FORBIDDEN_PAIRS / TARGET_PAIRINGS`.
- **Tree source-of-truth:** `src/lib/progress/mastery.ts LITERACY_TREE`, `src/lib/progress/focusNode.ts WORD_SONG_NODES_IN_ORDER`, `src/lib/progress/types.ts WordSongNode`.
- **Canon source-of-truth:** `scripts/generateSessionCanon.ts WORD_SONG_FOCUS_NODES`, `public/canon/word-song/level-1/cvc-words.json` (existing reference shape).
- **Marian's literacy levels:** `CLAUDE.md` §"Marian's current levels".
