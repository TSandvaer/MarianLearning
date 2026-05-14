# Word Song — digraphs `ch` picture-pack Midjourney prompts (Phase 1)

**Audience:** Thomas (Midjourney Web operator, Phase 2 — uses MJ Web workflow per `user_midjourney_web` memory, step-by-step with 4-grid feedback per word per `feedback_mj_walkthrough_step_by_step` memory). Devon (PNG-embed integration, Phase 3 via `yarn embed-pictures`).
**Author:** Marian Tutor design persona.
**Status:** Phase 1 prompt sheet — paste-ready, one prompt per word. **Pool RECONCILED against Dave's `digraph-ch-addendum.md`** — see word-list §0. The 7 ch-target words are Dave's §3c locked inventory: `chin, chip, chop, chat, chest, chug, chick`.
**Predecessor specs:** `design/word-song/digraphs-ch-word-list.md` (sibling — defines the 7-word pool, the load-bearing picture briefs, and the picture-pack scope), `design/word-song/picture-pack-style-anchor.md` (style frame — inherited verbatim), `design/word-song/digraphs-sh-picture-pack-prompts.md` (the immediately-prior digraph prompt sheet — **structural template, cloned section-for-section, MJ-parameter conventions inherited verbatim**).
**Predecessor research:** `design/research/digraph-acquisition-marian.md` (Dave, 2026-05-14) AND `design/research/digraph-ch-addendum.md` (Dave, 2026-05-14 — locks the pool + supplies the per-word picture briefs in §Recommendations-to-Kyle #4).

---

## 0. Scope — 7 wholly-new ch-initial words (Dave's §3c locked inventory)

This pack covers **7 wholly-new ch-initial targets** (no re-traces — none of these words exist as distractors in prior tiers):

> **`chin`, `chip`, `chop`, `chat`, `chest`, `chug`, `chick`.**

This is **Dave's `digraph-ch-addendum.md` §3c locked inventory** — all 7 fully decodable, all word-initial ch, all using short vowels Marian has formally covered. An earlier in-flight draft of the companion word-list spec proposed a different pool (`chip, chest, chick, chimp, cheese, chair, chain` with 3 long-vowel hybrids) — **that draft is superseded**; see word-list §0 for the full reconciliation. This sheet covers Dave's locked 7.

**Total generations needed for this pack: 7.**
**Total SVG file changes after Phase 3: 7 new.**

**ZERO of the 7 are `hybridMode: true`** — unlike the sh tier (which had 3). Every ch-word is a conventional short-vowel decodable entry. Picture-pack-wise this changes nothing about how the pictures are made; it is noted only so the asset count + schema expectations are clear (see word-list §6.1).

**5 of the 7 carry a load-bearing picture brief** (Dave §Recommendations-to-Kyle #4 — these are NOT optional polish; they are AC7 content in the word-list spec):

- `chin` — a friendly cartoon face in side-profile / chin-forward crop, the chin as the salient feature. NOT a free-floating body fragment.
- `chat` — two simple figures with a speech bubble between them; must read as "talking", not "two people".
- `chest` — a treasure chest (hinged-lid trunk), NOT an anatomical chest.
- `chop` — a chopped/split log with a small axe; the concrete-result depiction, not the bare verb.
- `chug` — a train or a bottle being gulped, mid-motion; a motion-line helps it read as the action.

`chip` and `chick` need standard single-subject briefs (no special composition concern beyond the disambiguation notes in §2.2 / §2.7).

---

## 1. MJ-parameter conventions — inherited verbatim from `digraphs-sh-picture-pack-prompts.md` §1

This prompt sheet inherits the MJ-parameter conventions locked in the `digraphs-sh` prompt sheet. They are re-stated compactly here; the sh sheet's §1 carries the full rationale + memory citations. **Do not revert to the pre-sh conventions (the short-e / short-u / short-o sheets ran 200+ word prompts — that was the antipattern the sh sheet corrected).**

### 1.1 v7 GUI workflow — NO `--v 6 --style raw --s 250 --ar` flags

Per `feedback_mj_moderator_negatives_per_word` memory. Set the 1:1 ratio in the MJ Web GUI dropdown, not as an `--ar` flag. v7 is the default in current MJ Web. Prompt pattern:

```
... [full prompt body] ... --no [per-word negatives]
```

### 1.2 NO `--cref / --sref / --cw 80` pack-cohesion flags

Per `feedback_mj_pack_cohesion_lever_unused` memory. The §1.4 style preamble (re-used byte-for-byte) is the cohesion mechanism. If Thomas finds drift across the 7 generations, the opt-in fallback is to capture a `chin` pose-zero from the first successful generation and apply `--cref/--sref/--cw 80` to the remaining 6 — a Phase-2 escalation, not the default.

### 1.3 Per-word `--no` only — NEVER paste pack-wide negatives in one prompt

Per `feedback_mj_moderator_negatives_per_word` memory ("moderator trips on pack-wide negatives"). Each per-word prompt below has its OWN tailored `--no` list: the always-apply style negatives (short list per prompt) + the one per-word anti-anthro entry + the one per-word content negative. Do NOT concatenate per-word negatives across words.

### 1.4 ≤40-word body ceiling + ≤12-entry `--no` ceiling

Per `feedback_mj_moderator_negatives_per_word` memory. Two-ceiling structure (identical to the sh sheet):

| Slot                             | Target                                                  | Why                                                    |
| -------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| Style preamble (§1.4 below)      | ≤14 words, byte-for-byte identical across all 7 prompts | Pack cohesion lever (no `--cref/--sref` fallback used) |
| Subject phrase + subject details | ≤22 words per prompt                                    | Subject identity load-bearing for the chip read        |
| `--no` list                      | ≤12 logical-concept entries per prompt                  | Empirically the moderator-safe ceiling                 |

Total body: ≤14 + ≤22 = ≤36 words — leaves 4 words headroom under the 40-word ceiling for word-specific safety phrases.

### 1.5 IP-name strip

Per `feedback_mj_moderator_negatives_per_word` memory. No prompt below mentions My Melody, Sanrio, Disney, Pixar, Studio Ghibli BY NAME. The short prompts use "modern children's-book illustration, soft pastel" as the style descriptor.

### 1.6 Always make remove.bg explicit

Per `feedback_mj_workflow_explicit_removebg` memory: MJ outputs ALWAYS have backgrounds. remove.bg (bgclear.ai canonical) is its own discrete step — see §3 Workflow steps.

### 1.7 Step-by-step walkthrough — one prompt at a time, wait for 4-grid feedback

Per `feedback_mj_walkthrough_step_by_step` memory. Each prompt below is in its own fenced code block, paste-ready, independently. When walkthrough time arrives (separate session), hand Thomas one at a time, wait for the 4-grid screenshot, iterate if needed, then move on. Do NOT hand him all 7 in one batch.

---

## 1.4 Style preamble — short form (14 words; canonical full preamble in style-anchor §2)

Re-use this short-form preamble **byte-for-byte** across all 7 prompts in this pack — it is the **identical 14-word preamble locked in `digraphs-sh-picture-pack-prompts.md` §1.4**. Re-using the exact sh-sheet preamble (not a ch-specific variant) maximizes cross-tier pack cohesion — the ch pictures should sit visually alongside the sh pictures and the five CVC packs as one coherent set, not form a separate-looking digraph sub-style:

> **Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text.**

14 words. Carries: style cluster (children's-book illustration, soft pastel, clean line art) = cohesion seed; cream-background = colour anchor; single-subject = compositional anchor; no-text = moderation safety. The aspect ratio (1:1) is set via the MJ Web GUI dropdown per §1.1, NOT in the preamble.

Each per-word prompt below appends a short subject phrase (≤22 words including subject-specific details) to this preamble. Total body stays ≤36 words.

**Note on `chat`'s preamble tension:** `chat`'s brief (two figures + speech bubble) is the one word in the pack whose subject is NOT strictly "single subject" — see §2.4 for how the prompt handles this within the preamble's single-subject rule (the two-figures-plus-bubble is treated as one compositional unit: "a chatting scene").

---

## 2. Per-word prompts — paste-ready

The format per row (mirrors `digraphs-sh-picture-pack-prompts.md` §2 structure):

```
WORD — category — vowel cue — distinctness check — prompt (fenced block) — negatives — asset spec — notes
```

Each "prompt" is paste-ready into MJ Web — copy the fenced block, paste into the MJ prompt box, set ratio to 1:1 in the GUI dropdown, hit submit.

---

### 2.1 `chin` — body part — `/ɪ/` inside

- **Vocabulary cue:** A friendly cartoon child's face in side-profile (or chin-forward three-quarter view), with the **chin as the visually salient feature** — the rounded point of the lower jaw clearly drawn. Dave's "ideal anchor" — body parts are the highest-familiarity vocabulary class.
- **Distinctness check:**
  - **vs. a generic face portrait:** the chin must be the SALIENT feature, not just "a face". Side-profile or a slight upward tilt makes the chin protrude and read.
  - **vs. `chick` (pack neighbor):** a face vs. a baby bird — different categories. FORBIDDEN_PAIR `[chick, chin]` is in-pool hygiene only (both are small rounded forms at 96pt).
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A friendly cartoon child face in side profile, gently smiling, the rounded CHIN clearly prominent, soft warm skin tone. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, full body, hands or shoulders, beard or stubble, exaggerated huge chin, scary face, kawaii sparkle eyes
```

- **Word-count check:** body 33 words (14 preamble + 19 subject); `--no` 11 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (11 concepts):**
  - **Full body / hands / shoulders** (the chin must be the focus — `full body`, `hands or shoulders`).
  - **Beard or stubble** (obscures the chin shape; also adult-coded — `beard or stubble`).
  - **Exaggerated huge cartoon chin** (caricature drift — must read as a normal friendly chin — `exaggerated huge chin`).
  - **Scary / unsettling face** (tone — `scary face`).
  - **Kawaii sparkle-eyes** (style drift — `kawaii sparkle eyes`).
  - **Photo-realistic portrait** (covered by `photorealistic`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-chin.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 from MJ → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** Side-profile is the strongest read — it makes the chin protrude. A front-facing portrait risks reading as just "face". If 4-grid produces only front portraits where the chin is not salient, regenerate with "side profile, chin-forward, the chin is the main feature" emphasis. Keep it a CHILD's face (friendly, age-appropriate), gently smiling — never a downward head pitch (reads as judging, per the Emma character forbidden list).

---

### 2.2 `chip` — object (food) — `/ɪ/` inside

- **Vocabulary cue:** A single food crisp — one curved, slightly-rippled potato/tortilla chip, warm golden colour. The single-curved-crisp silhouette carries "chip" recognition.
- **Distinctness check:**
  - **vs. poker chip (NOT the target sense):** the target is a FOOD crisp, not a gambling token. The prompt must force the food sense — a rippled, irregular-edged crisp, NOT a flat perfect-circle disc.
  - **vs. microchip (NOT the target sense):** not a computer circuit. The food-snack framing handles this.
  - **vs. `chest` (pack neighbor):** `chip` is a small thin curved crisp; `chest` is a chunky 3D trunk. Different mass + shape. FORBIDDEN_PAIR `[chest, chip]` is in-pool hygiene — keep them out of the same trio.
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A single golden potato CHIP crisp, gently rippled curved shape, warm toasted snack-food colour, irregular edge. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, poker chip gambling token, microchip circuit, bowl or bag of chips, smiling chip with face, perfect flat disc
```

- **Word-count check:** body 32 words (14 preamble + 18 subject); `--no` 11 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (11 concepts):**
  - **Poker chip / gambling token / casino chip** (wrong sense — `poker chip gambling token`).
  - **Microchip / computer circuit** (wrong sense — `microchip circuit`).
  - **Bowl or bag of multiple chips** (single subject — `bowl or bag of chips`).
  - **Perfect flat circular disc** (reads as poker chip — `perfect flat disc`).
  - **Anthropomorphised chip with face** (anti-anthro — `smiling chip with face`).
  - **Photo-realistic greasy crisp** (covered by `photorealistic`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-chip.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~40–80 KB.
- **Notes:** The food-crisp sense is mandatory. MJ pulls hard toward poker-chip / microchip for the bare word "chip" — the body's "golden potato CHIP crisp, gently rippled, snack-food colour" + the two wrong-sense negatives are both required. If 4-grid produces poker-chip or microchip, regenerate — do not pick the "least-bad". `chip` is the highest subject-disambiguation risk in the pack.

---

### 2.3 `chop` — object (action-result) — `/ɒ/` inside

- **Vocabulary cue:** A chopped/split log — a short piece of firewood split lengthwise, with a small axe resting against or beside it. The chopped-wood-result depiction (NOT the bare verb).
- **Distinctness check:**
  - **vs. the bare verb "chop":** must read as the concrete RESULT — split wood + axe — not a motion-blur of a chopping action with no object.
  - **vs. `chip` (pack neighbor):** chunky split log vs. thin flat crisp. **No risk.**
  - **`chop`/`shop` minimal-pair anchor:** `chop` is one of the two words (with `chip`) that form sh/ch discrimination pairs with the sh tier. The picture has no special requirement for this — the minimal-pair work is audio/script-side (word-list §4) — but the picture must be unambiguously "chop" so the contrast is clean.
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A short split log of firewood, freshly CHOPPED in half, a small wooden axe resting beside it, warm brown wood grain. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, person chopping, lamb chop meat, whole uncut log, forest scene, blood or gore, smiling log with face
```

- **Word-count check:** body 36 words (14 preamble + 22 subject); `--no` 12 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (12 concepts):**
  - **Person chopping** (second subject / human figure — must read as the RESULT, not the actor — `person chopping`).
  - **Lamb chop / meat** (the competing word-sense — must be CHOPPED WOOD — `lamb chop meat`).
  - **Whole uncut log** (loses the "chopped" cue — `whole uncut log`).
  - **Forest scene / trees** (environment violation — `forest scene`).
  - **Blood / gore** (tone guardrail — an axe + wood must stay gentle — `blood or gore`).
  - **Anthropomorphised log with face** (anti-anthro — `smiling log with face`).
  - **Photo-realistic timber** (covered by `photorealistic`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-chop.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** The split-log + small-axe composition is the load-bearing "chop" read — it shows the action's RESULT without showing a person. The axe must read as a small, friendly, cartoon hatchet (the `blood or gore` negative + the soft-pastel style keep it gentle — an axe is fine in a children's-book register; a menacing one is not). If 4-grid produces a person mid-swing or a whole uncut log, regenerate. NOT a lamb chop — the `lamb chop meat` negative is required.

---

### 2.4 `chat` — action (social) — `/æ/` inside

- **Vocabulary cue:** Two simple friendly cartoon figures facing each other with a **speech bubble between them** — the composition must clearly read as "talking / chatting". Dave: "the best short-a ch word that is picturable."
- **Distinctness check:**
  - **vs. "two people" / "two friends":** the SPEECH BUBBLE is the load-bearing discriminator. Without it the picture reads as "friends" or "people", not "chat".
  - **single-subject rule:** the two-figures-plus-bubble is treated as ONE compositional unit — "a chatting scene" — not two competing subjects. This is the one word in the pack that bends the single-subject anchor; the prompt frames it as a single tight vignette.
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, no text. A simple chatting scene, two small friendly cartoon children facing each other, one empty speech bubble between them, tight centered vignette. --no anime, photorealistic, 3d render, text inside bubble, watermark, crowd of people, phones or screens, speech bubble with writing, angry argument, kawaii sparkle eyes
```

- **Word-count check:** body 35 words (14 preamble minus "single subject" + 22 subject — see note); `--no` 11 logical-concept entries. Under both ceilings. **The preamble for `chat` drops "single subject"** and the subject phrase supplies "tight centered vignette" as the compositional anchor instead — this is the one documented per-word preamble deviation in the pack (see §1.4 note).
- **Negatives — what to avoid (11 concepts):**
  - **Text inside the speech bubble / speech bubble with writing** (the bubble must be EMPTY — MJ drifts to filling bubbles with fake text, a moderation + chip-read risk — TWO entries: `text inside bubble`, `speech bubble with writing`).
  - **Crowd of people** (must be exactly two figures — `crowd of people`).
  - **Phones / screens / devices** (modern "chat" drift — must read as face-to-face talking — `phones or screens`).
  - **Angry argument** (tone — must read as friendly chatting — `angry argument`).
  - **Kawaii sparkle-eyes** (style drift — `kawaii sparkle eyes`).
  - **Photo-realistic figures** (covered by `photorealistic`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-chat.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** The EMPTY speech bubble is the load-bearing cue — it is what makes the picture "chat" rather than "two friends". MJ has a strong drift to fill speech bubbles with fake text (a moderation-trip risk AND a chip-read risk since the app is strictly text-mirrors-speech). The TWO bubble-text negatives + the body's "one empty speech bubble" are both required. Exactly two figures — a crowd dilutes the read. If 4-grid produces filled bubbles or a crowd, regenerate. This is the trickiest word in the pack to ground; expect possible iteration.

---

### 2.5 `chest` — object — `/ɛ/` inside

- **Vocabulary cue:** A treasure chest — a wooden trunk with a hinged domed lid, metal bands, and a front lock-plate. Three-quarter view so the lid + front-face read. **The treasure-chest sense, NOT the anatomical chest.**
- **Distinctness check:**
  - **vs. anatomical chest (the competing word-sense):** must be a TREASURE TRUNK — the storybook-universal object — never a body part.
  - **vs. `box` (short-o target):** `chest` has a domed hinged lid + metal bands + lock-plate; `box` is a plain closed cuboid with a tape line. FORBIDDEN_PAIR `[chest, box]` locked in word-list §6 (cross-pool hygiene).
  - **vs. `chip` (pack neighbor):** chunky 3D trunk vs. thin flat crisp. FORBIDDEN_PAIR `[chest, chip]` locked in-pool (word-list §6).
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A wooden TREASURE CHEST, three-quarter view, domed hinged lid closed, three metal bands, front lock plate, warm brown wood. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, open lid spilling gold coins, plain cardboard box, human chest body part, smiling chest with face, treasure pile
```

- **Word-count check:** body 36 words (14 preamble + 22 subject); `--no` 11 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (11 concepts):**
  - **Open lid spilling coins / treasure pile** (second subjects + visual noise — `open lid spilling gold coins`, `treasure pile`).
  - **Plain cardboard box** (must read as a CHEST, not a box — `plain cardboard box`).
  - **Human chest / body part** (the competing word-sense — `human chest body part`).
  - **Anthropomorphised chest with face** (anti-anthro — `smiling chest with face`).
  - **Photo-realistic weathered-wood chest** (covered by `photorealistic`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-chest.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** The domed-lid + metal-bands + lock-plate silhouette is what separates "chest" from "box" at 96pt. Closed lid is mandatory — an open lid spilling treasure introduces a second subject and breaks the chip read. The `human chest body part` negative forecloses the anatomical sense. If 4-grid produces box-leaning generations (flat lid, no bands), regenerate with "domed lid, metal bands, pirate treasure chest" emphasis.

---

### 2.6 `chug` — action (onomatopoeia) — `/ʌ/` inside

- **Vocabulary cue:** A small friendly cartoon steam train, mid-"chug" — puffing along, with a small puff of smoke from the funnel and a simple motion-line. The action-of-chugging depiction. (Dave's recommended replacement for the dropped `much`.)
- **Distinctness check:**
  - **vs. a static train (loses the action):** a small puff + a motion-line signal the "chug" action.
  - **vs. a bottle-being-gulped (Dave's alternate cue):** the steam-train is the **recommended primary** — cleaner single-subject silhouette than a hand-holding-a-bottle (which introduces a body fragment). Use the train.
  - **vs. any existing pack object:** a steam train is a unique silhouette in the whole pack. **No risk.**
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A small friendly cartoon steam train CHUGGING along, one small puff of smoke from the funnel, gentle motion lines, rounded shapes. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, railway track scenery, long train many carriages, person driver, scary face on train, station environment
```

- **Word-count check:** body 35 words (14 preamble + 21 subject); `--no` 11 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (11 concepts):**
  - **Railway track / scenery / landscape** (environment violation — `railway track scenery`).
  - **Long train with many carriages** (single subject — must read as one small chugging engine — `long train many carriages`).
  - **Person / driver in the cab** (second subject — `person driver`).
  - **Scary face on the train** (anti-anthro tone — a gentle rounded train is fine; a menacing one is not — `scary face on train`).
  - **Station / platform environment** (environment violation — `station environment`).
  - **Photo-realistic locomotive** (covered by `photorealistic`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-chug.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** The small puff of smoke + gentle motion-lines are what make this "chug" (the action) rather than just "train". One small engine, NOT a long train — a multi-carriage train dilutes the single-subject read. A friendly rounded cartoon engine is fine and on-style; the `scary face on train` negative just guards against a menacing anthropomorphisation. `chug` is moderate-familiarity as an English word (Dave §3b) — the picture + Emma's audio carry it; the picture's job is to be unambiguously "a little train going chug-chug".

---

### 2.7 `chick` — animal — `/ɪ/` inside

- **Vocabulary cue:** A baby chicken — a small, round, fluffy yellow bird with tiny wings, a small orange beak, and stubby legs. Side or three-quarter view.
- **Distinctness check:**
  - **vs. `hen` (short-e target):** `chick` is small, round, fluffy, all-yellow, NO comb; `hen` is larger with a red comb + tail feathers + adult proportions. Size + fluff + no-comb contrast. **Low risk** with that contrast held.
  - **vs. `chin` (pack neighbor):** baby bird vs. a face — different categories. FORBIDDEN_PAIR `[chick, chin]` is in-pool hygiene only (both small rounded forms at 96pt).
- **Prompt (paste-ready):**

```
Children's-book illustration, soft pastel, clean line art, cream background, single subject, no text. A friendly baby CHICK, three-quarter view, small round fluffy yellow body, tiny wings, small orange beak, round eyes, no comb. --no anime, photorealistic, 3d render, multiple subjects, text, watermark, grass farm scene, hen with red comb, egg or nest, multiple chicks, kawaii sparkle eyes, chick wearing clothes
```

- **Word-count check:** body 36 words (14 preamble + 22 subject); `--no` 12 logical-concept entries. Under both ceilings.
- **Negatives — what to avoid (12 concepts):**
  - **Grass / farm scene / barn** (environment violation — `grass farm scene`).
  - **Hen with red comb** (the adult-bird competitor — must read as a baby CHICK, not a hen — `hen with red comb`).
  - **Egg or nest / multiple chicks** (second subjects — `egg or nest`, `multiple chicks`).
  - **Kawaii sparkle-eyes** (style drift — `kawaii sparkle eyes`).
  - **Anthropomorphised chick wearing clothes / standing upright** (anti-anthro — `chick wearing clothes`).
  - **Photo-realistic down-feather detail** (covered by `photorealistic`).
- **Asset spec output (Phase 3):**
  - Filename: `public/assets/pictures/picture-chick.svg` via `yarn embed-pictures`.
  - Source PNG: ≥1024×1024 → transparent-PNG via bgclear.ai → embed.
  - Target SVG size: ~50–100 KB.
- **Notes:** The small-round-fluffy-yellow-NO-comb silhouette is the load-bearing recognition cue. The `no comb` is in the body AND `hen with red comb` is in the `--no` — both required, because a comb is the single feature that flips the read to "hen" (which collides with the short-e target). Single chick, NOT a clutch. If MJ produces a chick with an adult comb or adult proportions, regenerate.

---

## 3. Workflow steps — generation → upscale → remove.bg → handoff

Per `feedback_mj_workflow_explicit_removebg` memory: MJ outputs ALWAYS have backgrounds. remove.bg is its own discrete step.

### Per-word workflow (Thomas operates):

1. **Paste the prompt** (from §2.X) into the MJ Web prompt box.
2. **Set aspect ratio to 1:1** in the GUI dropdown.
3. **Submit; wait for 4-grid.**
4. **Review 4-grid:**
   - Does any one of the 4 pass the §1 cohesion checks in `picture-pack-style-anchor.md`?
   - Does the subject read as the target noun in <3 seconds? (For the brief-dependent words — `chin`, `chat`, `chop`, `chug` — does it read as the SPECIFIC sense, not a competing one?)
   - Does it match the style of the prior pack pictures (short-a/o/u/i/e + the sh tier)?
5. **If 4-grid is mixed:** pick the strongest one. If all 4 fail, regenerate with adjustments (force the food-sense on `chip`, force the empty bubble on `chat`, force the no-comb on `chick`, force the side-profile on `chin`, force the split-log-result on `chop`).
6. **Upscale** the chosen image (U1/U2/U3/U4 button in MJ Web).
7. **Download** the upscaled PNG (≥1024×1024).
8. **Background removal:** drop the PNG into [bgclear.ai](https://bgclear.ai) (canonical tool per `removebg-tool-evaluation-2026-05-14.md`; fallback remove.bg) — output a transparent PNG. **MJ outputs ALWAYS have backgrounds; this step is mandatory, never skip.** Verify the transparent PNG has a clean edge (no halo, no fringe).
9. **Save** the transparent PNG as `picture-{word}-removebg.png` under the local pictures-source folder (location per Thomas's existing workflow).
10. **Handoff to Devon (Phase 3):** Devon's `yarn embed-pictures` script consumes the transparent PNGs and produces `picture-{word}.svg` files at `public/assets/pictures/` for the app.

### Pack-level workflow

Per `feedback_mj_walkthrough_step_by_step` memory: hand Thomas one prompt at a time, wait for his 4-grid feedback, fully sequence prompt → pick → upscale → remove.bg → save BEFORE moving to next word.

**Recommended generation order (start with the strongest/lowest-risk single-objects, build cohesion outward, end with the highest-drift-risk words):**

1. `chest` — strongest single-object, lowest drift risk, storybook-universal silhouette. Establishes the pack's style baseline.
2. `chick` — animal, low risk (watch for hen-comb drift — needs no-comb + baby-bird roundness).
3. `chug` — single-object (steam train), low-moderate risk (watch for long-train / station-scenery drift).
4. `chin` — body part, moderate risk (watch for generic-portrait drift where the chin is not salient — needs side-profile).
5. `chop` — action-result, moderate risk (watch for person-mid-swing / lamb-chop / uncut-log drift).
6. `chip` — **high subject-disambiguation risk** — MJ pulls hard toward poker-chip / microchip for the bare word "chip".
7. `chat` — **highest-difficulty word in the pack** — the empty-speech-bubble composition is the trickiest to ground (MJ drifts to filled bubbles + crowds + phones); end with it so the earlier 6 establish the style baseline before the hardest word.

After all 7 are generated + upscaled + bg-removed + saved, hand the batch to Devon for `yarn embed-pictures` Phase 3.

---

## 4. Phase-3 SVG embed — Devon owns

Per `picture-pack-style-anchor.md` §6 and `.claude/docs/skill-trees-and-content.md` (PNG-in-SVG embed pipeline):

- Devon runs `yarn embed-pictures` against the transparent-PNG batch.
- Output: `public/assets/pictures/picture-{chin,chip,chop,chat,chest,chug,chick}.svg` — 7 files.
- Target SVG file size: 40–100 KB per picture (PNG-in-SVG embed; not vector-traced — vector re-trace is polish backlog).
- Devon's `yarn embed-pictures` script handles the base64-encoding into single-`<image>`-element SVGs with the correct viewBox.

**Plus 2 distractor-only picture assets** — `picture-sat.svg` and `picture-sick.svg` for the ch-tier s-contrast traps (word-list §2 / AC7). Silhouette placeholders are acceptable per the distractor-only-entry pattern (Devon's picture-pack §6 finding #4 path); vector trace deferred to polish backlog. These do NOT need MJ prompts in this sheet — they fall under the distractor-only-entries pipeline, not the per-target-word MJ generation pipeline. `picture-sip.svg` already exists (short-i tier — reused, no new asset).

---

## 5. Acceptance criteria (this prompt sheet's deliverable)

- [ ] **7 paste-ready prompts** (one per ch-target word — Dave's §3c locked inventory `chin, chip, chop, chat, chest, chug, chick`), each in its own fenced code block, each ≤40 words for prompt body + tailored `--no` list at ≤12 logical-concept entries.
- [ ] No `--v 6 --style raw --s 250 --ar` parameters in any prompt (v7 GUI workflow).
- [ ] No `--cref / --sref / --cw 80` flags in any prompt (style preamble carries cohesion).
- [ ] Per-word `--no` only; no pack-wide negative blocks.
- [ ] IP-name strip applied (no My Melody / Sanrio / Disney / Ghibli BY NAME in prompts).
- [ ] remove.bg (bgclear.ai canonical) as an explicit Workflow §3 step (never implied as transparent from MJ).
- [ ] Generation order documented (start with `chest`, end with `chat`).
- [ ] Phase-3 handoff to Devon documented, incl. the `picture-sat.svg` + `picture-sick.svg` distractor-only assets.
- [ ] §1.4 style preamble is ≤14 words, byte-for-byte identical across 6 of the 7 prompts AND byte-for-byte identical to the `digraphs-sh` sheet's preamble (cross-tier cohesion lever). **`chat` is the one documented exception** — its preamble drops "single subject" and the subject phrase supplies "tight centered vignette" instead (§1.4 note + §2.4).
- [ ] Total body per prompt: preamble (14, or 13 for `chat`) + subject phrase + details (≤22) = ≤36 words. Headroom for word-specific safety phrases.
- [ ] The 5 load-bearing picture briefs (`chin` side-profile, `chat` two-figures+empty-bubble, `chest` treasure-not-anatomical, `chop` chopped-log+axe, `chug` train-mid-motion) are encoded in the prompt bodies + the §2 notes (these are AC7 content in the word-list spec — not optional polish).

---

## 6. Non-obvious findings — surfacing to Thomas

1. **`chat` is the highest-difficulty word in the pack.** The empty-speech-bubble composition is the trickiest to ground: MJ drifts to (a) filling the bubble with fake text — a moderation-trip risk AND a chip-read risk since the app is strictly text-mirrors-speech, (b) a crowd instead of exactly two figures, (c) modern phones/screens instead of face-to-face talking. The TWO bubble-text negatives + "one empty speech bubble" in the body + "exactly two figures" are all required. `chat` is also the one word whose preamble bends the single-subject rule (the two-figures-plus-bubble is one "chatting scene" vignette) — see finding #2. Expect iteration; end the pack with it.

2. **`chat`'s prompt is the one documented per-word preamble deviation in the pack.** Every other prompt uses the byte-for-byte 14-word preamble. `chat` drops "single subject" (because a chatting scene is inherently two figures) and the subject phrase supplies "tight centered vignette" as the compositional anchor instead. This is deliberate and documented (§1.4 note, §2.4) — it is NOT preamble drift. The other 6 prompts hold the preamble byte-for-byte for cross-tier cohesion.

3. **`chip` carries the highest subject-disambiguation risk** (after `chat`'s difficulty). The bare word "chip" pulls MJ hard toward poker-chip and microchip — neither is the target sense (a food crisp). The body phrasing "golden potato CHIP crisp, gently rippled, snack-food colour" + the two wrong-sense negatives are load-bearing. If 4-grid produces poker-chip or microchip, regenerate — do not pick the "least-bad". This is `chip`'s analogue to the sh tier's `shop` blank-signboard problem.

4. **5 of the 7 words have load-bearing picture briefs** (`chin`, `chat`, `chop`, `chest`, `chug`) — these come from Dave's `digraph-ch-addendum.md` §Recommendations-to-Kyle #4 and are **AC7 content in the word-list spec, not optional polish.** `chin` must be a face-with-prominent-chin (side-profile), not a free-floating fragment. `chat` must read as "talking" via the empty speech bubble. `chest` must be a treasure trunk, not an anatomical chest. `chop` must be the chopped-wood RESULT (split log + axe), not a person mid-swing or a lamb chop. `chug` must read as the chugging ACTION (train + puff + motion-line), not a static train. If a 4-grid satisfies the style but misses the brief's specific sense, it FAILS — regenerate.

5. **The ch-pack has ZERO `hybridMode` words — unlike the sh pack (which had 3).** This changes nothing about how the pictures are made (the quality bar is identical for all 7), but it is worth noting for asset-count + schema clarity: every ch-word is a conventional short-vowel decodable entry. The sh pack's `shoe/sheep/shark` carried `hybridMode: true` because their vowels were outside Marian's formal instruction; none of Dave's 7 ch words have that property (word-list §6.1).

6. **`chin`, `chop`, `chat` are Dave's keeps that a naive audit would reject — and the picture briefs are what rescue them.** An earlier in-flight draft of the word-list spec rejected `chin` (body-fragment imagery), `chop` (verb-class), and `chat` (abstract). Dave's addendum KEEPS all three with specific briefs (§Recommendations-to-Kyle #4): `chin` is shown _in a face_ (body parts are the highest-familiarity vocabulary class), `chop` is the `chop`/`shop` minimal-pair anchor with the concrete chopped-log picture, `chat` is "the best short-a ch word that is picturable" with the two-figures+bubble composition. The briefs in §2 are what make the keeps work.

7. **The ch-pack inherits the sh-pack's exact style preamble — byte-for-byte (6 of 7).** Not a ch-specific variant. The ch pictures should sit visually alongside the sh pictures and the five CVC packs as one coherent set, not form a separate-looking digraph sub-style. This is the cross-tier cohesion lever — and the only cohesion lever, since (per §1.2) no `--cref/--sref` flags are used. `chat` is the one documented exception (finding #2).

8. **`chop` and `chug` each carry a mild tone-guardrail negative.** `chop` has `blood or gore` (an axe + wood must stay gentle — an axe is fine in a children's-book register, a menacing one is not). `chug` has `scary face on train` (a gentle rounded cartoon engine is on-style; a menacing anthropomorphisation is not). Neither is as high-risk as the sh tier's `shark`, but both warrant a 4-grid tone check.

9. **`--no` list ceiling is ≤12 logical-concept entries per prompt** (per `feedback_mj_moderator_negatives_per_word` empirical recipe). Each prompt below is 11–12 entries — collapse redundant style negatives (`anime` + `watermark` cover the `chibi` / `logo` drift class) and fold multi-word phrases into single logical concepts (`poker chip gambling token` as one entry).

10. **2 distractor-only pictures are needed for the ch-tier** (`picture-sat.svg`, `picture-sick.svg`) — one more than the pre-addendum draft anticipated, because Dave's locked pool yields two strong s-contrast trap pairs (`chat/sat`, `chick/sick`) plus the dual-role `chip/sip` (whose `picture-sip.svg` already exists from the short-i tier). `sat` and `sick` fall under the distractor-only-entries pipeline (silhouette placeholders acceptable), NOT the per-target-word MJ generation pipeline — so they get no prompts in this sheet.

11. **Generation order ends on the two hardest words, deliberately.** Start with `chest` (lowest drift risk, strongest single-subject) to establish the style baseline; end with `chip` (high subject-disambiguation risk) then `chat` (the empty-bubble composition — hardest in the pack). The earlier 5 generations give Thomas a clean style reference before he hits the prompts most likely to need retries — mirrors the `digraphs-sh` sheet's "start safe, end risky" ordering logic.
