# Word Song — letter-sounds content/pedagogy spec (Wave 7 Track A, Tier A5)

**Ticket:** `86c9y49ap` — A5, Wave 7 Track A, "letter-sounds content/pedagogy spec (Kyle)". Epic `86c9y494c`.
**Status:** Draft for sponsor review / Dave hand-off.
**Author:** Marian Tutor design persona.
**Predecessors:** PR #211 (digraph-tier sibling split — the sibling-tier infrastructure this spec relies on already exists); A1 letter-names spec (PR #324, parallel sibling — shares case/font/SSML defaults with this tier); `design/research/phonics-sequence-marian.md` (anchor for short-vowel sequencing).
**Companion specs (downstream):** A6 `letter-sounds` Haiku directive (Dave), A7 canon bake + planner wiring + optional lint binding (Devon), A8 failing-first E2E (Jessica). Tier-A1 `letter-names` is the predecessor recognition tier authored in parallel — A5's content assumes Marian arrives with glyph-recognition already a non-issue (it is, per the CLAUDE.md current-levels table — alphabet mastered with minor b/d confusion).

---

## 0. Why this spec, why now

`letter-sounds` is the **second** literacy tier in `WORD_SONG_NODES_IN_ORDER` (`MarianLearning/src/lib/progress/focusNode.ts:66`) — it sits between `letter-names` (glyph → name) and `blending-cv` (decoding two-phoneme word units). Today it is in `VALID_WORD_SONG_FOCUS_NODES` (`api/_planner.ts:154-171`) but absent from `WORD_SONG_FIRST_CLASS_FOCUS_NODES` (`api/_planner.ts:643-653`), so `effectiveFocusNode` falls it through to the `blending-cv` stub. Anyone landing on the `letter-sounds` node today sees `"Tap the cat."` CVC content — accidentally functional but pedagogically wrong: a tier whose purpose is **phoneme → grapheme** mapping is silently rendering **whole-word decoding** content.

Three structural facts make this tier **materially heavier** than the sibling A1 `letter-names` spec, and motivate writing it with extra pedagogical scaffolding rather than the bake-once-and-leave posture A1 takes:

1. **This tier is GENUINELY NOVEL for Marian, not review.** Per `phonics-sequence-marian.md` §Q1 + the CLAUDE.md current-levels table: Marian's **consonant sounds are mastered** and her **short-/a/ sound is mastered**, but **short /o/, /u/, /i/, /e/ are at "teach next" status** (the locked vowel ladder is `o → u → i → e`). So the consonant half of the letter-sounds pool is review-mode (familiar territory), while the short-vowel half is **first-time acquisition territory** — Marian must form a new sound → letter mapping for each new short vowel. The tier therefore cannot be a flat "all sounds, randomly drawn" pool the way A1 letter-names can. The pool must be **explicitly stratified** by acquisition status: mastered-consonants + mastered-vowel as gentle, current-target-vowel as the introduction lift.
2. **The acoustic-similarity ban (`/i/` ≠ adjacent to `/e/`) lives at this tier.** Per `phonics-sequence-marian.md` §Q1: structured-literacy curricula (Orton-Gillingham, Keys to Literacy, Fairleigh Dickinson) **separate short /i/ from short /e/ in instruction** because they are the most acoustically similar English short-vowel pair. Marian's diagnostic showed /i/ as her weakest vowel; introducing /e/ adjacent risks merging the two in memory. **This means the per-session pool composition rule must encode the constraint: short /i/ and short /e/ may NEVER both appear as target sounds in the same session.** This is the load-bearing pedagogical rule for this spec — analogous to the b/d/p/q load-bearing rule in A1.
3. **Sounds are NOT letter names — TTS pronunciation requires explicit handling.** A letter NAME ("ay", "bee", "see") is what Azure's Emma voice engine produces by default when given an isolated letter glyph in `"Tap the letter A."` (per A1 §2.4 — this works natively, no SSML needed). A letter SOUND ("/æ/", "/ɒ/", "/m/") is the **phoneme** — distinct from the name. Emma cannot reliably produce phoneme-only utterances from prose: `"What says /a/?"` would be voiced as the word "a" (the article, /ə/) by default. **The phoneme must be voiced via SSML `<phoneme alphabet="ipa" ph="...">` for every isolated-phoneme utterance.** This applies selectively — see §2 for which utterance slots need the override and which can stay plain prose.

