# Word Song — Short-a CVC Picture Pack v1

**Audience:** Thomas (taste / curriculum sign-off), Matt (asset-pipeline routing), Kyle (author), Devon (consumes the file naming + word→asset map once approved), Jessica (validates against this list during QA).
**Status:** Proposal — draft. Sourcing/commissioning decisions deferred to Thomas. Spec PR #61 (`design/screen-4-word-song.md`) is the parent surface; this file fills its Open Question #3 (canonical word list) and #4 (picture-asset sourcing pipeline).
**Surface:** Picture chips and word-card pictures for the Word Song screen, v1 short-a CVC sessions.
**Scope:** 14 target words + 8 distractor-only pictures = 22 illustrations. Style-locked to Melody. Sourcing options provided per-picture.

This file is the canonical short-a CVC picture pack. It supersedes the inline candidate list in PR #61 §Open Questions #3 once Thomas signs off. Subsequent vowel families (short-o, short-u, short-i, short-e) get their own picture packs in their own files when those screens scope; see §Future work for the slot.

> **Phonics-sequence dependency:** Dave's research memo (`design/research/phonics-sequence-marian.md`, landed on `main` 2026-04-26) confirms short-a CVC as the right v1 surface and gives a recommended word inventory (`cat, hat, bat, mat, bag, map, fan, man, pan, tap, nap, cap, rat, van`). This pack draws from that inventory and from PR #61's candidate pool, intersected and tightened against Marian's L2 context. Where the two lists differ, this file documents the choice.

---

## Goal

Give Thomas a concrete picture list to approve, edit, or reject — not an abstract "commission or curate" question. Every target word in this pack is paired with: a picture brief specific enough that an illustrator or curator could execute it, a sourcing route, a style anchor, and a pre-vetted distractor pairing for both the gentle and trap tiers of the Word Song distractor policy.

