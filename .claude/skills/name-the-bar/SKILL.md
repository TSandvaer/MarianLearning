---
name: name-the-bar
description: Surface the orchestrator's OWN cited guesses about Thomas's implicit quality bar / direction as one-at-a-time confirmable popups BEFORE a taste-sensitive dispatch or a long away-run — so the real bar is NAMED up front instead of discovered after an ear-test reject. Persists confirmed bars to .claude/quality-bars.md and injects the relevant bar into the dispatch brief. Use when about to dispatch voice/audio, Emma-visual, motion-feel or first-of-class-UI work, before an away-run that will drift, when the destination feels thin or stale, or when you catch yourself guessing what Thomas wants. Trigger phrases: "name the bar", "/name-the-bar", "what's the bar here", "articulate the quality bar", "destination check", "what does Thomas actually want", "am I guessing the bar".
---

# Name the Bar — proactive quality-bar articulation

Marian Tutor is a **taste-driven** project on its subjective surfaces: Thomas knows the right answer
when he hears or sees it, and most of `.claude/quality-bars.md` + the project memory was learned
_reactively, after a reject_ (British voice over en-US, real-baked-canon auditioning over synthetic
previews, per-class phoneme SSML over one blanket rule). Each of those rejects cost a bake + a round
of Thomas's ear. This skill moves that cost **upstream**: surface the bar the agent _already
suspects_ as a cheap, confirmable question BEFORE the work starts.

Imported from Far-Horizon 2026-08-02 (`.claude/alignment/alignment-plan-Far-Horizon-2026-08-02.md`),
itself a local adaptation of the reference earned-autonomy suite's `destination` skill — the mechanism
is the same (sourced, falsifiable inferences confirmed one at a time); the plumbing here is Marian
Tutor's (AskUserQuestion popups, ClickUp tickets, the ear-test / audition-page economy, project memory
as the citation source).

> **The asymmetry that justifies guessing:** the cost the agent pays for guessing wrong is one click
> of correction. The cost Thomas pays for the agent never guessing is another ear-test round.
> Guess — but cite, and make it falsifiable.

## When to run

- **Before a taste-sensitive dispatch** — any `feat`/`fix` whose acceptance is subjective feel:
  voice/audio renders, Emma visuals and motion, first-of-class UI, celebration/reward feel. Same class
  that triggers a Thomas ear-test rather than a Jessica Playwright gate
  (`feedback_jessica_first_for_objective_gates`).
- **Before a long away-run** that will drift if the direction is unclear.
- **Mid-task, when you catch yourself guessing** what Thomas wants rather than citing a confirmed bar —
  pause and run this instead of guessing silently.
- **Compose with `/unstick`:** `/unstick` fires at _attempt 2_ (the precision gap surfaced reactively);
  `name-the-bar` fires at _attempt 0_ (name the bar before the first bake). Together they bracket the
  whole iteration.

**Do NOT run** for mechanical work (`chore`/`docs`/`test`, refactors, CI, planner contracts, type
plumbing) — there is no subjective bar to name. If you cannot form an honest cited inference, say so
and stop; a run that produces zero inferences is a valid outcome (the bar is already clear, or the
trail is too thin to infer from).

## Procedure

### 1. Gather signal

Read, in this order: `.claude/quality-bars.md` (already-confirmed bars), the relevant project memory
entries (`MEMORY.md` index → the taste/voice/visual entries), the ClickUp ticket(s) about to be
dispatched, and the recent conversation. Notice what Thomas has emphasized, pushed back on, or
re-routed — including what he has NOT said directly.

### 2. Form 2–5 sourced inferences

Each inference is one of five shapes:

- **Direction** — "I think you're heading toward X."
- **Priority** — "I think X matters more than Y here."
- **Constraint** — "I think you'd reject Z."
- **Question-being-asked** — "the question you're really answering is W, not V."
- **Quality-bar** — "the bar you're actually holding this to is Q." ← _the highest-leverage shape for this project._

Each inference must be **specific enough to be wrong** ("you care about audio quality" is not an
inference; "you'd rather ship one tier with clean fricatives than three tiers with buzzy ones" is) and
**cited** to a quoted phrase, a memory slug (`[[feedback_prefer_british_voice]]`), or a concrete
ear-test exchange. State it as "I think…" / "the trail suggests…", never "it's clear that…".

### 3. Turn each kept inference into a falsifiable question

Answerable in one sentence; a wrong reading should be cheap for Thomas to correct.

### 4. Surface ONE AT A TIME via AskUserQuestion, in priority order

Use `AskUserQuestion` — Thomas prefers clicking over typing (user-global § "Prefer AskUserQuestion
popups for discrete decisions"). One popup per inference, the recommended option first and labelled
"(Recommended)" when the inference is foundation-defensible. **Never batch** — the answer to Q1 often
reshapes or obsoletes Q3–5. Present the question first, then the 1–2-sentence cited hunch behind it so
Thomas can correct the _source-reading_, not just the conclusion.

### 5. Persist confirmed bars

Append/update `.claude/quality-bars.md` with what Thomas confirmed, corrected, or rejected (format in
that file's header). A confirmed bar becomes **input to the next dispatch** — it does not become the
dispatch itself.

### 6. Inject into the dispatch brief

When the dispatch fires, paste the relevant confirmed bar into the brief and into the Self-Test
Report's prediction block (`CLAUDE.md § Predict-Before-Soak + bounded convergence`) so the author
predicts against a _confirmed_ bar, not a guessed one.

## Boundaries

- This skill only CLARIFIES the bar; it never starts the work. A confirmed bar is input, not action.
- It does not score Thomas's clarity — "still exploring" is a legitimate answer; record it and stop.
- It does not replace an ear-test — it makes the ear-test's verdict cheaper by naming the bar the
  ear-test will judge against.
- **Never make Thomas the domain expert** (`feedback_no_sponsor_as_expert`). This skill asks him to
  confirm a _taste_ bar he already holds — never to answer a pedagogy, phonics-sequencing, or
  audio-engineering question that belongs to a specialist persona. If an inference is really a domain
  question in disguise, route it to Dave / Kyle instead of firing the popup.
- Orchestrator-run only (it asks Thomas directly). In a passive / non-orchestration session, draft the
  inferences but do not fire the popups unless the user asks.
