# Wave 13 — `simple-sentences` content tier

**Status:** plan — pre-dispatch
**Date drafted:** 2026-06-12
**Author:** Matt (planning role; orchestrator dispatches)
**Branch:** `matt/wave-13-plan` (base `main` @ `e1ada4a`)

## Sponsor decision (recorded)

| Field        | Value                                                                                                                                                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decider**  | Thomas (Sponsor / Product Owner)                                                                                                                                                                                                                              |
| **Date**     | 2026-06-12                                                                                                                                                                                                                                                    |
| **Decision** | Wave 13 = **`simple-sentences` content tier** — the final Word Song content frontier.                                                                                                                                                                        |
| **Context**  | Picked in tonight's sponsor walkthrough over two alternates: stop-for-now impl (`86ca7urx1`, spec merged #381) and M4.x slow-fact analysis (unblocked by the #406 latency re-anchor). Both Wave 11 + Wave 12 retros listed `simple-sentences` as a standing candidate. |

Wave-direction selection is a strategic-priority call (never-auto-decide). It was Thomas's to make; he made it. This plan decomposes it.

---

## TL;DR — this is the LAST genuine net-new Word Song content build

`simple-sentences` is the **only remaining valid-but-untuned word-song tier** — verified against `main` @ `e1ada4a`:

- The planner's `effectiveFocusNode` (`api/_planner.ts:798`) demotes it to `blending-cv` stub content; its own comment names it "the sole remaining valid-but-unsupported node" (`_planner.ts:789`).
- `api/_planner.test.ts:1418` pins it as "the LAST" stub-fallback tier in the routing sweep.
- No canon JSON: `git ls-files public/canon/word-song/level-1/` returns 13 files; **no `simple-sentences.json`** (sight-words.json shipped Wave 11; simple-sentences did not).

After this wave, **every** Word Song node is first-class. This is a full content-tier build: a Dave research gate, then the 6-surface content contract, then the 3 still-missing sibling-tier widening points, all paired with Jessica failing-first e2e.

**Derivation basis is NOT uniform — state it per content class (Wave 12 retro lesson).** Wave 12's "88->264" flat-count framing hid that only 6/11 math tiers had deterministic hint derivation; the generic 5 needed fresh pedagogy mid-wave. The Wave 13 analogue: the **clip count is ~59 (same as every word-song tier), but the content is structurally NEW** — sentences, not single words. Do not let the familiar 59-clip arithmetic imply a mechanical bake of the sight-words shape. The sentence-construction mechanic, the read-line template, and the distractor model are all net-new design surfaces routed into Dave's research AC (Track 1) — not assumed here. See section "Per-content-class derivation basis" below.

---

## Ground truth — verified, not assumed

Every "exists / doesn't exist" claim below carries a `git grep` / `git ls-files` / file-read citation run against `main` @ `e1ada4a`.

### Zero simple-sentences content files

```
$ git ls-files public/canon/word-song/level-1/
... 13 files: blending-cv, cvc-words, cvc-words-short-{o,u,i,e},
    digraphs-{sh,ch,th-voiceless}, letter-names, letter-sounds,
    letter-sounds-audit, sight-words
    (NO simple-sentences.json)
$ git ls-files | grep -i "simple.sentence" — only infra/test refs, no content files
```

- **No canon:** confirmed above.
- **No research:** `design/research/` has no `simple-sentences-*` file. (Adjacent: `sight-words-sequence-marian.md` carries the deferral rulings INTO this tier — see section "Inherited deferrals from Wave 11".)
- **No word-list spec:** `design/word-song/` has per-tier specs for every CVC + digraph tier and (Wave 11) sight-words; **none** for simple-sentences.
- **No e2e:** no `e2e/*simple-sentence*.spec.ts`. The `progression-mastery-loop.spec.ts` / `slidingWindow.test.ts` references are generic tree-walk seeds that *name* `simple-sentences` as the terminal downstream node, not content tests.

### The `simple-sentences` literal DOES exist in the progress + infra layer

`git grep -n "simple-sentences"` confirms the literal is wired into the curriculum graph and read-path — it is the **terminal** node of `WORD_SONG_NODES_IN_ORDER`:

