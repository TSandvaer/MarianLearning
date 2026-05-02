# Word Song — picture pack design folder

**Audience:** Thomas (operator of the Midjourney generation pass), Kyle/Devon (vector trace + integration), Jessica (QA gate), Matt (routing).
**Author:** Marian Tutor design persona.
**Ticket:** `86c9kww0h` — Phase 1 of 3 (prompt sheet + style anchor authoring).
**Status:** Phase 1 spec — draft for Thomas review.

This folder is the canonical design surface for the Word Song picture chip pack. It supersedes the older monolithic `design/word-song-picture-pack.md` (kept on disk for git provenance until merge; treat this folder as the source of truth from this PR forward).

---

## Why this folder exists

Marian's Word Song surface needs **real, vocabulary-anchoring illustrations** for every CVC target word. Today only `pic-dog.svg` ships as a real picture; the other 21 pictures (cat, hat, bat, mat, bag, fan, man, pan, cap, can, tag, dad, jam, van + bus, sun, fox, cup, pen, log, pot) are inline-SVG silhouette placeholders per `wordPictures.tsx`.

Per CLAUDE.md (Marian's current levels): "CVC reading — Emerging; pair every word with picture for vocab." Per Dave's polish audit (2026-05-02) and Kyle's polish audit (2026-05-02, `design/audits/2026-05-02-polish/kyle-visual-ux.md`, P0 #5): the picture is the vocabulary teaching mechanism. Marian's bottleneck on Word Song is **vocabulary, not decoding** — CV blending is "confident" per the April 2026 diagnostic. Schematic silhouettes don't anchor meaning; real illustrations do.

Thomas locked the source decision 2026-05-02: **Midjourney generation using existing subscription**. Phase 2 (Thomas) iterates the generations. Phase 3 (Kyle/Devon) traces the chosen images to SVG and ships them as `picture-{word}.svg` at `public/assets/pictures/`.

---

## Phase model

| Phase | Owner | Output | Status |
| ----- | ----- | ------ | ------ |
| 1. Prompt sheet + style anchor | Kyle (this PR) | `picture-pack-style-anchor.md`, `picture-pack-prompts.md`, `picture-pack-iteration-plan.md`, this README | Draft, this PR |
| 2. Midjourney generation | Thomas | 22 source images (PNG, ≥1024×1024) per `picture-pack-iteration-plan.md` | Blocked on phase 1 merge |
| 3. SVG trace + integration | Kyle (trace direction) + Devon (integration) | `public/assets/pictures/picture-{word}.svg` × 22 + `wordPictures.tsx` switch from inline to `<img>` | Blocked on phase 2 |

**v1 scope = 22 pictures total.** 14 CVC short-a target words + 8 distractor-only pictures, exactly matching `src/screens/WordSong/wordPack.ts` and `api/_plannerWordList.ts`. No other vowels in v1 — see §Future work.

---

## Files in this folder

- **`README.md`** (this file) — folder index, phase model, scope.
- **`picture-pack-style-anchor.md`** — the locked style frame every Midjourney prompt inherits. Aspect ratio, palette, line weight, framing, anti-references. Lifted from Emma's reference-styles doc and tightened for object/animal subjects rather than character work.
- **`picture-pack-prompts.md`** — per-word prompt rows. One row per word with: word, full Midjourney prompt, vocabulary cue, forbidden-pair distinguisher, notes.
- **`picture-pack-iteration-plan.md`** — Thomas's Midjourney workflow for phase 2. Single-seed strategy, common preamble, drift table, escalation ladder, quality gate.

---

## Word list scope (locked v1)

Source of truth cross-checked across three files:

- `api/_plannerWordList.ts` line 22 — `WORD_SONG_TARGET_WORDS_FOR_PROMPT` = `'cat, hat, bat, mat, bag, fan, man, pan, cap, can, tag, dad, jam, van'` (14 words).
- `src/screens/WordSong/wordPack.ts` — `TARGET_WORDS` (14 entries) + `DISTRACTOR_ONLY_WORDS` (8 entries: `bus, sun, dog, fox, cup, pen, log, pot`).
- `design/word-song-picture-pack.md` (Kyle, merged) — the original 14+8 pack spec.

**All three agree.** Total v1 picture count: **22**.

| Pool | Count | Words |
| ---- | ----- | ----- |
| CVC short-a target words | 14 | cat, hat, bat, mat, bag, fan, man, pan, cap, can, tag, dad, jam, van |
| Distractor-only pictures | 8 | bus, sun, dog, fox, cup, pen, log, pot |

**`pic-dog.svg` is already shipped as a real illustration.** Phase 2 either re-generates it for style consistency with the rest of the pack OR phase 3 keeps the existing asset and runs the other 21 through Midjourney. **Recommendation:** re-generate `dog` so all 22 share one Midjourney session's stylization; phase 3 then traces all 22 to SVG, replacing `pic-dog.svg` with the new trace. Avoids the "21 fresh + 1 vintage" style mismatch.

### Why not o/u/e/i in v1

The brief's suggested coverage included short o/u/e/i CVC words. Cross-check against the planner:

- `api/_planner.ts` line 626 caps Word Song to "CVC short-vowel" with the 14-word list above — **all short-a only**.
- The planner clamps Word Song to `blending-cv` per `project_planner_parser_contract` memory; the broader vowel progression is gated on Marian reaching mastery on short-a.
- Adding picture assets without server + client wordlist edits would ship a 22-picture pack the app can't surface.

**v1 ships 22 pictures matching the live word list. Future vowel families are tracked in §Future work below — separate ticket per vowel pack.**

---

## Style anchor — one paragraph TL;DR

See `picture-pack-style-anchor.md` for the full frame. The shorthand: **Emma's tonal sibling.** Soft-line digital illustration, warm pastel palette extending the existing `--my-rose` / `--my-cream` / Emma-skin family, single subject centered on solid soft-cream background, no text or environmental detail, child-recognizable for an L2 8yo without prior word knowledge. The picture carries the meaning; the chip carries the picture.

---

## Coverage breakdown (Jessica QA reference)

| Coverage axis | Count | Note |
| ------------- | ----- | ---- |
| Total pictures | 22 | Matches `wordPack.ts` ALL_WORDS length |
| Target words | 14 | All short-a CVC; matches `TARGET_WORDS` |
| Distractor-only | 8 | Mixed vowels; matches `DISTRACTOR_ONLY_WORDS` |
| Forbidden-pair distinguishers required | 5 | `cat↔dog`, `bus↔van`, `pan↔pot`, `cap↔hat`, `man↔dad` per `FORBIDDEN_PAIRS` |
| Rhyme-family clusters | 6 | `/æt/` (cat/hat/bat/mat), `/æn/` (fan/man/pan/can/van), `/æg/` (bag/tag), `/æp/` (cap), `/æd/` (dad), `/æm/` (jam) |
| Animals | 4 | cat, bat, dog, fox — all must read as distinct silhouettes |
| Vehicles | 2 | bus, van — silhouette-distinct |
| People | 2 | man, dad — silhouette-distinct via parent-with-child mitigation for `dad` |
| Kitchen / household | 5 | mat, fan, pan, pot, jam |
| Clothing / accessories | 2 | hat (sun hat), cap (baseball cap) |
| Objects | 5 | bag, tag, can, log, pen |
| Vessels | 1 | cup |
| Celestial | 1 | sun |
| Food | 1 | jam |

---

## Forbidden-pair distinguisher rules (v1)

The distractor system already encodes 5 pairs that must never appear in the same trio (silhouette-similarity rule, per `wordPack.ts` `FORBIDDEN_PAIRS`). The picture pack must back this up by making each pair **visually distinct** — even if the system fails to honor the rule, the pictures themselves should not collapse to the same read.

| Pair | Distinguisher (picture-side) |
| ---- | ---------------------------- |
| `cat` ↔ `dog` | Cat: pointed-up triangular ears, whiskers, narrow muzzle, tail curled at base, sitting upright. Dog: floppy or rounded ears, broader muzzle, tail down or wagging, sitting alert. **Different ear shapes carry the discrimination at 96pt.** |
| `bus` ↔ `van` | Bus: longer, multiple windows along the side (3+), distinctive flat front. Van: shorter, 2 windows, more car-like proportions, side door. **Window count + length carry the discrimination.** |
| `pan` ↔ `pot` | Pan: shallow round disc, single long handle extending right. Pot: deep cylinder, two short handles on opposite sides. **Handle count + depth carry the discrimination.** |
| `cap` ↔ `hat` | Cap: baseball cap with peak/visor extending forward. Hat: wide-brimmed sun hat with band/ribbon. **Brim shape carries the discrimination.** |
| `man` ↔ `dad` | Man: standalone adult-figure silhouette, neutral standing pose. Dad: parent-with-child composition (parent holding child's hand). **Composition carries the discrimination — `dad` is two-figure, `man` is one-figure.** |

These distinguishers are repeated in `picture-pack-prompts.md` per row so the prompt itself enforces them.

---

## Anti-dark-pattern audit (inherited)

Per CLAUDE.md non-negotiables and parallel to the Word Song spec audit:

- [x] No picture conveys urgency, danger, or shame.
- [x] No anthropomorphised non-human characters (no smiling fan with a face, no friendly bus with eyes, no fanged bat).
- [x] No real character likeness or branded imagery (no Pikachu, no McDonald's, no Sanrio characters drawn directly).
- [x] No text inside any picture (English or otherwise).
- [x] No background — every picture is a single subject on transparent / solid soft-cream that gets keyed to transparent in phase 3.
- [x] No gendered or culturally narrow imagery — `man` and `dad` are deliberately stylised, not detailed; outfit and ethnicity cues stay neutral.
- [x] `bat` is friendly, big-eyed, no fangs, NOT scary or Halloween-coded. Per `project_spec_drift_decisions` memory K = "Sanrio-style friendly bat (big eyes, no fangs)."

---

## Future work (out of scope for v1)

When Word Song expands to short-o, short-u, short-e, short-i (per Dave's recommended vowel sequence: o → u → e → i), each vowel family gets its own picture pack with the same structure as this folder.

**Per-vowel pack skeleton (when scoped):**

```
design/word-song/
├── picture-pack-style-anchor.md      (shared, v1)
├── picture-pack-prompts.md           (v1 — short-a, this PR)
├── picture-pack-prompts-short-o.md   (v2)
├── picture-pack-prompts-short-u.md   (v3)
├── picture-pack-prompts-short-e.md   (v4)
├── picture-pack-prompts-short-i.md   (v5)
├── picture-pack-iteration-plan.md    (shared, v1)
└── README.md                          (folder index, this file)
```

**Cross-vowel reuse:** distractor-only pictures from this v1 pack become target words in subsequent vowel packs — `dog`, `fox`, `log`, `pot` are short-o targets; `sun`, `cup`, `bus` are short-u targets; `pen` is a short-e target. No re-generation needed for those when the next pack ships; they ship as `picture-{word}.svg` once and serve every pack.

Tentative future pool per Dave's research memo `design/research/phonics-sequence-marian.md`:

| Vowel | Candidate target words |
| ----- | ---------------------- |
| short-o | dog, mop, box, top, pot, log, hop, dot, fox, cop |
| short-u | sun, cup, bug, mud, run, hug, nut, pup, cut, tub |
| short-i | pig, sit, hit, lip, tin, bin, wig, dip, fin, kit |
| short-e | bed, hen, leg, net, pen, red, web, ten, den, get |

**Do not author those packs now.** Each is gated on (a) Marian reaching ~90% accuracy on the prior vowel and (b) the planner widening to the new vowel (planner edit + `wordPack.ts` edit + word list contract edit, per `project_planner_parser_contract` memory: widen the parser BEFORE the planner).

---

## Provenance

- **Ticket:** `86c9kww0h` — Phase 1 prompt-sheet authoring.
- **Source decision:** Thomas locked Midjourney 2026-05-02.
- **Polish-audit grounding:** `design/audits/2026-05-02-polish/kyle-visual-ux.md` P0 #5 (silhouette placeholders break vocabulary anchoring); `design/audits/2026-05-02-polish/dave-developmental.md` (vocabulary is Marian's bottleneck on Word Song).
- **Predecessor spec:** `design/word-song-picture-pack.md` (sourcing options A/B/C draft, superseded by Thomas's lock).
- **Word list source of truth:** `api/_plannerWordList.ts`, `src/screens/WordSong/wordPack.ts`.
- **Style inheritance:** `design/character-emma.md` §2.1, `design/character/reference-styles.md`, `design/character-emma-ai-prompts.md` §1 (base prompt structure).
- **Forbidden-pair source:** `src/screens/WordSong/wordPack.ts` `FORBIDDEN_PAIRS`.
- **Phonics sequence:** `design/research/phonics-sequence-marian.md` (Dave).
- **Locked decisions:** `project_spec_drift_decisions` memory (K = keep `bat` Sanrio-style friendly; L = keep `dad` parent-with-child pose).
- **Asset format lock:** `project_pic_dog_svg` memory — SVG vector for all CVC pictures.
