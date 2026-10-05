# Emma's Path — Hub card, map screen, session-end beats

Status: **design spec** for ticket 6/10 of `design/progression-emmas-path.md` (ClickUp 123jpnbc3dp).
Brief: `design/progression-emmas-path.md` — "What we build", Decisions 1–3, Design rules.
Builds on: `src/lib/progress/nodeProgress.ts`, `lands.ts`, `prerequisites.ts` (merged in PR #495).
Out of scope: implementation code, final art production (§8 lists the art to make).

## 0. Supersedes (in `design/screen-hub.md`)

| `screen-hub.md` line                                                                                                                                                             | Old rule                                                              | New rule (this spec)                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **:238–239** — `### Icon states` table, "Current — next-up" and "Locked (future)" rows (the ticket cites :238; the locked row with the "no how to unlock copy" text is line 239) | Locked stage = blank padlock; "not tappable; no 'how to unlock' copy" | Every locked stop shows its real art frosted + padlock; **every tap gets Emma's voice naming the requirement as a skill** (§4.2). The 5-icon strip and its "current" glow are replaced by the Hub card (§2).                                            |
| **:264** — "Why no whole-tree map, no branching graph"                                                                                                                           | Only a sliding 5-window; never a whole-tree view                      | One **map screen per world** shows the whole tree (§3). Still linear, no branching — the Tversky concern is met by one path climbing one way, with Emma on it and audio on every stop.                                                                  |
| **:283** — "Locked (v2+)" card row: tap shows "Coming soon!" with no further detail                                                                                              | Lock taps say "Coming soon!" only                                     | **Worlds never lock** (Decision 3). Locks exist only on steps inside a world, and their tap line is the requirement (§4.2). "Coming soon!" is retired. The "never show stardust-to-unlock" ban **stands** — requirements are skills, never points/days. |

`screen-hub.md` carries a pointer back to this section at each of those lines.

## 1. Shared vocabulary and data

- **World** = Number Garden (`'math'`) or Word Song (`'word-song'`). Both always open.
- **Land** = `Land` from `lands.ts` (`number`, `name`, `nodes`). 4 math lands, 5 word lands.
- **Step / stop** = one `SkillNode`. 11 math, 13 word (`MATH_TREE` / `LITERACY_TREE`).
- **Current step** of a world = the first step in tree order whose `skillLevels[node] !== 'mastered'` — the same forward rule as `pickFocusNode` (`focusNode.ts:169`). If every step is mastered, current = the last step (§3.6 "path complete").
- **Next unlock** = `nodeProgress(p, current).unlocksNext` (null on a tree's last step).
- **Good day / bud** = one of `nodeProgress(...).goodDays`; `requiredDays` buds per step (3 today; letter-sounds while per-vowel tracking is on = 4 vowels × 3).

### Data contract — field per UI element

| UI element                                      | Source                                                                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Hub big land number                             | `landOf(current).number`                                                                                                                |
| Hub bead count + land grouping                  | `landsOf(world)` → each `land.nodes` in order (one bead per node, a gap between lands)                                                  |
| Bead state (mastered / current / locked / open) | `nodeProgress(p, node).level` (`'mastered' \| 'practicing' \| 'intro' \| 'locked'`) + current-step rule                                 |
| Current bead partial fill                       | `nodeProgress(p, current).goodDays / requiredDays`                                                                                      |
| Hub hero: next-unlock highlight                 | `nodeProgress(p, current).unlocksNext`                                                                                                  |
| Map land bands + gate positions                 | `landsOf(world)`; a gate sits before every land with `number > 1`                                                                       |
| Gate open / closed                              | `nodeProgress(p, land.nodes[0]).level !== 'locked'` → open                                                                              |
| Stop state                                      | `nodeProgress(p, node).level`                                                                                                           |
| Practice buds under a stop                      | `goodDays`, `requiredDays`; for letter-sounds use `vowels[]` (4 groups of `requiredDays` each, per-vowel `goodDays`)                    |
| "Nearly there" variant (cvc-words)              | `awaitingNovelWordCheck === true`                                                                                                       |
| Locked-stop requirement line                    | `PREREQUISITES[node][0]` (the single tree predecessor); if that is not the current step, the line names the current step instead (§4.2) |
| Session-end bud beat                            | `after.goodDays > before.goodDays` for the session's focus node                                                                         |
| Session-end unlock beat                         | `before.unlocksNext` is now `level !== 'locked'` (and `after.level === 'mastered'`)                                                     |
| Session-end land-gate beat                      | unlock beat AND the newly unlocked step `=== landOf(newStep).nodes[0]`                                                                  |
| Show/hide land number                           | `getSettings(p).showLevelToMarian` (default to become `true` — build ticket; §6)                                                        |

`before` / `after` = `nodeProgress` computed on the progress doc before and after the session's history entry + mastery rule are applied. Never compare raw `skillLevels` in UI code — always go through `nodeProgress` so display cannot drift from the rule.

## 2. Hub card (replaces the 5-icon strip)

The card keeps its place, size (measured 373 pt wide at 820×1180), tap-to-start behaviour (`onPickTree`) and suggested-node ring. Only the strip area changes.

```
+-------------------------------------------+  373 pt
|  🌸 🌼 🌷   (world emblem, unchanged)       |
|                                           |
|  ( 2 )   [current 44pt] ─→ [next 44pt 🔒] |  hero row, 56 pt tall
| land no.   ✿ ✿ ◦  buds                     |  buds 14 pt under current icon
|                                           |
|  ● │ ● ● ◐ ○ │ ○ ○ ○ │ ○ ○ ○               |  bead row, 18 pt beads
+-------------------------------------------+
        [        🗺  map  (64 pt)        ]       separate button under the card
```

- **Land number:** numeral in a 56 pt circle, `--my-rose` fill, cream numeral, 34 pt bold. Left edge 16 pt inset. Hidden when `showLevelToMarian === false` (the hero row slides left to fill).
- **Hero row (the next goal is the hero):** current step icon 44 pt, full colour, 2 pt rose ring; under it the buds (§3.4) at 14 pt. A 20 pt soft arrow, then the next-unlock icon 44 pt, frosted (§3.3) with a 16 pt padlock bottom-right. If `unlocksNext === null`, the arrow and next icon are replaced by a single 28 pt bloomed flower.
- **Bead row:** one bead per step (11 / 13), 18 pt diameter, 5 pt gap inside a land, 13 pt gap (with a 2 pt × 12 pt pale divider) between lands. Width check: Word Song 13×18 + 8×5 + 4×13 = 326 pt ≤ 341 pt usable. Number Garden is narrower.
  - mastered = solid `--my-rose` fill.
  - current = rose ring 2 pt + pie fill `goodDays / requiredDays` (never empties; Decision 1).
  - open but not current (`intro`/`practicing`, rare) = rose ring, pale fill.
  - next unlock = pale bead with a 1-cycle shimmer on Hub mount, then a static 2 pt `--my-rose` dashed ring (same "this one is next" cue as the hero).
  - locked = `--my-pink-30` hollow ring, opacity 0.6.
- **Beads and hero are not separate tap targets.** The whole card stays the 280+ pt "start a session" target. The map has its own button so a stray tap never starts a session.
- **Map button:** 64 pt tall, card-width pill, 16 pt below the card, cream fill + 2 pt rose border, a 40 pt folded-map picture centred (no text; `aria-label="Number Garden map"` / `"Word Song map"`). Tap → `sfx-plink`, route to the map of that world. Vertical budget: comes out of the existing ~8 vh stats-strip / spacer band; the stats strip moves down 80 pt (still above the bottom safe area at 1180 pt tall).
- **No Hub audio change** other than the map button `sfx-plink`. The welcome-back greeting stays as specified in `screen-hub.md`.

## 3. Map screen (one per world)

Portrait, one screen, no scrolling, designed at 820×1180 (scales by width to 768–1024 pt; vertical numbers below are for 1180).

```
+--------------------------------------------------+
| [⌂ 64]          🌸 world emblem 48pt             |  header 88 pt
|--------------------------------------------------|
|   L4  (●)───(●)───(●)                            |  land band (top = last land)
|                      ╲                           |
|               [ gate 4 🔒 ]                       |  gate 40 pt
|                      ╱                           |
|   L3  (●)───(●)───(●)                            |
|       ╱                                          |
|   [ gate 3 ]                                     |
|       ╲                                          |
|   L2  (✿)───(✿)───(🙋Emma on ●)───(❄🔒)         |
|                        ✿ ✿ ◦  buds               |
|                      ╲                           |
|               [ gate 2 (open) ]                   |
|   L1  (✿)                                        |  bottom = land 1
|--------------------------------------------------|
|   ( Emma's caption ribbon — mirrors speech )     |  ribbon 96 pt
+--------------------------------------------------+
```

### 3.1 Bands and path

- Path region = 1180 − top inset − 88 header − 96 ribbon − bottom inset ≈ 952 pt. Each land is one horizontal band; land 1 at the bottom, path climbs bottom → top.
- Gate strip 40 pt between bands. Band height = (952 − gates × 40) / lands → Number Garden 208 pt, Word Song 158 pt. Emma (112 pt) may overlap upward into the gate strip above her stop.
- Inside a band the stops sit on one row, evenly spaced, left→right on odd lands and right→left on even lands, so the trail snakes upward. Widest row (Words, 5 stops) = 5 × 72 + 4 gaps ≥ 60 pt — fits 788 pt usable.
- Trail: 10 pt rounded dotted line, `--my-pink-50`; the part already walked (up to and including the current stop) is solid `--my-rose`.
- Land background tint per band (pale, 8 % alpha) so lands read as places. Optional 20 pt land-number pebble at the band's start (hidden when `showLevelToMarian === false`).

### 3.2 Stops — 72 pt picture stops

Each stop is a 72 pt circle with the step's picture (§5). Tap target 88 pt (8 pt invisible pad).

| State             | Visual                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| mastered          | Full colour + 24 pt bloomed flower badge top-right                                                                    |
| current           | Full colour + 3 pt rose ring + buds under it + Emma standing on it                                                    |
| open, not current | Full colour, 2 pt rose ring, buds under it, no Emma                                                                   |
| locked            | **Real art, frosted:** 6 px blur, 55 % white veil, 70 % saturation; 28 pt padlock centred-bottom, overlapping the rim |

### 3.3 Frost treatment (locked stops, next-unlock on Hub)

Shared style token `frost`: `filter: blur(6px) saturate(0.7)` on the art + a 55 % cream overlay + padlock. The picture must still be recognisable as "something real" — it is a peek, not a hidden box (Design rule: show real, built content behind locks).

### 3.4 Practice buds

- Row of `requiredDays` buds, 16 pt each, 6 pt gap, centred 8 pt under the stop.
- Grown (one per good day): open pink flower. Not yet: small closed green bud. Buds only ever change closed → open (Decision 1: never taken away).
- letter-sounds with per-vowel tracking: 4 groups of 3 buds (from `vowels[]`), 12 pt gap between groups, buds at 12 pt so the row is ≤ 200 pt.
- `awaitingNovelWordCheck`: all buds open + the stop gets a soft pulsing glow (2 s loop, opacity 0.6↔1.0) — "nearly there".
- No numbers, no "2/3" text, no days language anywhere.

### 3.5 Land gates

- 64 × 40 pt garden arch on the trail where it climbs into a land. Each gate shows a **land picture** (§5.3), never a number-only badge.
- Closed (first step of that land is locked): arch with a closed gate, frost treatment, 20 pt padlock. Open: gate swung open, full colour.
- Tap a gate → speaks the land name (§4.1 L-lines); a closed gate also speaks its requirement (§4.2).

### 3.6 Emma

- `emma-idle.svg` at 112 pt tall, feet on the top edge of the current stop, may overlap the band above (z above trail, below ribbon).
- Path complete (every step mastered): Emma on the last stop in `emma-cheering.svg`, no next-unlock highlight, open line M-3.
- Header: back button 64 pt (house picture, `aria-label="Home"`) top-left → Hub (`mid-skill-back`-style return, no greeting replay inside 30 s per `useRapidRemountSuppression`). World emblem 48 pt centred, decorative.

## 4. Audio script

All lines Lily (ElevenLabs), baked into canon as whole lines (no runtime stitching — stitched name clips break prosody). `{name}` = the stage's spoken name from §4.3; each `{name}` variant is a separate baked line.

### 4.1 Map open, stop tap, gate tap

| ID                       | When                         | Line                                       |
| ------------------------ | ---------------------------- | ------------------------------------------ |
| `path.open.{node}`       | Map opens (current = node)   | "Here is your path! You are on {name}."    |
| `path.open.done.{world}` | Map opens, path complete     | "You did all of it! Look at your flowers!" |
| `path.stop.{node}`       | Tap an open or mastered stop | "{Name}." (name only)                      |
| `path.land.{world}.{n}`  | Tap an open gate             | "Land {n}: {land name}."                   |

### 4.2 Locked-stop tap — the requirement, as a task

Tap a locked stop → `sfx-poof` (soft) + Emma `emma-attentive-pointing.svg` pose, pointing toward the current stop, 1.5 s; then:

| ID                             | Condition                                              | Line                                             |
| ------------------------------ | ------------------------------------------------------ | ------------------------------------------------ |
| `path.locked.next.{node}`      | `PREREQUISITES[node][0]` is the current step           | "{Name}! First, {prerequisite name}. Then this!" |
| `path.locked.later.{node}`     | the prerequisite is itself locked (stop is further on) | "{Name}! Not yet. First, {current name}."        |
| `path.gate.locked.{world}.{n}` | tap a closed gate                                      | "Land {n}: {land name}! First, {current name}."  |

The `later` form always names the step Marian can do **now**, so every locked tap ends in something actionable. No counts, days, points or "come back" — ever.

### 4.3 One spoken name per stage (24, all different)

Replaces the collapsing `FRIENDLY_NODE_NAMES` for Path surfaces (recap may adopt it too — build-ticket call). Word-stage names lean on the stop picture so the name and the art match.

| Node                            | Spoken name                 | Node                    | Spoken name       |
| ------------------------------- | --------------------------- | ----------------------- | ----------------- |
| `number-recog`                  | numbers                     | `letter-names`          | letter names      |
| `add-to-10`                     | adding to ten               | `letter-sounds`         | letter sounds     |
| `add-to-20`                     | adding to twenty            | `blending-cv`           | blending sounds   |
| `sub-to-10`                     | taking away to ten          | `cvc-words`             | cat words         |
| `sub-to-20`                     | taking away to twenty       | `cvc-words-short-o`     | dog words         |
| `two-digit-addsub-no-regroup`   | big numbers                 | `cvc-words-short-u`     | sun words         |
| `two-digit-addsub-with-regroup` | making tens                 | `cvc-words-short-i`     | pig words         |
| `skip-counting`                 | skip counting               | `cvc-words-short-e`     | bed words         |
| `mult-2-5-10`                   | groups of two, five and ten | `digraphs-sh`           | ship words        |
| `mult-3-4`                      | groups of three and four    | `digraphs-ch`           | chick words       |
| `mult-6-9`                      | big groups                  | `digraphs-th-voiceless` | thumb words       |
|                                 |                             | `sight-words`           | star words        |
|                                 |                             | `simple-sentences`      | reading sentences |

Land names spoken exactly as `lands.ts` `name`, with "&" read as "and".

### 4.4 Session-end beats

| ID                     | Trigger (§1 data contract)                            | Line                                                      |
| ---------------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| `end.bud.{node}`       | good day banked, no unlock                            | "Look! A new flower for {name}!"                          |
| `end.unlock.{newNode}` | unlock                                                | "You learned {mastered name}! Now you can do {new name}!" |
| `end.land.{world}.{n}` | unlock that opens a land gate (replaces `end.unlock`) | "A new land! Land {n}: {land name}!"                      |

No line on a session that banks no good day — the existing recap line plays unchanged; nothing shrinks, nothing is said about the score. A second good session on the same day banks no bud and gets no bud beat.

### 4.5 Vocabulary check

The repo has no machine-readable 200-word list (`grep -rli "vocabulary cap\|core-vocab\|200 core\|vocab list" design src scripts` finds only prose vocab checks in specs and research notes), so this is a by-hand check like `screen-hub.md` §Vocab check. Carrier words: here, is, your, path, you, are, on, did, all, of, it, look, at, flowers, flower, a, new, for, learned, now, can, do, land, first, then, this, not, yet. Name words: numbers, adding, taking, away, to, ten, twenty, big, making, tens, skip, counting, groups, two, three, four, five, and, letter, letters, names, sounds, blending, words, reading, sentences, cat, dog, sun, pig, bed, ship, chick, thumb, star, sound, pairs (land names: counting, adding, taking away, big numbers, groups, letters, blending, words, sound pairs, sentences). Checked against the baked canon text (`grep -rhoiw <word> public/canon`, 2026-10-05): every word above already occurs in `public/canon` except **here, all, learned, land, yet, big, making, tens, thumb, pairs** (10 words). Those 10 are the vocabulary cost of this spec — all everyday words, within cap headroom. Dave to confirm "making tens" and "star words" land for an ESL 8-year-old (§10).

## 5. Icons — one unique picture per stage, no text

Pictures, not glyphs: no digits, letters, `+ − ×` or words inside any icon. Word stops reuse the existing word pictures (`public/assets/pictures/picture-*.svg`).

### 5.1 Number Garden (11)

| Node                            | Picture                                                          | Status |
| ------------------------------- | ---------------------------------------------------------------- | ------ |
| `number-recog`                  | Open hand, five fingers spread                                   | new    |
| `add-to-10`                     | Two flowers being planted into one pot                           | new    |
| `add-to-20`                     | Egg box with two full rows of eggs                               | new    |
| `sub-to-10`                     | Three birds on a fence, one flying off                           | new    |
| `sub-to-20`                     | Bunch of balloons, one floating away                             | new    |
| `two-digit-addsub-no-regroup`   | One bundle of ten sticks tied with a ribbon + three loose sticks | new    |
| `two-digit-addsub-with-regroup` | Loose sticks with a ribbon mid-tie into a new bundle             | new    |
| `skip-counting`                 | Frog hopping over lily pads (dotted hop arcs)                    | new    |
| `mult-2-5-10`                   | Pairs of socks on a washing line                                 | new    |
| `mult-3-4`                      | A three-leaf clover beside a four-leaf clover                    | new    |
| `mult-6-9`                      | Smiling octopus waving all eight arms                            | new    |

### 5.2 Word Song (13)

| Node                    | Picture                                       | Status                      |
| ----------------------- | --------------------------------------------- | --------------------------- |
| `letter-names`          | Singing mouth with music notes (the ABC song) | new                         |
| `letter-sounds`         | Ear with three sound waves                    | new                         |
| `blending-cv`           | Two puzzle pieces clicking together           | new                         |
| `cvc-words`             | Cat                                           | reuse `picture-cat.svg`     |
| `cvc-words-short-o`     | Dog                                           | reuse `picture-dog.svg`     |
| `cvc-words-short-u`     | Sun                                           | reuse `picture-sun.svg`     |
| `cvc-words-short-i`     | Pig                                           | reuse `picture-pig.svg`     |
| `cvc-words-short-e`     | Bed                                           | reuse `picture-bed.svg`     |
| `digraphs-sh`           | Ship                                          | new (no `picture-ship.svg`) |
| `digraphs-ch`           | Chick                                         | new                         |
| `digraphs-th-voiceless` | Thumb (thumbs-up)                             | new                         |
| `sight-words`           | Shining star with a smile                     | new                         |
| `simple-sentences`      | Open storybook                                | new                         |

All 24 are distinct objects; no picture or motif repeats (the old strip repeated `+` ×2, `−` ×2, `±` ×2, `×` ×3).

### 5.3 Land gate pictures (9, distinct from stop pictures)

Number Garden: 1 seed, 2 watering can, 3 tall sunflower, 4 beehive. Word Song: 1 alphabet-block tower (plain coloured blocks, no letters), 2 two notes joined by a slur, 3 bookshelf, 4 pair of birds singing, 5 letter envelope. Gate 1 has no arch (land 1 is always open) — its picture sits on the start pebble.

### 5.4 Other new art

Folded map (map button), house (back button), padlock 16/20/28 pt, bloomed flower badge 24 pt, bud open / closed 12–16 pt, garden arch open / closed.

## 6. Session-end beats (flow)

Today: SessionEnd → "All done" → Hub. New:

1. **No good day banked:** unchanged.
2. **Good day banked, no unlock:** on SessionEnd, after the stardust tally, a 72 pt copy of the focus stop slides up (spring stiffness 260, damping 22) with its bud row; the new bud opens (scale 0 → 1.15 → 1.0, 450 ms, + `sfx-sparkle`); line `end.bud.{node}`. "All done" → Hub as today.
3. **Unlock:** SessionEnd plays its normal recap, then "All done" routes to **the map** (not the Hub). On map mount, line `end.unlock.{newNode}` with this choreography:
   - 0 ms: map visible, Emma on the just-mastered stop; its flower badge blooms (scale 0 → 1, 300 ms).
   - 400 ms: Emma hops along the trail to the new stop (spring, 700 ms, two small arcs).
   - 1100 ms: padlock pops — scale 1 → 1.3 → 0 with 6 pink sparkles, `sfx-chime-soft`; frost fades out over 400 ms.
   - 1500 ms: `emma-cheering.svg`, line plays. Back button returns to Hub (no greeting replay).
4. **Land gate opens** (unlock where the new step is the first of its land): step 3, plus between padlock-pop and the line, the gate swings open (rotateY 0 → −70°, 600 ms) with 12 sparkles + `sfx-cheer`, the new land's band tint fades in from 0 → 8 %; line `end.land.{world}.{n}` instead of `end.unlock`. One predictable size up — never random.

This map moment **replaces** the Hub `PromotionCelebration` overlay for unlocks (its label bug — naming the mastered step — goes away with it). Retiring the overlay and its `pendingPromotion` wiring is the build ticket's job.

`showLevelToMarian`: wired by the build ticket and defaulted to `true`. `false` hides only land numbers (Hub land circle, map pebbles, the "Land {n}" words — the line becomes "A new land: {land name}!"); beads, buds, map and requirement lines stay, because they are progress and next-goal, not a level badge.

## 7. Motion and reduced motion

Springs: stiffness 260, damping 22 unless stated. `prefers-reduced-motion`: replace hops/swings/pops with 200 ms cross-fades; audio unchanged. No infinite loops except the `awaitingNovelWordCheck` glow and Emma's existing breathing loop.

## 8. Assets required (art production out of scope)

New pictures: 20 stop pictures (§5.1 + §5.2 "new"), 9 land-gate pictures, map/house icons, padlock (3 sizes), flower badge, bud open/closed, arch open/closed. Reused: 5 CVC pictures, `emma-idle`, `emma-cheering`, `emma-attentive-pointing`, `sfx-plink`, `sfx-poof`, `sfx-sparkle`, `sfx-chime-soft`, `sfx-cheer`. New audio: §4 lines × variants, Lily, ear-tested (voice-QA gate).

## 9. Acceptance criteria (for QA)

- [ ] Hub card shows the land number = `landOf(current).number` and exactly 11 (math) / 13 (word) beads grouped into 4 / 5 lands.
- [ ] The current bead fill equals `goodDays / requiredDays`; the next-unlock bead and hero icon match `unlocksNext`.
- [ ] Map button is 64 pt tall, under each card, and opens that world's map; tapping beads never starts a session.
- [ ] At 820×1180 the whole map fits without scrolling; every stop is 72 pt with an 88 pt tap target.
- [ ] Locked stops show frosted real art + padlock; tapping one plays a `path.locked.*` line naming a skill, never a number or day.
- [ ] Emma stands on the first not-mastered step; buds under it never decrease across sessions.
- [ ] Gates are visible between every pair of lands; closed iff the land's first step is locked.
- [ ] Each of the 24 stages has a different spoken name and a different picture; no icon contains text.
- [ ] Session end: bud beat only when `goodDays` rose; unlock → map + padlock pop + `end.unlock` line; new land → gate swing + `end.land` line.
- [ ] `showLevelToMarian === false` hides land numbers only.

## 10. Open questions

1. Dave: do "making tens" (regroup) and "star words" (sight words) work for an ESL 8-year-old, or keep "bigger numbers" / "quick words"?
2. Whole-line bakes ≈ 24 × 5 templates (~120 lines) + 9 land lines; acceptable Lily render + ear-test load, or split into name + carrier clips for the `locked.later` set?