| Surface                                       | Site (verified)                                                       |
| --------------------------------------------- | --------------------------------------------------------------------- |
| `WordSongNode` union                          | `src/lib/progress/types.ts:83`                                       |
| `WORD_SONG_NODES_IN_ORDER`                    | `src/lib/progress/focusNode.ts:102` (terminal)                       |
| `LITERACY_TREE`                               | `src/lib/progress/mastery.ts:174` (terminal; `nextNode -> null`, `mastery.test.ts:154`) |
| `SKILL_NODES` guard set                       | `src/lib/progress/guards.ts:58`                                      |
| `SCHEMA_FLOOR_NODES` + `DEFAULT_SKILL_LEVELS` | `src/lib/progress/defaults.ts:120` (floor), `:221` (`'locked'`)      |
| Hub stage id union + `WORD_SONG_STAGES`       | `src/screens/Hub/stages.ts:46,83`                                    |
| `STAGE_LABEL` glyph                           | `src/screens/Hub/stageIcons.tsx:185` (`'I'`)                          |
| `WORD_SONG_LABELS` caption                    | `src/screens/Hub/progressProjection.ts:122` (`'simple sentences'`)   |
| e2e `wordSongNodesInOrder.ts` shim            | `e2e/_helpers/wordSongNodesInOrder.ts:85`                            |
| e2e `seedStorage.ts DEFAULT_SKILL_LEVELS`     | `e2e/_helpers/seedStorage.ts:146` (`'locked'`)                      |
| `VALID_WORD_SONG_FOCUS_NODES`                 | `api/_planner.ts:172`                                                |

So this is a stub tier (infrastructure present, content absent) — net-new content build, **NOT** already shipped. A plan that filed "build the simple-sentences SkillNode infrastructure" tickets would be re-building merged work; a plan that filed "build the simple-sentences content" tickets is real, un-shipped work.

---

## Inherited deferrals from Wave 11 — this is the receiving tier

The Wave 11 sight-words research (`design/research/sight-words-sequence-marian.md`, Dave, W11-01) explicitly deferred work **INTO** this tier. These are not new scope decisions — they are commitments already made, and Track 1's research must honour them:

1. **Carrier-sentence scaffolding deferred here.** Wave 11 retro (`retro-2026-06-12-wave-11-sight-words.md`, Sponsor decisions row 3): *"Uniform read line 'Find the word: <word>.' — Dave (PROCEED-UNIFORM) — Carrier-sentence scaffolding explicitly deferred to the simple-sentences tier."* Sight-words shipped a bare-word recognition line; the carrier sentence ("The cat is here. Find: the.") was punted to simple-sentences. **Wave 13 is where the carrier sentence becomes first-class** — sentences ARE the content, not scaffolding around a single word.

2. **Confusable function words deferred here** (`sight-words-sequence-marian.md:75-76`):
   - *"the / they / then / there (introduce 'the' first; others only in simple-sentences tier)"*
   - *"where / were (defer entirely to simple-sentences)"*
   So `they, then, there, where, were` are Wave 13's inherited vocabulary — held back from sight-words precisely because they need sentence context to disambiguate.

3. **Literacy Leitner box — still a SEPARATE downstream design, NOT this wave** (`sight-words-sequence-marian.md:200-205`, reaffirmed Wave 11 plan section "NOT to touch"). If Dave's Wave 13 research recommends spaced repetition for sentence-level reading, that remains a separate ticket. Do NOT build literacy Leitner in Wave 13. Flag-only.

**The L2 framing carries forward.** Marian is Tagalog-primary; Tagalog has no articles and distributes grammatical weight differently (`sight-words-sequence-marian.md:53-54`). Simple sentences are where English word-order and function-word glue get exercised in context. The audio-first, no-speed-feedback, no-streak-shame policy is locked across all tiers and applies here verbatim.

---

## The sentence-construction render question (route to Dave + Kyle, do NOT answer here)

Every shipped Word Song tier operates on a **single target token** — a CVC word, a digraph word, or a sight word — with a 3-chip picker. The read-line template discriminates the content type (verified in `planFromServer.test.ts`):

- `"Tap the <word>."` -> `contentType: 'blending-cv'` (picture chips)
- `"Read the <word>."` -> `contentType: 'cvc-word'` (picture chips, decoding beat)
- `"Find the word: <word>."` -> `contentType: 'sight-word'` (written-word chips, NO picture, NO decoding beat — Wave 11)

