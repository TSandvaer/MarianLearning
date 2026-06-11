# Wave 11 — `sight-words` content tier

**Status:** plan — pre-dispatch
**Date drafted:** 2026-06-11
**Author:** Matt (planning role; orchestrator dispatches)
**Branch:** `matt/wave-11-sight-words-plan` (base `main` @ `8ddf7e9`)

## Sponsor decision (recorded)

| Field        | Value                                                                                                                                                                                                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decider**  | Thomas (Sponsor / Product Owner)                                                                                                                                                                                                                                              |
| **Date**     | 2026-06-11                                                                                                                                                                                                                                                                    |
| **Decision** | Wave 11 = **`sight-words` content tier** — the next net-new Word Song content frontier.                                                                                                                                                                                       |
| **Context**  | The original Wave 11 nomination (digraphs ch/th) turned out to be already shipped — see `design/wave-11-plan.md` (PR #376). Thomas re-pointed Wave 11 at `sight-words`, which that same plan listed as candidate option 3: "the genuine next literacy content frontier." This is that input. |

Wave-direction selection is a strategic-priority call (never-auto-decide). It was Thomas's to make; he made it. This plan decomposes it.

---

## TL;DR — this IS a genuine net-new content build

Unlike the digraphs ch/th nomination (which was already shipped across all surfaces), `sight-words` is a **true stub tier**: the `SkillNode` literal exists in the progress/infra layer, but **zero content surfaces exist** — no canon, no word lists, no research, no e2e, no first-class planner support. The planner currently demotes `sight-words` to `blending-cv` stub content via `effectiveFocusNode`.

This is a full content-tier build: a Dave research gate, then the 6-surface content contract, then the 3 still-missing sibling-tier widening points, all paired with Jessica failing-first e2e.

**Critical pedagogy distinction:** sight words are **not phonics-decodable by design** (the, was, said, of...). Every prior Word Song tier — CVC vowels, digraphs — is a *decoding* tier where the child sounds out the word. Sight words are *whole-word recognition*: high-frequency irregular words the child must recognise instantly without decoding. This changes the WordSong render/wordPack treatment in ways we must NOT guess at — the question is routed into Dave's research AC, not answered here.

---

## Ground truth — verified, not assumed

Every "exists / doesn't exist" claim below carries a `git grep` / `git ls-files` citation run against `main` @ `1b6c1b6` (re-verified post-rebase to `8ddf7e9`; the literacy surfaces are unchanged between those two commits).

### Zero sight-words content files

```
$ git ls-files | grep -i sight
(exit 1 — no matches)
$ git ls-files | grep -i "canon.*sight"
(exit 1 — no matches)
```

- **No canon:** `public/canon/word-song/level-1/` ships 12 JSON files (`blending-cv`, `cvc-words`, the four short-vowel siblings, `digraphs-{sh,ch,th-voiceless}`, `letter-names`, `letter-sounds`, `letter-sounds-audit`). **No `sight-words.json`.**
- **No research:** `design/research/` has 26 files; **none** match `sight`. (Closest adjacency: `phonics-sequence-marian.md` — but sight words are explicitly the *non*-phonics track.)
- **No word-list spec:** `design/word-song/` has per-tier word-list specs for every CVC + digraph tier; **none** for sight-words.
- **No e2e:** no `e2e/*sight*.spec.ts`. The `progression-mastery-loop.spec.ts` references are generic tree-walk seeds that *name* `sight-words` as a downstream node, not content tests.

### The `sight-words` literal DOES exist in the progress + infra layer

`git grep -n "sight-words"` confirms the literal is wired into the curriculum graph and read-path:

| Surface                                 | Site (verified)                                                          |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `WordSongNode` union                    | `src/lib/progress/types.ts:82`                                          |
| `WORD_SONG_NODES_IN_ORDER`              | `src/lib/progress/focusNode.ts:101`                                    |
| `LITERACY_TREE`                         | `src/lib/progress/mastery.ts:173`                                      |
| `SKILL_NODES` guard set                 | `src/lib/progress/guards.ts:57`                                        |
| `SCHEMA_FLOOR_NODES` + `DEFAULT_SKILL_LEVELS` | `src/lib/progress/defaults.ts:119` (floor), `:220` (`'intro'`)   |
| Hub stage id union + `WORD_SONG_STAGES` | `src/screens/Hub/stages.ts:45,82`                                      |
| `STAGE_LABEL` glyph                     | `src/screens/Hub/stageIcons.tsx:184` (`'the'`)                          |
| `WORD_SONG_LABELS` caption              | `src/screens/Hub/progressProjection.ts:121` (`'sight words'`)          |
| e2e `wordSongNodesInOrder.ts` shim      | `e2e/_helpers/wordSongNodesInOrder.ts:84`                              |
| e2e `seedStorage.ts DEFAULT_SKILL_LEVELS` | `e2e/_helpers/seedStorage.ts:145` (`'intro'`)                        |
| `VALID_WORD_SONG_FOCUS_NODES`           | `api/_planner.ts:170`                                                  |

So this is a stub tier (infrastructure present, content absent) — net-new content build, **NOT** already shipped. A plan that filed "build the sight-words SkillNode infrastructure" tickets would be re-building merged work; a plan that filed "build the sight-words content" tickets is real, un-shipped work.

---

## Sibling-tier widening audit — which of the 16 are done vs missing

Per `sibling-tier-checklist.md`. Because the SkillNode literal already landed, the infra points are mostly done; only the **content-ship** points remain. Each row carries the citation that proves its state.

| #   | Point (file / symbol)                                       | State for `sight-words`   | Citation                                                                 |
| --- | ----------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------- |
| 1   | `types.ts` `WordSongNode` union                             | **DONE**                  | `types.ts:82`                                                          |
| 2   | `focusNode.ts` `WORD_SONG_NODES_IN_ORDER`                   | **DONE**                  | `focusNode.ts:101`                                                    |
| 3   | `mastery.ts` `LITERACY_TREE`                                | **DONE**                  | `mastery.ts:173`                                                      |
| 4   | `guards.ts` `SKILL_NODES`                                   | **DONE**                  | `guards.ts:57`                                                        |
| 5   | `defaults.ts` `SCHEMA_FLOOR_NODES`                          | **DONE**                  | `defaults.ts:119`                                                     |
| 6   | `defaults.ts` `DEFAULT_SKILL_LEVELS`                        | **DONE** (`'intro'`)      | `defaults.ts:220`                                                     |
| 7   | `Hub/stages.ts` `WordSongStageId` union                     | **DONE**                  | `stages.ts:45`                                                        |
| 8   | `Hub/stages.ts` `WORD_SONG_STAGES`                          | **DONE**                  | `stages.ts:82`                                                        |
| 9   | `Hub/stageIcons.tsx` `STAGE_LABEL`                          | **DONE** (`'the'`)        | `stageIcons.tsx:184`                                                  |
| 10  | `Hub/progressProjection.ts` `WORD_SONG_LABELS`              | **DONE** (`'sight words'`)| `progressProjection.ts:121`                                          |
| 11  | `e2e/_helpers/wordSongNodesInOrder.ts` shim                 | **DONE**                  | `wordSongNodesInOrder.ts:84`                                          |
| 12  | `e2e/_helpers/seedStorage.ts` `DEFAULT_SKILL_LEVELS`        | **DONE** (`'intro'`)      | `seedStorage.ts:145`                                                  |
| 13  | `api/_planner.ts` `VALID_WORD_SONG_FOCUS_NODES`             | **DONE**                  | `_planner.ts:170`                                                     |
| 14  | `api/_planner.ts` `WORD_SONG_FIRST_CLASS_FOCUS_NODES`       | **MISSING**               | absent from list at `_planner.ts:750-762` (stops at `digraphs-th-voiceless`) |
| 15  | `scripts/generateSessionCanon.ts` `WORD_SONG_FOCUS_NODES`  | **MISSING**               | absent from bake list at `generateSessionCanon.ts:281-293` (same stop) |
| 16  | `src/lib/debug/debugSeed.ts` `SEEDS` table                 | **MISSING**               | no `'sight-words'` key in `SEEDS` (`debugSeed.ts:259+`; word-song recipes stop at `digraphs-th-voiceless` `:483`) |

**Net: 13 of 16 done, 3 missing — all three are the content-ship surfaces** (#14 first-class planner, #15 canon bake list, #16 debug seed). This is the exact "stub-tier" fingerprint: infra widened, content not. The three missing points all land in the content-ship PR (Track 2), not a separate infra PR.

### NOT in the 16 — but required for content (per "What the checklist does NOT cover")

The checklist explicitly excludes the actual content layer. For sight-words these are **all net-new**:

- **`WORD_SONG_TRACK_GUIDE` directive block** (`api/_planner.ts`) — a per-tier Haiku directive. Must be inserted in tree order (between `digraphs-th-voiceless` and `simple-sentences`). **This is where the whole-word-recognition vs decoding distinction becomes a prompt-authoring problem** — the directive must NOT instruct phonics decoding.
- **Word lists** — new `WORD_SONG_SIGHT_WORDS` (or per-set) const in `api/_plannerWordList.ts`; today there is no sight-word list (`grep sight api/_plannerWordList.ts` → only doc-comment references).
- **`wordPack.ts` entries** — new `WordEntry` rows + `TARGET_PAIRINGS`. **Open design question (route to Dave):** the `WordEntry` shape assumes `vowel?` / `phoneme?` classification and picture-pairing distractors. Sight words may not fit either — picture-pairing for "the"/"was" is not obviously meaningful. See § "The decoding-vs-recognition render question" below.
- **Canon JSON** — `public/canon/word-song/level-1/sight-words.json`, baked once #15 lands.
- **e2e spec** — `e2e/sight-words-content.spec.ts` (Jessica, failing-first).

### NOT to touch (explicit per checklist + progress doc)

- **`WORD_SONG_GRADUATION_GATED_NODES`** stays `{ 'cvc-words' }` only (`mastery.ts:89`). Sight-words is a vocabulary tier, not a decoding-acquisition gate — adding it would impose a novel-pool graduation with no probe pool. (`progress-and-persistence.md` § Graduation gate; `sibling-tier-checklist.md` § does-not-cover.)
- **No Leitner box on literacy.** The progress doc reserves Leitner for math facts only; `types.ts` comment says "Literacy uses sight-word lists later" — but v1 ships NO literacy Leitner. If Dave's research recommends spaced-repetition for sight words, that is a **separate downstream design**, explicitly OUT of scope for this wave (flagged, not built).
- **K2 read-path remap** — not needed; we are ADDING content to an existing literal, not renaming/removing one.

---

## The decoding-vs-recognition render question (route to Dave, do NOT answer here)

Every shipped Word Song tier is a **decoding** tier: `"Tap the cat."` / `"Read the cat."` with a picture-grounded 3-chip picker, where the picture anchors meaning and the child sounds out C-V-C. The render machinery (`wordPack.ts` `WordEntry`, `TARGET_PAIRINGS` picture distractors, `wordDistractors.ts` gentle/trap axes, the `silent-text-window` decoding beat) is all built around *phonics decoding*.

Sight words break this model:

1. **Not decodable** — "the", "was", "said", "of" violate phonics rules; the child must recognise them whole, instantly, without sounding out. A `silent-text-window` "decoding beat" may be actively wrong here.
2. **Picture-pairing is dubious** — "cat"→cat-picture anchors meaning; "the"→? has no picturable referent. The 3-chip picture picker that every CVC/digraph tier uses may not transfer.
3. **Distractor axes differ** — CVC traps share rhyme/vowel/onset. Sight-word confusions are visual-shape / high-frequency-neighbour (was/saw, of/off, the/they), a different distractor model.
4. **Recognition mechanic unknown** — is it "tap the word you hear" (audio→word matching, no picture)? "which of these says <word>" (whole-word visual discrimination)? Flash-recognition timing? This is a pedagogy call.

**These are NOT mine to answer.** They are the core of the Dave research AC (Track 1). The research must specify the recognition mechanic BEFORE Kyle/Devon design the render and BEFORE any content dispatch — otherwise we build a decoding UI for a non-decoding skill.

---

## Track-based decomposition

Per `feedback_track_based_wave_decomposition.md` — each track carries an `assignee_recommendation`; tracks dispatch in dependency order. Track 1 (research) **gates everything** — no content dispatch until Dave's citation is committed to `design/research/` (dispatch-template Pedagogy gate; `skill-trees-and-content.md` § "Authoring rule going forward": research committed before/with the spec that cites it).

### Track 1 — Pedagogy research (BLOCKS all content) → **Dave**

Dave answers: which sight words, what sequence + dosage for Marian, AND the recognition-mechanic question above. Output: a committed `design/research/sight-words-sequence-marian.md` with citations. Single ticket; ACs pinned in the ticket.

### Track 2 — Content authoring (planner + word lists + canon) → **Kevin**

Depends on Track 1 merged. Word lists (`_plannerWordList.ts`), the `WORD_SONG_TRACK_GUIDE` directive block (tree-order insert), `wordPack.ts` entries per Dave's render decision, the 3 missing sibling-tier points (#14 first-class, #15 bake list — both in the 3-place sync contract — plus #16 debug seed), and the canon bake. Backend/planner/lint is Kevin's lane.

### Track 3 — Render treatment (WordSong UI for whatever mechanic Dave specifies) → **Devon**

Depends on Track 1 (mechanic decision) and coordinates with Track 2 on `wordPack` shape. If Dave's mechanic differs from the picture-grounded CVC picker (likely), Devon owns the WordSong render divergence — new content-type discriminant, possibly a no-picture or word-discrimination chip mode. Heavy UI/visual-treatment work is Devon's lane. **If the mechanic == the existing picker** (Dave may rule picture-pairing fine for concrete sight words), Track 3 collapses into Track 2 and Devon is not needed — decided after research.

### Track 4 — E2E + regression spec (failing-first) → **Jessica**

Writes the failing Done-when test BEFORE Kevin/Devon dispatch (the test is the spec). Progression-mastery e2e + content-tier round-trip + the negative-membership / trivially-green traps (`testing-and-ci.md` §4.1.1d/e — avoid `failNetwork` + negative assertions; use positive request-body discriminators). Per `feedback_progression_e2e_mandatory.md` + `feedback_jessica_first_for_objective_gates.md`.

---

## Recommended dispatch order

1. **Track 1 (Dave research)** — solo, gates everything. Nothing else dispatches until the research doc is committed.
2. **Track 4 (Jessica failing-first spec)** — can start as soon as Track 1 lands and the mechanic + word set are known (the spec encodes the mechanic). Dispatch alongside / just before Track 2.
3. **Track 2 (Kevin content)** — after Track 1 merged + Jessica's failing test exists. Carries the 3 missing sibling-tier points + 6-surface content.
4. **Track 3 (Devon render)** — only if Dave's mechanic diverges from the CVC picker; coordinate `wordPack` shape with Kevin (Track 2). If divergent, sequence the shared-`WordEntry`/content-type vocabulary per the parallel-shared-concept rule (name the content-type discriminant explicitly in both briefs, or sequence Track 2's wordPack shape first).

Gate cadence: research-gated (Thomas/Dave) at Track 1; CI-gated thereafter, so Tracks 2-4 can run at normal parallel density once the research lands.

---

## Tickets (filed in ClickUp list `901523003843`)

| Track | Ticket ID    | Title                                                            | Assignee | Contract                                                  |
| ----- | ------------ | --------------------------------------------------------------- | -------- | -------------------------------------------------------- |
| 1     | `86ca7xmkd`  | W11-01 Research: sequence + dosage + recognition mechanic       | Dave     | Pinned ACs (research deliverable)                        |
| 2     | `86ca7xmr8`  | W11-02 Content: 6-surface + 3 sibling points + canon bake       | Kevin    | Full dispatch contract                                   |
| 3     | `86ca7xmvz`  | W11-03 Render: WordSong sight-words recognition treatment       | Devon    | Full dispatch contract (CONDITIONAL on Track 1 mechanic) |
| 4     | `86ca7xmn5`  | W11-04 E2E: failing-first progression + content spec            | Jessica  | Done-when test contract                                  |

Dependency chain: W11-01 (research) blocks W11-02, W11-03, W11-04. W11-04 (failing test) precedes W11-02/W11-03 dispatch. W11-03 is conditional — collapses into W11-02 if Dave rules the existing picture-picker transfers. Full scoped contracts live in each ticket description.
