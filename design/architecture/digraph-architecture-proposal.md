# Digraph Architecture Proposal — SkillNode split + phoneme-tagging

**Status:** Proposal, awaiting review by Thomas + Devon.
**Author posture:** Kevin (dev). Pre-implementation audit; no production code edits in this PR.
**Date:** 2026-05-14
**Source of truth for pedagogy:** `design/research/digraph-acquisition-marian.md` (Dave, in-flight on branch `design/dave-digraph-research`).
**Trigger:** Dave's research surfaced two architectural findings that need a dev decision before any digraph content ticket dispatches.

---

## TL;DR

1. **`digraphs` is a single SkillNode today.** Recommend splitting into three sequential sibling nodes: `digraphs-sh`, `digraphs-ch`, `digraphs-th-voiceless`. The CVC-tier sibling pattern (`cvc-words` → `cvc-words-short-o` → `…short-e`) is the exact precedent and the mastery + first-encounter + focus-node machinery already handles it cleanly. A single `digraphs` node CANNOT enforce sequential digraph isolation under the current mastery rule — three correct sh-only sessions would promote the node to `'mastered'` without ever touching ch or th.

2. **The `th` grapheme covers two phonemes (/θ/ and /ð/). Distractor architecture today is keyed on `WordEntry.word` (string) and `WordEntry.vowel`. There is no phoneme tag.** Recommend adding an optional `phoneme?: string` field to `WordEntry` (IPA, content phoneme only) NOW, while no `th` words exist in the pack. Within v1's same-vowel-only distractor rule the risk is theoretical, but it becomes load-bearing the moment Dave's recommended sh-ch interleaving / cross-digraph mode lands — same scaling shape as `cvc-words` → cross-vowel-mix.

3. **Implementation order:** split first, then phoneme-tag, then sh content tier, then ch, then th (voiceless). Voiced /ð/ is explicitly NOT a digraph node — Dave's research routes it to the sight-words tier.

4. **Backward-compat:** zero migration cost. Same precedent as every prior tier addition (short-o through short-e). New keys land at `'locked'` on existing localStorage blobs via `defaultLockedSkillLevels()` + the read-path defaulter at `withDefaultedSkillLevels`. Tests pass on day 1; no schemaVersion bump.

---

## 1. Current state (cited)

### 1.1 SkillNode shape today

The literacy track holds **a single `digraphs` node** between the short-e tier and `sight-words`. There is no sub-progression mechanism, no per-digraph isolation, and the planner does not emit first-class content for it (it falls through to the `blending-cv` stub-fallback).

The shape is replicated in **thirteen** files. The five-place widening contract referenced in `e2e/_helpers/wordSongNodesInOrder.ts:36-50` is actually a ten-plus-place contract:

| File                                    | Symbol                                 | Lines     | Role                                                      |
| --------------------------------------- | -------------------------------------- | --------- | --------------------------------------------------------- |
| `src/lib/progress/types.ts`             | `WordSongNode` union                   | 39-50     | Type literal                                              |
| `src/lib/progress/focusNode.ts`         | `WORD_SONG_NODES_IN_ORDER`             | 73-85     | Focus-picker walk order                                   |
| `src/lib/progress/mastery.ts`           | `LITERACY_TREE`                        | 129-141   | Mastery-rule walk order                                   |
| `src/lib/progress/guards.ts`            | `SKILL_NODES` (Set)                    | 19-43     | Runtime guard for persisted blobs                         |
| `src/lib/progress/defaults.ts`          | `SCHEMA_FLOOR_NODES`                   | 30-54     | Read-path defaulter                                       |
| `src/lib/progress/defaults.ts`          | `DEFAULT_SKILL_LEVELS`                 | 85-131    | Greenfield baseline (`digraphs: 'locked'` line 128)       |
| `src/screens/Hub/stages.ts`             | `WORD_SONG_STAGES` + `WordSongStageId` | 25-66     | Hub path-strip stage list                                 |
| `src/screens/Hub/stageIcons.tsx`        | `STAGE_LABEL`                          | 150-174   | Per-stage glyph label (`digraphs: 'sh'` line 171)         |
| `src/screens/Hub/progressProjection.ts` | `WORD_SONG_LABELS`                     | 102-114   | Hub celebration caption (`digraphs: 'digraphs'` line 111) |
| `e2e/_helpers/wordSongNodesInOrder.ts`  | `WORD_SONG_NODES_IN_ORDER` shim        | 53-82     | e2e tsconfig boundary mirror                              |
| `api/_planner.ts`                       | `VALID_WORD_SONG_FOCUS_NODES`          | 136-148   | Server input validation                                   |
| `api/_planner.ts`                       | `WORD_SONG_FIRST_CLASS_FOCUS_NODES`    | 605-612   | First-class content modes                                 |
| `api/_planner.ts`                       | `WORD_SONG_TRACK_GUIDE` (prompt copy)  | 971-1097  | Per-tier read-line + pool docs                            |
| `api/_plannerWordList.ts`               | `WORD_SONG_TARGET_WORDS_*`             | full file | Per-tier word pools                                       |
| `scripts/generateSessionCanon.ts`       | `WORD_SONG_FOCUS_NODES`                | 220-227   | Build-time canon bake list                                |
| `src/lib/debug/debugSeed.ts`            | `SEEDS` table                          | full file | Per-tier ear-test recipe                                  |

That list is the **real cost of a sibling-node addition**. The CVC short-e ticket (86c9teua2) touched every entry — see PR #208 for the precedent shape. A future digraph split touches the same list ×3.

### 1.2 Mastery rule semantics (post-PR #201) — the load-bearing detail

`src/lib/progress/mastery.ts` `applyMasteryRule()` runs THREE passes per call (lines 227-392):

