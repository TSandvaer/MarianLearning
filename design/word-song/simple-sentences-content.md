# Word Song — `simple-sentences` render contract + scene asset spec

**Ticket:** 86ca8cujn — W13-02
**Status:** Draft for Devon (render) + Kevin (parser/planner) consumption; Thomas open-questions in §7.
**Author:** Marian Tutor design persona.
**Gating research:** `design/research/simple-sentences-sequence-marian.md` (Dave, W13-01, ticket 86ca8cpe6 — PROCEED-SENTENCE-COMPLETION). This spec implements that ruling; it does not re-open it.
**Wave plan:** `design/wave-13-simple-sentences-plan.md` (Track 1b).
**Precedent transferred:** Wave 11 sight-words written-word-chip render (PR #390) — see §2 for what transfers vs. what is net-new.

This is the LAST Word Song content tier. `simple-sentences` is the terminal node of `WORD_SONG_NODES_IN_ORDER` (`nextNode → null`). After this wave every literacy node is first-class.

---

## Goal

Marian reads a 3–4 word sentence with one word gapped, hears Emma read it aloud, and taps the written-word chip that correctly fills the gap — building syntactic-slot prediction (the cloze skill Dave's E1/E9 identify as the most targeted drill for sentence-level reading).

## User state entering this screen

Marian arrives from Hub (word-song tile) into `route === 'literacy'` with `focusNode === 'simple-sentences'`. She has mastered the CVC + digraph decoding tiers and the 20-word sight-words tier (Wave 11). Every word in every sentence is already taught — this tier exercises _application_, not new-word acquisition. The screen is one of an 8-problem session mixed into a ~15-min flow; this is not her first reading screen of the day.

---

## 1. Vocabulary contract (NAME-verbatim — Kevin + Devon consume identically)

Per the parallel-shared-concept rule (user-global `CLAUDE.md`): the parser author (Kevin), the planner directive (Kevin), and the render branch (Devon) MUST use these exact identifiers. Do not paraphrase, re-case, or re-derive.

| Concept                                      | Verbatim value                                                             | Notes                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`WordSongContentType` value**              | `'simple-sentence'`                                                        | New member added to the union in `src/screens/WordSong/wordSessionPlans.ts` (`WordSongContentType`). Singular, hyphenated, matches the `cvc-word` / `sight-word` casing precedent.                                                                                                                                                         |
| **Read-line template (parser discriminant)** | `"Finish the sentence: <sentence>."`                                       | `<sentence>` is the full sentence **with the gap word replaced by the literal gap token** (below). The verb phrase `Finish the sentence:` is the discriminant — distinct from `Tap the` / `Read the` / `Find the word:` so template-match order is NOT load-bearing (same property the `sight-word` template has).                         |
| **Gap token (in-template, written form)**    | `___` (exactly three ASCII underscores, U+005F ×3)                         | Appears once inside `<sentence>` at the gap position. The parser locates the gap by this literal. Example read line: `"Finish the sentence: The cat ___ the bag."` On-screen this renders as a styled blank underline (§3.2); the underscores are the data carrier, not the visual.                                                        |
| **Gap token (spoken form)**                  | Emma speaks the word **`blank`** at the gap position                       | Dave §9: one syllable, confirmed within Emma's ~200-word cap. The TTS read line the planner emits substitutes `blank` for the `___` token so Azure renders natural prosody: `"Finish the sentence: The cat blank the mat."` See §4 for the read/display split.                                                                             |
| **Target word (the answer)**                 | The word that fills `___`                                                  | Carried as the problem's `target.word` — a real `wordPack.ts` `WordEntry`, resolved via `getWordEntry` exactly like the `sight-word` and CVC tiers (NOT a synthesized sentinel).                                                                                                                                                           |
| **Sentence-frame field**                     | `WordSongProblem.sentenceFrame?: string` (new optional carrier — see §1.1) | The full sentence with `___` preserved, for display. The chips do NOT carry the frame; only the read line + this field do.                                                                                                                                                                                                                 |
| **Scene-id field**                           | `WordSongProblem.sceneId?: string` (new optional carrier — see §1.3)       | The gentle-phase scene asset key. Planner emits it; parser carries it onto the problem (mirrors `sentenceFrame`); Devon's render looks the asset up via `SCENE_PICTURES[sceneId]`. Filename: `public/assets/scenes/scene-<sceneId>.svg`. Present only on gentle problems (1–3); `undefined` on trap problems and every other content type. |

### 1.1 Where the sentence frame lives — parser carries it, NOT `WordEntry`

The displayed sentence ("The cat \_\_\_ the mat.") is **per-problem**, not per-word — the same target word (`sat`) appears in many different frames. So the frame canNOT live on the shared `WordEntry` (which is per-word and reused across problems). It lives on the **problem**, parsed out of the read line:

- Add an optional field to `WordSongProblem` (`src/screens/WordSong/wordSessionPlans.ts`): **`sentenceFrame?: string`** — the full sentence with the `___` gap token preserved, e.g. `"The cat ___ the bag."`
- The parser (`planFromServer.ts`) extracts it: strip the `Finish the sentence: ` prefix and the trailing `.` from the read line, keep the `___` token in place. The target word is resolved separately (see §1.2).
- `sentenceFrame` is `undefined` for every other content type (back-compat — same posture as `contentType?`). Devon's render branch reads it only when `contentType === 'simple-sentence'`.

This is the one genuinely new wire-carried datum this tier adds. Everything else reuses the existing `WordSongProblem` shape.

### 1.2 Parser obligation — target resolution is NOT the captured gap token

**Critical for Kevin — this tier breaks the "capture the token, look it up" pattern.** Every prior template captures the target token directly from a fixed slot (`"Tap the <word>."` → `<word>` is the target). Here the read line carries `___` at the gap, NOT the answer word — Emma must not say the answer aloud (that would defeat the cloze). So the parser cannot get the target from the read line's gap.

The target word is therefore carried by the **`correct` utterance**, which already names the answer in every tier (`"Yes! Bit."`). The parser resolves the target from the `correct` line's word, not from the `read` line:

- `correct` template for this tier: **`"Yes! <Word>."`** (capitalized target — identical shape to sight-words/CVC `correct`). Parser captures `<Word>`, lowercases, resolves via `getWordEntry`, membership-checks against `TARGET_WORD_SET`.
- The `read` line is parsed only to (a) confirm the `Finish the sentence:` discriminant fires `contentType: 'simple-sentence'`, and (b) extract `sentenceFrame` (the sentence with `___` preserved).
- **Validation invariant:** the read line MUST contain exactly one `___` token. Zero or two+ → throw `PlanFromServerError` (the planner emitted a malformed cloze; better a clean throw than a silent wrong render). Pin this in Kevin's parser unit tests.

This target-from-`correct` resolution is the load-bearing parser divergence. Name it explicitly in the Kevin dispatch brief so it is not missed.

### 1.3 Scene-id ↔ problem coupling — how the render finds its scene asset

The gentle-phase scene illustration (§3.2, §8) is **per-problem** (which scene shows depends on which sentence this problem is), so the render needs the problem to carry its scene key. The shared `WordEntry` cannot hold it (the same target word appears in problems with different scenes), so — exactly like `sentenceFrame` — it lives on `WordSongProblem`:

- **Field (verbatim, Kevin + Devon consume identically):** `WordSongProblem.sceneId?: string`.
- **Planner emission (Kevin):** the planner emits the `sceneId` per gentle problem from `WORD_SONG_SIMPLE_SENTENCES` (each pool sentence carries its stable `sceneId`, e.g. `cat-sat-mat`). Trap problems (4–8) carry NO `sceneId` (`undefined`) — they are text-only by Dave's ruling.
- **How it reaches the render:** the parser sets `problem.sceneId` from the planner's emission, the same way it sets `sentenceFrame`. (If the wire shape cannot carry a non-utterance per-problem field, Kevin derives `sceneId` deterministically from the frame's content words at parse time — but the parser MUST set the field either way so Devon reads ONE name. The emit-vs-derive choice is Kevin's; the field name on `WordSongProblem` is fixed.)
- **Render lookup (Devon):** `SCENE_PICTURES[problem.sceneId]` resolves to `public/assets/scenes/scene-<sceneId>.svg`. A `sceneId` of `undefined` (trap problem) OR a missing registry entry → no scene rendered (graceful text-only fallback, §8.2). So `sceneId` absence is both the trap-phase signal AND the missing-asset fallback — one predicate, no special-casing.

`sceneId` and the §8.2 filename `scene-<sentence-id>.svg` use the SAME identifier: `<sentence-id>` IS `sceneId`. The §8.5 brief table's `scene-id` column is the literal `sceneId` value per row.

---

## 2. What transfers from sight-words, what is new

| Surface                                                  | Transfers from sight-words (PR #390)? | Detail                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Written-word chips**                                   | ✅ TRANSFERS verbatim                 | 3 chips, written text (no picture), `data-testid="word-song-chip-sight-word"` chip shape. Reuse the exact 36px text-glyph chip primitive at `WordSong.tsx` (the `isSightWord` chip branch). Gate it on `contentType === 'simple-sentence'` ALSO (see §3.3). Chip size, border, spring, hit area, shake — all identical. |
| **No word card / no picture meaning-anchor on the chip** | ✅ TRANSFERS                          | The chip is the written word, not a picture. The CVC `word-song-word-card` block stays skipped (extend the existing `contentType !== 'sight-word'` skip-guard to also exclude `'simple-sentence'`).                                                                                                                     |
| **No decoding beat**                                     | ✅ TRANSFERS                          | The 1,500 ms `SILENT_TEXT_WINDOW_MS` is CVC-only and stays OFF here (Dave §7 — the task is syntactic prediction, not phonics). Do NOT widen `isCvcWord` to include `'simple-sentence'` (same explicit warning the sight-word branch carries).                                                                           |
| **Read-aloud fires immediately**                         | ✅ TRANSFERS                          | No held decoding window; Emma reads the gapped sentence as soon as the problem mounts.                                                                                                                                                                                                                                  |
| **3-chip count**                                         | ✅ TRANSFERS                          | Word-song is 3 chips (vs Math's 4). Dave §6 confirms 3 is the working-memory-correct count for an 8yo processing a sentence frame (E8).                                                                                                                                                                                 |
| **The gapped-sentence DISPLAY**                          | ❌ NET-NEW                            | The sentence frame with a styled blank renders as a **prominent sentence panel** above the chip row — this is the new component (§3.2). Sight-words had only the caption ribbon + chips.                                                                                                                                |
| **Scene illustration (gentle phase)**                    | ❌ NET-NEW                            | A scene illustration accompanies problems 1–3 (Dave §"Picture role"). New asset class (§5). Sight-words was text-only.                                                                                                                                                                                                  |
| **Sentence-frame wire field**                            | ❌ NET-NEW                            | `WordSongProblem.sentenceFrame` (§1.1).                                                                                                                                                                                                                                                                                 |
| **Target-from-`correct` parser resolution**              | ❌ NET-NEW                            | §1.2 — the read line gaps the answer, so the target comes from `correct`, not `read`.                                                                                                                                                                                                                                   |

**Track-3 collapse signal:** the render delta over sight-words is (a) the sentence-frame panel, (b) the gentle-phase scene illustration. If Thomas defers scenes (Q2), the only net-new render is the sentence panel — small enough that Track 3 may collapse into Track 2 per the wave plan's conditional. With scenes IN (the sponsor decision), Track 3 stands (scene placement + phase-gated visibility is real Devon work).

---

## 3. Visual layout

Portrait iPad, thumb-safe. The sentence panel is the new reading surface; chips stay in the existing thumb zone.

### 3.1 Wireframe (gentle phase, problems 1–3 — scene present)

```
┌─────────────────────────────────────────┐  ← safe-area top (44pt inset)
│  [Emma idle, upper-left ~30vh]   [HUD]   │     HUD = stardust + streak (unchanged)
│                                          │
│        ┌──────────────────────┐          │
│        │                      │          │  ← SCENE illustration (gentle only)
│        │   scene: cat on mat  │          │     280×210pt, centered, above sentence
│        │                      │          │
│        └──────────────────────┘          │
│                                          │
│     ╔══════════════════════════════╗     │  ← SENTENCE PANEL (net-new)
│     ║   The  cat  _____  the  mat. ║     │     gap = styled blank underline
│     ╚══════════════════════════════╝     │     words reveal w/ Emma's read
│                                          │
│      ┌──────┐  ┌──────┐  ┌──────┐        │  ← 3 written-word chips
│      │ sat  │  │ cat  │  │ the  │        │     96pt min, thumb-reachable
│      └──────┘  └──────┘  └──────┘        │
│                                          │
└─────────────────────────────────────────┘  ← safe-area bottom (34pt inset)
```

### 3.1b Wireframe (trap phase, problems 4–8 — NO scene)

```
┌─────────────────────────────────────────┐
│  [Emma idle, upper-left ~30vh]   [HUD]   │
│                                          │
│                                          │  ← scene slot ABSENT; sentence panel
│     ╔══════════════════════════════╗     │     rises into the freed vertical space
│     ║   The  dog  _____  there.    ║     │     (panel vertically centered in the
│     ╚══════════════════════════════╝     │      area scene+panel occupied in gentle)
│                                          │
│      ┌──────┐  ┌──────┐  ┌──────┐        │
│      │ sat  │  │ ran  │  │ see  │        │  ← same-class foils (Dave trap rule)
│      └──────┘  └──────┘  └──────┘        │
│                                          │
└─────────────────────────────────────────┘
```

### 3.2 Sentence panel (NET-NEW component)

- **Container:** rounded card, `border-[3px] border-my-pink bg-white`, rose shadow — visually a sibling of the existing caption ribbon (`word-song-ribbon`) but LARGER and CENTER-STAGE, not the to-Emma's-right caption. `data-testid="word-song-sentence-panel"`.
- **Text:** `font-display`, **2.0rem** (larger than the 1.6rem caption — this is the reading target, not a side caption), `leading-relaxed`, `text-ink`, centered. Words space-separated; the panel wraps to 2 lines max at the 3–4 word ceiling so it never overflows the iPad portrait width.
- **The gap:** rendered as a **blank underline** in the word-flow — a `border-b-[3px] border-ink` span ~3.5ch wide with `&nbsp;` content, `data-testid="word-song-sentence-gap"`, `data-gap-filled="false"`. NOT a special symbol, NOT the `___` underscores literally (Dave §5: "a blank underline inside the sentence text" is the most natural reading-readiness format).
- **Word-by-word reveal:** the sentence panel reveals word-by-word synced to Emma's read (same `captionRevealed` tick mechanism as the existing ribbon — boundary events or 165 wpm fallback). Each word `data-testid="word-song-sentence-word"` with `data-revealed`. The gap reveals as the blank underline at its position in sequence (Emma says "blank" → the underline appears).
- **On correct:** the blank fills with the target word in place (spring scale-in, `data-gap-filled="true"`) so Marian SEES the completed sentence "The cat **sat** the mat." before advancing — the closure beat that makes the cloze feel finished. The filled word uses the same `text-ink` weight as the rest of the sentence (it's now part of the sentence, not a chip).

### 3.3 Chips

- 3 written-word chips, thumb-zone (lower third), `≥96pt` square hit area (44pt iOS-HIG floor cleared with headroom). Reuse the **exact** `isSightWord` text-glyph chip from `WordSong.tsx` — same 36px text, same border/spring/shake/hit-area. The selector predicate widens: `const isSightWord = contentType === 'sight-word' || contentType === 'simple-sentence'` OR (cleaner) introduce `const isWrittenWordChip = contentType === 'sight-word' || contentType === 'simple-sentence'` and gate the text-glyph render on that. **Devon's call on the exact predicate name — but keep the chip VISUAL identical to sight-words; only the gate widens.** The `data-testid="word-song-chip-sight-word"` MAY stay (tests key on it) or Devon may add a parallel `word-song-chip-written-word` — coordinate with Jessica's W13-05 selectors before renaming.

### 3.4 Safe areas & thumb zones

- Sentence panel + scene occupy the upper-middle (reading happens above the thumb). Chips stay in the thumb-reachable lower third — primary action is thumb-native, portrait-first.
- Emma stays upper-left ~30vh perch (unchanged from all WordSong tiers).
- Back-arrow (mid-skill exit) unchanged, top-left, outside the reading flow.

### 3.5 Gentle/trap split + function-word introduction ordering (Dave dosage)

Per Dave §"Dosage and session structure" — the 8-problem session splits gentle/trap exactly like every word-song tier, and the render/foil/scene state keys on the phase:

| Problems | Phase  | Scene (§8) | Foil class                                                                                | Sentence templates                                                                      |
| -------- | ------ | ---------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1–3      | Gentle | Present    | Wrong part-of-speech (class foils — wrong-class chips, eliminated by the slot constraint) | Templates A/B only (SV / SVO — safest for Tagalog-L1 SVO learning)                      |
| 4–8      | Trap   | Absent     | Same class, wrong meaning (semantic foils — correct part-of-speech, wrong meaning)        | All templates; deferral (Template D) + is/was-adjective (Template E) prioritised in 5–8 |

**Function-word introduction ordering (AC4 — encode explicitly, it does NOT fall out of the pool listing).** The five inherited Wave-11 deferrals are introduced in this exact order (Dave research rec #10, line 317; risk #4, line 283 — highest-frequency + lowest syntactic complexity first):

> **they → there → where → were → then**

Sequencing rules (Dave §"Dosage note on the deferrals" + §"Gentle → trap progression"):

- Deferrals do NOT appear until **session 4 or later** (sessions 1–3 are Templates A/B only, no deferral gap words).
- When a deferral first appears, it appears in the **gentle phase first** (scene present + wrong-class foil) before moving to the trap phase.
- Once the tier is underway (session 4+), deferrals should fill **≥3 of the 8 problems per session** — they are the highest-priority content for this tier (they are precisely the words that need sentence context, which this tier supplies).

**Implementation lane:** this ordering + dosage is a **planner/word-list concern (Kevin)** — `WORD_SONG_SIMPLE_SENTENCES` and the `WORD_SONG_TRACK_GUIDE` directive block encode the `they → there → where → were → then` sequence and the session-4+ / gentle-first / ≥3-per-session dosage rules explicitly (Dave rec #4 routes the dosage rule there; do NOT leave it for Haiku to infer). The render (Devon) is dosage-agnostic — it renders whatever phase/foil/scene state the served problem carries. This spec states the ordering so it is a deliberate hand-off, not a silent omission.

---

## 4. Copy / TTS script

Emma reads the gapped sentence; she speaks `blank` at the gap (never the answer). Within the ~200-word cap.

| Slot                   | Template                                               | Example (problem with target `bit`, frame `"The cat ___ the bag."`) | Timing                                                                                                           |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `read` (TTS)           | `"Finish the sentence: <sentence-with-blank-spoken>."` | "Finish the sentence: The cat blank the bag."                       | On problem mount (no decoding window). Sentence panel reveals word-by-word against this read.                    |
| `read` (display frame) | carried separately as `sentenceFrame` with `___`       | "The cat \_\_\_ the bag." (renders as styled blank, §3.2)           | —                                                                                                                |
| `correct`              | `"Yes! <Word>."`                                       | "Yes! Bit."                                                         | On correct tap. Gap fills with the word; ear-wiggle pose + chime + sparkles (§5 motion).                         |
| `reprompt`             | `"Hmm... try again?"`                                  | "Hmm... try again?"                                                 | On wrong tap — puzzled-tilt, no red X (§6).                                                                      |
| `hint`                 | `"Listen. <full sentence spoken with the answer>."`    | "Listen. The cat bit the bag."                                      | After 2nd wrong (single hint — see §6). Emma reads the COMPLETE sentence so Marian hears the target in its slot. |
| `giveAnswer`           | `"This one is <word>."`                                | "This one is bit."                                                  | After 3rd wrong. The correct chip then auto-highlights and the gap fills.                                        |

**Read/display split is load-bearing.** The TTS `read` substitutes `blank` for `___` (natural prosody); the display uses `sentenceFrame` with the styled underline. Same string, two renderings — keep them in lockstep. The planner emits BOTH derivable from one source sentence; the parser splits them (the `read` is what gets TTS'd; `sentenceFrame` is what displays). See §1.1.

**Hint speaks the full sentence WITH the answer** (Dave §"Recognition mechanic" + cloze pedagogy): hearing the target word in its syntactic slot is the scaffold. This differs from CVC hints ("Let's look. Cat.") — for a cloze, the resolving scaffold is the completed sentence, not the isolated word.

---

## 5. Motion

Reuse the house motion vocabulary (spring `stiffness: 260, damping: 20`); nothing sharp or frantic. Honour `prefers-reduced-motion` (springs collapse to fades per app-root `MotionConfig`).

| Element              | Trigger                          | Animation                                                             | Config                                                   |
| -------------------- | -------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| Sentence panel mount | Problem mount                    | scale 0.9 → 1, opacity 0 → 1                                          | spring 260/20, ~250ms (mirrors `word-song-ribbon` mount) |
| Sentence word reveal | Per-word boundary / 165 wpm tick | opacity 0 → 1 fade-in per word                                        | 0.1s ease-out per word (mirrors caption reveal)          |
| Gap fill on correct  | Correct tap                      | target word scale 0 → 1 spring-in inside the blank slot               | spring 260/16, ~300ms                                    |
| Scene illustration   | Gentle problem mount             | opacity 0 → 1, scale 0.96 → 1                                         | spring 260/16, ~250ms; reduced-motion → opacity-only     |
| Chip correct         | Correct tap                      | `whileTap scale 0.96`; sparkle burst on the tapped chip               | existing sight-word chip motion (reused)                 |
| Emma correct         | Correct tap                      | `celebration` pose (tilt LEFT −6°, keyframed hold) + chime + sparkles | `emmaPose.ts` `CELEBRATION_*` (unchanged)                |
| Emma wrong           | Wrong tap                        | `puzzled-tilt` (tilt RIGHT +10°) + soft poof; chip stays tappable     | `emmaPose.ts` puzzled spring 220/20 (unchanged)          |

---

## 6. Emma beats — read / hint / reactions / never a red X

- **Read-aloud:** fires immediately on problem mount (no decoding beat — §2). Emma speaks the gapped sentence, "blank" at the gap. The sentence panel reveals word-by-word in sync.
- **Hint shape — SINGLE hint (explicit).** Word Song stays single-hint per the W12 out-of-scope ruling (`design/wave-12-plan.md` line 14: "Word-song three-hint is explicitly out-of-scope for Wave 12"). The three-beat hint choreography shipped Wave 12 is **math-track only**. This tier emits ONE `hint` utterance (the full-sentence-with-answer read, §4), fired after the 2nd wrong tap (`GUIDED_AFTER_WRONG_COUNT`), matching every other word-song tier. Do NOT author a three-slot hint here.
- **Correct (ear-wiggle path):** `celebration` pose + chime + sparkle burst on the tapped chip + the gap fills with the target word. Then advance.
- **Wrong (NEVER a red X):** `puzzled-tilt` pose + soft "poof" SFX. The chip Marian tapped is NOT marked wrong with any red X / error icon — the gap simply stays empty and tappable. She tries again. This is the invariant `never a red X` principle (`emma-character-and-animation.md` §10) — encoded here verbatim.
- **Give-answer (after 3rd wrong):** `"This one is <word>."` — the correct chip auto-highlights and the gap fills. Gentle, no punishment, then advance.

---

## 7. Open questions for Thomas (walkthrough-ready — recommended defaults)

| #   | Question                                                                                                                                                                                                                                                                                                      | Recommended default                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | **Scene asset scope.** Dave's research scopes ~20 distinct scenes (one per sentence template, shared across phonological variants). Thomas decided SCENES IN V1 and will produce the MJ pack himself. Confirm the **scene-per-template** sharing model (≈20 scenes total) vs. scene-per-sentence (40 scenes)? | **Scene-per-template (≈20).** Dave §"Asset scope note" scopes it this way; a template's scene (e.g. "subject sat on object") reads for every phonological variant. Halves Thomas's MJ load. The §5 asset spec below assumes this; if Thomas wants per-sentence scenes, the filename convention extends trivially (keyed by sentence id, not template id).                       |
| Q2  | **Gap-fill closure beat.** On correct, fill the blank with the target word in-place (§3.2) before advancing — adds ~300ms hold?                                                                                                                                                                               | **Yes — fill the gap.** Seeing "The cat **sat** the mat." completed is the closure that makes the cloze feel finished; it also gives a half-beat of passive whole-sentence reading exposure. Costs ~300ms of the existing correct-advance window — within the current 1.2–1.6s correct-advance budget.                                                                          |
| Q3  | **Chip text size for 4-letter+ deferral words.** Sight-words used 36px for ≤4-letter words. The deferrals (`they`, `there`, `where`, `were`, `then`) run to 5 letters ("there", "where", "where"). Does 36px still fit the 96pt chip?                                                                         | **Drop to 32px for this tier's chips** (or keep 36px and widen the chip to 112pt for 5-letter words). 32px keeps "there"/"where" inside the 96pt chip content box with margin. Devon measures at implementation; flag if 5-letter words clip at 36px. Mechanical, not a design call — defaulting to 32px is safe.                                                               |
| Q4  | **Sentence-frame display for the deferral templates (Template D).** Some Template-D frames gap the FIRST word ("\_\_\_ are in the van." → `they`). A leading blank underline reads slightly oddly. Acceptable?                                                                                                | **Acceptable — leading blank is fine.** It's grammatically natural ("\_\_\_ are in the van.") and Dave's pool includes these by design (Template D gaps the deferral wherever it sits). The styled underline at sentence-start reads clearly. No special-casing needed.                                                                                                         |
| Q5  | **Selector naming.** Reuse `data-testid="word-song-chip-sight-word"` for the chips (tests already key on it) or introduce `word-song-chip-written-word`?                                                                                                                                                      | **Reuse `word-song-chip-sight-word`** for the chip to avoid churning Jessica's selectors — the chip is visually identical and the test-id names the SHAPE (written-word), not the tier. Add the NEW `word-song-sentence-panel` + `word-song-sentence-gap` test-ids for the net-new panel. Jessica's W13-05 spec keys on those. Final call coordinate with Jessica before merge. |

---

## 8. Scene asset spec (Thomas produces the MJ pack)

Consistent with the existing picture-pack pipeline (`design/word-song/picture-pack-style-anchor.md`). Scenes are a NEW asset class (multi-subject scenes, not single-subject vocabulary cards), so the style frame adapts as noted.

### 8.1 Scope

- **≈20 scenes**, one per sentence template-instance in the gentle-phase pool (Q1 default: scene-per-template). Only the gentle phase (problems 1–3) shows scenes; trap phase (4–8) is text-only (Dave §"Picture role").
- Each scene depicts the **completed** sentence (the correct-answer version): "The cat sat on the mat" → a cat sitting on a mat. The scene is the comprehension context, NOT the answer — Marian taps the word chip, never the scene.

### 8.2 Filename convention

```
public/assets/scenes/scene-<sentence-id>.svg
```

- `<sentence-id>` is the planner's stable sentence identifier (Kevin assigns in `WORD_SONG_SIMPLE_SENTENCES`; e.g. `cat-sat-mat`). Lowercase, hyphenated, derived from the sentence's content words.
- SVG wrapper embeds a background-removed PNG (same PNG-in-SVG technique as the picture pack), produced via the bgclear.ai → SVG-embed path (`emma-character-and-animation.md` §3a). **Scenes have a continuous high-contrast subject perimeter, so bgclear.ai works (unlike face-crops); a solid cream background per the style frame keys cleanly to transparent.**
- Map id ↔ src in a new `SCENE_PICTURES` registry alongside `wordPictures.tsx` (Devon wires the lookup; absent scene → graceful text-only fallback so a missing asset never bricks the screen).

### 8.3 Dimensions & sizing

- **Source MJ render:** 1024×1024 minimum (per the picture-pack constraint). Scenes are 1:1 square like the picture pack — the on-screen frame crops/letterboxes to the 280×210pt panel.
- **On-screen:** 280×210pt scene panel (4:3 landscape crop of the square source, or square at 210×210 — Devon picks the crop that reads cleanest per scene). Renders at ≤ the sentence panel width on iPad portrait; sits ABOVE the sentence panel (§3.1).
- **File-size discipline:** scenes are multi-subject so they carry more detail than single-subject cards — budget **< 400 KB per scene SVG** (vs. <300 KB tight-crop, ~250 KB picture-pack). Downscale the source to 768×768 before embedding if a scene exceeds 400 KB. 20 scenes × ~350 KB ≈ 7 MB total — within the 8 MiB workbox per-file cap PER FILE (each scene is its own file; the cap is per-file not aggregate), and PWA precache handles the set. Confirm no single scene exceeds 8 MiB.

### 8.4 Style brief (extends the locked picture-pack style frame)

Scenes inherit the picture-pack style anchor (`picture-pack-style-anchor.md` §2) with these **scene-specific amendments** — Thomas pastes the anchor preamble, then appends per scene:

> **TWO subjects in a simple relationship, square 1:1 composition.** A child-friendly illustrated scene showing **[SCENE DESCRIPTION — e.g. "a small cat sitting on a woven mat"]**, in the style of modern slice-of-life Korean manhwa / webtoon children's-book illustration. [INHERIT the full style-anchor palette + line-weight + cel-shading block verbatim.] **The relationship between the two objects must be unmistakable** — the cat is clearly ON the mat, not beside it; the dog is clearly IN the box, not next to it — because the scene's job is to make the sentence's meaning legible to a child still acquiring English. **Background: solid soft cream (#FFF6EE)** — flat, mask-friendly, no environment, no extra props, no text, no labels. Both subjects rendered in the same warm-pastel palette; neither dominates. **Read-on-first-look:** a 6-to-8-year-old should describe the scene in the target sentence's words ("the cat sat on the mat") without prompting.

Scene-specific locked attributes (regenerate if violated):

- **Exactly the subjects named in the sentence** — no extra figures, no decorative props (same single-world discipline as the picture pack, extended to the 2-subject case).
- **Spatial relationship readable at 280pt** — the preposition/verb meaning (on / in / to / sat / ran) must be visually unambiguous at panel size.
- **Tonal sibling of Emma + the picture pack** — same warmth, palette family, line philosophy. Scenes share screen real-estate with Emma and the chips; style mismatch foregrounds style as a cue and breaks pedagogy (same rationale as picture-pack §1.2).
- **No scene shows text** — Marian reads the sentence from the panel, not from the illustration.

### 8.5 Per-scene brief table (Thomas's generation worklist — gentle-phase templates)

Kevin's `WORD_SONG_SIMPLE_SENTENCES` pool finalizes the exact gentle-phase sentences; the scene list is one per gentle-eligible template-instance. Representative set (final list ships with Kevin's word list — Thomas generates against the finalized ids):

| scene-id       | Scene description                      | Sentence it contexts                 |
| -------------- | -------------------------------------- | ------------------------------------ |
| `cat-sat-mat`  | a cat biting a bag                     | "The cat bit the bag."               |
| `dog-ran`      | a happy dog running                    | "The dog ran."                       |
| `cat-on-mat`   | a cat resting on a mat (locative)      | "The cat sat on the mat." (prep gap) |
| `dog-in-box`   | a dog sitting inside an open box       | "The dog is in the box."             |
| `sun-hot`      | a bright warm sun                      | "The sun is hot."                    |
| `see-dog`      | a child pointing at / looking at a dog | "I see the dog."                     |
| `cat-ran-shed` | a cat running toward a small shed      | "The cat ran to the shed."           |
| `bag-in-van`   | a bag inside an open van               | "The bag is in the van."             |
| `mat-red`      | a red mat                              | "The mat is red."                    |
| `man-big`      | a tall/big man figure                  | "The man is big."                    |

(Final ≈20-row table ships with Kevin's pool; this is the format + first 10 for Thomas to start against. Each row reuses the §8.4 style brief with `[SCENE DESCRIPTION]` = the middle column.)

---

## Acceptance criteria (Jessica W13-05 keys on these)

- [ ] `WordSongContentType` includes `'simple-sentence'`; the parser sets it when the read line matches `"Finish the sentence: <sentence>."`.
- [ ] A `"Finish the sentence: The cat ___ the bag."` read line parses to `contentType: 'simple-sentence'` with `sentenceFrame === "The cat ___ the bag."`.
- [ ] The target word is resolved from the `correct` utterance (`"Yes! Bit."` → `bit`), NOT from the gapped read line.
- [ ] A read line with zero `___` tokens or two+ `___` tokens throws `PlanFromServerError`.
- [ ] The sentence panel (`word-song-sentence-panel`) renders the frame with a styled blank underline (`word-song-sentence-gap`, `data-gap-filled="false"`) at the gap position.
- [ ] Chips render as written-word text glyphs (no picture, no word card) — 3 chips.
- [ ] No decoding beat: read-aloud fires immediately on `simple-sentence` problems (`isCvcWord` is NOT widened to include `'simple-sentence'`).
- [ ] Correct tap: gap fills with the target word (`data-gap-filled="true"`), `celebration` pose + chime + sparkles, then advance.
- [ ] Wrong tap: `puzzled-tilt` pose + poof SFX, NO red X / error icon, chip stays tappable.
- [ ] Exactly ONE `hint` utterance per problem (no three-slot hint); hint speaks the full sentence with the answer.
- [ ] Gentle problems (1–3) render a scene illustration above the sentence panel; trap problems (4–8) render NO scene.
- [ ] Each gentle problem carries a `sceneId` on `WordSongProblem`; the render resolves `SCENE_PICTURES[sceneId]` → `scene-<sceneId>.svg`; trap problems carry `sceneId === undefined`.
- [ ] A missing scene asset (or `undefined` `sceneId`) falls back to text-only (no broken-image, no crash).
- [ ] Function-word deferrals are introduced in `they → there → where → were → then` order, session 4+, gentle-phase-first (planner/word-list assertion — Kevin's `WORD_SONG_SIMPLE_SENTENCES` + directive encode the sequence; round-trip test pins it).
- [ ] All touch targets ≥ 44pt; chips ≥ 96pt and thumb-reachable in portrait.
- [ ] `prefers-reduced-motion`: springs collapse to fades; word reveal still functions.

---

## Cross-references

- `design/research/simple-sentences-sequence-marian.md` — Dave W13-01 (the gating pedagogy ruling).
- `design/wave-13-simple-sentences-plan.md` — Track decomposition; the 6-surface content contract.
- `design/wave-11-sight-words-plan.md` + sight-words render (PR #390) — the written-word-chip precedent that transfers.
- `.claude/docs/skill-trees-and-content.md` — `WordSongContentType`, parser-planner contract, word/picture packs.
- `.claude/docs/emma-character-and-animation.md` §10 — the "never a red X" invariant; non-pose asset production path (§3a/§3b) for the scene SVG-embed technique.
- `design/word-song/picture-pack-style-anchor.md` — the locked style frame the scene brief extends.
- `design/wave-12-plan.md` line 14 — word-song stays single-hint (this tier inherits it).