**Scope of this spec:** per-sound prompt template (the read-line + utterance slot shape; specifically how Emma voices an isolated phoneme), the 8-problem pool composition rule (which consonants + which vowels per session, in what mix, with the /i//e/ adjacency ban encoded as a hard constraint), distractor strategy (which letters serve as gentle vs. trap distractors per target sound — leans on Marian's documented confusion classes), TTS phoneme handling (which sounds need explicit IPA SSML overrides, which can rely on Emma's native pronunciation), render contract (3-chip layout; letter glyphs as chips, NO pictures), session-shape acceptance criteria, mastery rule.

**Out of scope** (explicit; mirrors the ticket Out-of-scope list):

- Letter-names tier — that's the parallel A1 spec (PR #324).
- Picture-pairing — this tier is sound → letter glyph; pictures don't apply. The chip carries the letter glyph, same render contract as A1.
- Sight-words and simple-sentences — Wave 8.
- Cross-vowel CVC anything — this is the isolated-sound tier; no CVC blending, no CVC pool coupling.
- `SkillNode`-widening checklist (the 14-16 points in `.claude/docs/sibling-tier-checklist.md`) — `letter-sounds` is already in the `WordSongNode` union, `LITERACY_TREE`, and `WORD_SONG_NODES_IN_ORDER`. Per the ticket non-obvious context: this tier doesn't widen the union. The pool-extension five-point checklist in `skill-trees-and-content.md` also does not apply — there is no `wordPack.ts TARGET_WORDS` entry, no `TARGET_PAIRINGS` row, no `VALID_*_WORDS` Set; the canon JSON is the source of truth on its own.

**Adoption of A1 defaults (Q1–Q6 from PR #324).** This spec **adopts the A1 spec's open-question defaults verbatim** to keep the bookend pair (A1 + A5) coherent for sponsor review and downstream impl:

- **Q1 (case)**: case-strict tap; chip case matches read-line case. _(Restated as A5 §3.5; not re-opened.)_
- **Q3 (SSML on isolated `A`)**: no pre-emptive wrap on letter NAMES; trust Emma. _(Restated; A5 introduces a NEW SSML need for phoneme utterances — that's §2 of this spec and is a genuinely-new decision for A5.)_
- **Q4 (font)**: Atkinson Hyperlegible. _(Adopted verbatim; same render contract.)_
- **Q5 (session-end utterance)**: standard `session.end.opener`. _(Adopted verbatim.)_
- **Q6 (compositionLint binding)**: YES — same `RULE_IDENTITY+SPEC+LINT` triple-pin pattern. _(Adopted, see §6 / §7 Q3.)_

The genuinely-new A5 decisions are: (i) read-line template phrasing for an isolated-phoneme prompt (resolved inline §2.1), (ii) SSML scope for phoneme utterances (resolved inline §2.3 + §2.4 — substitution-table extension of `PHONEME_OVERRIDES`, see §8 appendix), (iii) per-session vowel-progression rule (resolved inline §1.4), (iv) /i//e/ adjacency ban enforcement in-session vs. cross-session (resolved inline §1.2 + §1.4), and (v) the mastery-progression decision for whether `letter-sounds` masters per-vowel or as one composite tier (sponsor Q4) + the mastery-threshold calibration (sponsor Q6). Only (v) escalates to §7; the other four are pre-resolved in spec body (see §8 appendix for the routing audit on review-resolved items).

---

## 1. Sound coverage and pool composition

### 1.1. The sound pool

The full pool of letter-sounds covered by this tier is the **English short-vowel set + the mastered-consonant set**:

| Sound class                                   | Members                                                                                                                   | Marian status                                                                        | Notes                                                                                                                                                                                                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mastered consonants**                       | `/m/`, `/n/`, `/p/`, `/b/`, `/t/`, `/d/`, `/k/`, `/g/`, `/s/`, `/h/`, `/l/`, `/r/`, `/f/`, `/v/` (14 sounds)              | Mastered per CLAUDE.md (Tagalog L1 transfer — see `phonics-sequence-marian.md` §Q2). | Each has a single canonical letter mapping in CVC tier (m ↔ M, n ↔ N, …). Voiced/unvoiced pairs (b/p, d/t, g/k, v/f, z/s) are the within-class trap surface — see §3.                                                                                                                  |
| **Mastered vowel**                            | `/æ/` (short-a)                                                                                                           | Mastered                                                                             | Anchor sound; used as warmup item in every session that doesn't otherwise use short-a as the current-target vowel. Maps to letter `a`.                                                                                                                                                 |
| **Current-target vowel**                      | One of `/ɒ/` (short-o), `/ʌ/` (short-u), `/ɪ/` (short-i), `/ɛ/` (short-e) — exactly ONE per session in introduction-phase | Per Marian's progression — see §1.4 vowel sequence                                   | This is the **lift** of every session. The vowel under introduction gets the heaviest emission rate (2-3 of 8 problems target it). Maps to letters `o, u, i, e` respectively.                                                                                                          |
| **Excluded — long vowels**                    | Long-a `/eɪ/`, long-o `/oʊ/`, long-u `/u:/`, long-i `/aɪ/`, long-e `/i:/`                                                 | Out of scope for this tier                                                           | Letter-sounds tier covers SHORT vowels only. Long vowels arrive at the CVCe / vowel-team tier (post-CVC). Including them here would conflict with Marian's expectation (built in CVC tiers) that vowel letters say their short sound.                                                  |
| **Excluded — voiced TH, ZH, NG, semi-vowels** | `/ð/`, `/ʒ/`, `/ŋ/`, `/w/`, `/y/`, `/j/` (as phoneme distinct from letter j)                                              | Out of scope                                                                         | Voiced-`/ð/` is excluded for the same reason it's excluded from `digraphs-th-voiceless` (see that spec §1.4) — conservative voicing posture. Semi-vowels `/w/`, `/y/` are taught later as their letter-name conflates with their phoneme.                                              |
| **Excluded — `x`, `q`, `z`**                  | `/ks/` (x), `/kw/` (q), `/z/` (z)                                                                                         | Out of scope for v1                                                                  | `x` is a TWO-phoneme grapheme (`/ks/`); confusing for an isolated-phoneme tier. `q` is almost never standalone (always `qu` blend). `z` is in mastered-consonants but rarely appears in Marian's CVC corpus — deferred to keep the pool tractable. Re-introduce if Wave 8 finds a use. |

**Pool size:** 14 consonants + 1 mastered vowel + 1 current-target vowel = **16 active sounds per session-eligible pool** (the 4 unintroduced vowels are off-pool until they reach current-target status in their progression turn). The pool is consciously kept small to make the tier feel tight and trackable — 16 sound→letter mappings is the entire universe Marian sees during this tier's lifespan, even though the tier instance runs across multiple sessions per current-target vowel.

### 1.2. The /i/ ↔ /e/ acoustic-similarity ban (load-bearing)

Per `phonics-sequence-marian.md` §Q1 (Dave, locked 2026-04-26): English short /i/ (`/ɪ/`) and short /e/ (`/ɛ/`) are **the most acoustically similar short-vowel pair** in English. Structured-literacy curricula universally separate them in instruction. Marian's specific risk: her diagnostic showed `/i/` as her weakest sound; her Tagalog phonology has `/i/` and `/ɛ/` as distinct phonemes but the English letter-to-sound mapping for both is new; teaching them back-to-back **would risk merging the two in her memory** (per phonics-sequence research consensus + the Q1 verdict).

This translates into **two hard constraints** on the pool composition rule (§1.3):

1. **`/i/` and `/e/` MUST NOT both appear as target sounds in the same session.** A session can have one or the other as current-target, but never both. (Distractor-letter chips can still include `i` or `e` as glyphs — see §3 — but the spoken target phoneme cannot be both /i/ and /e/ in the same 8-problem run.)
2. **Cross-session, `/e/` introduction MUST wait until `/i/` has reached `practicing → mastered` status.** This is a tier-internal constraint that the planner cannot enforce alone (planner is session-scoped, not session-history-aware) — see §5.3 for how mastery-tracking handles this. The recommended implementation is: track per-vowel sub-mastery within `letter-sounds` and gate `/e/`-targeted sessions behind `/i/` sub-mastery (open as §7 Q4).

The acoustic-similarity ban is the load-bearing pedagogical rule for this tier — same way "≤2 b/d/p/q targets per session" is the load-bearing rule for A1 letter-names.

### 1.3. Pool composition rule — 8 problems per session

Each Word Song letter-sounds session emits **8 problems**, matching the Math + CVC-tier + A1 session shape. Composition depends on **which vowel is current-target** for that session (the planner derives this from `progress.vowelProgressionState` — see §1.4):

| Slot                | Tier                      | Sound class                                                                                                                   | Notes                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–3 (gentle window) | gentle                    | **Mastered consonants** drawn from the 14-sound pool                                                                          | 3 quick wins to open the session. Pure-review surface — Marian sees `/m/`, `/s/`, `/t/` etc. with letter chips she knows from CVC tiers. **Vowel sounds are NOT used in the gentle window** — vowel mapping is the lift, not the warmup.                                                                                                                                        |
| 4–5 (mid-tier)      | gentle-to-trap transition | **Mixed**: 1 consonant from a voiced/unvoiced trap pair (e.g. `/b/` vs `/p/` distractor) + 1 mastered vowel (`/æ/` — short-a) | Mid-window introduces the mastered vowel `/æ/` as an item — surfaces letter-`a` recognition. The consonant slot in this window may be from a voiced/unvoiced pair where the within-pair member is included as a distractor (the within-class trap — see §3).                                                                                                                    |
| 6–8 (trap window)   | trap                      | **Current-target vowel preferred + voiced/unvoiced consonant pair traps**                                                     | Problems 6–8 actively work the lift. At least **2 of these 3 problems** must have the current-target vowel as the target sound; the cap of **≤3 of 8 problems may target the current-target vowel** prevents the session from feeling like a single-vowel drill. The remaining 1 trap slot uses a voiced/unvoiced consonant trap pair (b/p, d/t, g/k, v/f, z/s, j/sh — see §3). |

**Hard constraints on the composition (Haiku directive must enforce):**

- **Exactly 8 problems per session.** Same as every other tier.
- **No sound appears more than once as a target across the 8 problems.** (Distractors may repeat across problems — 14 consonants + 2 vowels in pool gives 16 sound→letter mappings and 8 × 3 = 24 chip slots; distractor repetition is unavoidable. But the **target** of each problem must be unique within the session.)
- **At least 2 targets from the current-target vowel.** This is the "ensure the tier does its job" anchor. Composition is meaningless if the lift vowel is missing.
- **At most 3 targets from the current-target vowel.** Cap prevents single-vowel drill feel. Even when Marian is introducing /o/, she only sees 2-3 `/ɒ/` problems per session.
- **At least 1 vowel slot for the MASTERED vowel `/æ/`** in the mid-tier window. Maintains short-a as the anchor sound and provides a "you know this one" reset in the session's middle.
- **At least 4 mastered-consonant targets** (problems 1–3 fully + at least 1 of problems 4–5). Maintains the session's overall review feel and ensures the lift vowel doesn't dominate.
- **/i/ and /e/ EXCLUSIVE constraint** (per §1.2): if current-target vowel is `/ɪ/`, the sound `/ɛ/` MAY NOT appear as a target — and ideally not as a distractor either (see §3.2). Same in reverse when current-target is `/ɛ/`. This is a HARD-GATE constraint, enforceable in compositionLint.
- **No long vowels appear as targets or as distractors.** Long-vowel sounds are out of scope; their letter glyphs (`a, e, i, o, u`) only appear with their SHORT-vowel pronunciation.

### 1.4. Vowel sequence and per-session current-target derivation

**Sequence (locked, do not modify):** `/æ/ (mastered)` → `/ɒ/` → `/ʌ/` → `/ɪ/` → `/ɛ/`. Per `phonics-sequence-marian.md` §Q1 (Dave, locked 2026-04-26). The /i/ → /e/ ordering at the end is **NOT optional** — it satisfies the acoustic-similarity ban by guaranteeing /e/ arrives only after /i/ has had separation time.

**Per-session current-target derivation:**

The planner picks the current-target vowel by reading **the lowest-mastery short-vowel sub-state** from the user's progress doc. Three states per vowel, mirroring tier-level mastery state machine:

- `unintroduced` — vowel hasn't appeared as a target yet
- `practicing` — vowel has appeared as a target in ≥1 session
- `mastered` — vowel has hit the per-vowel sub-mastery threshold (see §5.3)

**Derivation algorithm:**

1. Walk vowels in locked order: `/ɒ/, /ʌ/, /ɪ/, /ɛ/`.
2. The first vowel in `practicing` state is current-target.
3. If all in-pipeline vowels are `mastered`, current-target = the next `unintroduced` vowel in the sequence (and that vowel transitions to `practicing` on first session emission).
4. If `/e/` would be picked but `/i/` is not yet `mastered`, the planner **skips to the next mastered vowel for review-mode emission** rather than introducing `/e/` adjacent to a non-mastered `/i/`. (Implements the cross-session ban from §1.2.)

This decision is **MORE COMPLEX** than the simple "pick the focused vowel" rule used by CVC short-vowel tiers (which read focus directly from `effectiveFocusNode`). Letter-sounds is a single tier carrying multiple vowel sub-states. The added complexity is justified by the pedagogy — see §5.3 for mastery rule, §7 Q4 for the open question about implementation surface.

**Fallback if the per-vowel progression isn't yet tracked in `progress`:** the planner emits with `/ɒ/` as default current-target. This is the safe default: Marian's next-vowel-to-master is /o/, and the spec ships against today's progress doc shape without forcing a Kevin-side progress migration in Wave 7.

### 1.5. Pool composition worked example — current-target = /ɒ/

Session shape for a typical "introducing short-o" session (8 problems):

| #   | Slot     | Target sound | Target letter | Distractor 1 | Distractor 2 | Rationale                                                                                         |
| --- | -------- | ------------ | ------------- | ------------ | ------------ | ------------------------------------------------------------------------------------------------- |
| 1   | gentle   | `/m/`        | `m`           | `s`          | `t`          | Mastered consonant, clean distractors (no voiced/unvoiced trap).                                  |
| 2   | gentle   | `/h/`        | `h`           | `l`          | `r`          | Mastered consonant, clean distractors.                                                            |
| 3   | gentle   | `/n/`        | `n`           | `k`          | `f`          | Mastered consonant, clean distractors.                                                            |
| 4   | mid-tier | `/æ/`        | `a`           | `o`          | `e`          | Mastered vowel `/æ/` as anchor. Distractors are vowels (vowel-tier discrimination warmup).        |
| 5   | mid-tier | `/b/`        | `b`           | `d`          | `p`          | Voiced consonant with within-class trap (`/p/` is voiceless counterpart; `/d/` is b/d/p/q trap).  |
| 6   | trap     | `/ɒ/`        | `o`           | `a`          | `u`          | **Current-target vowel first emission**. Distractors are mastered + future-target vowels.         |
| 7   | trap     | `/ɒ/`        | `o`           | `e`          | `c`          | **Current-target vowel second emission**. Distractors are vowel (off-target) + consonant (mass).  |
| 8   | trap     | `/g/`        | `g`           | `k`          | `c`          | Voiced consonant with voiceless counterpart trap + visual `c↔g` cousin (CURVED-OPEN per A1 §1.4). |

Constraints satisfied: 8 unique targets, 2 current-target-vowel emissions (within the 2-3 cap), 1 mastered-vowel emission (`/æ/`), 5 mastered-consonant targets, no `/i/`/`/e/` adjacency (current-target is `/ɒ/`, neither /i/ nor /e/ appears as target). Mixed-case considerations are deferred to A1's case-strict rule (§3.5).

This is **one valid session shape**. Per A1 §1.5, alphabetical-walk vs random sampling: **same decision applies — pure constrained random sampling**, no deterministic walk. The Haiku planner's natural variance per session-start call produces the random sampling under the §1.3 composition constraints.

---

## 2. Utterance template — the read line and SSML phoneme handling

### 2.1. Read-line template

**`"Which letter says <SOUND>?"`** — `<SOUND>` is the isolated phoneme, voiced via SSML `<phoneme alphabet="ipa" ph="...">` wrap.

Examples:

- `"Which letter says <phoneme alphabet=\"ipa\" ph=\"m\">mmm</phoneme>?"` (target chip: glyph `m`)
- `"Which letter says <phoneme alphabet=\"ipa\" ph=\"ɒ\">o</phoneme>?"` (target chip: glyph `o`)
- `"Which letter says <phoneme alphabet=\"ipa\" ph=\"b\">buh</phoneme>?"` (target chip: glyph `b`)

**Why "Which letter says..." not "Tap the letter..."** — A1's read line `"Tap the letter A."` works when the prompt is the letter NAME (which Marian already maps to the glyph). Letter-sounds inverts that: the prompt is a SOUND, the answer is the glyph that maps to it. **"Tap the letter /m/"** parses awkwardly because the sound isn't a noun; **"Which letter says /m/?"** frames the task as recognition ("identify the grapheme for this phoneme") and parallels how Emma would frame it in everyday speech ("Which letter says mmm?").

Alternative considered and rejected: **"What letter is /m/?"** — semantically vague (could be read as "what's the letter NAME of this sound's glyph?", which conflates with letter-names tier). The `"says"` framing is unambiguous: it asks for the glyph whose **pronunciation** is the given sound. This matches structured-literacy curriculum phrasing (Orton-Gillingham, UFLI).

Alternative considered and rejected: **"Tap /m/."** — too terse; loses the framing scaffold that helps Marian as an L2 learner orient to the task each problem.

### 2.2. The 8 utterance slots per problem

Mirroring the CVC-tier + A1 shape, each problem emits 5 utterance slots:

| Slot         | Template                                                                                     | Example (target sound = `/m/`, letter = `m`)                                |
| ------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `read`       | `"Which letter says <SOUND>?"`                                                               | `"Which letter says <phoneme alphabet=\"ipa\" ph=\"m\">mmm</phoneme>?"`     |
| `correct`    | `"Yes! <LETTER> says <SOUND>."`                                                              | `"Yes! M says <phoneme alphabet=\"ipa\" ph=\"m\">mmm</phoneme>."`           |
| `reprompt`   | `"Hmm... try again?"` (verbatim across all problems and tiers — same as A1 + CVC canon)      | `"Hmm... try again?"`                                                       |
| `hint`       | `"Listen. <SOUND>."` (the sound only — no other framing; gives Marian a clean second listen) | `"Listen. <phoneme alphabet=\"ipa\" ph=\"m\">mmm</phoneme>."`               |
| `giveAnswer` | `"This one is <LETTER>. <LETTER> says <SOUND>."`                                             | `"This one is M. M says <phoneme alphabet=\"ipa\" ph=\"m\">mmm</phoneme>."` |

Plus the standard session-end utterance bundle (`session.end.opener`, `session.end.recap.<N>`, `session.end.streak.<N>`) that every canon JSON ships — see `blending-cv.json` for the canonical session-end set. The Haiku directive must include the full session-end bundle on session-end calls; this is not letter-sounds-tier-specific.

**Utterance ID namespace:** `word.p<N>.<slot>` (canonical, same as every other Word Song tier — see `wordSongUtteranceId(problemIndex, slot)` in `wordSessionPlans.ts:115`).

### 2.3. SSML phoneme handling — which sounds need IPA overrides

This is the **genuinely-new decision for A5** (A1 trusted Emma's native pronunciation; this tier cannot). The choice is per-sound, not blanket.

**General rule:** every isolated-phoneme utterance MUST be wrapped in `<phoneme alphabet="ipa" ph="...">`. The visible word inside the tag is the **mnemonic English-letter approximation** (mostly for diagnostic readability when reading the SSML — Azure ignores the visible word once `ph=` is set) — see `api/_tts.ts:194-198` `PHONEME_OVERRIDES` for the existing convention. The bracketed letters below show the recommended mnemonic for each sound.

| Sound class                                                          | Per-sound IPA                                                                   | Mnemonic visible word                    | Why SSML required                                                                                                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Continuant consonants** (`/m/, /n/, /s/, /f/, /v/, /l/, /r/, /h/`) | `m, n, s, f, v, l, r, h`                                                        | `mmm, nnn, sss, fff, vvv, lll, rrr, hhh` | Without SSML, Emma reads `"m"` in prose as the letter name "em" (`/ɛm/`), not the sustained phoneme `/m/`. The visible mnemonic uses a triplet (`mmm`) to hint a sustained articulation. |
| **Stop consonants** (`/p/, /b/, /t/, /d/, /k/, /g/`)                 | `p, b, t, d, k, ɡ` (note `ɡ` is U+0261 — IPA voiced velar plosive, NOT Latin g) | `puh, buh, tuh, duh, kuh, guh`           | Stops cannot be pronounced in isolation without a vowel epenthesis (the "schwa" tail). Mnemonic `puh` captures this. Without SSML, Emma reads `"p"` as the letter name "pee" (`/pi:/`).  |
| **Mastered vowel** (`/æ/`)                                           | `æ`                                                                             | `a`                                      | Without SSML, Emma reads `"a"` in `"Which letter says a?"` as the article (`/ə/` or `/eɪ/`), not the short-a phoneme `/æ/`. The wrap forces /æ/.                                         |
| **Current-target short vowels** (`/ɒ/, /ʌ/, /ɪ/, /ɛ/`)               | `ɒ, ʌ, ɪ, ɛ`                                                                    | `o, u, i, e`                             | Same as `/æ/` — without SSML, Emma reads isolated vowel letters in prose as their NAME (long sound) or as the schwa. The wrap forces the short pronunciation.                            |

**Hard SSML rule:** `<phoneme>` wrap applies ONLY inside utterance slots `read`, `correct`, `hint`, `giveAnswer` where the phoneme is being voiced. The `reprompt` slot (`"Hmm... try again?"`) has no phoneme content and stays plain prose.

**Hard SSML anti-rule:** the letter-NAME mentions inside `correct` and `giveAnswer` (e.g. the `"Yes! M says ..."` part) MUST be voiced as their natural NAME pronunciation (the long letter name "em") — they are NOT wrapped in `<phoneme>`. The wrap is on the SOUND only; the letter name is plain prose. This matches A1's no-pre-emptive-wrap stance (A1 §2.4 / §7 Q3) — defensive wrapping of correctly-pronounced words can degrade pronunciation (per `project_audio_phoneme_overrides` memory).

### 2.4. SSML-emission integration with `api/_tts.ts`

`api/_tts.ts:194-198` ships `PHONEME_OVERRIDES = { four: 'fɔːr' }` — a substitution registry that wraps whole-word matches at TTS render time. The existing infrastructure is the **closest available shape** for letter-sounds but needs two extensions before A5 can ship — see "Recommended architecture" below.

**Resolved during review (Devon, 2026-05-23) — inline-SSML-in-canon DOES NOT WORK against today's `api/_tts.ts`:**

- `escapeSsml` (`api/_tts.ts:117`) XML-escapes `<` to `&lt;` and `>` to `&gt;` on every text segment.
- `applyPhonemeOverrides` (`api/_tts.ts:227`) calls `escapeSsml` on every plain segment between regex matches; the regex only matches whole-word `PHONEME_OVERRIDES` keys (currently `\b(four)\b`).
- Any inline `<phoneme ph="m">mmm</phoneme>` placed in canon utterance text would therefore be escaped to literal entities (`&lt;phoneme ph=&quot;m&quot;&gt;mmm&lt;/phoneme&gt;`) and Azure would vocalize those entities as junk text.

Inline-SSML-in-canon is therefore NOT a viable path without modifying `_tts.ts` to add a skip-escaping mode — a coupling surface we explicitly want to avoid.

**Recommended architecture (PRIMARY): tier-aware extension of `PHONEME_OVERRIDES`.**

The Haiku directive emits utterance text with **plain mnemonic words** (`mmm`, `buh`, `o`, etc.) in the canon JSON's `utterances[].text` field. The browser-side renderer in `api/_tts.ts` wraps the mnemonics in `<phoneme alphabet="ipa" ph="...">` at render time via an extended `PHONEME_OVERRIDES` table that knows about both the mnemonic-to-IPA mapping AND the tier scope.

**Concrete shape (informs A7 Devon ticket):**

- Widen the type: `PHONEME_OVERRIDES: Record<string, { ipa: string; tiers?: TierId[] }>`.
- Existing `four` entry becomes `{ ipa: 'fɔːr' }` (no tier filter — global, preserves current behaviour).
- New letter-sounds entries: `mmm → { ipa: 'm', tiers: ['letter-sounds'] }`, `buh → { ipa: 'b', tiers: ['letter-sounds'] }`, etc. — see §2.3 table for the full mnemonic→IPA mapping for the 14 consonants + 5 short vowels.
- `applyPhonemeOverrides` accepts an optional `tierFilter?: TierId` parameter. When set, only entries whose `tiers` array is undefined (global) OR includes the current `tierFilter` activate. The caller (utterance render path) passes the source tier alongside the text.

**Why the tier-filter is load-bearing:** several mnemonics (e.g. `o`, `m`, `a`) are also plain English text fragments. Without a tier-filter, wrapping the letter `m` in every CVC utterance would mispronounce real words like "math" or "moth". The tier-filter ensures letter-sounds activates the phoneme set without polluting CVC-tier rendering.

**Cost/scope:** small. The `PHONEME_OVERRIDES` shape change is type-level + one regex builder + one parameter threaded through `applyPhonemeOverrides` to the call site. No canon shape change (utterances stay plain text). A7 Devon ticket scope is: canon bake + planner wiring + lint binding + this `PHONEME_OVERRIDES` extension. Spec §8 obs #4 covers the A7 ticket scope.

**Alternative considered and rejected: inline-SSML-in-canon with `_tts.ts` skip-escaping mode.** Would require adding an opt-out flag to `escapeSsml` and changing the canon utterance shape to carry "SSML or plain" hints. Larger code surface, larger blast radius for any escape-bypass bug. The tier-aware substitution table keeps SSML construction in one place (`_tts.ts`) and keeps the canon JSON plain text — easier to reason about and audit.

### 2.5. Acceptance criteria for Emma's spoken output

These are **Jessica's A8 E2E spec invariants** — testable from the rendered MP3 bytes (timing, presence) and from listening-test sign-off (acoustic accuracy). The A8 spec must cover at least:

1. **Phoneme presence in MP3:** for each utterance slot with an SSML wrap, the rendered MP3 must contain audible audio in the wrapped region (not silence — confirms Azure accepted the SSML).
2. **Per-vowel acoustic correctness:** `/æ/, /ɒ/, /ʌ/, /ɪ/, /ɛ/` must each be distinguishable on listening test. Specifically, `/ɪ/` and `/ɛ/` must be acoustically distinct from each other (the load-bearing test — Emma's voice has historically conflated these without SSML; we need to confirm with SSML they separate cleanly).
3. **Stop-consonant schwa tail:** `/p/, /b/, /t/, /d/, /k/, /g/` must be voiced with the SSML's recommended `puh/buh/tuh/duh/kuh/guh` mnemonic length (~150-250 ms total) — Emma's typical isolated-IPA rendering can be too clipped to hear cleanly on iPad speakers; the visible mnemonic provides the duration cue.
4. **Continuant length:** `/m/, /n/, /s/, /f/, /v/, /l/, /r/, /h/` must be voiced with sustained articulation (~300-500 ms) — the `mmm/nnn/sss` mnemonics are duration cues.
5. **Letter-name pronunciation:** in `correct` and `giveAnswer` slots, the letter mentions (e.g. "M says ...") must voice as the LETTER NAME ("em"), NOT as the phoneme. Confirms the SSML scope rule from §2.3 holds.

These are listening-test items (Thomas ear-test required per `jessica.md:99` — audio ear-test routes to Thomas on utterance-text/SSML payload changes; this whole spec is an SSML payload change). The A8 ticket brief MUST flag Thomas-ear-test as a required gate post-bake.

---

## 3. Distractor classes and selection rules

### 3.1. Per-tier distractor rule

Each problem emits **3 chips** (1 target + 2 distractors), mirroring every other Word Song tier (`wordDistractors.ts:65` `GENTLE_RAMP_THROUGH = 3`).

| Tier           | Problems | Distractor rule                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gentle`       | 1–3      | Both distractors from **clean-distinct consonant set** — different articulation place AND different voicing from target. E.g. target sound = `/m/` (bilabial nasal), distractors = `s` (alveolar fricative) + `t` (alveolar stop). No voiced/unvoiced partner of target appears.                                                                                                                                                             |
| `gentle-mixed` | 4–5      | One distractor from the clean-distinct pool; the other MAY be from a within-class trap (same articulation place OR same voicing as target — a soft trap). E.g. target = `/b/`, distractors = `s` (clean) + `p` (within-class trap — voiceless counterpart of `/b/`).                                                                                                                                                                         |
| `trap`         | 6–8      | When target IS a voiced/unvoiced consonant pair member (b/p, d/t, g/k, v/f, z/s, j/sh), at least one distractor MUST be the partner. When target IS the current-target vowel, at least one distractor MUST be a vowel-class neighbour (mastered vowel `a` or another short-vowel letter — see §3.2 for the i/e ban). When target is a mastered-consonant with NO within-class trap (e.g. `/h/`, `/r/`), trap window emits clean distractors. |

**Hard distinctness constraints (must hold for all 3 tiers, enforced by the Haiku directive and Devon's A7 lint binding):**

1. **All 3 chips are distinct letters.** No `[M, M, S]` trios. (Trivial.)
2. **The target chip is among the 3 chips emitted.** (Trivial.)
3. **Chip case is consistent with the read-line.** Per A1 §3.5 (Q1 default adopted): all 3 chips share the same case OR 2-of-3 share the target's case. Letter-sounds typically renders in lowercase (the alphabet glyphs Marian sees in CVC tiers are lowercase); the spec recommends **all chips lowercase by default** for letter-sounds, with uppercase as a less-common variant (~20% of sessions) once Marian is comfortable.
4. **No digit may appear as a chip.** Letter pool only.
5. **No same-letter-different-case in the same trio.** Per A1 §3.1.5.
6. **No long-vowel-pronunciation chip in any trio.** If target sound is `/æ/`, distractors may include `e, i, o, u` (other vowel letters) — but those distractor letters must, on tap, be evaluated against their SHORT-vowel sound mapping, not long. (Render contract: there is no spoken-distractor-confirmation phase; the wrong-tap path goes to `reprompt`. So this rule is enforced implicitly by the correct-answer match, not by extra spoken content. Flag for A8 E2E.)

### 3.2. The /i/ ↔ /e/ adjacency ban — distractor scope

Per §1.2, `/i/` and `/e/` may never both be TARGETS in the same session. **Distractor scope is a softer constraint:**

- **When current-target vowel is `/ɪ/`:** the letter `e` MAY appear as a distractor on consonant-target problems (low confusion risk — Marian isn't being asked to choose between sounds, just to identify the letter for the spoken consonant). The letter `e` MAY NOT appear as a distractor on the `/ɪ/`-target problems themselves (would force Marian to discriminate /i/ from /e/ before /e/ has been introduced as a sound).
- **When current-target vowel is `/ɛ/`:** same in reverse — letter `i` may appear as consonant-problem distractor but NOT as a `/ɛ/`-target-problem distractor.

This is the **soft distractor constraint**; the hard target constraint (§1.2 #1) is in compositionLint, but the soft distractor constraint may live in the Haiku directive as a SHOULD rather than a MUST. Open as §7 Q5 — sponsor preference.

### 3.3. Worked examples

| Tier         | Problem | Read line (with SSML)                                  | Target chip | Distractor 1 | Distractor 2 | Why                                                                                             |
| ------------ | ------- | ------------------------------------------------------ | ----------- | ------------ | ------------ | ----------------------------------------------------------------------------------------------- |
| gentle       | 1       | `"Which letter says <phoneme ph=\"m\">mmm</phoneme>?"` | `m`         | `s`          | `t`          | Clean distinct consonants. No within-class trap.                                                |
| gentle       | 2       | `"Which letter says <phoneme ph=\"h\">hhh</phoneme>?"` | `h`         | `l`          | `r`          | Clean distinct. `/h/` has no voicing partner.                                                   |
| gentle-mixed | 4       | `"Which letter says <phoneme ph=\"æ\">a</phoneme>?"`   | `a`         | `o`          | `u`          | Mastered vowel anchor. Distractors are other short-vowel letters (soft cross-vowel reminder).   |
| gentle-mixed | 5       | `"Which letter says <phoneme ph=\"b\">buh</phoneme>?"` | `b`         | `p`          | `s`          | Within-class trap (`/p/` is voiceless counterpart of `/b/`) + clean anchor.                     |
| trap         | 6       | `"Which letter says <phoneme ph=\"ɒ\">o</phoneme>?"`   | `o`         | `a`          | `u`          | Current-target vowel `/ɒ/` first emission. Distractors are mastered + next-future vowels.       |
| trap         | 7       | `"Which letter says <phoneme ph=\"ɒ\">o</phoneme>?"`   | `o`         | `e`          | `c`          | Current-target vowel second emission. Distractors mix vowel + consonant mass.                   |
| trap         | 8       | `"Which letter says <phoneme ph=\"d\">duh</phoneme>?"` | `d`         | `t`          | `b`          | Within-class trap (`/t/` voiceless counterpart) + cross-class (`b` is b/d/p/q confusion class). |

This is **one valid session shape** — many valid permutations exist. The Haiku directive's job is to sample within the §1.3 + §3.1 constraints, not to reproduce this exact session.

---

## 4. Visual / render contract (no picture pack)

### 4.1. Chip layout

**Identical to A1 letter-names** (intentional — they share the render surface). Three chips in a horizontal row, target chip random-position within the trio per the existing `AnswerChips` position-randomisation. Chip content is the letter glyph rendered as text, NOT a picture.

### 4.2. Glyph font and rendering

**Adopt A1's recommendation: Atkinson Hyperlegible.** Per A1 §4.2 + Q4 default. The dyslexia-friendly disambiguation matters even more here than in A1 because letter-sounds adds a layer of cognitive load (sound → glyph mapping is a new association, not a recognition recall). The font should not work against the pedagogy by introducing glyph ambiguity.

**Critical anti-pattern (adopted from A1):** do NOT use a stylised display font. The chip glyph IS the assessment.

**Glyph size:** same as A1 — ~64pt cap-height in the ~96pt-square chip. Centred horizontally and vertically.

**Glyph colour:** single dark colour per A1.

**Same-tier visual identity with A1:** A1 and A5 chips look identical on screen. Marian sees "a chip with a letter on it" in both tiers; the difference is the spoken prompt. This is intentional — minimises learning-curve on the chip-interaction layer; Marian focuses on the audio prompt, not the chip semantics.

### 4.3. No picture-pack budget impact

**No new entries in `public/assets/pictures/`** for this tier. No MJ generation, no remove.bg pass, no `yarn embed-pictures` run. The only artifact that ships is `public/canon/word-song/level-1/letter-sounds.json` plus the planner directive in `api/_planner.ts` plus the lone-literal addition to `WORD_SONG_FIRST_CLASS_FOCUS_NODES`.

### 4.4. Speech-ribbon caption walk — SSML stripped from display

The speech-ribbon caption renders the spoken read line **with SSML tags STRIPPED** — Marian sees `"Which letter says mmm?"` on screen, not `"Which letter says <phoneme ph=\"m\">mmm</phoneme>?"`. The caption renderer in `emma-character-and-animation.md` § "speech-ribbon caption walk" needs a `stripSsml(text)` helper (or the canon JSON ships a `displayText` field alongside `text` for SSML-bearing utterances). **Open as §7 Q2 — Devon's call at A7 impl time.**

The caption SHOULD reflect what Emma says (audio-text mirror per CLAUDE.md design principles), so the stripped caption is the right product behaviour — Marian hears "mmm" and reads "mmm" on the ribbon. The semantics of the ribbon text are "what Marian hears as words", not "the SSML source".

---

## 5. Progression criteria

### 5.1. Session-by-session

Standard Word Song session shape: **8 problems, one session-end celebration.** Same as A1 + every CVC tier.

A session is "complete" when all 8 problems have been attempted (regardless of accuracy). The `sessionEnd` event fires on problem-8 completion.

### 5.2. Per-problem accuracy

Standard 3-attempts-then-give-answer flow (same as A1 + CVC tiers — `audio-system.md` per-screen contract):

- **First-tap correct** → `correct` utterance plays, Emma celebration, chip pulse, move to next problem.
- **First-tap wrong** → `reprompt` utterance plays, chip dim on wrong tap, retry same problem.
- **Second-tap wrong** → `hint` utterance plays.
- **Third-tap wrong** → `giveAnswer` utterance plays, correct chip pulses, move to next problem.

**No tier-specific accuracy override** — letter-sounds uses the standard flow.

### 5.3. Promotion to next tier — composite vs per-vowel mastery (§7 Q4)

This is the **single biggest pedagogical question** for this tier. Two possible mastery shapes:

**Option A (recommended): per-vowel sub-mastery within `letter-sounds`.**

- Each of `/ɒ/, /ʌ/, /ɪ/, /ɛ/` has its own sub-mastery state (`unintroduced | practicing | mastered`).
- A vowel masters when its target-emission accuracy hits 80% across the last 3 sessions in which it was current-target (vs. the standard 90% threshold — lowered because letter-sounds is novel acquisition; per `phonics-sequence-marian.md` §Q5 the 90% rule applies to consolidated material, and short-vowel sound→letter mapping is genuinely new for Marian).
- The TIER (`letter-sounds`) masters when ALL FOUR vowels are sub-mastered.
- The picker walks past `letter-sounds` only when the tier is fully mastered.
- The current-target derivation (§1.4) reads sub-mastery state.

**Pros:** matches pedagogy precisely; honours the /i/ → /e/ sequencing ban (don't introduce /e/ until /i/ sub-mastered); gives Marian credit per-vowel as she progresses. **Cons:** requires `progress` doc shape change (add `progress.literacy.letterSoundsVowelStates: Record<Vowel, MasteryState>`), which is a Kevin/Devon migration cost in A7.

**Option B: composite mastery on the whole pool.**

- Standard 90% across 3 sessions — same rule as every other tier.
- No per-vowel tracking. Current-target vowel derivation falls back to "the next unintroduced vowel in sequence" (i.e. always introducing one at a time, but no gate on prior-vowel mastery — sessions cycle through vowels in fixed turn-order).
- The `/i/` → `/e/` adjacency ban is enforced at the per-session level only (§1.2 hard constraint #1).

**Pros:** zero `progress` doc change; ships against today's shape; A7 is a small canon-bake + planner directive PR. **Cons:** Marian could mass /e/ before /i/ is mastered — the cross-session ban (§1.2 hard constraint #2) cannot be enforced without sub-mastery tracking.

**Recommendation:** ship Option B in Wave 7, file Option A as a Wave 8 enhancement once A8 Jessica E2E confirms the basic plumbing works. The cross-session ban can be approximated in Option B by the planner directive's vowel-turn-order rule — Marian gets fixed-cadence vowel cycling (e.g. /o/-targeted session 1, /u/-targeted session 2, /i/-targeted session 3, /e/-targeted session 4, then mastery check), and the directive can hardcode "/e/-targeted session must follow /i/-targeted session by ≥2 intervening sessions" as a session-scoped rule. This is the simpler ship; Option A is the right long-term shape.

### 5.4. Realistic mastery timeline for Marian

Given Marian's mastered-consonants + mastered-/æ/ + novel-/o,u,i,e/ starting state:

- **Session 1 (current-target /ɒ/)**: 7-8 of 8 correct on first tap. The 2-3 /ɒ/-target items are the only items at real risk — Marian must form a brand-new sound→letter mapping. Plausibly 1-2 first-tap-wrong on /ɒ/ items, recoverable via hint slot. Result: tier flips `intro → practicing`; `/ɒ/` sub-state flips to `practicing` (under Option A) or just first-time emission cycle progresses (under Option B).
- **Sessions 2-3 (current-target /ɒ/, then /ʌ/)**: continued /ɒ/ practice + first /ʌ/ session. `/ʌ/` is the predicted high-risk vowel per `phonics-sequence-marian.md` §Q1 (Tagalog L1 interference — Marian renders `/u/` as long-oo). Expect 5-6/8 on first /ʌ/-target session; recovers over sessions 4-5.
- **Sessions 4-6 (continued /ʌ/ + first /ɪ/)**: `/ɪ/` is Marian's known weakness; expect 4-5/8 on first /ɪ/-target session. May need 3-4 sessions to consolidate.
- **Sessions 7-10 (continued /ɪ/, then /ɛ/)**: /ɛ/ arrives only after /i/ sub-mastery (Option A) or after fixed ≥2-session gap (Option B). Expect 5-6/8 on first /ɛ/-target session.
- **Sessions ~10-15**: tier flips `practicing → mastered`. Picker walks to `blending-cv`.

**Risk: /i/ or /e/ sticks below mastery threshold indefinitely.** Mitigation: the 80% sub-mastery threshold for novel vowels (Option A) is intentionally lower than the 90% applied to consolidated material. The mastery rule is calibrated for Marian's documented L2 starting state, not for an L1 5-year-old phonics learner. Per `phonics-sequence-marian.md` §Q5 + the 8-year-old L2 considerations, the 90% threshold is the right floor for consolidated material but is too aggressive for first-acquisition phoneme mapping.

**Open as §7 Q6:** which mastery threshold (80% / 85% / 90%) for letter-sounds sub-mastery? Spec recommends 80% on the pedagogical-fit reasoning above.

---

## 6. Mastery rule (summary)

**Recommended for Wave 7 ship: Option B composite — standard 90/3 cross-day-deduped rule** (no per-tier override in v1). The cross-session /i/ → /e/ adjacency ban is approximated by the Haiku directive's session-turn-order rule.

**Recommended long-term (Wave 8+): Option A per-vowel sub-mastery** with 80% threshold per vowel.

Implementation note: A7 ships Option B (no `mastery.ts` change). Option A is a follow-up ticket — flag in `letter-sounds.json`'s bake metadata so the Wave 8 enhancement is discoverable.

---

## 7. Open questions for sponsor

These are the decisions that need Thomas's call before A6 (Dave's directive) is locked. **All adopt A1's defaults where applicable (see §0).** Only the two questions below are genuine sponsor escalations from this spec — five other open-question candidates that surfaced during authoring were resolved as Devon/Dave impl calls or pre-locked precedent (see §8 appendix "Questions resolved during review" for the routing audit).

| #      | Question                                                                                                                                                                                                                                                                                                                     | Recommendation                                                                                                                         | Impact if flipped                                                                                                                                                                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q4** | **Mastery shape — Option A per-vowel sub-mastery (with `progress.literacy.letterSoundsVowelStates`) or Option B composite tier mastery (today's shape)?** Spec §5.3 recommends Option B for Wave 7 ship + Option A as Wave 8 follow-up. Option B approximates the cross-session ban via session-turn-order in the directive. | Option B for Wave 7. Option A in Wave 8.                                                                                               | If Option A is preferred for Wave 7: A7 Devon ticket scope widens to include `progress` shape migration + `defaults.ts` widening + `cloudSync.ts` migration (per `sibling-tier-checklist.md` partial coverage) + new `mastery.ts` branch. Probably +1 week to A7. |
| **Q6** | **Mastery threshold for letter-sounds — 80% (recommended per pedagogical fit) or 90% (standard tier threshold)?** Per `phonics-sequence-marian.md` §Q5: 90% is the consolidated-material rule; first-acquisition phoneme mapping is genuinely novel for Marian — applying 90% may strand her in `practicing` indefinitely.   | 80% threshold (per-vowel sub-mastery under Option A, OR composite under Option B). Lower threshold matches novel-acquisition pedagogy. | If flipped to 90%: Marian may stick in `practicing` on /i/ specifically (her known weakness) for many sessions. Mitigable by Option A's per-vowel granularity even if 90% is kept — only the /i/ sub-state would stick, not the whole tier.                       |

(Q4/Q6 numbering retained from the original sponsor-question slate so cross-references in the brief and PR body remain stable; the gaps Q1/Q2/Q3/Q5/Q7 reflect the resolved/reclassified items documented in §8 appendix "Questions resolved during review".)

---

## 8. Cross-tier concerns surfaced during authoring

These are observations made while drafting that may have implications for adjacent tiers or for the planner architecture. None are blockers for A5.

1. **The `blending-cv` stub fallback masks the un-shipped state of `letter-sounds`.** Identical to the A1 spec's observation #1. Telemetry would help. Out of scope for A5; flag for Wave 8+ observability.

2. **Cross-tier coherence with A1 letter-names — they ship as a bookend pair.** A1 + A5 are both bake-and-leave-ish, share the render contract (no pictures, letter chips), and share the Q1-Q6 defaults from PR #324. The natural progression for a fresh user is: session 1 = letter-names (most users alphabet-mastered, fast flip), session 2 = letter-sounds (genuinely novel for Marian, slow grind), session 3+ = blending-cv etc. Jessica's A4 + A8 E2E specs should be **paired** in the same dispatch wave to validate the bookend flow end-to-end.

3. **`api/_tts.ts` SSML escaping — RESOLVED during review (Devon, 2026-05-23).** `escapeSsml` (`api/_tts.ts:117`) escapes `<`/`>` on every plain text segment; `applyPhonemeOverrides` (`api/_tts.ts:227`) calls `escapeSsml` between regex matches. Inline `<phoneme>` markup in canon text is therefore escaped to literal entities and would vocalize as junk. **A6 directive authoring is NOT blocked.** The tier-aware substitution-table architecture (§2.4) is the locked path; Dave can author the A6 directive against the substitution-table contract without further investigation. **A7 Devon ticket scope MUST include the `PHONEME_OVERRIDES` extension** (widen to `Record<string, { ipa: string; tiers?: TierId[] }>`, thread `tierFilter?: TierId` through `applyPhonemeOverrides`) alongside the canon bake + planner wiring + lint binding. See §2.4 for the concrete shape.

4. **The `/i/` ↔ `/e/` adjacency ban is a NEW pattern in the codebase.** Today's compositionLint bindings are per-tier-scoped (e.g. sub-to-10 lint validates within a single tier's canon). The /i//e/ ban CROSSES tiers if we want to enforce cross-session — `letter-sounds` would need to look at the prior session's bake to enforce. This is **not enforceable in compositionLint** (which is bake-time, single-canon-aware) — it must live in either: (a) the runtime planner derivation (§1.4 algorithm), or (b) per-vowel sub-mastery tracking (Option A). Flag for Dave A6 directive: the cross-session ban is a runtime concern, not a compositionLint rule.

5. **Voiced/unvoiced consonant pair traps (§3.1) overlap with the b/d/p/q confusion class from A1.** Letter `b` is in BOTH the CIRCLE-STICK band (A1 §1.4 — Marian-specific visual confusion) AND the voiced-/b/-vs-voiceless-/p/ pair (this spec §3.1 — pedagogically-grounded auditory confusion). When a `/b/`-target problem in letter-sounds has `p` and `d` as distractors, BOTH classes are activated. This is **pedagogically correct** — it surfaces both confusion vectors in a single high-information problem — but worth noting that letter-sounds may end up being a stealth-mode b/d/p/q retainer for Marian alongside its primary phoneme-mapping job. Welcome side effect.

6. **The pool-extension five-point checklist in `skill-trees-and-content.md` does NOT apply to this tier** — same as A1 spec's observation #6.

7. **`api/_tts.ts:194-198` `PHONEME_OVERRIDES` is the only existing SSML phoneme injection.** Its docstring (lines 180-195) explicitly cautions against defensive wrapping (`"defensive wrapping of unaffected words can degrade pronunciation"`). The A5 spec's per-phoneme SSML wrap is NOT defensive wrapping — it is required wrapping for utterances whose semantic content IS an isolated phoneme. The distinction is: existing `PHONEME_OVERRIDES` patches word-level pronunciation errors in prose context (the word "four" said wrong); A5's SSML wraps create phoneme-only utterances that have no English-word equivalent. The Dave A6 directive should reference this distinction explicitly so future maintainers don't assume "no SSML in canon" is an invariant.

### Appendix: Questions resolved during review (not sponsor escalations)

Five candidate open-questions surfaced while drafting were resolved during Devon's review and pulled out of the §7 sponsor surface. Routing:

- **(was Q1) SSML emission architecture — RESOLVED by Devon.** Tier-aware substitution-table extension of `PHONEME_OVERRIDES` is the only viable path against today's `api/_tts.ts` (inline-SSML-in-canon gets XML-escaped by `escapeSsml` at line 117 before reaching Azure — see §2.4 + obs #3). No spike needed.
- **(was Q2) Speech-ribbon caption — `stripSsml(text)` helper vs. `displayText` companion field — Devon A7 implementation call.** Both shapes work; the choice is a render-side implementation detail Devon resolves at bake time. Spec §4.4 retains the recommendation (helper at render time, no canon shape change) as a default but does not escalate.
- **(was Q3) `compositionLint` binding for letter-sounds — pre-cleared by A1 Q6 default adoption.** A1 §7 Q6 adoption (see §0) carries the YES default forward; A7 ticket should bind the `TierLintBinding` mirroring sub-to-10's shape per `[[feedback_haiku_directive_sharpening]]` Pattern 7. No sponsor decision needed.
- **(was Q5) Distractor scope of /i//e/ ban (MUST vs SHOULD) — Dave A6 directive call, default to SHOULD.** Within directive-authoring tightness scope; the hard target-side ban (§1.2 #1) stays MUST in the directive, the distractor-side ban (§3.2) defaults to SHOULD. Dave can flip in the A6 directive if pedagogical reading supports tighter.
- **(was Q7) Voiced-th `/ð/` exclusion — pre-locked by `digraphs-th-voiceless` precedent.** Same conservative voicing posture as the digraphs-th-voiceless spec §1.4. No flip expected; listed in §1.1 for transparency only.

### Wave 7 plan amendment (for orchestrator)

The Wave 7 plan should reflect: **"Dave A6 dispatches after A1 AND A5 merge"** (NOT after A1 + spike). The spike on `api/_tts.ts` escaping behaviour is resolved during this review — the substitution-table architecture is locked. A6 needs to know which `PHONEME_OVERRIDES` extension it is emitting against, which requires A5 merged. A7 Devon ticket scope includes the `PHONEME_OVERRIDES` extension + tier-filter parameter alongside the canon bake + planner wiring + lint binding (see §2.4 and obs #3 for the concrete shape).

---

## 9. Cross-references

- Ticket `86c9y49ap` (this spec), epic `86c9y494c` (Wave 7), parallel ticket `86c9y4960` (A1 `letter-names` spec — PR #324).
- Downstream tickets: A6 (Dave directive, fires when A5 merged), A7 (Devon canon bake + planner wiring + lint binding, after A6 merged), A8 (Jessica failing-first E2E spec, parallel with A7).
- `design/word-song/letter-names-content.md` (A1 spec, PR #324) — sibling spec; defines Q1/Q3/Q4/Q5/Q6 defaults adopted here.
- `design/word-song/short-o-pool-expansion.md` — structural template precedent (per-tier content/pedagogy doc shape).
- `design/word-song/short-i-pool-expansion.md` — structural template precedent.
- `design/word-song/short-e-pool-expansion.md` — structural template precedent.
- `design/word-song/digraphs-th-voiceless` (`digraphs-th-word-list.md`) — precedent for excluding voiced-/ð/ on conservative voicing posture (adopted in §1.1).
- `design/research/phonics-sequence-marian.md` — short-vowel ordering (§Q1, locked `o → u → i → e`), /i//e/ acoustic-similarity ban (§Q1 Source 3), 90/3 mastery rule (§Q5), L2/Tagalog phonology context (§Q2), b/d confusion (§ "The b/d confusion").
- `CLAUDE.md` — Marian's current levels (consonants mastered; short-a mastered; o → u → i → e teach order).
- `.claude/docs/skill-trees-and-content.md` — Word Song tree promotion order, `WORD_SONG_FIRST_CLASS_FOCUS_NODES`, stub-fallback behaviour, pool-extension vs `SkillNode`-widening checklist distinction.
- `.claude/docs/audio-system.md` — Azure TTS voice (`en-US-EmmaMultilingualNeural`), SSML pipeline through `api/_tts.ts` and `api/_session.ts`.
- `.claude/docs/sibling-tier-checklist.md` — NOT applicable to this tier (per ticket non-obvious context); referenced here only to explicitly document non-application.
- `[[feedback_haiku_directive_sharpening]]` — Pattern 7 RULE_IDENTITY+SPEC+LINT triple-pin (informs §7 Q3).
- `[[feedback_distractor_class_pedagogical_gates_mechanical]]` — pedagogical-first audit for distractor classes (informs §3 distractor selection: voiced/unvoiced pairs and /i//e/ class are pedagogically-grounded, not mechanically-derived).
- `[[feedback_failing_first_must_prove_green]]` — A8 Jessica E2E spec must use canon-bytes mock per PR #283 pattern, not `failNetwork`.
- `[[project_audio_phoneme_overrides]]` — the existing single-phoneme override (`four → /fɔːr/`); precedent for the pattern but NOT the architecture (see §8 observation #7 for the distinction).
- `api/_tts.ts:180-198` — `PHONEME_OVERRIDES` docstring + table.
- `api/_planner.ts:643-680` — `WORD_SONG_FIRST_CLASS_FOCUS_NODES` + `effectiveFocusNode`; A7 must add `'letter-sounds'` to the literal array.