Simple sentences break the single-token model. The core unknowns — **all pedagogy/design calls, NOT mine to answer**:

1. **What is the task?** Candidate mechanics, none assumed:
   - **(a) Sentence completion** — Emma reads "The cat is ___", Marian taps the missing word from 3 chips. (Closest to sight-words; reuses written-word chips.)
   - **(b) Sentence ordering** — scrambled word chips, Marian taps them in order to build the sentence. (New mechanic; new render.)
   - **(c) Read-and-match** — Emma reads a sentence, Marian taps the matching picture/scene from 3 options. (Reintroduces pictures at the SENTENCE level, not word level.)
   - **(d) Tap-the-word-you-hear within a sentence** — comprehension probe.
   These are materially different render surfaces. Dave's research picks ONE (or a gentle/trap split across two) BEFORE Kyle specs and BEFORE any content dispatch.

2. **Read-line template + content-type discriminant.** Whatever mechanic Dave picks, it needs a NEW read-line template (e.g. `"Finish the sentence: The cat is ___."` or `"Build: the cat sat."`) and a NEW `WordSongContentType` value (`'simple-sentence'`). Per the planner-parser contract, the **browser parser widens FIRST** (Pattern A) — `planFromServer.ts` must accept the new template before the planner emits it.

3. **Distractor / foil model.** Sentence-completion foils are grammatical/semantic (wrong part of speech, wrong meaning), not phonics-rhyme or visual-shape. New distractor axis — pedagogy-gated.

4. **Sentence pool + length/vocabulary constraints.** Sentences must be built from **taught vocabulary only**: the CVC pool + sight-words pool + Emma's ~200-word cap (`CLAUDE.md` design principles). Sentence length (3-5 words?), syntactic complexity, and which sentences — all Track 1.

