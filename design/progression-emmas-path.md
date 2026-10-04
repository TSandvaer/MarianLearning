# Emma's Path — visible levels, locks and progress

Status: **plan, decisions locked 2026-10-04** (Thomas). Not started.

## Why

Thomas: it must be obvious what level Marian is at, what she has to master to unlock the next content (e.g. adding and taking away before multiplication), and that more content exists — for maths, letters, sounds and words.

Audit (2026-10-04, read-only): today nothing communicates any of that.

- Hub progress is a 5-cell strip of 28 px icons in a 373 px card (measured on live at 820×1180); 5 of 11 / 13 stages show, repeated glyphs (`+` ×2, `×` ×3), word stages use text a non-reader can't use (`src/screens/Hub/stageIcons.tsx:150-185`).
- Locked stages are blank padlocks; tapping does nothing; the spec bans "how to unlock" copy (`design/screen-hub.md:238,283`).
- The unlock celebration is silent and names the stage she _mastered_, not the one she unlocked (`PromotionCelebration.tsx:179-185`, `mastery.ts:449-450`).
- Session end shows no progress (`SessionEnd.tsx:284-285`).
- The parent toggle "Show level to Marian" is read by nothing (`ParentSettings.tsx:548-554`).
- Mastery in practice = 3 sessions on 3 separate days, each **8/8** (95 %/90 % thresholds over 8 problems; `parentSettings.ts:64-65`, `mastery.ts:635`); one 7/8 resets.

## Decisions (Thomas, 2026-10-04)

1. **Mastery:** a step is mastered after **3 separate days at 7/8 or better, in any order**. Good days accumulate and are never taken away, so displayed progress only grows.
2. **Level = land.** Number Garden: 4 lands — Counting · Adding & taking away · Big numbers · Groups (×). Word Song: 5 lands — Letters · Blending · Words · Sound pairs (sh/ch/th) · Sentences.
3. **Both worlds always open.** Locks apply only to steps inside a world.

## Design rules (research, Dave)

- The next goal and its partial progress are the hero; the full map is context (Bandura & Schunk 1981; Hattie & Timperley 2007).
- Unlock requirements are skills ("First, adding. Then this!"), never points, stardust, days or countdowns (Deci, Koestner & Ryan 1999).
- Progress only fills upward; one predictable unlock celebration that names the skill learned, never "you're so smart" (Mueller & Dweck 1998).
- Every locked tap gets Emma's voice; icons and audio carry everything, minimal text (ESL, non-reader).
- Show only real, built content behind locks; avoid "come back tomorrow" lures, shrinking progress, peer comparison (Radesky et al. 2022).

## What we build (design, Kyle)

- **Hub card:** big land number + one bead per step (11 / 13), grouped by land, the next unlock highlighted; replaces the 5-icon strip. A separate 64 pt map button under each card.
- **Map screen (one per world):** portrait, one screen, path climbing bottom→top; 72 pt picture stops; locked stops show their real art frosted with a padlock; Emma stands on the current stop with practice buds (good days toward the unlock) under it. Locked land gates are visible.
- **Audio:** opening the map, tapping any stop (its name), tapping a locked stop (its requirement). One spoken name per stage (`friendlyNodeName.ts` today merges 8 word stages into "reading words").
- **Session end:** a bud grows on a good day; on an unlock, "All done" goes to the map, the padlock pops and Emma names the new skill. A whole-land gate opening gets a slightly bigger moment.
- Map "current stop" = first not-mastered step (same rule as the session picker). `showLevelToMarian` wired and default on.

## What changes underneath (R&D, Kevin)

- Pure `nodeProgress(progress, node)` → level, good days / required, last score, unlocks-next; reuses the mastery rule's own helpers so display can't drift from the rule.
- `PREREQUISITES` derived from the tree order, so "you need X to unlock Y" is a lookup.
- Mastery rule change to decision 1 (cumulative qualifying days at ≥ 7/8), with a migration that keeps already-mastered steps mastered.
- No storage schema change for v1. Gap: history keeps 30 sessions (`storage.ts:27`); cumulative good-day counts need a small per-node counter.

## Order of work

1. **Speed (in progress):** PR #494 — reuse canon Lily audio in live sessions + only skip the canon when the planner uses the review facts (add-to-20+ with review facts: ~31 s → 0.6 s on preview). Then a session-start timeout with a prepared-session fallback (add-to-10 still ~15 s), then prefetch from the Hub.
2. **Data + rule:** `nodeProgress`, `PREREQUISITES`, cumulative mastery rule + migration, fix the celebration label.
3. **Design specs:** Hub card + map + session-end beats (Kyle), confirming the reversal of `screen-hub.md:238,264,283`.
4. **Build:** Hub card, map screen, session-end beats, locked-stop audio; new Emma lines rendered in Lily and ear-tested.

## Open items

- Kyle and Dave differ on keeping the 5-icon strip; this plan follows Kyle (replace it) with Dave's "next goal is the hero" applied to the bead row.
- `.claude/docs/skill-trees-and-content.md` lists 10 maths / 8 word stages; the code has 11 / 13.
- The wrong-answer line "Hmm... try again?" may conflict with the no-nag copy rule; unchecked.
