# Word Song parser-widening plan

**Ticket:** `86c9kxp08` (step 1, MERGED as PR #132) +
`86c9kxu07` (step 2).
**Author:** Kevin (rule logic + adaptive engine ownership).
**Status:** Step 1 MERGED. Step 2 in flight (this PR).

This document is the canonical hand-off between the browser parser and
the Haiku planner system prompt for the Word Song track. It is the
implementation surface of the **planner-parser contract** (memory
`project_planner_parser_contract`).

---

## Why parser-first

The contract is binding: **widen the BROWSER PARSER first, then the
planner.** The reverse ordering caused a P0 regression on Word Song
during the M2 milestone:

- PR #117 widened the planner system prompt to emit
  `letter-sounds` content (`"Tap the letter that says /m/."`) when
  Marian's focus node was `letter-sounds`.
- The browser parser was unchanged. Its only accepted template was
  `"Tap the <word>."`. Every `letter-sounds` problem failed
  `parseReadTarget` and the screen silently fell back to the static
  short-a plan.
- PR #118 reverted by hard-clamping the picker (`focusNode.ts`) to
  `'blending-cv'` and re-clamping the planner system prompt to
  single-mode CVC short-a content. The clamp is the current
  prod posture.

The lesson: when the planner emits content the parser doesn't
understand, the screen silences. **Always widen the parser first** so
the next planner change is a one-side delta with the receiving end
already proven.

The `parser-first` rule is enforced in this folder by gating each
planner-system-prompt change behind a previously-merged parser change
that already accepts the new shape.

---

## Step 1 (this PR — `86c9kxp08`)

**Goal:** widen the browser parser to accept a second content type
(`cvc-word`) alongside the existing `blending-cv`.

**What changes:**

- `WordSongProblem` (in `wordSessionPlans.ts`) gains an optional
  `contentType?: 'blending-cv' | 'cvc-word'` discriminant. Optional for
  back-compat with hand-built static plans (`STATIC_WORD_SONG_PLANS`)
  and the test suite. The parser always sets it explicitly when
  building from the wire.
- `planFromServer.ts` exports a new `parseReadLine(read)` that returns
  `{ entry, contentType }`. It dispatches on the read-line template:
  - `"Tap the <word>."` → `contentType: 'blending-cv'` (existing v1
    template; no behaviour change for current sessions).
  - `"Read the <word>."` → `contentType: 'cvc-word'` (new template,
    parser-only today).
- The legacy `parseReadTarget(read)` becomes a thin wrapper that
  discards the discriminant. Same return shape, same exception class —
  existing call-sites are untouched.
- Both templates funnel through the same target-word membership check
  (`TARGET_WORD_SET`) so distractor-only entries (`bus`, `sun`, etc.)
  cannot slip through on either path.

**What does NOT change:**

- The wire-shape contract is preserved: `{ id, label, utterances:
[{ id, text }] }`. No new fields on the wire. The discriminant is
  derived from the read line, not stamped on the wire.
- The id namespace is preserved. Every problem utterance id is still
  `word.p<N>.<slot>`. The P0-incident `cvc.*` namespace is still
  rejected (the regression test for it stays green). Step 2 does NOT
  introduce a new namespace either — see §"Why no new id namespace"
  below.
- The picker (`focusNode.ts`) stays hard-clamped to `'blending-cv'`.
  The clamp's TODO comment will be removed in step 2.
- The planner system prompt (`api/_planner.ts WORD_SONG_TRACK_GUIDE`)
  is untouched. It still emits `"Tap the <word>."` exclusively.

**Why this content type next.** Per `LITERACY_TREE` in
`src/lib/progress/mastery.ts`:

```
letter-names  →  letter-sounds  →  blending-cv  →  cvc-words  →
digraphs  →  sight-words  →  simple-sentences
```

Marian's April 2026 diagnostic puts her at `cvc-words: 'intro'`. CVC
reading is her next progression beat — the right widening target for a
single-step-ahead parser change. `letter-sounds` is skipped because
the existing CV-blending content already exercises consonant + vowel
phonemes implicitly, and the prod incident showed the screen has no
viable rendering path for the
`"Tap the letter that says /m/."` template (tap-a-letter-tile is a
different UI affordance than tap-a-picture-chip; see §Out of scope).

---

## Step 2 (this PR — ticket `86c9kxu07`)

Goal of step 2: **make the planner emit `cvc-word` content + un-clamp
the picker** so Marian's focus moves to `cvc-words` once she masters
`blending-cv`. **This is the August 2026 timeline unblock for the
literacy track.**

**Concrete changes (DONE — this PR):**

1. **`api/_planner.ts WORD_SONG_TRACK_GUIDE` widens.** The previous
   single-mode prompt now describes TWO first-class content modes:
   - `focusNode === 'blending-cv'` → emit `"Tap the <word>."` problems
     (status quo).
   - `focusNode === 'cvc-words'` → emit `"Read the <word>."` problems.
     Word pool is the same 14 short-a CVC words; broader CVC pools
     are gated on Marian's vowel progression (see §Future tiers).
   - All other focus nodes (`letter-sounds`, `digraphs`,
     `sight-words`, `simple-sentences`) → fall back to `blending-cv`
     content as a STUB so the screen always renders. This is handled
     by `effectiveFocusNode` server-side; the user message just names
     `blending-cv` for those nodes. Future paired parser-then-planner
     widenings move each tier to first-class.
2. **`api/_planner.test.ts` regression tests updated.** The pre-step-2
   "single-mode" describe block becomes a "first-class blending-cv +
   cvc-words, untuned tiers stub" sweep. New round-trip tests live in
   `src/screens/WordSong/plannerRoundTrip.test.ts` and exercise
   planner→parser integration for both first-class modes plus the
   stub-fallback path.
3. **`src/lib/progress/focusNode.ts pickFocusNode` un-clamped.** The
   word-song branch now walks `WORD_SONG_NODES_IN_ORDER` honouring
   `skillLevels`, identical pattern to the math walker. Untuned tiers
   are safe to surface because the planner's stub-fallback content
   keeps them rendering. Tests pin AC scenarios (a/b/c) from ticket
   `86c9kxu07`.
4. **`MATH_FOCUS_NODE_GUIDE` is unchanged** (math track is not in
   scope).
5. **`scripts/generateSessionCanon.ts` adds `cvc-words`** to the
   word-song combo enumeration. Pre-step-2 the script baked only
   `blending-cv`; post-step-2 it bakes both first-class modes. Untuned
   tiers stay out of canon on purpose — they fall back to blending-cv
   content, so baking them would just be a wasteful duplicate of the
   blending-cv blob.
6. **No picture-asset dependency.** The cvc-word pictures are the
   same 22 the v1 pack already covers — see §Picture asset
   dependency.

**Why step 2 is a separate PR.** Bundling planner + parser changes is
exactly the failure mode that produced the P0 in PR #117. By splitting
the work, each side ships in isolation:

- Step 1 (PR #132 / `86c9kxp08`) was a pure-additive parser change.
  Existing prod sessions could not regress because the planner didn't
  emit the new template yet.
- Step 2 (this PR / `86c9kxu07`) ships only after step 1 is on `main`.
  The parser is proven to accept the shape; the planner change is a
  one-sided emission delta. If step 2 introduces a planner regression,
  step 1 stays valid and the revert surface is small (one file:
  `api/_planner.ts`).

---

## Why no new id namespace

A tempting design is to namespace cvc-word content under
`cvc.p<N>.<slot>` ids. Don't.

The post-fix planner contract (PR #118) explicitly forbids any
non-`word.*` prefix on problem utterances. The browser parser drops
out-of-namespace ids silently (the `skip-not-throw` rule for additive
emissions like `session.end.*`), so a `cvc.*` namespace would be
silently dropped — exactly the case-1 silence that bit prod. The
regression test
`wordSongSessionPlanFromServer — round-trips post-fix planner output`
pins this contract; we do not break it.

The discriminant therefore lives on the read-line template, NOT the
id namespace. This keeps the wire shape stable across content-type
widenings and the failure mode loud (an unrecognised template throws
a clear error rather than producing a silently-empty plan).

---

## Future tiers

Same parser-first ordering applies to every future widening. Per
`LITERACY_TREE`:

| Tier               | Read-line template (proposed)                                                                                                                                                                                          | Parser change                                        | Planner change             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------- |
| `cvc-words`        | `"Read the <word>."`                                                                                                                                                                                                   | DONE (PR #132, step 1)                               | DONE (this PR, step 2)     |
| `digraphs`         | TBD — likely `"Read the <word>."` with broader pool, or `"Find <digraph> in <word>."` if a tap-a-digraph-tile UI surface lands                                                                                         | Future PR — parser first                             | Future PR — planner second |
| `sight-words`      | TBD — likely `"Read the <word>."` with sight-word pool. Decoding strategy differs (memorisation, not sound-out) but the parser surface can be identical to cvc-word. UI affordance is the deciding factor.             | Future PR — parser first                             | Future PR — planner second |
| `simple-sentences` | Brand new shape — sentence + missing-word picker, or sentence + read-aloud confirmation. Not a `"<verb> the <word>."` template. The wire-shape contract may need to grow a `kind` field on each problem at this point. | Future PR — parser-design first, then implementation | Future PR                  |

**Heuristic for the verb choice in future templates.** Each verb
should be unambiguous in regex form (a different leading word from
already-accepted templates) and pedagogically meaningful. `Tap` =
match-picture-to-spoken-word. `Read` = decode-printed-word. A future
`Find` verb could mean find-letter-in-word (digraphs).

When a future tier needs more than one cosmetic differentiator (e.g.
sentence-level content), introduce an explicit per-problem `kind`
field on the wire shape. That's a non-additive widening — coordinate
the schema bump across this parser, the static plan generator, the
planner system prompt, and the UI in lockstep, ideally behind a
feature flag.

---

## Picture asset dependency

The browser parser is **asset-agnostic by design**. It does not
validate that `picture-{word}.svg` exists at
`/assets/pictures/`. The renderer (`wordPictures.tsx`) falls back to
the inline-SVG placeholder for any missing path; the parser does not
know or care.

The picture pack itself is tracked separately:

- Phase 1 prompt-sheet authoring: `design/word-song/` (Kyle, ticket
  `86c9kww0h`).
- Phase 2 Midjourney generation: Thomas, blocked on phase 1 merge.
- Phase 3 SVG trace + integration: Kyle (trace direction) + Devon
  (integration), blocked on phase 2.

The 22-picture pack covers the entire 14-target + 8-distractor pool
the parser already accepts. **No additional picture assets are
required for step 2** — the cvc-word content uses the same word pool
as `blending-cv` and therefore the same picture chips. When the planner
widens to broader vowel families (`short-o`, `short-u`, etc.), each
new vowel pack is a separate ticket per the §Future work table in the
picture-pack folder README.

---

## Provenance

- **Step 1 ticket:** `86c9kxp08`.
- **Binding memory:** `project_planner_parser_contract` — widen
  parser before planner; bundling caused a P0 regression on word-song
  (PR #117 → #118).
- **P0 incident audit:** `api/_planner.test.ts` describe block
  `word-song single-mode P0 regression (86c9kt47v)` and
  `planFromServer.test.ts` describe block
  `wordSongSessionPlanFromServer — round-trips post-fix planner output (P0 86c9kt47v)`.
- **Tree source of truth:** `src/lib/progress/mastery.ts
LITERACY_TREE` and `src/lib/progress/focusNode.ts
WORD_SONG_NODES_IN_ORDER`.
- **Wire-shape source of truth:** `api/_types.ts Utterance`,
  `api/_planner.ts PlannerPlan`, `src/screens/WordSong/planFromServer.ts ServerPlan`.
- **Marian's literacy levels:** `CLAUDE.md` §"Marian's current levels".
