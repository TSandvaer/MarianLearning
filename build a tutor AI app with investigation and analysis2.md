# Building a Tutor AI App for Marian — Part 2: Tooling & Team Setup

**Date:** 2026-04-24
**Continues from:** [build a tutor AI app with investigation and analysis.md](./build%20a%20tutor%20AI%20app%20with%20investigation%20and%20analysis.md)

---

## Table of contents

1. [Picking up from Part 1](#1-picking-up-from-part-1)
2. [Claude Code skills research](#2-claude-code-skills-research)
3. [Recommended skills for the project](#3-recommended-skills-for-the-project)
4. [Agent team setup request](#4-agent-team-setup-request)

---

## 1. Picking up from Part 1

Part 1 ended with the paper practice plan delivered (10 min/day, 4 weeks) and three concrete next artifacts queued up for when the app build starts:

1. **Progress JSON schema** — single source of truth Claude reads/writes per session
2. **Melody system prompt** — tone, vocabulary cap, in-character rules
3. **Session 1 walkthrough** — screen-by-screen of Marian's first session, before any code

Plus a week-by-week build backlog mapped to the 4–6 week budget.

**Suggested starting point:** progress JSON schema first — smallest artifact, but pins down what "adaptive" actually means. The system prompt and session walkthrough both reference it.

---

## 2. Claude Code skills research

**User's question:** _Are there any skills that would be very beneficial to add to this project? Search the internet._

Searched the public Claude Code skills ecosystem (2026) against the project's locked decisions: React + Vite + Tailwind PWA, iPad home-screen install, Framer Motion, Web Speech API (v1) → ElevenLabs (v2), My Melody theme, 8-year-old user, English-only.

Key directories found:

- [anthropics/skills](https://github.com/anthropics/skills) — official
- [karanb192/awesome-claude-skills](https://github.com/karanb192/awesome-claude-skills) — 50+ verified
- [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)
- [secondsky/claude-skills](https://github.com/secondsky/claude-skills) — production-tested web skills
- [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) — 1,400+ agentic skills

---

## 3. Recommended skills for the project

### Already available (keep using)

- **`claude-api`** — already installed locally. Covers prompt caching (cuts cost on the 3-call-per-session pattern), model selection (Haiku for session gen, Sonnet for stumbles), structured output for the session JSON blob. Lean hard on it Week 1–2.

### Worth installing (4 picks)

1. **PWA patterns skill** — Maps to Week 6 deploy. iPad home-screen install is fussy (icons, `apple-mobile-web-app-capable`, splash screens, service worker). Skill handles Workbox, caching strategies, install prompt hooks.
2. **Motion (Framer Motion) skill** ([secondsky/claude-skills/motion](https://agentskills.so/skills/secondsky-claude-skills-motion)) — locked-in dependency for Melody animations. Covers spring physics, layout animations, LazyMotion (4.6 KB — matters on iPad).
3. **Mobile App Design skill** ([awesome-skills/mobile-app-design](https://github.com/awesome-skills/mobile-app-design)) — iOS HIG, 44pt+ touch targets, thumb-safe zones. One-pass review at Week 3 before shipping to Marian.
4. **Kids UX Auditor** — age-appropriateness + dark pattern detection (variable reward loops, fake urgency, social pressure). COPPA isn't relevant (family-local), but the dark-pattern audit is — easy to accidentally copy addictive-app patterns.

### Skip for this project

- **Tailwind v4 + shadcn** — only if on Tailwind v4; skip otherwise
- **iOS Simulator skill** — user is on Windows
- **ElevenLabs TTS skill** — defer to v2
- **TDD / testing skills** — 4–6 week family project, manual + Marian is the test

### Worth creating yourself

**Project-specific `melody-voice` skill** (via `skill-creator`). Encodes Melody's register rules: ~200-word vocabulary cap, in-character reactions, forbidden phrases, handling wrong answers. The most-repeated constraint in the build — formalize once, every future session prompt/dialog/minigame inherits consistency for free. **Highest-leverage custom skill for this specific project.**

### Honest framing

Skills help implementation speed, not the hard parts. The hard parts are:

1. Whether the adaptive model actually tracks her progress well
2. Whether Melody's voice feels right to Marian
3. Whether 10-minute sessions hold her attention

No skill solves those — only real usage does. Install the four above, build `melody-voice`, and don't lose a week skill-shopping.

**Install order:** PWA patterns + Motion at Week 1 start. Mobile App Design + Kids UX Auditor at Week 3 pre-ship sanity check.

---

## 4. Agent team setup request

**User's request (captured, not yet executed — conversation saved before implementation):**

Create an agent team to work on this project:

- **Matt** — Project Leader (Lead). Defines tasks in ClickUp, prioritises, assigns to other team members.
- **Kyle** — UX Designer.
- **Kevin** — Developer.
- **Devon** — Developer.
- **Jessica** — Tester / QA.

**Rules:**

- Kevin and Devon create PRs and review each other's PRs, assisted by the `codereview` skill.
- **GitHub repo:** https://github.com/TSandvaer/MarianLearning.git
- **ClickUp board:** https://app.clickup.com/90151646138/v/b/li/901523003843 (connect via ClickUp MCP)
- **Product owner:** the user (Thomas). Final say. Final approval of the resulting product. Additional QA approval pass on top of Jessica's.
- **Primary communication channel:** user ↔ Matt (Project Leader).

**Status:** Request captured. Implementation pending — user chose to save the conversation to this file first.

**Next action when work resumes:** Build out the five agent definitions (`.claude/agents/matt.md`, `kyle.md`, `kevin.md`, `devon.md`, `jessica.md`) with role-specific system prompts, tool allowlists, and handoff protocols. Verify ClickUp MCP is configured before Matt's agent can write to the board. Confirm GitHub repo access for Kevin/Devon.