5. **Picture role.** Sight-words removed pictures entirely. Simple sentences MAY reintroduce a scene illustration for comprehension (Dave's Wave 11 note allowed "a small scene illustration may accompany the carrier sentence for contextual comprehension"). Whether sentences get scene art is a Kyle asset question gated on Dave's mechanic.

**These are NOT mine to answer.** They are the core of the Dave research AC (Track 1) + Kyle spec (Track 1b). The research must specify the mechanic + sentence pool + constraints BEFORE Kyle designs the render and BEFORE any content dispatch — otherwise we build the wrong UI for the skill (the exact trap Wave 11's pedagogy-locked-before-mechanics sequencing avoided).

---

## Per-content-class derivation basis (Wave 12 retro lesson — state it explicitly)

| Content class                  | Clip basis                                                    | Derivation                                                                                      | Risk                                                                                            |
| ------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Problem clips (8 x 5 = 40)     | NEW sentences — Emma reads a full sentence per problem        | **Non-deterministic** — depends on Dave's mechanic + sentence pool; Haiku composes the read line | HIGH. Unlike a single-word read ("Read the cat."), a sentence read is novel prosody every time. Whatever mechanic Dave picks, the read-line is multi-word and the bake is NOT a mechanical clone of any prior tier. |
| Session-end clips (19)         | Recap/streak/goodbye family — SAME shape as every tier        | **Deterministic** — reuses the established session-end utterance contract                       | LOW. Byte-preservable if the planner emits identical session-end text (it should).             |

**Net new clips: ~59** (same as every word-song tier), but ~40 carry genuinely new sentence-level content. The session-end 19 are mechanically familiar. **Do not frame Wave 13 as "just another 59-clip word-song bake"** — the problem-clip half is a new content class. This row table IS the derivation-basis statement the Wave 12 retro asked future plans to carry.

---

## Sibling-tier widening audit — which of the 16 are done vs missing

Per sibling-tier-checklist.md. Because the SkillNode literal already landed (it is the terminal tree node), the infra points are mostly done; only the content-ship points remain. Each row carries the citation that proves its state (verified @ e1ada4a).

| # | Point (file / symbol) | State | Citation |
| --- | --- | --- | --- |
| 1 | types.ts WordSongNode union | DONE | types.ts:83 |
| 2 | focusNode.ts WORD_SONG_NODES_IN_ORDER | DONE (terminal) | focusNode.ts:102 |
| 3 | mastery.ts LITERACY_TREE | DONE (terminal) | mastery.ts:174 (nextNode -> null; mastery.test.ts:154) |
| 4 | guards.ts SKILL_NODES | DONE | guards.ts:58 |
| 5 | defaults.ts SCHEMA_FLOOR_NODES | DONE | defaults.ts:120 |
| 6 | defaults.ts DEFAULT_SKILL_LEVELS | DONE (locked) | defaults.ts:221 |
| 7 | Hub/stages.ts WordSongStageId union | DONE | stages.ts:46 |
| 8 | Hub/stages.ts WORD_SONG_STAGES | DONE | stages.ts:83 |
| 9 | Hub/stageIcons.tsx STAGE_LABEL | DONE (glyph I) | stageIcons.tsx:185 |
| 10 | Hub/progressProjection.ts WORD_SONG_LABELS | DONE (caption set) | progressProjection.ts:122 |
| 11 | e2e/_helpers/wordSongNodesInOrder.ts shim | DONE | wordSongNodesInOrder.ts:85 |
| 12 | e2e/_helpers/seedStorage.ts DEFAULT_SKILL_LEVELS | DONE (locked) | seedStorage.ts:146 |
| 13 | api/_planner.ts VALID_WORD_SONG_FOCUS_NODES | DONE | _planner.ts:172 |
| 14 | api/_planner.ts WORD_SONG_FIRST_CLASS_FOCUS_NODES | MISSING | absent at _planner.ts:759-781 (stops at sight-words) |
| 15 | scripts/generateSessionCanon.ts WORD_SONG_FOCUS_NODES | MISSING | absent from bake list (generateSessionCanon.ts:290 names the omit) |
| 16 | src/lib/debug/debugSeed.ts SEEDS table | MISSING | no simple-sentences key (debugSeed.ts:506-507 names locked downstream) |

**Net: 13 of 16 done, 3 missing — all three are the content-ship surfaces** (#14 first-class planner, #15 canon bake list, #16 debug seed). Same stub-tier fingerprint Wave 11 had. All three land in the content-ship PR (Track 2). #14 + #15 are 2 of the **3-place sync contract** (planner-and-canon.md, Focus-node taxonomy): WORD_SONG_FIRST_CLASS_FOCUS_NODES + generateSessionCanon.ts activeCombos() + the combo-count assertion in generateSessionCanon.test.ts MUST move together in one PR.

### NOT in the 16 — but required for content (per checklist does-not-cover)

- **WORD_SONG_TRACK_GUIDE directive block** (api/_planner.ts) — per-tier Haiku directive. Insert in tree order AFTER the sight-words block (simple-sentences is terminal). Where the sentence-construction mechanic becomes a prompt-authoring problem.
- **Sentence pool / word lists** — new const in api/_plannerWordList.ts (e.g. WORD_SONG_SIMPLE_SENTENCES). Taught vocabulary only (CVC + sight-words pools + ~200-word cap).
- **wordPack.ts / content-type entries** — depends on Dave mechanic. Sight-words written-word treatment (WordEntry/sightWord precedent) extends if completion; new shape if ordering/scene-match. Route to Dave/Kyle.
- **Browser parser widening** (src/screens/WordSong/planFromServer.ts) — new read-line template -> new WordSongContentType value. Widen FIRST (Pattern A).
- **WordSong render** (src/screens/WordSong/WordSong.tsx) — render branch for the new content type. Closest precedent: Wave 11 sight-words written-word-chip branch (PR #390) — reuse if completion; diverge if ordering/scene-match.
- **Canon JSON** — public/canon/word-song/level-1/simple-sentences.json, baked once #15 lands.
- **e2e spec** — e2e/simple-sentences-content.spec.ts + progression spec (Jessica, failing-first).

### NOT to touch (explicit per checklist + progress doc)

- **WORD_SONG_GRADUATION_GATED_NODES** stays cvc-words only (mastery.ts). Simple-sentences is a reading-application tier, not a decoding-acquisition gate — no novel-pool probe.
- **No literacy Leitner box.** Reserved for math facts only. If Dave recommends spaced sentence review, that is a SEPARATE downstream design ticket — OUT of scope for this wave (flagged, not built). Same posture as Wave 11.
- **K2 read-path remap** — not needed; ADDING content to an existing literal, not renaming/removing one.

---

## Six-surface coverage (explicit — the silent-demote trap)

Known failure mode (skill-trees-and-content.md + Wave 11 retro): canon + planner-first-class ALONE silently demotes the tier to a blending-cv stub via the render/parser path. All six surfaces must ship:

| # | Surface | What lands | Track |
| --- | --- | --- | --- |
| 1 | canon | public/canon/word-song/level-1/simple-sentences.json (baked after #15) | 2 (Kevin) |
| 2 | planner-first-class | WORD_SONG_FIRST_CLASS_FOCUS_NODES (#14) + WORD_SONG_TRACK_GUIDE directive + sentence list | 2 (Kevin) |
| 3 | browser-parser | planFromServer.ts new read-line template -> new WordSongContentType — widen FIRST (Pattern A) | 2/3 |
| 4 | WordSong-render | WordSong.tsx render branch for the new content type | 3 (Devon) |
| 5 | E2E | content round-trip + progression spec (failing-first) | 4 (Jessica) |
| 6 | lint | generateSessionCanon.ts WORD_SONG_FOCUS_NODES (#15) + combo-count assertion in generateSessionCanon.test.ts (3-place sync contract) | 2 (Kevin) |

**Planner-parser contract (Pattern A) is load-bearing here.** Surface 3 (parser) MUST widen BEFORE surface 2 (planner emits the new template). If the planner emits a sentence read line the parser does not accept, wordSongSessionPlanFromServer throws, the screen falls to static stub, and the result is silent wrong-tier render. Sequence the parser-widening commit ahead of the canon-emitting one (or land in one PR, parser change ordered first and tested). Same precedent as the Wave 11 W11-02 scope amendment.

---

## Canon re-bake sizing + voice-QA impact

**Sizing reference (measured @ e1ada4a):** sight-words.json = 1,085,674 bytes (~1.06 MB), 59 utterances (40 problem + 19 session-end). Simple-sentences is the same shape: ~59 new clips, ~1.0-1.1 MB committed JSON. Sentence reads run slightly longer than single-word reads (more audio per clip), so budget up to ~1.2 MB. Well under the 8 MiB workbox per-file cache cap (reference_pwa_asset_size_limits.md) — no vite.config.ts maximumFileSizeToCacheInBytes change needed.

**Voice-QA impact — ~59 NEW ear-test items.** Per project_voice_qa_system.md, every new clip is a new hash-keyed needs-retest item on voice-qa.html. Simple-sentences adds ~59 items to Thomas ear-test queue. **Sentence prosody is the highest-risk audio class yet** — Olivia (en-GB) reading a full sentence has more room for unnatural intonation than a single word; flag this for Thomas attention. Fails route to Kevin; 2+ rejections on one clip -> audition-page pattern (feedback_audio_audition_page_pattern.md).

**Byte-preservation discipline.** This is a NET-NEW tier (new file), so there are no existing clips to preserve within simple-sentences.json. BUT the bake must not churn the other 13 canon files. Use the targeted/single-file bake path (single new combo via npm run canon:generate --require-keys, OR scoped npm run canon:regen) — do NOT run a full all-tier re-bake that would re-render and byte-churn the 13 Thomas-approved tiers and flip them ALL back to needs-retest on voice-qa.html. Verify with git status --short public/canon/ showing ONLY simple-sentences.json added, no other canon file modified, BEFORE opening the content PR.

**Merge-first-on-byte-proof pattern (Thomas has now used this twice — Wave 12 #413, and the British-voice rollout).** Because the 13 existing tiers stay byte-untouched (only a new file is added), the established move applies: merge the content PR on a git status byte-proof (only simple-sentences.json new, no existing canon modified), then ear-test the ~59 new clips on production voice-qa.html where the verdict history lives, fails fix-forward. Avoids the per-origin-localStorage-blank-preview problem (Wave 12 retro: an ear-gate can move post-merge when byte-safety is proven). Recommend as the default for Wave 13 canon merge. Tooling: scripts/verifyThreeHintBytePreservation.ts is hint-specific; for a new-file tier the proof is simply the scoped git status — no special script needed.

---

## Track-based decomposition

Per feedback_track_based_wave_decomposition.md — each track carries an assignee_recommendation; tracks dispatch in dependency order. Track 1 (research) gates everything — no content dispatch until Dave citation is committed to design/research/ (dispatch-template Pedagogy gate; skill-trees-and-content.md authoring rule: research committed before/with the spec that cites it).

### Track 1 — Pedagogy research (BLOCKS all content) -> Dave
assignee_recommendation: dave

Dave answers: the sentence-construction mechanic (the four candidates above), the sentence pool (taught CVC + sight-words vocabulary + ~200-word cap), length/syntax constraints for a 7-9yo emerging L2 reader, distractor/foil design (grammatical/semantic, not phonics), the picture role (scene illustration yes/no), and dosage/sequence. Must honour the inherited Wave 11 deferrals (carrier sentences first-class here; they/then/there/where/were vocabulary; literacy-Leitner stays a separate downstream ticket). Output: a committed design/research/simple-sentences-sequence-marian.md with citations. Single ticket; ACs pinned in the ticket.

### Track 1b — Design spec (mechanic -> render contract) -> Kyle
assignee_recommendation: kyle

Depends on Track 1 mechanic ruling. Kyle authors design/word-song/simple-sentences-content.md: the read-line template, the new WordSongContentType value name, the chip/scene layout, the gentle/trap split, and (if scene art) the asset spec. Vocabulary-contract: Kyle NAMES the content-type discriminant string + read-line template verbatim so Kevin (parser/planner) and Devon (render) consume identical vocabulary (parallel-shared-concept rule). Do NOT clone the sight-words spec — the sentence mechanic is different enough to need its own.

### Track 2 — Content authoring (parser + planner + word lists + canon) -> Kevin
assignee_recommendation: kevin

Depends on Track 1 + Track 1b merged. Parser widening FIRST (Pattern A) — planFromServer.ts accepts the new read-line template before the planner emits it. Then: sentence pool (_plannerWordList.ts), the WORD_SONG_TRACK_GUIDE directive block (tree-order insert after sight-words), the 3 missing sibling-tier points (#14 first-class + #15 bake list — the 3-place sync contract — plus #16 debug seed), and the scoped canon bake (byte-proof: only the new file added). Backend/planner/lint is Kevin lane.

### Track 3 — Render treatment (WordSong UI for Dave mechanic) -> Devon
assignee_recommendation: devon

Depends on Track 1 (mechanic) + Track 1b (spec) + coordinates with Track 2 on content-type/WordEntry shape. Devon owns the WordSong.tsx render branch. Closest precedent: the Wave 11 sight-words written-word-chip branch (PR #390) — reuse if mechanic is sentence-completion (written-word chips, no picture, no decoding beat); diverge if ordering/scene-match (new chip interaction or scene-picker). Heavy UI/visual work is Devon lane. CONDITIONAL collapse: if Dave rules the mechanic == the sight-words written-word picker with only a longer read line, Track 3 collapses into Track 2 and Devon is not needed — decided after research.

### Track 4 — E2E + regression spec (failing-first) -> Jessica
assignee_recommendation: jessica

Writes the failing Done-when test BEFORE Kevin/Devon dispatch (the test is the spec). Progression-mastery e2e (simple-sentences is terminal — assert promotion to mastered with NO downstream unlock, nextNode -> null) + content-tier round-trip + the negative-membership / trivially-green traps (testing-and-ci.md 4.1.1d/e — avoid failNetwork + negative assertions; use positive request-body discriminators; the silent-demote-to-blending-cv fallback is the trap to guard against). Per feedback_progression_e2e_mandatory.md + feedback_jessica_first_for_objective_gates.md. Sizing: terminal-tier progression walk is multi-session — call test.setTimeout(sessions x ~50s + 30s headroom) per testing-and-ci.md 4.1.1b.

---

## Recommended dispatch order

1. **Track 1 (Dave research)** — solo, gates everything. Nothing else dispatches until the research doc is committed.
2. **Track 1b (Kyle spec)** — immediately after Track 1 mechanic ruling lands; read-only against shared state, can run alongside Jessica spec scaffolding.
3. **Track 4 (Jessica failing-first spec)** — as soon as the mechanic + read-line template + sentence set are known (the spec encodes the mechanic). Dispatch alongside / just before Track 2.
4. **Track 2 (Kevin content)** — after Track 1 + 1b merged + Jessica failing test exists. Parser-widening FIRST within the track. Carries the 3 missing sibling-tier points + 6-surface content + scoped byte-proof bake.
5. **Track 3 (Devon render)** — only if Dave mechanic diverges from the sight-words written-word picker; coordinate content-type/WordEntry vocabulary with Kevin (Track 2) via Kyle named-vocabulary contract (Track 1b). If divergent, sequence the shared content-type discriminant per the parallel-shared-concept rule (name it explicitly in both briefs, or sequence Track 2 shape first — Pattern A).

Gate cadence: research-gated (Thomas/Dave) at Track 1; spec-gated (Kyle, possibly a Thomas subjective-render check) at Track 1b; CI-gated thereafter, so Tracks 2-4 run at normal parallel density once research + spec land. Canon merge: byte-proof merge-first, ear-test post-merge on production voice-qa.html (recommended default).

---

## Open questions for Thomas (walkthrough-ready — recommended defaults)

| # | Question | Recommended default |
| --- | --- | --- |
| Q1 | Sentence mechanic — completion (tap missing word) / ordering (build from scrambled chips) / read-and-match (tap matching scene) / hear-the-word? | Defer to Dave Track 1 research, then ratify. Non-binding lean: sentence-completion (option a) — reuses the sight-words written-word-chip render (lowest new-build cost, collapses Track 3), and Dave Wave 11 carrier-sentence framing already points that way. Pedagogy call — Dave owns it. |
| Q2 | Scene illustration? Reintroduce pictures at the sentence level for comprehension, or stay text-only like sight-words? | Text-only for v1 unless Dave research says scene art is load-bearing for L2 comprehension. Adds a Kyle asset-pack ticket + render work if yes. Lean-out to protect the timeline; let Dave veto. |
| Q3 | Sentence length cap — 3 words, 3-4, or up to 5? | 3-4 words for v1 (e.g. The cat sat. / I can see the dog.). Emerging L2 reader + working-memory + August deadline argue short. Dave confirms the ceiling. |
| Q4 | Vocabulary source — strictly taught CVC + sight-words pool, or allow a few new high-frequency words? | Strictly taught vocabulary + the inherited Wave 11 deferred words (they/then/there/where/were). No net-new vocabulary in Wave 13 — sentences exercise APPLICATION of known words, not new word acquisition. |
| Q5 | Canon merge gate — pre-merge preview ear-test, or byte-proof merge-first + post-merge ear-test on production? | Byte-proof merge-first + post-merge ear-test (the pattern you used twice). New file = 13 existing tiers byte-untouched; production voice-qa.html holds your verdict history; preview origins show blank. |
| Q6 | Track 3 (Devon render) — pre-authorise conditional dispatch? If Dave rules the sight-words picker transfers, Track 3 collapses into Track 2. | Pre-authorise: dispatch Devon only if Dave mechanic diverges from the sight-words written-word picker. Saves a round-trip; the collapse condition is mechanical. |
| Q7 | This is the LAST Word Song tier. After Wave 13, every literacy node is first-class. Wave 14 literacy direction, or shift to math (M4.x slow-fact) / polish / stop-for-now? | No decision needed now — flagging for awareness. Recommend banking the all-Word-Song-tiers-shipped milestone and re-opening the Wave 14 direction question after Wave 13 lands. |

---

## Tickets (to be filed in ClickUp list 901523003843 after sponsor go)

| Track | Title | Assignee | Contract |
| --- | --- | --- | --- |
| 1 | W13-01 Research: sentence mechanic + pool + constraints + distractors | Dave | Pinned ACs (research deliverable) |
| 1b | W13-02 Spec: WordSong simple-sentences render contract | Kyle | Full dispatch contract (CONDITIONAL on Track 1 mechanic) |
| 2 | W13-03 Content: 6-surface + 3 sibling points + scoped canon bake | Kevin | Full dispatch contract |
| 3 | W13-04 Render: WordSong simple-sentences treatment | Devon | Full dispatch contract (CONDITIONAL — collapses if picker transfers) |
| 4 | W13-05 E2E: failing-first terminal-tier progression + content spec | Jessica | Done-when test contract |

Dependency chain: W13-01 (research) blocks W13-02, W13-03, W13-04, W13-05. W13-02 (spec) blocks W13-03/W13-04. W13-05 (failing test) precedes W13-03/W13-04 dispatch. W13-04 is conditional — collapses into W13-03 if Dave rules the sight-words picker transfers. Full scoped contracts live in each ticket description (filed post-go).

The wave-anchor ticket (W13) is filed at plan-PR-open time and links this PR; per-track tickets are filed after Thomas go.