1. **Stale-clear / autoPromote re-entry** for `pendingPromotion` (243-262).
2. **intro → practicing pass** (298-309): any node currently at `'intro'` flips to `'practicing'` the moment **one history entry with `successRate > 0`** mentions it in `skillFocus`. This is the post-#201 self-healing pass.
3. **practicing → mastered scan** (314-376): 3 cross-day qualifying sessions at `≥ parentSettings.masteryThreshold['word-song'].percent` (default 0.90).

A node can traverse `intro → practicing → mastered` in a single `applyMasteryRule()` call when history is sufficient (line 292 explicitly documents this).

The `'mastered'` transition then unlocks the next node downstream from `'locked' → 'intro'` (lines 357-359, applied to BOTH the practicing→mastered branch AND the auto-promote re-entry branch). The downstream-unlock cascade walks `nextNode(track, node)` (lines 150-159) which reads `LITERACY_TREE`.

**Critical implication for a single `digraphs` node:**

- Marian completes 3 cross-day sh-only sessions at 100%.
- The mastery rule sees `skillFocus.includes('digraphs')` on 3 entries and `successRate >= 0.90` on each.
- `digraphs` promotes to `'mastered'`.
- `sight-words` unlocks.
- Marian has never seen a `ch` or `th` word and has no native /ʃ/ phoneme reference for either.

This is not hypothetical; the `successRate` per-node filter (line 420) does not inspect WHICH words inside the focus node were tested. The unit of mastery is the focus node, not the pool subset.

### 1.3 Distractor architecture today

`src/screens/WordSong/wordPack.ts` carries:

- `WordEntry` shape (lines 34-51): `{ word, pictureKey, vowel: 'a'|'o'|'u'|'i'|'e', category, isTarget }`.
- `TARGET_PAIRINGS` (lines 758-951): `Record<word, { gentle: [w,w], trap: [w,w] }>` — one row per target.
- `TARGET_PAIRINGS_CROSSVOWEL` (lines 1007-1054): same shape, scoped to the three CVC tiers when `crossVowelMixingActive()` is `true`.

Both matrices are keyed by `word` string. `pickDistractors(target, problemIndex, options)` (`wordDistractors.ts:121-160`) looks up the row, dereferences both distractor words via `getWordEntry()` (which throws on missing), and returns the pair.

The **only phonological dimension on `WordEntry` is `vowel`** (a short-vowel literal). There is no consonant tag, no phoneme tag, no digraph tag. Same-vowel-only enforcement and cross-vowel mixing both ride on the `vowel` field.

`crossVowelMixingActive()` (`mastery.ts:667-678`) reads `CVC_CROSS_VOWEL_NODES` (line 595-599) — a hardcoded three-node Set. Widening to short-i / short-e is explicitly flagged as a "deliberate change point" in the comment at lines 591-594 (the matrix author needs to extend both the set AND `TARGET_PAIRINGS_CROSSVOWEL` rows).

### 1.4 Planner / canon today

`api/_planner.ts` recognises `digraphs` in `VALID_WORD_SONG_FOCUS_NODES` (line 145) but does NOT include it in `WORD_SONG_FIRST_CLASS_FOCUS_NODES` (lines 605-612). `effectiveFocusNode()` (lines 627-638) routes `digraphs` requests to `blending-cv` content as a stub-fallback. There is no `digraphs` canon JSON in `public/canon/word-song/level-1/` — verified.

---

## 2. Finding #1 — SkillNode shape

### 2.1 Three options on the table

**Option A — Three sequential sibling SkillNodes** (recommended).
`digraphs-sh`, `digraphs-ch`, `digraphs-th-voiceless` inserted in that order between `cvc-words-short-e` and `sight-words`.

**Option B — One `digraphs` SkillNode + planner-side per-session isolation.**
Keep `digraphs` as a single node. The session-start request carries an extra `digraphStage: 'sh' | 'ch' | 'th'` hint that the planner reads to gate which subset of the digraph pool to draw from. Some browser-side state tracks "which sub-stage am I on right now?" outside the persisted `Progress` document.

**Option C — One `digraphs` SkillNode with internal pool composition rules.**
The planner reads progress.history and decides whether to ship sh-only, ch-only, th-only, or mixed words based on rolling accuracy on each sub-pool. No new persisted state; no client-side stage tracker; "isolation" emerges from a heuristic the planner runs.

### 2.2 Recommendation: Option A (three sibling SkillNodes)

**Rationale, in priority order:**

1. **Mastery rule already enforces sequential isolation when each digraph is its own node.** The intro→practicing→mastered cascade works exactly as it does for the CVC tiers — `digraphs-sh` is the focus until 3 cross-day sessions ≥90%; the rule auto-promotes; `digraphs-ch` unlocks `'intro'`; the focus-picker walks past `sh` (mastered) and lands on `ch`. Each digraph gets its own 3-session window at ≥90% before the next unlocks. The 90% number is exactly the readiness gate Dave's §Q1 + §Q2 call for.