**This pack is not** a commissioning brief by itself (that's a separate workstream once Thomas picks a sourcing path), nor an implementation spec for `wordDistractors.ts` (that's Devon's, off the merged Word Song spec). It's the _content layer_ — the actual nouns, the actual pictures, the actual pairings.

---

## Selection criteria (why these 14, not the others)

Words considered: the union of Dave's recommended inventory (14 words) and PR #61's candidate pool (12 words) = 18 unique candidates.

**Inclusion criteria — a word makes the v1 pack only if it satisfies all four:**

1. **CVC short-a.** Consonant + short /æ/ + consonant. No CVCe, no consonant blends, no digraphs.
2. **Concrete and unambiguously picturable** at 96×96pt chip size. A child looking at the picture should arrive at the target noun without prior context.
3. **In Marian's likely vocabulary.** Per April 2026 diagnostic: she has Tagalog-mediated picture-book exposure (cat, dog, sun, hat — all confirmed cold). Words that require Western-cultural knowledge (e.g. `lab` as in laboratory, `vat`) are excluded. Filipino household items (electric `fan`) are favoured per Dave's research §Q2.
4. **Distractor-friendly within the pack.** A target word that has no good gentle-tier or trap-tier pairing in the pack is dropped; the discrimination quality of the surface depends on each word having usable distractor neighbours.

**Exclusion criteria — words dropped from the candidate union:**

| Word  | Why dropped                                                                                                                                                                                                    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rat` | Picture indistinguishable from `cat` and `bat` at 96pt (small four-legged animal). Fails silhouette-distinctness rule (Word Song spec §Distractor policy constraint #2). Also less child-friendly connotation. |
| `tap` | Picture-ambiguous: water tap, a single tap action, a dance tap? Multiple valid renderings would make this chip read differently across sessions. Drop.                                                         |
| `nap` | Hard to picture without a person/character; picturing a child napping introduces a second human figure that competes with Melody for attention. Drop.                                                          |
| `map` | Picturable, but maps are abstract for an 8-year-old who has limited geography exposure. The picture would have to be a stylised cartoon map, which dilutes the vocabulary anchor. Defer to v2.                 |
| `sad` | Picturing "sad" requires either a sad face (which conflicts with Melody's warm tone — a sad face on the chip pulls emotional weight) or a sad emoji-style icon (style mismatch). Drop.                         |

**Net pack:** 14 target words + 8 distractor-only pictures.

**Sanity check against Dave's research memo §"Application to Marian → Short-a words":** Dave's recommended pool was `cat, hat, bat, mat, bag, map, fan, man, pan, tap, nap, cap, rat, van`. After exclusions (`rat`, `tap`, `nap`, `map`), the surviving overlap is `cat, hat, bat, mat, bag, fan, man, pan, cap, van` — 10 words. To reach 14, add `can, tag, dad, jam` — all CVC short-a, all picturable, all in Marian's likely vocabulary, all distractor-friendly. None of the four additions conflict with Dave's exclusion criteria. Documented at §Per-word picture briefs.

**Difference from PR #61's candidate pool:** PR #61 listed `cat, bat, hat, mat, can, fan, man, pan, bag, tag, sad, dad` (12 words). This pack drops `sad` (per exclusion table) and adds `cap, van, jam` for distractor-trio diversity (alliteration distractor for `cat`, vehicle distractor that isn't a `bus`, and a new ending-consonant /m/ for trap-tier discriminations).

---

## Style requirements (locked across all 22 pictures)

The pack must read as one coherent visual world — Melody's world. Style mismatch within the chip trio would foreground the style as the discrimination cue rather than the meaning, which fails the spec's §Distractor policy constraint #5.

**Visual language (locked):**

- **Format:** SVG, optimised. Target file size: <30 KB per picture (per PR #61 §Assets required). Where SVG isn't available from the source (e.g. photographic stock), commission an SVG re-illustration; do not ship raster.
- **Palette:** primary fills from the existing Melody palette tokens — `--my-rose` (`#FFB7C5`), `--my-cream` (`#FFF5F0`), `--ink` (`#3B3B3B`), `--sparkle` (`#FFD966`). Object-specific colours allowed (a `bus` is yellow or blue, not pink) but must use a desaturated, illustrated palette — no neon, no pure black, no high-contrast photographic colour.
- **Line weight:** consistent ~3pt outer stroke at the picture's native render size. No outlineless flat illustrations (they'd disappear against the cream background), no detailed inked line art (clashes with Melody's soft round forms).
- **Pose / framing:** single subject, side or three-quarter view, friendly expression where the subject has a face, centred in a square frame with ~12% margin so the picture has visual breathing room inside the chip.
- **No backgrounds.** Each picture is the subject on transparent. The chip's cream-fill background is the only ground.
- **No text inside the picture.** No labels, no environmental signage. (The word-card letters carry the text; the picture carries only the meaning.)
- **No human characters except Melody.** All animals and objects are non-anthropomorphic. A `cat` is a cat, not a cartoon cat in clothes; a `fan` is a fan, not a friendly fan with a face. This protects Melody's role as the only character in Marian's session.

**Style anchors (existing assets to match):**

- `melody-idle.svg` (live in repo) — line weight, eye-shape style, palette saturation. The pack should look like it lives in the same illustrated book as Melody.
- `flower-glyph.svg` (Math screen, on `assets-todo.md`) — once it lands, picture-pack illustrations should match its line treatment.

**Anti-style examples (do not commission these):**

- Realistic 3D-rendered or photographic stock (style mismatch with Melody).
- Flat emoji-style icons (too low information for an 8-year-old, no warmth).
- Dense detailed line art (kawaii-detailed Sanrio merch style — beautiful but too much information for a chip-sized picture).
- Stock children's-book illustration with a different illustrator's hand (e.g. Eric Carle collage style, or Sandra Boynton thick-line cartoon) — both lovely, neither matches Melody's aesthetic.

**Pictures that must NOT match Melody too closely:** the `cat` picture especially must not read as a _bunny_ (Melody is a bunny). Domestic short-haired cat with clearly cat-shaped ears, whiskers, and a cat tail — not rabbit ears, not a rabbit-shaped face. Same precaution for `bat` (must read as a flying bat, not a bunny in flight).

---

## Sourcing options (Thomas decides per-pack, not per-picture)

Three viable routes. The pack should ship via _one_ of these — mixing routes risks style fragmentation.

### Option A — Commission a single illustrator

**What it looks like:** hire one illustrator on Fiverr / 99designs / direct referral to draw all 22 pictures in one batch with a shared style guide based on Melody.

- **Estimated cost:** $5–15/picture × 22 = $110–330 total. Higher end ($330) buys revisions and SVG delivery.
- **Lead time:** 1–2 weeks from brief approval. Most Fiverr children's illustration sellers turn a 20-piece pack in 7–10 days.
- **Quality:** highest. Illustrator can sight-match Melody and adjust per Thomas's feedback.
- **Risk:** illustrator availability / sample-quality variance. Mitigation: Thomas picks the illustrator from sample portfolios, locks one before brief.
- **Style consistency:** highest — single hand, single brief.
- **Recommended for:** Thomas's default if budget allows; gives the cleanest aesthetic outcome.

**Specific Fiverr search hints (for whoever places the order):** search terms like _"cute children's book illustration, pastel, kawaii, SVG"_ — filter to sellers with cat/animal portfolios, ≥4.8 stars, ≥50 reviews. Provide them: this file, `melody-idle.svg`, the target word list, the style requirements section.

### Option B — Curate from licensed illustrated noun packs

**What it looks like:** find a single open-licensed (CC-BY or CC0) or commercially-licensed children's-book illustration pack on a stock site (Vecteezy, Freepik Premium, IconScout, Storyset by Freepik) that includes all 22 nouns in a consistent style. Pay per-picture (typically $1–3 each via Premium subscription) or use CC0 sets.

- **Estimated cost:** $0 (CC0) to $80 (premium subscription month + downloads). Most shoestring.
- **Lead time:** hours to a day, once a pack is identified.
- **Quality:** medium. Hard to find a single pack that has all 22 nouns; usually the curator ends up with 16 from one set and 6 from another, breaking style.
- **Risk:** style fragmentation. A `cat` from one Vecteezy set + a `bus` from another will not match.
- **Style consistency:** medium-low. Possible only if the curator finds a pack with all 22.
- **Recommended for:** budget-constrained; only if Thomas accepts that some style variation will be visible.

**Specific recommendations to evaluate:**

- **Storyset by Freepik** (https://storyset.com) — pastel children's illustration, style-coherent, free with attribution. Has most animals and household objects. Style is closer to "modern flat" than to Melody's hand-drawn warmth, but it's the closest free option that scales to 22 pictures.
- **OpenClipart** (https://openclipart.org) — CC0, no attribution, but style is wildly inconsistent across contributors. Usable only if curator commits to the time of finding 22 from a single contributor's portfolio. Unlikely to succeed.
- **The Noun Project** (https://thenounproject.com) — icon-style, single-line, abstracted. **Do not use** — too low information for the picture-as-meaning role this pack plays.

### Option C — AI-generated with consistent style prompt

**What it looks like:** generate all 22 pictures via Midjourney / DALL-E 3 with a single style prompt anchored on Melody. Iterate per picture until the style holds. Vectorise the raster outputs.

- **Estimated cost:** Midjourney subscription ($30/month) + ~30 minutes per picture for prompt iteration + manual SVG vectorisation (free tools or another commission). Net: $30 + ~10 hours of Kyle's time.
- **Lead time:** 1–2 days if the prompt nails it on the first try; 4–5 days if iteration is needed.
- **Quality:** medium-high. Modern AI image models can match a style prompt well if the prompt is tight; the failure mode is subtle inconsistency that humans catch and AI doesn't.
- **Risk:** style drift between pictures (the model interprets "soft pastel illustrated" differently for `cat` vs `bus`); IP/licensing posture for AI-generated content is still ambiguous in some jurisdictions; the resulting pictures are not legally defensible as "original" work for any potential future commercial use. For Marian's personal-educational use case, this is acceptable per the brief.
- **Style consistency:** medium. Better than Option B, worse than Option A.
- **Recommended for:** Kyle's hands-on backup if Options A and B both fall through. Workable but lower-quality than Option A.

**Specific prompt seed** (for whoever drives the AI gen): _"soft pastel illustration, children's book style, single subject on transparent background, gentle pink and cream palette, 3pt outer line, friendly rounded forms, kawaii but not detailed, flat colour fills with simple shading, square framing with margin, kid-readable at 96px square"_. Append the noun. Iterate.

### Hybrid options (rejected for v1)

- **Mix Option A and Option B:** commission the 6 hardest-to-curate, curate the easy 16. Rejected — the style-mix problem is the point of having one pipeline. The "easy" curated ones will look noticeably different from the commissioned ones. If Thomas wants to save money on the easy ones, the right move is to commission all 22 in one batch and negotiate a bulk rate with one illustrator.

**Recommended default (until Thomas chooses):** Option A. Cleanest outcome, predictable lead time, manageable cost. Falls back to Option C if budget is hard-zero.

---

## Per-word picture briefs (14 target words)

Format per word:

```
WORD — picture target — L2/cultural fit — sources — distractor pairings
```

Distractor pairings list the gentle-tier (problems 1–3) and trap-tier (problems 4–8) candidates from the §Distractor pairing matrix. The full pairing matrix is at the end of this section.

---

### 1. `cat`

- **Picture target:** Domestic short-haired cat, sitting upright, three-quarter view, friendly expression, pointed ears, whiskers, simple cat tail curled at the base. Pink nose, soft tabby or solid grey/cream coat. Eyes open, soft.
- **L2/cultural fit:** **Strong.** Cats are universal — Marian recognised `cat` cold in the diagnostic. No cultural ambiguity. Tagalog `pusa` is fully equivalent.
- **Style risk:** must NOT read as a bunny (Melody is a bunny). Pointed ears, not floppy; whiskers visible; cat-shaped face proportions (longer muzzle than a bunny, narrower).
- **Sources:**
  - Option A — Fiverr brief: "sitting cat, three-quarter view, pastel illustration, soft pink-and-cream palette, kawaii but not super-detailed, no background, cat-shaped not bunny-shaped"
  - Option B — Storyset has cats in their "Animals" pack at https://storyset.com/animals — the "Tabby cat" sticker style is closest to Melody's tone
  - Option C — Midjourney prompt: appended `domestic short-haired cat sitting, friendly expression, pastel children's book illustration` to the seed
- **Distractor pairings:**
  - **Gentle (problems 1–3):** `bus` (vehicle, /b/-start, no overlap), `sun` (celestial, /s/-start, no overlap)
  - **Trap (problems 4–8):** `bat` (rhyme + same vowel + same ending /æt/), `cap` (alliteration + same vowel /æ/, different ending)

---

### 2. `hat`

- **Picture target:** Sun hat or simple top hat with a brim, viewed three-quarter from the side. Soft pastel colour (rose or cream). Simple band or ribbon detail.
- **L2/cultural fit:** **Strong.** Hats are universal. Marian read `hat` correctly in her diagnostic. Tagalog `sumbrero` is fully equivalent.
- **Style risk:** must read as a hat at 96pt — a wide-brimmed sun hat (most kid-readable) is preferred over a baseball cap (which would visually conflict with `cap`).
- **Sources:**
  - Option A — Fiverr brief: "soft pastel sun hat with simple band, three-quarter view, kid-friendly illustration, pastel palette"
  - Option B — Storyset accessories pack has multiple hat styles; pick the one that doesn't read as a `cap`
  - Option C — Midjourney prompt: `pastel sun hat with simple ribbon, single subject, transparent background, illustrated style`
- **Distractor pairings:**
  - **Gentle:** `dog` (animal, /d/-start), `cup` (vessel, /k/-start)
  - **Trap:** `cat` (rhyme + same vowel + same ending /æt/), `bag` (same vowel + same starting position rhyme structure /æ\_/)

---

### 3. `bat`

- **Picture target:** Flying bat (the animal — not a baseball bat), wings spread, viewed front-on or three-quarter. Soft purple or grey colour, friendly face (small smile, big eyes), no scary or fanged elements.
- **L2/cultural fit:** **Medium.** The animal `bat` is recognisable in the Philippines (Filipino fruit bats are well-known) but the _English word_ may not be in Marian's active vocabulary yet. The picture has to do the lifting. Tagalog `paniki` (fruit bat) is the equivalent.
- **Style risk:** must NOT read as a baseball bat (the inanimate object), and must NOT read as scary/Halloween. Friendly cartoon flying bat — closer to Sanrio's own bat character (Kuromi's vibe) than to a horror-movie bat. Rounded wings, big eyes.
- **Sources:**
  - Option A — Fiverr brief: "cute friendly flying bat, wings spread, pastel illustration, big eyes, no fangs, soft purple, like Sanrio character"
  - Option B — Storyset Halloween pack has bats but most are too spooky; harder to source via Option B
  - Option C — Midjourney prompt: `cute friendly cartoon flying bat, big eyes, soft purple, pastel illustration, kawaii not scary`
- **Distractor pairings:**
  - **Gentle:** `sun` (celestial, /s/-start), `cup` (vessel, /k/-start)
  - **Trap:** `cat` (rhyme + same vowel + same ending /æt/), `hat` (rhyme + same vowel + same ending /æt/)

---

### 4. `mat`

- **Picture target:** Bath mat or doormat, square or rectangular, viewed straight-on with slight perspective so it reads as 3D. Soft pastel weave pattern (simple stripes or dots). Cream or rose base.
- **L2/cultural fit:** **Medium-strong.** Mats (banig — woven mat, very common in Filipino homes) are deeply familiar to Marian. The picture will likely be more familiar to her than the English word; that's exactly the picture-as-vocabulary-scaffold pattern Dave's research recommends.
- **Style risk:** at 96pt, a flat mat could read as a generic rectangle. Add subtle weave texture or a soft border to keep it identifiable.
- **Sources:**
  - Option A — Fiverr brief: "small woven mat with simple pattern, three-quarter view, pastel colours, illustrated"
  - Option B — Hard via stock — most mat illustrations are real-estate or fitness mats; doesn't match the homey vibe
  - Option C — Midjourney prompt: `simple woven mat with stripe pattern, three-quarter perspective, pastel illustration, soft palette`
- **Distractor pairings:**
  - **Gentle:** `pen` (stationery, /p/-start), `dog` (animal, /d/-start)
  - **Trap:** `cat` (rhyme + same vowel + same ending /æt/), `man` (same vowel + same starting position structure)

---

### 5. `bag`

- **Picture target:** Tote bag or shoulder bag, viewed three-quarter, with simple handle. Soft rose or cream colour, no logos, no text. A fabric bag, not a paper grocery bag.
- **L2/cultural fit:** **Strong.** Bags are universal. Tagalog `bag` is a direct loanword.
- **Style risk:** must not look like a backpack (which would be a different word) or a paper bag (loses the everyday-object reading). Simple tote with one handle reads cleanest at 96pt.
- **Sources:**
  - Option A — Fiverr brief: "soft pastel tote bag, simple shape, three-quarter view, illustrated style, no text or logos"
  - Option B — Storyset has tote bags in the "Shopping" pack; usable
  - Option C — Midjourney prompt: `soft pink tote bag, simple shape, illustrated, no logos, pastel`
- **Distractor pairings:**
  - **Gentle:** `bus` (vehicle, /b/-start, both /b/ but very different objects = OK for gentle), `pen` (stationery, /p/-start)
  - **Trap:** `tag` (rhyme + same vowel + same ending /æg/), `bat` (alliteration + same vowel)

---

### 6. `fan`

- **Picture target:** Electric pedestal fan (Filipino household standard) OR a hand-held folding fan. Three-quarter view. Pedestal fan reads more universally and is what Dave's research §Q2 specifically calls out as culturally familiar.
- **L2/cultural fit:** **Very strong.** Per Dave's research memo: "fan (electric fan is universal in Filipino homes) is highly picturable and culturally familiar." Tagalog `electric fan` / `bentilador` is everyday Marian vocabulary.
- **Style risk:** the pedestal-fan render must read as a fan and not as a small lamp or a microphone at 96pt. Add subtle motion lines if needed for animation-of-blades suggestion.
- **Sources:**
  - Option A — Fiverr brief: "electric pedestal fan, three-quarter view, pastel illustration, blades visible, simple base"
  - Option B — Storyset and Freepik have lots of pedestal fan illustrations — usable
  - Option C — Midjourney prompt: `electric pedestal fan, three-quarter view, pastel illustration, simple, blades visible`
- **Distractor pairings:**
  - **Gentle:** `dog` (animal, /d/-start), `bus` (vehicle, /b/-start)
  - **Trap:** `man` (rhyme + same vowel + same ending /æn/), `pan` (rhyme + same vowel + same ending /æn/)

---

### 7. `man`

- **Picture target:** Adult male figure, simple cartoon, friendly expression, viewed front-on or three-quarter. Casual clothing (t-shirt + jeans), no specific cultural markers (no business suit, no traditional Filipino barong — needs to be neutral). Eyes open, soft smile.
- **L2/cultural fit:** **Medium.** Marian knows the word `man` (per Dave's memo: Tagalog `lalaki` is the equivalent; the English word is in her receptive vocabulary). The picture will be more familiar than the English label.
- **Style risk:** introduces a _human figure_ into a screen that's otherwise non-human (Melody + objects + animals). To avoid competing with Melody, the man-figure should be drawn smaller-feeling — simpler face, less detail than Melody, lower visual hierarchy. Or stylise as a gingerbread-style standing figure (silhouette + minimal features) rather than a fully detailed character.
- **Decision call for Thomas:** stylised silhouette-figure vs detailed cartoon man? Default: stylised silhouette to protect Melody's character role. Open question #2 below tracks this.
- **Sources:**
  - Option A — Fiverr brief: "simple stylised man figure, neutral clothing, friendly stance, pastel illustration, NOT competing with the character Melody — minimal facial detail"
  - Option B — Storyset has people-style packs but many are too detailed; the simpler "Cuate" or "Pana" people-set styles are closer to a usable register
  - Option C — Midjourney prompt: `simple stylised cartoon man, friendly stance, neutral t-shirt and pants, pastel illustration, minimal face details`
- **Distractor pairings:**
  - **Gentle:** `cup` (vessel, /k/-start), `log` (object, /l/-start)
  - **Trap:** `fan` (rhyme + same vowel + same ending /æn/), `pan` (rhyme + same vowel + same ending /æn/)

---

### 8. `pan`

- **Picture target:** Frying pan, viewed three-quarter from above. Round flat surface, simple handle extending right. Soft grey or cream colour. No food in the pan (would distract from the noun).
- **L2/cultural fit:** **Strong.** Cooking pans (kawali — Filipino frying pan/wok) are everyday Marian vocabulary. The English word `pan` is shorter and may be less familiar than `kawali` but the picture carries it.
- **Style risk:** must not look like a hat from above (similar circular silhouette) — the handle is the disambiguating feature, must be clearly visible.
- **Sources:**
  - Option A — Fiverr brief: "frying pan, three-quarter view from above, simple handle, pastel illustration, no food inside"
  - Option B — Storyset Kitchen pack has pans; usable
  - Option C — Midjourney prompt: `simple frying pan, three-quarter view, visible handle, pastel illustration, soft colours`
- **Distractor pairings:**
  - **Gentle:** `dog` (animal, /d/-start), `pen` (stationery, /p/-start, both /p/ start = use only when the other distractor is far enough)
  - **Trap:** `fan` (rhyme + same vowel + same ending /æn/), `man` (rhyme + same vowel + same ending /æn/)

---

### 9. `cap`

- **Picture target:** Baseball cap, viewed three-quarter, with simple peak/visor visible. Soft rose or blue colour, no logo, no team markings.
- **L2/cultural fit:** **Strong.** Baseball caps are universal. The English word `cap` is short and decodes cleanly.
- **Style risk:** must NOT look like `hat` — the peak/visor is the disambiguating feature. The two pictures (`cap` and `hat`) must be visibly different at 96pt: `hat` is the wide-brim sun hat, `cap` is the baseball cap with peak. The two must never appear in the same chip trio (would fail silhouette-distinctness rule per spec §Distractor policy constraint #2).
- **Sources:**
  - Option A — Fiverr brief: "baseball cap, three-quarter view, pastel colour, no logos, illustrated style"
  - Option B — Storyset accessories pack has caps; usable
  - Option C — Midjourney prompt: `baseball cap, three-quarter view, simple peak, pastel pink colour, no logos`
- **Distractor pairings:**
  - **Gentle:** `dog` (animal, /d/-start), `bus` (vehicle, /b/-start)
  - **Trap:** `cat` (alliteration + same vowel /æ/, different ending), `bag` (same vowel + same /æ\_/ structure)
  - **Forbidden pairing:** **`cap` must not appear in the same trio as `hat`** — silhouette-similarity rule.

---

### 10. `can`

- **Picture target:** Soft drink can or soup can, simple cylinder shape, viewed three-quarter. Pastel colour, no specific brand, simple ring-pull or label band detail.
- **L2/cultural fit:** **Strong.** Cans are universal, Tagalog `lata` is the equivalent.
- **Style risk:** at 96pt, a plain cylinder could be ambiguous (cup? jar? candle?). The ring-pull on top or a clear band-label is the disambiguating detail.
- **Sources:**
  - Option A — Fiverr brief: "soft drink can, three-quarter view, pastel colour, simple band label, ring pull on top, illustrated"
  - Option B — Storyset and Freepik have can illustrations; usable
  - Option C — Midjourney prompt: `simple drink can, three-quarter view, pastel pink colour, ring pull, no brand`
- **Distractor pairings:**
  - **Gentle:** `sun` (celestial, /s/-start), `dog` (animal, /d/-start)
  - **Trap:** `fan` (rhyme + same vowel + same ending /æn/), `man` (rhyme + same vowel + same ending /æn/)

---

### 11. `tag`

- **Picture target:** Price tag or gift tag, simple paper-card shape with a string loop at the top, slightly tilted three-quarter view. Cream or rose base, simple line for "where the price would be" but no actual text.
- **L2/cultural fit:** **Medium.** Marian likely knows `tag` from price-tags on clothing. Less common than `bag` or `cat` but recognisable.
- **Style risk:** could read as a flag if drawn flat. The string loop at the top is the disambiguating feature.
- **Sources:**
  - Option A — Fiverr brief: "price tag with string loop, slightly tilted, pastel cream base, no text, illustrated"
  - Option B — Storyset shopping pack has tags; usable
  - Option C — Midjourney prompt: `simple price tag with string loop, tilted, pastel cream base, illustrated, no text`
- **Distractor pairings:**
  - **Gentle:** `pen` (stationery, /p/-start), `cup` (vessel, /k/-start)
  - **Trap:** `bag` (rhyme + same vowel + same ending /æg/), `bat` (same vowel + alliteration with target via /t/ end → adjacent)

---

### 12. `dad`

- **Picture target:** Adult male figure with a child-friendly "dad" cue — could be holding a smaller figure's hand, or wearing a "World's Best Dad" generic mug-style item. Friendlier than the `man` figure, slightly different pose.
- **L2/cultural fit:** **Strong.** Marian uses `dad` (or its Tagalog equivalent `tatay`) as a name for her father every day. Conceptually trivial.
- **Style risk:** **Significant.** Like `man`, this introduces a human figure. Two human-figure pictures in the same pack (`man` and `dad`) could read as the same picture at 96pt — the silhouette-distinctness rule would fail if both end up in the same trio.
- **Mitigation:** make `dad` a _parental_ picture (a parent figure holding a child's hand, or a head-and-shoulders portrait that reads as "this is someone's dad") that's visibly different from `man`'s standalone-figure pose. Alternative: _swap `dad` out and use `had` or `sat`_ — but those are verbs that don't picture concretely.
- **Decision call for Thomas:** keep `dad` with the parental-pose mitigation, or drop it from v1? Default: keep with mitigation; flag in Open Questions #3.
- **Sources:**
  - Option A — Fiverr brief: "stylised dad figure with child holding hands, simple, pastel, family vibe, minimal facial detail"
  - Option B — Storyset family pack has parent-with-child compositions
  - Option C — Midjourney prompt: `simple stylised dad figure holding child's hand, pastel illustration, minimal detail, family scene`
- **Distractor pairings:**
  - **Gentle:** `bus` (vehicle, /b/-start), `cup` (vessel, /k/-start)
  - **Trap:** `bag` (same vowel + alliteration of CVC structure), `bat` (same vowel + similar consonant frame)
  - **Forbidden pairing:** **`dad` must not appear in the same trio as `man`** — silhouette-similarity rule.

---

### 13. `jam`

- **Picture target:** Jar of jam or fruit preserve, viewed three-quarter, simple round jar with a lid and a simple label band (no text). Strawberry-pink or cream contents visible through clear jar.
- **L2/cultural fit:** **Medium.** Jam is less of a Filipino-staple than rice or fruit but is universally recognisable, especially as Marian has likely encountered it on bread. Tagalog has no direct equivalent for "jam" specifically.
- **Style risk:** could read as a generic jar (`pot` is a related distractor — but `pot` is a cooking pot, different shape). The pink/red contents and the lid/label combination should disambiguate.
- **Sources:**
  - Option A — Fiverr brief: "jar of jam with lid and simple label, three-quarter view, pastel illustration, pink/red contents visible, no text"
  - Option B — Storyset food pack has jam jars; usable
  - Option C — Midjourney prompt: `jar of jam, three-quarter view, pink contents visible, simple lid and label, no text, pastel illustration`
- **Distractor pairings:**
  - **Gentle:** `bus` (vehicle, /b/-start), `dog` (animal, /d/-start)
  - **Trap:** `bag` (same vowel + ending consonant adjacent /m/-/g/ shapes), `pan` (same vowel + similar /-an/ to /-am/ ending)

---

### 14. `van`

- **Picture target:** Delivery van or family van (panel van), viewed from the side or three-quarter front. Boxy shape, two windows, two visible wheels. Soft rose or blue colour. No specific brand markings.
- **L2/cultural fit:** **Strong.** Vans are everyday vehicles in Filipino traffic; Tagalog uses `van` as a direct loanword.
- **Style risk:** must not look like a `bus` (the gentle-tier distractor). The two pictures must be visibly different: `bus` is longer with multiple windows and a more recognisable bus-front; `van` is shorter, fewer windows, more car-like proportions.
- **Sources:**
  - Option A — Fiverr brief: "delivery van or family van, side view, simple box shape, pastel colour, two windows, two visible wheels, no logos"
  - Option B — Storyset transport pack has vans; usable
  - Option C — Midjourney prompt: `simple delivery van, side view, pastel pink, no logos, two windows, illustrated style`
- **Distractor pairings:**
  - **Gentle:** `pen` (stationery, /p/-start), `cup` (vessel, /k/-start)
  - **Trap:** `man` (rhyme + same vowel + same ending /æn/), `fan` (rhyme + same vowel + same ending /æn/)
  - **Forbidden pairing:** **`van` must not appear in the same trio as `bus`** — silhouette-similarity rule (both vehicles in side view).

---

## Distractor-only pictures (8 pictures, never the target)

These are pictures that appear _only_ as distractors, never as the target word. They don't need to be CVC short-a (per Word Song spec §Distractor policy constraint #4 — "distractor _words_ don't have to be CVC short-a; what matters is their _picture_ is recognisable"). They expand the pack's variety so the same 14 chip pictures don't keep recycling.

All 8 are from the candidate list in PR #61 §Open Questions #3 with Marian-vocabulary confirmation (per Dave's memo §Q2: she recognised `dog` and `sun` cold in the diagnostic).

| Word  | Picture target                                                                            | L2 fit                                                                          | Sourcing notes                                                          |
| ----- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `bus` | School bus or simple city bus, side view, multiple windows, simple wheels                 | Strong — Tagalog `bus` direct loanword                                          | Options A/B/C all viable; Storyset transport pack has buses             |
| `sun` | Round sun with simple radiating lines, friendly face optional, soft yellow with rose tint | Strong — Marian knows `sun` cold                                                | Options A/B/C all viable                                                |
| `dog` | Friendly dog, sitting, side or three-quarter view, soft brown or cream coat               | Strong — Marian read `dog` cold in diagnostic                                   | Options A/B/C all viable. Style: must NOT compete with `cat` silhouette |
| `fox` | Cartoon fox, sitting or standing, soft orange-red, friendly expression                    | Medium — foxes less common in Filipino context; the picture carries the meaning | Options A/B/C all viable                                                |
| `cup` | Mug or teacup with handle, three-quarter view, simple shape, pastel colour                | Strong — universal                                                              | Options A/B/C all viable                                                |
| `pen` | Ballpoint pen, side view, simple cylinder with point and clip                             | Strong — universal                                                              | Options A/B/C all viable                                                |
| `log` | Wood log, horizontal, simple cylinder with bark texture, brown                            | Medium — less common picture in Marian's reading                                | Options A/B/C all viable                                                |
| `pot` | Cooking pot, two handles, simple round shape, three-quarter view, soft grey               | Strong — Tagalog `kaldero` is everyday vocabulary; picture reads universally    | Options A/B/C all viable. Style: must NOT compete with `pan` silhouette |

**Forbidden pairings (silhouette-similarity rule):**

- `dog` and `cat` — both small four-legged animals at 96pt. Never in the same trio together. (Use one as a target, one as a distractor — never both as distractors-of-each-other in the same problem.)
- `bus` and `van` — both vehicles in side view. Never in the same trio together.
- `pan` and `pot` — both cooking vessels in three-quarter view. Never in the same trio together.

Devon: encode these forbidden-pairs as a constant in `wordDistractors.ts` and assert against them when picking distractors.

---

## Distractor pairing matrix (master table)

The full matrix showing, for every target word, the tier-1 (gentle) and tier-2 (trap) distractor pairs. Devon: this is the source of truth for `wordDistractors.ts`'s distractor-picking logic for v1 short-a.

**Reading this matrix:** each row is a target word. The "gentle" pair is the two distractors used for problems 1–3 when this word is the target. The "trap" pair is the two distractors used for problems 4–8 when this word is the target. Distractors are always picked as pairs from the same tier.

| Target | Gentle distractor 1 | Gentle distractor 2 | Trap distractor 1 | Trap distractor 2 | Notes                                                         |
| ------ | ------------------- | ------------------- | ----------------- | ----------------- | ------------------------------------------------------------- |
| `cat`  | `bus`               | `sun`               | `bat`             | `cap`             | Trap pair = rhyme + alliteration                              |
| `hat`  | `dog`               | `cup`               | `cat`             | `bag`             | Trap pair = rhyme + same-vowel structure                      |
| `bat`  | `sun`               | `cup`               | `cat`             | `hat`             | Trap pair = both rhymes                                       |
| `mat`  | `pen`               | `dog`               | `cat`             | `man`             | Trap pair = rhyme + same-vowel structure                      |
| `bag`  | `bus`               | `pen`               | `tag`             | `bat`             | Trap pair = rhyme + alliteration                              |
| `fan`  | `dog`               | `bus`               | `man`             | `pan`             | Trap pair = both rhymes (fan/man/pan all /æn/)                |
| `man`  | `cup`               | `log`               | `fan`             | `pan`             | Trap pair = both rhymes; do NOT pair with `dad`               |
| `pan`  | `dog`               | `pen`               | `fan`             | `man`             | Trap pair = both rhymes; do NOT pair with `pot`               |
| `cap`  | `dog`               | `bus`               | `cat`             | `bag`             | Trap pair = alliteration + same-vowel; do NOT pair with `hat` |
| `can`  | `sun`               | `dog`               | `fan`             | `man`             | Trap pair = both rhymes /æn/                                  |
| `tag`  | `pen`               | `cup`               | `bag`             | `bat`             | Trap pair = rhyme + adjacent CVC                              |
| `dad`  | `bus`               | `cup`               | `bag`             | `bat`             | Trap pair = same-vowel CVC; do NOT pair with `man`            |
| `jam`  | `bus`               | `dog`               | `bag`             | `pan`             | Trap pair = adjacent CVC structures                           |
| `van`  | `pen`               | `cup`               | `man`             | `fan`             | Trap pair = both rhymes; do NOT pair with `bus`               |

**Implementation hand-off note for Devon:** the matrix's "do NOT pair with X" annotations encode silhouette-similarity exclusions. Encode those as a `FORBIDDEN_PAIRS` constant + assertion in `wordDistractors.ts`:

```typescript
const FORBIDDEN_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['cat', 'dog'], // both four-legged animals in side profile
  ['bus', 'van'], // both vehicles in side view
  ['pan', 'pot'], // both cooking vessels in three-quarter view
  ['cap', 'hat'], // both head-coverings, similar mass at 96pt
  ['man', 'dad'], // both human figures
] as const
```

Picking a distractor that's in a forbidden pair with the target (or with the _other_ distractor) must throw or fall back to the next-best candidate. Per-target distractor-picking is deterministic by problem ID per the Math screen pattern; the forbidden-pair check applies after picking.

---

## Future work (out of scope for v1)

When the Word Song screen pivots to short-o, short-u, short-i, and short-e (per Dave's recommended sequence: o → u → i → e), each vowel family needs its own picture pack with the same structure as this file. **Do not author those packs now.** Each pack is gated on its corresponding screen scoping, and on Marian reaching ~90% accuracy on the prior vowel family (per Dave's mastery-gate recommendation).

Tentative future picture-pack candidates per vowel (drawn from Dave's memo §"Application to Marian"):

| Vowel   | Candidate target words (from Dave's memo)        |
| ------- | ------------------------------------------------ |
| short-o | dog, mop, box, top, pot, log, hop, dot, fox, cop |
| short-u | sun, cup, bug, mud, run, hug, nut, pup, cut, tub |
| short-i | pig, sit, hit, lip, tin, bin, wig, dip, fin, kit |
| short-e | bed, hen, leg, net, pen, red, web, ten, den, get |

Cross-vowel reuse: pictures from this short-a pack that are _distractor-only_ (`dog`, `sun`, `cup`, `pen`, `log`, `pot`, `fox`, `bus`) become _target words_ in subsequent vowel packs (`dog` and `pot` and `fox` and `log` are short-o targets; `sun` and `cup` are short-u targets; `pen` is short-e target). This pack's 8 distractor-only pictures are therefore not throwaway — they accumulate into the multi-vowel picture library.

---

## Acceptance criteria (Jessica + Thomas)

These are the testable criteria for "this picture pack is ready to ship." Jessica validates against the implementation; Thomas validates the curation choices.

### Pack composition (Thomas signs off)

- [ ] 14 target words + 8 distractor-only pictures = 22 illustrations total
- [ ] Each target word has a picture brief, an L2 fit note, three sourcing options, and a distractor-pairing entry
- [ ] Distractor pairing matrix complete for all 14 target words (gentle + trap pairs)
- [ ] Forbidden-pair list documented (5 pairs in v1)
- [ ] Sourcing route chosen by Thomas (Option A, B, or C, or Hybrid-rejected with rationale)

### Style consistency (Kyle reviews on delivery)

- [ ] All 22 pictures are SVG, <30 KB each
- [ ] Single illustrator hand or single curated source, no style mismatch within the pack
- [ ] Palette draws from `--my-rose`, `--my-cream`, `--ink`, `--sparkle` plus object-specific desaturated colours
- [ ] No backgrounds (transparent in chip)
- [ ] No text inside any picture
- [ ] No anthropomorphised non-human characters (no smiling fans, no friendly buses with eyes)
- [ ] `cat`, `bat`, and any other small-mammal pictures clearly do not read as bunnies (Melody silhouette protection)
- [ ] `man` and `dad` use minimal facial detail to not compete with Melody's character role
- [ ] At 96×96pt render, every picture in the matrix is identifiable in <3 seconds by an adult unfamiliar with the pack (informal Kyle eyeball test)

### Implementation handoff (Devon consumes)

- [ ] Word→asset map encoded as `cvc-shorta-pack.ts` constant (path TBD by Devon)
- [ ] `FORBIDDEN_PAIRS` constant matches the forbidden-pairs list in this doc
- [ ] Distractor-pairing matrix encoded as data, not hardcoded if-else
- [ ] All 22 picture filenames follow a single naming convention (proposal: `picture-{word}.svg`, e.g. `picture-cat.svg`, `picture-bus.svg`)

### Anti-dark-pattern audit (parallels Word Song spec audit)

- [ ] No picture conveys urgency, danger, or shame
- [ ] No picture is gendered or culturally narrow in a way that would alienate Marian
- [ ] No picture relies on prior Western-cultural knowledge
- [ ] No picture uses a real character likeness or branded imagery (no "this is Pikachu", no McDonald's logos, etc.)

---

## Open questions for Thomas

> **Note:** every open question has a default so impl can proceed even if Thomas's morning review takes a day or two. Defaults are conservative and reversible.

### #1 — Sourcing route

Three options laid out in §Sourcing options. Thomas picks one for the whole pack. **Default until decided:** Option A (commission a single illustrator on Fiverr) — cleanest aesthetic outcome, manageable cost ($110–330 total), 1–2 week lead time. **Owner:** Thomas.

### #2 — Human-figure stylisation for `man`

Detailed cartoon man vs simple stylised silhouette? Detailed competes with Melody for visual attention; stylised is safer but less illustratively rich. **Default until decided:** simple stylised silhouette (lower visual hierarchy, protects Melody's character role). **Owner:** Thomas (taste call).

### #3 — Keep `dad` in v1, or drop?

`dad` is a strong vocabulary win (everyday word for Marian) but introduces a second human figure that compounds the issue raised in #2. The mitigation (parent-with-child pose) makes it visibly different from `man`, but adds a third character on screen. **Default until decided:** keep `dad` with the parent-with-child pose mitigation. If Thomas doesn't love it, drop `dad` and replace with one of: `had`, `sat`, `ham`, `tan` (all CVC short-a, all in some vocabulary, all picturable but with their own caveats — ask Kyle to draft replacements if Thomas wants). **Owner:** Thomas (taste).

### #4 — `bat` (animal): friendly or skip?

`bat` is on Dave's recommended inventory, but the animal carries Halloween/spooky connotations in Western culture. Sanrio's own bat character (Kuromi) is safely cute. **Default until decided:** keep `bat` with explicit "cute friendly Sanrio-style flying bat, no fangs, big eyes" brief — see §Per-word picture brief #3. If Thomas worries about the spooky read, drop and replace with `tan` or `gas`. **Owner:** Thomas.

### #5 — Pack size (14 target words — too many? too few?)

14 target words, drawn 8-at-a-time per session, gives the session-generation logic enough variety to not repeat the same 8 across consecutive sessions. Alternative: trim to 12 for cheaper commission, expand to 16 for more variety. **Default until decided:** ship with 14 target words. **Owner:** Thomas + Matt (cost vs variety trade-off).

### #6 — Distractor-only picture set: 8 pictures, expandable later?

The 8 distractor-only pictures (`bus, sun, dog, fox, cup, pen, log, pot`) cover gentle-tier needs across all 14 target words. Could be expanded to e.g. 12 distractor-only pictures to give the gentle tier more variety. **Default until decided:** ship with 8 distractor-only pictures; add more as subsequent vowel-family packs ship (each new vowel pack contributes its own distractor-only pictures into the shared library). **Owner:** Thomas.

### #7 — File naming convention

Proposed: `picture-{word}.svg` (e.g. `picture-cat.svg`, `picture-bus.svg`). All in `public/assets/pictures/`. Alternative: namespace by vowel family (`public/assets/pictures/short-a/picture-cat.svg`). **Default until decided:** flat directory `public/assets/pictures/` with `picture-{word}.svg`; namespace by vowel only if/when the multi-vowel library outgrows a single directory (~50+ pictures). **Owner:** Devon (impl detail), with veto from Thomas if he prefers the namespaced layout.

### #8 — When Thomas reviews and approves, who triggers commission/curation?

This file lists three sourcing options but doesn't execute any. Once Thomas picks, who places the Fiverr order / curates the pack / runs the AI gen? **Default until decided:** Matt routes the work post-approval — possibly to a designated assistant or directly contracts a Fiverr seller. **Owner:** Matt + Thomas.

---

## Provenance

- Brief: Matt's overnight task — picture-pack proposal as follow-up to Word Song spec PR #61.
- Parent spec: `design/screen-4-word-song.md` (PR #61, draft).
- Phonics-sequence research grounding: `design/research/phonics-sequence-marian.md` (Dave, landed 2026-04-26 on `main`). §Q2 short-a CVC inventory and §"Application to Marian" word list directly inform this pack's selection criteria.
- Diagnostic data on Marian's vocabulary baseline: `build a tutor AI app with investigation and analysis.md`, project memory `project_diagnostic_results.md`.
- Style anchor: `melody-idle.svg` (already in repo).
- Anti-dark-pattern audit framework: parallels `design/screen-3-math.md` §"Anti-dark-pattern audit" and `design/screen-4-word-song.md` §"Anti-dark-pattern audit".
