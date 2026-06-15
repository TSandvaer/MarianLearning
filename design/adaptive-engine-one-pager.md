# Adaptive engine — one-pager

**Status: proposal → shipped pending Thomas iPad confirm.**
_(M5, ticket 86c9kmwh0. Code for M1–M5 is merged; this doc flips to "shipped"
only after Thomas walks the 5-session iPad smoke checklist below and confirms
the loop behaves on a real device. Do not pre-flip the status.)_

## What it is

The adaptive engine is the small set of pure modules under
`src/lib/progress/` that decide **what Marian practises next** and **when she
moves up a tier**, plus the planner-side wiring that turns those decisions into
a session. The guiding constraint is the project thesis — _"Claude is the
brain, not the mouth"_: the engine runs locally on a `localStorage` progress
document, and Claude (Haiku) is called once at session-start to author the
session that the engine asked for.

No database, no analytics, no server-side per-child state. The entire model is
one JSON blob at `marian-tutor:progress:v1`.

## The loop, in one breath

1. **Session-start** — the browser reads the progress doc, picks the focus node
   (`pickFocusNode`), and ships compact hints (focus node, recent success rate,
   graduation flag, Leitner box-1 facts, slow facts) on the `/api/claude`
   payload. Haiku authors 8 problems + pre-canned chatter targeting that node.
2. **Play** — Marian does the 8 problems. Per-problem correctness and first-tap
   latency are captured.
3. **Session-end** — `recordProgressOnSessionEnd` appends a `SessionHistoryEntry`
   and runs `applyMasteryRule`, which can promote a node `practicing → mastered`,
   unlock the next tier `locked → intro`, and queue a Hub celebration. Math facts
   promote/demote in the Leitner box.

## The pieces (all shipped)

| Milestone | What shipped                                                                                  | Source of truth                                                      |
| --------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| M1        | Progress doc model + localStorage adapter + hardened read path (defaulters, type guards).     | `src/lib/progress/{types,storage,guards}.ts`                         |
| M2        | Focus-node picker + session-start hint piping into the planner payload.                       | `src/lib/progress/focusNode.ts`, `App.tsx#readProgressHintsForTrack` |
| M2.5      | Parent settings surface (see below).                                                          | `src/screens/ParentSettings/`                                        |
| M3        | Mastery rule — per-track threshold promotion, tree-adjacency unlock, graduation gate.         | `src/lib/progress/mastery.ts`                                        |
| M4        | Leitner spaced-review box for math facts + session-gen weighting + slow-fact surfacing.       | `src/lib/progress/leitner.ts`                                        |
| M5        | This closeout — `?reset=1` QA affordance, session-end focus-recap line, iPad validation pass. | this ticket (86c9kmwh0)                                              |

## Mastery thresholds (locked)

Per-track, parent-tunable, defaulting to:

- **Math: 95/3** — over-practice durability hypothesis on fact automaticity.
- **Word-song: 90/3** — Pickering et al. (PMC5843573): 90% over-learning is the
  durable plateau; 95% buys practice time without measurable benefit, and the
  August timeline can't afford the slack.

`cvc-words` (short-a) additionally carries a **novel-pool graduation gate**
(80% on 2–3 unseen short-a words) so promotion reflects generalised decoding,
not item familiarity. New sibling vowel tiers do NOT inherit this gate.

## Parent settings (v1 scope)

Reached **only** via a 3-second long-press on Hub character art — never linked
from a Marian-facing surface. The screen is deliberately drab (slate-on-white,
system font, no Emma art) so it reads as "obviously not a Marian screen."

Controls (all save immediately, no save button):

- **`autoPromote`** — when off, a qualifying node queues a `pendingPromotion`
  for parent confirm instead of promoting automatically.
- **`sessionMode`** — segmented off / on.
- **`masteryThreshold`** — two independent three-way segmented controls (math +
  word-song). Presets `80/2 | 90/3 | 95/3`; math default `95/3`, word-song `90/3`.
- **`crossDayEnforcement`** — dedupe mastery counting to one session per local
  calendar day (LATEST entry wins).
- **`showLevelToMarian`** — toggle.
- **Backup export** — read-only JSON of progress + session-history in a
  provenance envelope, with a Copy button. Manual recovery path if Safari clears
  origin storage.

Source: `src/screens/ParentSettings/ParentSettings.tsx`. This section is the
citation target for `src/router/route.ts` and the `screens-and-flows.md`
ParentSettings reference.

## M5 additions (this ticket)

- **`?reset=1` QA affordance** — appended to the app URL, clears Marian's local
  learning state on boot (progress + session-history + stardust + transient hub
  state) and boots into first-launch (Splash → Greet). Preserves the
  ParentSettings backup export and the cloud device-id. QA-only; no Marian-facing
  UI, just a `console.log` confirmation.
- **Session-end focus-recap line** — Emma now says _"You worked on
  &lt;friendly-name&gt; today!"_ at session-end, where the friendly name is a
  spoken, child-facing phrasing of the focus node (e.g. `add-to-10` → "adding to
  ten", any CVC/digraph tier → "reading words"). The map lives at
  `src/screens/SessionEnd/friendlyNodeName.ts`; the planner directive emits the
  audio (`session.end.recap.focus`) on the next canon re-bake, and the caption
  renders client-side immediately via the graceful-degradation path.

## iPad validation smoke (Thomas — gates the status flip to "shipped")

5 real sessions on iPad over a calendar week. Walkthrough lives in the M5 PR
description; the expected behaviours:

- [ ] **Session 1** opens on `add-to-10`, no Leitner items in scope, no promotion.
- [ ] Sessions where Marian misses 1–2 facts → those facts return in subsequent
      sessions (Leitner box-1 weighting toward problems 4–8).
- [ ] Two consecutive 90%+ sessions on `add-to-10` (with the math threshold lowered
      to 90/2 in Parent settings for the test, or the natural 95/3) → a later
      session opens with `add-to-20` in scope.
- [ ] `?reset=1` on a seeded returning user lands on Greet, not Hub.
- [ ] Emma's session-end focus-recap line reads naturally and names the right tier.

## Out of scope (re-evaluate after this lands)

- Sonnet stumble-explanation (the "real stumble" second Claude call).
- Parent dashboard.
- Cross-vowel mixing in CVC sessions.