2. **Option B and C both invent a parallel state machine outside `Progress`.** That violates the existing architectural posture (`progress.skillLevels` is the unit of mastery for a reason — it's the durable input to the curriculum walker AND to the cross-day mastery cadence). Option B requires a new `digraphStage` field on `Progress`, a new sub-progression rule, and an `applyDigraphMasteryRule()` helper that mirrors `applyMasteryRule()` but at one level deeper. Option C pushes the same logic into the planner where it is invisible to the mastery rule, the Hub path-strip, and parent settings.

3. **Hub UX surfaces three stage icons instead of one — Dave's research §Q2 makes this pedagogically correct.** "Marian, you mastered sh! Now we're learning ch!" reads as a real milestone. The pictured-strip celebration (per Kyle's screen-hub spec) already handles per-node promotion. With a single digraph node, Marian sees one icon labelled "sh" that silently mutates to "ch" mid-stream — invisible progress.

4. **The intro→practicing cascade (post-#201) handles three sub-nodes cleanly** — I walked the cascade by hand against `mastery.ts` (see §2.4 below).

5. **Future cross-digraph mode (Dave §Q5)** — sh+ch interleaving once both are ≥70% — fits the existing cross-vowel mix infrastructure (`crossVowelMixingActive` + `TARGET_PAIRINGS_CROSSVOWEL`) precisely. With three sibling nodes, a `DIGRAPH_CROSS_NODES = ['digraphs-sh', 'digraphs-ch']` predicate is two lines and a parallel `TARGET_PAIRINGS_CROSS_DIGRAPH` matrix gives Kyle the same authoring surface that cross-vowel-mix already has. With Option B/C the cross-mode hook is a fresh invention.

6. **Sight-words gating works correctly.** Today `sight-words` is at `'intro'` in `DEFAULT_SKILL_LEVELS` and the post-#201 intro→practicing transition has been firing on it independently of the literacy track's main walk. The `nextNode()` chain (`mastery.ts:150-159`) means `sight-words` will get an additional `locked → intro` unlock signal when `digraphs-th-voiceless` masters; since it is already `'intro'` the unlock is a no-op (line 357 guards `=== 'locked'`). No regression. **However**: in the Option-A world, downstream nodes should NOT be at `'intro'` before their upstream master if we want strict sequencing. Currently `sight-words` is at `'intro'` from greenfield — that is fine pre-digraph because there is no enforcement gate, but it does mean Marian can theoretically pick `sight-words` as a focus before digraphs are touched (the picker walks past non-mastered nodes only when `'mastered'` — at line 124 it returns the first non-mastered node, which is the FIRST one in declaration order, so sight-words would never be picked while digraphs sits at `'locked'` ahead of it). Lock holds. Confirmed by reading `pickFocusNode()` against the seeded baseline.

### 2.3 Pros / cons matrix

| Concern                                                  | Option A (three nodes)                    | Option B (planner gate)                        | Option C (planner heuristic) |
| -------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------- | ---------------------------- |
| Mastery rule enforces digraph isolation                  | YES — natural                             | NO — needs new sub-rule                        | NO — emergent only           |
| Hub path-strip surfaces digraph progress                 | 3 stages, named                           | 1 stage, opaque progress                       | 1 stage, opaque progress     |
| Parent settings (mastery threshold) per digraph          | YES — already per-track                   | NO — single threshold                          | NO                           |
| Cross-digraph mode (Dave §Q5)                            | Easy — clone cross-vowel-mix infra        | Hard — new orthogonal axis                     | Hard — emergent              |
| First-encounter scaffolding per digraph                  | Trivial — node-keyed (PR #173 §4)         | Need word-keyed gate                           | Need word-keyed gate         |
| Cost to ship                                             | 1 PR per digraph (sibling-tier precedent) | Net-new sub-progression rule + persisted state | Planner-only but invisible   |
| Risk of "Marian masters digraphs without seeing ch / th" | Zero                                      | Real (depends on heuristic)                    | High                         |
| Test surface                                             | Round-trip + e2e per tier (precedent)     | New mastery + new planner branches             | Heuristic regression         |
| Backward-compat                                          | Trivial (locked-key fill)                 | Trivial                                        | Trivial                      |
| Total file churn per digraph                             | ~13 file edits, ~3 line ranges each       | ~6 file edits + new sub-progression module     | ~3 file edits, planner-heavy |

Option A's _per-digraph file churn_ is the highest, but it is mechanical and follows a 5-PR precedent (short-o through short-e). The other options have lower per-digraph churn but introduce a NEW conceptual category (sub-progression below a node), which is the kind of architectural debt the project doesn't have today.

### 2.4 Walkthrough — mastery rule + focus-node picker over 3 digraph sub-nodes

Starting state (after `cvc-words-short-e` masters):

```text
skillLevels = {
  ...all CVC tiers: 'mastered',
  'digraphs-sh':            'intro',      // cascaded from 'locked' when short-e mastered
  'digraphs-ch':            'locked',
  'digraphs-th-voiceless':  'locked',
  'sight-words':            'intro',      // unchanged from greenfield
  'simple-sentences':       'locked',
}
```

`pickFocusNode('word-song')` walks `WORD_SONG_NODES_IN_ORDER`, sees every CVC tier at `'mastered'`, lands on `digraphs-sh` (first non-mastered). ✓

Marian completes a session on `digraphs-sh` with `successRate = 0.875` (7/8). Session-end runs:

1. `recordProgressOnSessionEnd` appends a history entry with `skillFocus: ['digraphs-sh']`.
2. `applyMasteryRule()` runs.
3. Pass 1 (autoPromote re-entry): no pending promotion. No-op.
4. Pass 2 (intro→practicing): `digraphs-sh` is `'intro'`, history has one entry with `successRate > 0`. Promotes to `'practicing'`.
5. Pass 3 (practicing→mastered): `digraphs-sh` is now `'practicing'`. Only 1 history entry. `qualifies()` returns false (`filtered.length < threshold.sessions`). No-op.

End state: `digraphs-sh: 'practicing'`. ✓

Marian completes 3 more cross-day sessions at 0.95, 0.92, 1.00. After session 4 (the 3rd at ≥0.90 in window):

1. Pass 1: no-op.
2. Pass 2: `digraphs-sh` is `'practicing'` now — pass 2 skips it (line 300 `continue` when `!== 'intro'`).
3. Pass 3: `qualifies()` looks at the last 3 cross-day-deduped entries (0.95, 0.92, 1.00); all ≥0.90. `digraphs-sh` qualifies. autoPromote=true (default) → flip to `'mastered'`. `nextNode('word-song', 'digraphs-sh') === 'digraphs-ch'`. `digraphs-ch` is `'locked'` → flips to `'intro'`. `pendingPromotion = 'digraphs-sh'` (Hub celebration cue, ticket 86c9m3brc).

End state: `digraphs-sh: 'mastered', digraphs-ch: 'intro'`. ✓

`pickFocusNode()` now walks past `digraphs-sh` (mastered) and lands on `digraphs-ch`. Next session focuses on `ch`. Cycle repeats. After `digraphs-ch` masters, `digraphs-th-voiceless` unlocks. After `digraphs-th-voiceless` masters, `sight-words` is hit by `nextNode()` and the locked→intro guard at line 357 makes it a no-op (already intro). Hub celebration only fires once per `applyMasteryRule()` call.

**No corner case identified.** The cascade is identical in shape to the CVC tier sibling cascade that already ships and is regression-covered by `e2e/progression-mastery-loop.spec.ts` (PR #202).

### 2.5 Affected files for Option A

**Per-digraph sibling-tier addition** (the exact 13-place list from §1.1 above):

For shipping `digraphs-sh`, EVERY entry below gets a `digraphs-sh` literal added between `cvc-words-short-e` and the pre-existing `digraphs` literal (which we rename / leave or remove — see §2.6 migration note):

1. `src/lib/progress/types.ts:39-50` — `WordSongNode` union, insert `'digraphs-sh'`.
2. `src/lib/progress/focusNode.ts:73-85` — `WORD_SONG_NODES_IN_ORDER`.
3. `src/lib/progress/mastery.ts:129-141` — `LITERACY_TREE`.
4. `src/lib/progress/guards.ts:19-43` — `SKILL_NODES` Set.
5. `src/lib/progress/defaults.ts:30-54` — `SCHEMA_FLOOR_NODES`.
6. `src/lib/progress/defaults.ts:85-131` — `DEFAULT_SKILL_LEVELS` (line for `'digraphs-sh': 'locked'`).
7. `src/screens/Hub/stages.ts:25-66` — `WordSongStageId` + `WORD_SONG_STAGES`.
8. `src/screens/Hub/stageIcons.tsx:150-174` — `STAGE_LABEL` (e.g. `'digraphs-sh': 'sh'`).
9. `src/screens/Hub/progressProjection.ts:102-114` — `WORD_SONG_LABELS` (e.g. `'digraphs-sh': 'digraphs (sh)'`).
10. `e2e/_helpers/wordSongNodesInOrder.ts:53-82` — `WORD_SONG_NODES_IN_ORDER` shim.
11. `api/_planner.ts:136-148` — `VALID_WORD_SONG_FOCUS_NODES`.
12. `api/_planner.ts:605-612` — `WORD_SONG_FIRST_CLASS_FOCUS_NODES` (only when content lands, not on the SkillNode-split-only PR).
13. `api/_planner.ts:971-1097` — `WORD_SONG_TRACK_GUIDE` prompt copy (read-line template + pool reference).
14. `api/_plannerWordList.ts` — new `WORD_SONG_TARGET_WORDS_DIGRAPHS_SH` export (with the 8-10 sh words per Dave §Q4 once Kyle spec'd).
15. `scripts/generateSessionCanon.ts:220-227` — `WORD_SONG_FOCUS_NODES`.
16. `src/lib/debug/debugSeed.ts` — new seed recipe `digraphs-sh` (preceding CVC tiers all mastered).
17. `public/canon/word-song/level-1/digraphs-sh.json` — bake target (after planner ships content).

Test surfaces (additive but mandatory): 18. `src/lib/progress/focusNode.test.ts` — tier-walk regression (pin `digraphs-sh` between short-e and `digraphs-ch`). 19. `src/lib/progress/mastery.test.ts` — sibling-tier promotion cascade test. 20. `e2e/digraphs-sh-progression.spec.ts` — Jessica-authored failing-first E2E spec (mandatory per `feedback_progression_e2e_mandatory.md` memory). 21. `src/screens/WordSong/plannerRoundTrip.test.ts` — extend `WORD_SONG_TARGET_WORDS_DIGRAPHS_SH` alignment assertion.

A short-e-precedent PR comes in around ~25 changed files; digraph-sh will be similar plus a Jessica E2E spec. Each subsequent digraph (`ch`, `th-voiceless`) replays the same shape ~14-15 files.

### 2.6 Migration / backward-compat for the SkillNode split

**Recommended path: drop the single `digraphs` literal from `WordSongNode` in the same PR that adds `digraphs-sh`. This is acceptable because the literal is currently dead.**

Verification of "currently dead":

- No production canon file references `digraphs` (verified: `public/canon/word-song/level-1/` has no `digraphs.json`).
- The planner falls through to `blending-cv` content for `digraphs` focus requests via `effectiveFocusNode()` stub-fallback (`_planner.ts:627-638`).
- Marian's current state (per April 2026 diagnostic and 5 PRs shipped through short-e) has `digraphs: 'locked'`. Her localStorage has never carried `digraphs: 'intro'` or higher.
- No memory entry or pickup-state references `digraphs` as having shipped content.

**Migration cost:** zero for Marian; zero for any tester who's deep-launched into a state seeded by `debugSeed.ts`. The schema-floor fill at `defaultLockedSkillLevels()` (`defaults.ts:77-83`) handles the `digraphs-sh` key landing as `'locked'` on any persisted blob that predates the change. The `'digraphs': 'locked'` key on existing blobs becomes "an unrecognised key" — and `isProgressV1` at `guards.ts:206` does NOT iterate extra keys; it only checks the keys it expects. The extra key is invisible to the runtime and gets pruned on the next `saveProgress` round-trip via `withDefaultedSkillLevels` (need to verify whether the storage adapter strips unknown keys; if not, the extra key is harmless dead weight).

**One backward-compat caveat:** if for any reason a Marian profile DOES have `digraphs: 'intro'` or higher (e.g. someone hand-edited their localStorage during QA), dropping the literal silently drops that progress. Mitigation: keep `digraphs` in the union for one PR (the split PR), mark it as deprecated in the comment, and add a one-time migration step that maps `digraphs: 'intro' | 'practicing' | 'mastered'` → `digraphs-sh: <same level>` on first load. **Conservative recommendation: ship the migration step even though no real user is affected.** Pattern: extend `STEPS` in `migrate.ts`. Schema bump to v2 is the textbook way; lighter alternative is an additive read-path patch keyed off "blob carries `digraphs` AND no `digraphs-sh`."

**I recommend the read-path additive patch over a v1 → v2 schema bump.** Rationale: the same precedent was set when `cvc-words-short-o` shipped without bumping schemaVersion (the legacy `cvc-words` literal stayed in the union and the new sibling joined it). The blob doesn't need a structural change — it needs a key rename for one specific dead-letter case. The migration framework at `migrate.ts:20-23` is the right home for a `digraphs → digraphs-sh` rewrite, but it can be added to `withDefaultedSkillLevels` instead to avoid the schemaVersion ceremony. **Defer the decision to Devon's review** — both shapes are clean.

---

## 3. Finding #2 — `th` grapheme covers two phonemes

### 3.1 Why this matters (audit)

Today every word in `wordPack.ts TARGET_WORDS` is CVC short-a/o/u/i/e. Two facts establish the boundary:

1. `WordEntry.vowel: 'a' | 'o' | 'u' | 'i' | 'e'` (line 45) — the phonological dimension on the entry.
2. The same-vowel-only rule (spec §8 across all five vowel tier docs + the `crossVowelMixingActive()` predicate) ensures that within a single session's distractor pool, every word shares a vowel.

This works because **vowel** is the entire phonological discriminator we care about for CVC. The grapheme→phoneme mapping is 1:1 for short vowels (modulo the box/fox /ks/ note Dave flagged separately for short-o, which is a coda issue not a vowel issue).

**`th` breaks the 1:1 grapheme→phoneme mapping inside the consonant onset.** Dave §Q3 + §Q5 confirm:

- `thin, thick, thank, path, math, moth, tenth, with` → /θ/ (voiceless)
- `the, this, that, they, them, then` → /ð/ (voiced)

And the chip-tap format Dave §Q3 explicitly notes: "the voiced/voiceless th distinction is invisible to a child looking at the text chip."

**The vulnerability:** if `digraphs-th-voiceless` ships and a future ticket adds voiced-th words to the pool without architecture changes, the distractor selector has no way to know that `'thin'` and `'them'` belong to different phoneme buckets.

### 3.2 Concrete failure mode (today, on a hypothetical poorly-implemented `digraphs-th` tier)

Suppose someone adds `'thin'` and `'them'` to `TARGET_WORDS` with `vowel: 'i'` and `vowel: 'e'` respectively (assuming we add `WordEntry.vowel: 'i'|'e'|...|whatever`). Then:

1. Even with the same-vowel-only rule, `'thin'` would be in the short-i pool and `'them'` would be in the short-e pool — no collision in V1. **The architecture as-shipped contains the vulnerability accidentally.**

2. **But** `crossVowelMixingActive()` is shipped as a parent-tunable switch. Once it includes short-e and short-i (when those tiers are mastered together with short-a, short-o, short-u — see `CVC_CROSS_VOWEL_NODES` widening note at `mastery.ts:591-594`), a session on, say, the short-i tier could draw `'them'` as a distractor for `'thin'`. Both have `th-` onsets. Marian hears Emma pronounce `'thin'` (/θɪn/) and is asked to identify the matching chip among `'thin' / 'them' / 'wig'`. The text chip `'them'` starts with `th` — same as `'thin'`. The phonemic distinction (Emma said /θ/, `'them'` is /ð/) is invisible to Marian because she's reading the text, not generating the phoneme. **The chip-tap UX produces an artificially confusable trio.**

3. The matrix author can avoid that with `FORBIDDEN_PAIRS` (`wordPack.ts:680-730`), but they have to KNOW. Today there's no mechanism that flags it.

### 3.3 Cleanest mitigation — phoneme-tag the WordEntry

**Recommendation:** add an optional `phoneme?: string` field to `WordEntry`, IPA-encoded, scoped to the LOAD-BEARING phoneme of the word (typically the digraph or onset phoneme for digraph-tier words; null/omitted for non-digraph words where vowel + word-identity already suffice).

```ts
export interface WordEntry {
  word: string
  pictureKey: string
  vowel: 'a' | 'o' | 'u' | 'i' | 'e'
  category: WordCategory
  isTarget: boolean
  /**
   * Optional phoneme tag (IPA). Used for distractor-selection scoping
   * when a grapheme covers multiple phonemes (e.g. `th` → /θ/ vs /ð/).
   * For CVC short-vowel words this is `undefined` — `vowel` already
   * carries the discriminating phonological dimension. For digraph-tier
   * words this carries the digraph's phoneme: '/ʃ/' for sh, '/tʃ/' for
   * ch, '/θ/' for voiceless-th, '/ð/' for voiced-th (sight-words tier).
   */
  phoneme?: string
}
```

**Pool selection patch in `pickDistractors`:** when target.phoneme is defined, both distractors' phonemes (if defined) must equal target.phoneme. If a distractor's phoneme is undefined (a non-digraph distractor used cross-tier), the check is bypassed — the phoneme tag is opt-in and absence means "don't filter on this dimension."

Code-shape sketch (against current `wordDistractors.ts:121-160`):

```ts
export function pickDistractors(
  target: WordEntry,
  problemIndex: number,
  options?: PickDistractorsOptions,
): [WordEntry, WordEntry] {
  // ... (existing matrix lookup) ...
  const [d1, d2] = [getWordEntry(d1Word), getWordEntry(d2Word)]

  // Phoneme-scoping (NEW). When target carries a phoneme tag, any
  // distractor that ALSO carries one must match. Distractors without
  // a phoneme tag pass through — they are non-digraph filler from
  // other tiers and the vowel-axis filter has already constrained
  // them appropriately.
  if (target.phoneme !== undefined) {
    if (d1.phoneme !== undefined && d1.phoneme !== target.phoneme) {
      throw new Error(
        `[wordDistractors] phoneme mismatch: target ${target.word} (${target.phoneme}) ` +
          `vs distractor ${d1.word} (${d1.phoneme}). Matrix authoring bug — ` +
          `voiced/voiceless th must not co-occur (see digraph-architecture-proposal.md §3).`,
      )
    }
    if (d2.phoneme !== undefined && d2.phoneme !== target.phoneme) {
      throw new Error(/* parallel */)
    }
  }

  // ... (existing forbidden-pair / distinctness assertions) ...
  return [d1, d2]
}
```

**Why a defensive throw and not silent filtering:** silent filtering hides a matrix authoring bug. The matrix should be hand-curated by Kyle just like every other distractor row. If a /θ/ word's row lists a /ð/ distractor by mistake, that is a content-authoring bug Devon catches in PR review; the assertion makes it impossible to ship.

### 3.4 Alternative considered: separate phoneme-keyed pools

Split `TARGET_PAIRINGS` into `TARGET_PAIRINGS_TH_VOICELESS` and `TARGET_PAIRINGS_TH_VOICED`. Same shape as the cross-vowel matrix split.

**Pro:** the type / matrix declares phoneme separation explicitly.
**Con:** the matrix proliferates per grapheme→multi-phoneme case. With c-soft/c-hard, g-soft/g-hard, s-voiced/s-unvoiced (all flagged in §3.5 below), you end up with one matrix per grapheme. The phoneme-tag approach handles all of them uniformly.

**Recommendation: phoneme-tag, not separate matrices.** The matrix stays single-source-of-truth; the constraint moves into the runtime check.

### 3.5 Generalisation — other grapheme→multi-phoneme cases

This is the question Dave's research didn't ask but the architecture review should. Below is the audit:

| Grapheme | Phonemes                        | Where it surfaces                                                                                                                                                                                                                                                                             | Risk timeline                                                                                                                        |
| -------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `th`     | /θ/ thin, /ð/ this              | Digraph tier (Dave §Q2-Q3)                                                                                                                                                                                                                                                                    | **Imminent — gates this proposal.**                                                                                                  |
| `c`      | /k/ cat, /s/ city               | Could appear if `letter-sounds` tier ever surfaces `c` words explicitly; CVC pool today never has /s/-c words (only /k/-c: cat, cap, can, cup, cot).                                                                                                                                          | Low — current pool is /k/-c only. Future risk if "soft c" words enter `cvc-words`-style content.                                     |
| `g`      | /g/ gum, /dʒ/ gem               | **TODAY in pack: `gum` (/g/) AND `gem` (/dʒ/) are both in TARGET_WORDS** (short-u and short-e respectively). Same-vowel-only rule keeps them apart in v1 sessions. Cross-vowel matrix doesn't currently pair them. **Latent vulnerability** if cross-vowel mode extends to short-e + short-u. | **Real now**, masked by same-vowel-only and the current 3-node `CVC_CROSS_VOWEL_NODES`. Surfaces when cross-vowel widens to short-e. |
| `s`      | /s/ sun, /z/ rose               | CVC pool today is /s/-s only (sun, sip, bus). No /z/-s words. Future risk if `rose`, `nose` style words enter.                                                                                                                                                                                | Low.                                                                                                                                 |
| `ch`     | /tʃ/ chin, /k/ school, /ʃ/ chef | Digraph tier — /tʃ/ only per Dave §Q2. The /k/ and /ʃ/ variants are out-of-scope for this stage of curriculum.                                                                                                                                                                                | Low — Dave explicitly scopes ch to /tʃ/ for Marian's tier.                                                                           |
| `y`      | /j/ yes, /aɪ/ my, /i/ funny     | Not in CVC pool. Future risk in long-vowel or polysyllabic content.                                                                                                                                                                                                                           | None now.                                                                                                                            |
| `oo`     | /uː/ moon, /ʊ/ book             | Out of scope until long-vowel tiers.                                                                                                                                                                                                                                                          | None now.                                                                                                                            |

**Conclusion: `gum` vs `gem` is a real instance of the same problem TODAY**, masked by the same-vowel-only rule. The phoneme-tag mitigation also covers this case for free if we ship it now. If we don't, the bug ships the moment cross-vowel mode widens to include short-e — which is the next architectural step on the cross-vowel-mode roadmap (see `mastery.ts:611-619` widening contract).

**Recommendation:** ship the phoneme-tag field NOW, even before any `th` word lands. Document `gum: '/g/'` and `gem: '/dʒ/'` in the same PR as the type change. The same-vowel-only rule keeps the cross-vowel matrix from authoring `gem` as a distractor for `gum` today; the phoneme-tag adds a belt-and-braces assertion so a future cross-vowel-matrix author can't accidentally pair them. Cost: ~6 lines in `wordPack.ts` + the helper + a test. Benefit: forecloses the entire grapheme→multi-phoneme class of bug architecturally rather than fixing it word-by-word.

### 3.6 Affected files for the phoneme-tag mitigation

The proposed phoneme-tag is a 4-place change:

1. `src/screens/WordSong/wordPack.ts:34-51` — extend `WordEntry` interface with optional `phoneme?: string`.
2. `src/screens/WordSong/wordPack.ts:399-614` — annotate `gum: '/g/'` and `gem: '/dʒ/'` on existing entries (and any digraph-tier entries as they land).
3. `src/screens/WordSong/wordDistractors.ts:121-160` — add the phoneme-scoping branch shown in §3.3.
4. `src/screens/WordSong/wordDistractors.test.ts` — assertion-fire tests: target tagged + distractor tagged + mismatch → throws; target tagged + distractor un-tagged → passes; target untagged + distractor tagged → passes.

No type changes ripple outside `src/screens/WordSong/`. No persisted-progress schema impact. No planner contract impact (`WordEntry` is browser-only; the planner sees words by string and the parser dereferences via `getWordEntry()`).

---

## 4. Migration / backward-compat summary

| Change                                         | Persisted impact                                                                         | Test surface                                                                                 | Risk                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Add `digraphs-sh` literal                      | Schema-floor fill: existing blobs get `digraphs-sh: 'locked'` on next read.              | `isProgressV1` keys grow by 1; no shape change otherwise.                                    | None — same precedent as 5 prior CVC-tier sibling adds. |
| Drop `digraphs` literal                        | If a hand-edited blob has `digraphs: <level>`, the level is lost. Real users unaffected. | Optional one-time read-path remap (`digraphs → digraphs-sh`) covers the QA / hand-edit case. | Low.                                                    |
| Add `WordEntry.phoneme?` field                 | Browser-only; not persisted.                                                             | New test cases on `wordDistractors.test.ts`.                                                 | None — additive optional field.                         |
| Future: `digraphs-ch`, `digraphs-th-voiceless` | Same as `digraphs-sh`.                                                                   | Sibling-tier precedent.                                                                      | None.                                                   |
| Future: cross-digraph mode (sh↔ch at ≥70%)     | New `DIGRAPH_CROSS_NODES` constant; new `TARGET_PAIRINGS_CROSS_DIGRAPH` matrix.          | Same shape as cross-vowel-mix infrastructure.                                                | None — orthogonal.                                      |

**No schemaVersion bump required for any of the above.** Same posture as `cross-vowel-mix v1` (PR #181), `cvc-words-short-i` (PR #190), `cvc-words-short-e` (PR #208).

---

## 5. Implementation order (PR-by-PR)

1. **PR — SkillNode split + phoneme-tag infrastructure** (no content). Renames the dead `digraphs` literal to `digraphs-sh`. Adds `digraphs-ch` and `digraphs-th-voiceless` as `'locked'` siblings between `cvc-words-short-e` and `sight-words`. Adds `WordEntry.phoneme?` and `gum: '/g/'`, `gem: '/dʒ/'` annotations. Wires the phoneme-scoping check in `pickDistractors`. NO planner content yet; the three new nodes route to `blending-cv` content via the stub-fallback. **Owner: Kevin or Devon.** Tests: vitest only — no Jessica E2E spec yet because no progression behaviour ships in this PR (mastery rule walks the new nodes but they stay at `'locked'` for everyone).

2. **PR — Kyle's digraph-sh content spec.** Word pool (8-10 words per Dave §Q4), distractor matrix, MJ pictures, first-encounter scaffolding line ("Two letters, one sound. Sh — finger on lips."). Same shape as `design/word-song/short-u-pool-expansion.md` etc.

3. **PR — Jessica failing-first E2E spec for digraphs-sh progression.** Mandatory per `feedback_progression_e2e_mandatory.md` memory. Spec exercises `intro → practicing → mastered` and `nextNode` unlock of `digraphs-ch`.

4. **PR — `digraphs-sh` canon-wire.** Lands `WORD_SONG_TARGET_WORDS_DIGRAPHS_SH` in `_plannerWordList.ts`, adds `digraphs-sh` to `WORD_SONG_FIRST_CLASS_FOCUS_NODES`, extends the `WORD_SONG_TRACK_GUIDE` prompt with the "Read the <word>." template for digraph-sh content, regenerates `public/canon/word-song/level-1/digraphs-sh.json`, adds the `digraphs-sh` debug seed recipe. Pattern is identical to PR #208 for short-e. Jessica's spec from step 3 flips RED → GREEN.

5. **PR — Marian iPad smoke + observation.** Dave's §Q3 risk-flag: real Marian performance may diverge from /θ/ → /t/ Tagalog-substitution prediction; observation override.

6. **PRs 6-8** — repeat steps 2-5 for `digraphs-ch`.

7. **PRs 9-11** — repeat steps 2-5 for `digraphs-th-voiceless`.

8. **PR — cross-digraph mode (sh↔ch interleaving)**, when both sh and ch are mastered. Dave §Q5 + the precedent at `cross-vowel-mix-spec.md`. Adds `DIGRAPH_CROSS_NODES`, `crossDigraphMixingActive()` predicate, `TARGET_PAIRINGS_CROSS_DIGRAPH` matrix, parent-settings toggle `crossDigraphMixingEnabled`.

9. **Sight-words tier work — separate flow.** Voiced /ð/ function words (the, this, that, they) join the sight-words pool here per Dave §Q2 (§Q3 voiced-th deferral). Outside the digraph progression entirely.

---

## 6. Open questions for Thomas

1. **Voiced /ð/ as a sight-words concern, not a digraph concern.** Dave §Q2 + §Q3 are explicit: function words "the, this, that, they, them" should arrive via sight-word path, not via digraph chip-tap. This proposal embraces that. **Confirm: the `digraphs-th-voiceless` node will NEVER contain a voiced-/ð/ word; voiced-th words live in the `sight-words` tier only. Phoneme-tag the voiced-/ð/ sight-words too?** (Recommendation: yes — `'the': '/ð/'`, etc. The cost is one annotation per word; the benefit is the phoneme-scoping assertion catches cross-tier accidents.)

2. **Migration step for `digraphs → digraphs-sh`** — additive read-path patch (recommended) vs `migrate.ts STEPS` schemaVersion bump. Both work; I have a weak preference for the read-path patch because no real user has `digraphs: 'intro'` or higher. Devon's call.

3. **Cross-digraph mode timing** — Dave §Q5 suggests sh↔ch interleaving at ≥70% accuracy. The cross-vowel-mix predicate (`crossVowelMixingActive`) gates on `'mastered'` (i.e. ≥90%). Should cross-digraph use the same `'mastered'` gate (simpler, but slower onset) or a new `'practicing-with-recent-≥70%'` gate (lighter, closer to Dave's recommendation)? Recommendation: **start with `'mastered'` for consistency and review after observing Marian's real digraph trajectory.** A new gate is an architectural increment we should justify with data.

4. **Hub stage icons for three digraphs** — current `STAGE_LABEL` has `digraphs: 'sh'`. With the split, that becomes:
   - `digraphs-sh: 'sh'`
   - `digraphs-ch: 'ch'`
   - `digraphs-th-voiceless: 'th'` (or `'ɵ'`? — IPA on a Hub icon may be too obscure for an 8-year-old; recommend `'th'` plain).
     Kyle owns the final glyph selection, but the split is what unlocks the option.

5. **Should `gum: '/g/'` and `gem: '/dʒ/'` annotations be added in the SkillNode-split PR (step 1) or in a separate prerequisite PR?** Pro for separate: the SkillNode split PR is already large (~17 files for the split alone); cleaner to land phoneme-tag infrastructure in its own diff. Pro for combined: the phoneme-tag is half of the architectural motivation; splitting it makes the test surface harder to argue. **Weak preference for combined** — both are pre-content infrastructure and review naturally as a pair.

6. **Spec ownership for digraphs.** Dave's research grants the dev team a clear pedagogical floor (sh first, ch second, th-voiceless third, 8-10 words each, sequential isolation). Kyle writes the per-tier spec from here (word selection, MJ pictures, distractor rows, first-encounter scaffolding). **Confirm: Kyle is dispatched only after Thomas signs off on the SkillNode split.** Inverting that order risks Kyle authoring a `digraphs.md` spec for a single pool that this proposal recommends against.

---

## 7. Non-obvious findings worth surfacing

Listed for the orchestrator + the `maintain-docs` hook.

1. **`gum` and `gem` are already in the pack with different `g` phonemes.** The same-vowel-only rule keeps them apart in v1 sessions, but the cross-vowel widening contract at `mastery.ts:591-594` means the masking is contingent on `CVC_CROSS_VOWEL_NODES` staying at 3 nodes. The day someone adds `cvc-words-short-e` to that set, the gum/gem pair is one matrix-author mistake away from shipping a confusable trio. This is a latent vulnerability, not a current bug. Phoneme-tag closes it architecturally.

2. **The intro→practicing self-heal (PR #201) makes the mastery rule "promote on any non-zero session"** for nodes at `'intro'`. For digraphs, this means the FIRST session where Marian gets ANY sh word right will flip `digraphs-sh` from `'intro'` to `'practicing'`. From there the standard 3-cross-day-≥90% rule gates `'mastered'`. The pedagogical interpretation: `'intro'` is "first contact"; `'practicing'` is "in active rotation"; `'mastered'` is "3 sessions ≥90% over 3 days". Dave's research §Q1 readiness gate (`~90% over CVC across two short vowels`) maps cleanly onto our `'mastered'` semantics.

3. **The five-place widening contract documented in `wordSongNodesInOrder.ts:36-50` is actually thirteen-plus places.** Future sibling-tier work should refer to a canonical "tier-addition checklist" rather than the partial list in that file. Recommendation: extract a `.claude/docs/sibling-tier-checklist.md` after this proposal is approved.

4. **`api/_planner.ts:VALID_WORD_SONG_FOCUS_NODES`** is duplicated from `WordSongNode` "because the api/ build runs under a server-only tsconfig" (file comment, line 105-121). This duplication is enforced by code review + unit test rather than by an import. Future sibling-tier adds must remember both copies. Pattern is fine but worth flagging when the checklist gets extracted.

5. **`crossVowelMixingActive` is hardcoded to a 3-node Set** (`mastery.ts:595-599`). Adding short-i / short-e to cross-vowel-mode is a planned-but-not-shipped widening (see comment at lines 591-594). When that ships, the phoneme-tag infrastructure I propose here is what protects gum/gem and other latent grapheme-phoneme ambiguities from surfacing as confusable trios. **There is a hidden ordering dependency:** ship phoneme-tag BEFORE widening `CVC_CROSS_VOWEL_NODES` to short-e.

6. **The `App.tsx:1153-1157` cross-vowel gate is hardcoded** (`focus === 'cvc-words' || focus === 'cvc-words-short-o' || focus === 'cvc-words-short-u'`). This is a second instance of the 3-node literal — and it's not exported from `mastery.ts` as `CVC_CROSS_VOWEL_NODES`. There's a drift risk: the predicate and the gate-list are in lockstep today by hand. A small refactor that exports `isCvcTier(node)` from `mastery.ts` would close that drift surface. Tangential to this proposal but worth flagging.

7. **No `.claude/docs/*.md` files were present in the worktree at session start.** The CLAUDE.md preamble references them as canonical project context with auto-load via `session-start-read-docs.sh`. They do not exist on `main` as of 0c34d89 — verified via `git ls-files | grep .claude` (empty). Either the docs live outside the repo (e.g. in `~/.claude/projects/...`), or the auto-load is doing something other than loading repo files. Sub-agents reading the dispatch brief's "Read first" preamble should not block on the docs being absent — the source code is the canonical reference, which is what this proposal was built against.
