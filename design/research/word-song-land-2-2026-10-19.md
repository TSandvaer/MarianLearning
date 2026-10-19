# Word Song land 2: blending, alone in its land

**Date:** 2026-10-19
**For:** the coordinator, relayed to Thomas.
**Status:** research only, docs only. One team recommendation (child psychology plus Kyle's UX view, which I took from his specs; I could not message him).
**Trigger:** Thomas, 2026-10-19, looking at the Word Song map: "Why is blending sounds all alone in the lane?" He then approved (popup) "Ask Dave + Kyle for one recommendation".

**Who this plans for:** any learner of about 6 to 9 (`CLAUDE.md:9`). Marian is one user.

---

## Bottom line

**Keep land 2 as it is (option a).** Cost: nothing. No code, no Lily characters, no files beyond this note.

**The answer to "why":** lands group steps by the kind of skill (Thomas's decision 2, `design/progression-emmas-path.md:21`), and the tree has one blending step. A land with one stop is a short, honest goal, not a defect. Number Garden already has one (land 1 "Counting") and wave 5 adds another (land 6 "Bigger numbers"), which Thomas approved today.

Merging (b) makes every later land number go down by one for any learner past land 2. That breaks the plan's own rule that shown progress only grows. A second blending step (c) has real phonics evidence behind it, but nothing shows a learner needs it yet.

---

## State check (read in code, 2026-10-19)

- **The land:** `{ world: 'word-song', number: 2, name: 'Blending', nodes: ['blending-cv'] }` (`packages/core/src/progress/lands.ts:61`). The land number is "the level shown to Marian" (`lands.ts:16`). The Hub card shows it (`packages/core/src/hub/hubCardModel.ts:159`).
- **Other one-stop lands:**
  - Number Garden land 1 "Counting" holds only `number-recog` (`lands.ts:23`).
  - Wave 5 adds Number Garden land 6 "Bigger numbers" with one stop, `add-two-digit`. Kyle placed it "leaving room for a later `sub-two-digit` in land 6" (`design/native/content-wave-5.md:28`, `:53`). Thomas approved the land names (T1, `content-wave-5.md:595`).
- **What the blending step does:** "Tap the <word>." means "match picture to spoken word" (`api/_planner.ts:2236`). Its eight canon words are cat, bag, hat, dad, van, can, man and jam (`public/canon/word-song/level-1/blending-cv.json`). It has no blend clip (planner rule, `api/_planner.ts:1634`), and its letter row pulses silently (`design/native/word-song-native.md:137`). So the stop named "blending sounds" does not split a word into its sounds. The first place a learner hears sounds blended is cvc-words: all 40 of its baked words carry a blend clip (`word-song-native.md:137`).
- **Map fit:** a world with more than `PORTRAIT_FIT_LANDS = 6` lands scrolls on portrait (`packages/core/src/map/mapLayout.ts:323`). Word Song has 8 lands on main and 9 with PR #617. A merge gives 7 or 8, which still scrolls, so the layout behaves the same.

---

## The three options and their cost

| Option                              | What a learner sees                                                                                                                                                                                                                                       | Cost                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(a) Keep**                        | Unchanged. A land gate after letter sounds, then another gate after one step.                                                                                                                                                                             | None.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **(b) Merge into land 1 or land 3** | Every learner past land 2 sees their land number drop by one on the Hub card and the map. "Into Letters" puts a step that isn't letters under a spoken land name. "Into Words" gives Words 6 stops; no land has more than 5 today, and 6 is not measured. | **Lily:** 14 lines, **370 characters** after #617 ("Land 2: Words." through "A new land! Land 8: More words and stories!"). That is 12 lines, 296 characters, against main today. Characters counted as wave 5 counts them (`content-wave-5.md:426`). It also throws away #617's freshly rendered land 9 lines. The 6–7 "A new land: <name>!" lines keep their text; I assume they can be renamed without a re-render, but I have not checked. **Files:** `lands.ts`; `pathArt.ts` (`LandArtId` loses one); land emblem WebPs renumbered, and the Blending emblem (two puzzle pieces, `design/emmas-path/emmas-path-spec.md:233`) retired; the audio/asset registries; `lands.test.ts`, `mapModel.test.ts:61` ("23 word stops in 8 lands"), `mobile/src/layout/mapScreenLayout.test.ts:198` (8-land figures), `contentWave4WordSong.wiring.test.ts:94-96` (`land-ws-8`), the path-line count tests, and `e2e/emmas-path-map.spec.ts` plus `e2e/emmas-path-session-end-beats.spec.ts`. PR #617 is rebased, and its approved "Land 9" text becomes "Land 8". |
| **(c) A second blending step**      | A new stop before cvc-words, e.g. Emma says a word's sounds joined ("mmmaaan") and the learner taps its picture.                                                                                                                                          | A whole new SkillNode: the sibling-tier checklist (`.claude/docs/sibling-tier-checklist.md`, 14–16 places) and all six content surfaces. Measured proxy: a step the size of blending-cv has 1,032 canon characters (60 utterances) and 9 per-step path and guidance clips. Its blend clips and art are extra, and cvc-words' locked-next and unlock lines change because they name the new step. It needs a Dave-words, Kyle-spec, render and ear-test cycle. **For a fluent learner:** at least 2 more days (fast track, `design/native/fast-track-native.md` Goal), typically 3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

---

## Evidence

- **Proximal goals help. Bandura & Schunk (1981)**, "Cultivating competence, self-efficacy, and intrinsic interest through proximal self-motivation", _JPSP_ 41(3):586–598. https://uploads-ssl.webflow.com/59faaf5b01b9500001e95457/5bc552d85141987915dab842_Bandura%20&%20Schunk,%201981.pdf
  - Children with near subgoals made faster progress and gained self-efficacy and interest. Distal goals had no measurable effect.
  - Moderate (one experiment, much cited; I saw a search summary of its abstract). The plan already rests on it (`progression-emmas-path.md:25`).
  - _Use:_ a one-stop land is the nearest goal on the map. That helps; it does not harm.
- **Progress that shrinks is the harm.** The plan's own rules: "displayed progress only grows" (decision 1, `progression-emmas-path.md:20`), "Progress only fills upward" and "avoid … shrinking progress" (`:27`, `:29`, citing Radesky et al. 2022).
  - _Use:_ under (b), a learner's land number drops, which breaks these rules.
- **The phonics case for (c). Ehri et al. (2001)**, "Phonemic awareness instruction helps children learn to read: Evidence from the National Reading Panel's meta-analysis", _Reading Research Quarterly_ 36(3):250–287.
  - Phonemic awareness instruction helps reading. It helps more with letters and when it focuses on one or two skills such as blending.
  - Strong (meta-analysis). I saw search summaries, including of the NRP findings page (https://www.nichd.nih.gov/publications/pubs/nrp/findings), not the full paper.
- **Gonzalez-Frey & Ehri (2021)**, _Scientific Studies of Reading_ 25(3):272–285 (already in `design/research/cvc-blend-audio-phonics.md`).
  - Kindergartners (mean age 5.6) taught connected phonation ("sssaaannn") decoded new words better than those taught segmented phonation.
  - Strong (RCT). _Use:_ if land 2 ever gets a second stop, this is its format.

**Kyle's view, from his specs:**

- A land's name is spoken, so its steps must fit it (content wave 1 § 5.1, `lands.ts:87`). That rules out merging into "Letters".
- A new land may start with one stop and grow (`content-wave-5.md:53`).
- Every gate shows its own land picture (`emmas-path-spec.md:136`), so land 2 already has its own art.
- Map layout depends on the land count, and a merge changes nothing there (State check).

---

## Application to learners (multi-user)

- **A 6-year-old just past letter sounds:** gets a quick, real win (one step, then a new land) before the long Words land (5 stops). That suits the age.
- **A fluent 8–9-year-old:** passes it in 2 days on the fast track, which costs less than any option that adds a step.
- **Danish version:** planned, not designed (`CLAUDE.md:9`). None of the three options blocks it. Keeping adds nothing new to translate.

## Risks / what would change this

- **The strongest case against keeping:** the "Blending" stop does not split a word into its sounds (State check), and the evidence supports blending practice for beginners (Ehri et al. 2001). Two things weigh against acting now. Every cvc-words problem already has a blend clip. And no learner has stalled yet: Marian found Word Song too easy (`fast-track-native.md`, Trigger).
  - **The signal that would justify (c):** a learner masters blending-cv and then trips the pace guard on cvc-words (≤ 5/8 on two recent days, `fast-track-native.md:54`, `paceHold` in the backup export).
- **If the map's look is what matters to Thomas:** the least harmful merge is into "Words", folded into #617 before it merges. It still costs the land-number drop and the 370 characters above.

## Recommendation

Keep Word Song land 2 "Blending" as one stop. Give Thomas the "why" above. No ticket, no build, no render.

## Only Thomas can answer

- Does the one-stop lane bother him enough to pay for a land number that goes down for learners past land 2, plus about 370 Lily characters? That is a values call, not an evidence call.
