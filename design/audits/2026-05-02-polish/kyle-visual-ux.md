# Visual + UX Polish Audit — 2026-05-02

**Auditor:** Kyle (UX)
**Production URL audited:** https://marian-learning.vercel.app/
**Production HEAD at audit time:** b09294a (M3 mastery promotion, M2.5 parent settings)
**Audit context:** Quality bar shift — "polished, responsive, immersive" as ship-to-Marian gate.

---

## Walkthrough notes

I walked the codebase + production end-to-end with the intent of running a real iPad session as Marian would. Two structural caveats up front (called out again in "What I deliberately did NOT cover"):

1. I did not have a live iPad in front of me for this audit pass. Every iPad-Safari-specific finding below is grounded in the source (motion configs, asset weights, layout values, computed spring physics) plus the project's existing iPad-QA log trail in `lib/debug` — but a few items that depend on physical-device feel (e.g. perceived heaviness of the Greet wake animation, exact judder timings on transitions, real cold-PWA boot time) are flagged for Jessica's QA pass.
2. The production Vercel deploy is React-rendered; raw HTML inspection only returned the SSR shell ("Marian Tutor"). Findings below are based on a careful read of the screen components plus the assets the components reference. I corroborated each finding against either a prod-relevant code path or a missing/placeholder asset on disk.

What surprised me, in order of impact:

- **The bunny visuals are 500×500 raster PNGs wrapped in SVG**, not vector geometry. Each pose file is 150–220 KB. Eight poses × ~190 KB ≈ **1.5 MB just for character art**, and they upscale ~3× on a 12.9" iPad Pro. That's both a bundle-weight finding and a "Emma looks soft" finding. Phase 3b will replace the artwork; the _technique_ (raster-in-SVG) should be revisited at the same time.
- **None of the SFX MP3s are shipped.** `sfx-chime-soft.mp3`, `sfx-sparkle.mp3`, `sfx-poof.mp3`, `sfx-plink.mp3`, `sfx-cheer.mp3` — all listed in `assets-todo.md`, none on disk. The Sfx helper degrades gracefully (single warn + silent no-op), so the screen still functions, but **every reward and error reaction is silent in production today**. Marian gets a tap → caption-walk → Emma's pose-swap, with no audio punctuation. That collapses the immersion budget hard.
- **None of the Hub welcome-back lines are shipped.** `public/assets/audio/hub/` has only a README. The 18 manifest entries in `hubLines.ts` all 404, the Hub falls through to its silent 165-wpm caption walk. So when Marian arrives at Hub, the screen reveals "Hi! What today?" word-by-word in **dead silence**. Same gap as SFX but worse for the immersion lens — Hub is the home of the app from session 2 onward.
- **The Hub doesn't read real progress.** `App.tsx` renders `<Hub />` without a `progress` prop, so it always shows `numberGardenIndex: 0, wordSongIndex: 0`. The mastery / promotion engine writes `pendingPromotion` and `skillLevels` on session-end (M3 just shipped), but Hub never consumes them — the path-strip will perpetually show "+ on add-to-10, all locked padlocks ahead" no matter what Marian completes. There is also no celebration moment for promotion — it happens silently in localStorage between sessions. Big polish + immersion miss given M3 is what just shipped.
- **The Word Song picture chips are inline-SVG silhouette placeholders** (Emma palette, schematic shapes for cat / dog / hat / etc.). Per `wordPictures.tsx` they are explicitly v1 placeholders — Thomas's sourcing decision (commission / curate / AI-gen) is deferred. For "polished, ship-to-Marian", these read as wireframe-y. Only `pic-dog.svg` is a real illustration.
- **The Hub stage icons are also placeholder text-glyphs** — `+`, `−`, `Aa`, `cat`. The "tree-themed" SVGs Thomas locked (Q9=B in screen-hub.md) ship via ticket 86c9j53yx which has not landed. Today the path-strip looks like a typographic scratchpad rather than an icon strip.
- **Math / WordSong back-arrow is top-left.** That's outside the bottom-60% kid-thumb zone the project's own design constraint calls for. It's intentional per the spec (parent-style affordance, not Marian-tap-natural), but worth re-checking against the polish lens — if Marian wants to switch trees mid-session, the only path is a top-left tap that requires re-gripping the iPad.
- **Greet's wake-tap target is the entire viewport** with three event handlers (onClick + onTouchEnd + onPointerDown). Functionally correct (the iPad-Safari unlock dance is well-documented in the file header), but during the wake state the **Emma image, the ready ring, and the finger-tap nudge are all `pointer-events: none`** — the tap-target is invisible and full-bleed. From Marian's POV this is just "tap anywhere"; from a "responsive within 100ms" lens, the visible Emma is _not_ the affordance, the entire screen is. Worth verifying she reads it as inviting on first launch.
- **Sleep splash is dead code in production.** App.tsx wires `onAllDone` so SessionEnd's CTA flips to Hub at 300ms. The `phase === 'sleep-splash'` branch in SessionEnd.tsx + the entire `SleepSplash.tsx` file are unreachable. The dead-launch-fallback comment says "preserves dark-launch fallback if Thomas opts for one" — fine to keep, but add a code comment + test to make that branch's status explicit.

What felt good:

- **Reduced-motion handling is genuinely thorough.** Every screen has explicit branches for the `prefers-reduced-motion: reduce` case, not just a global MotionConfig. That's quality.
- **Safe-area handling is consistent.** Every screen uses `pt-[env(safe-area-inset-top)]` etc. No home-indicator overlaps in the layout.
- **Touch targets are well above the 44pt minimum** everywhere (heart 117×160, math chips 120×120, word-song chips 96×96, Hub tree nodes 280×280pt, mid-skill back arrow 56×56pt visual in larger touch zone). HIG-clean.
- **Caption ribbon word-by-word reveal is consistent across Greet / Hub / Math / Word Song / Session-End.** That's the kind of cross-screen consistency that builds "this is one world" feel.
- **The `layoutId="emma"` shared-element transition** is correctly wired across Greet → Math → SessionEnd. When real character art lands, this will be a quietly delightful moment.
- **Parent Settings is appropriately drab.** Slate-on-white, no Emma, no pastel — clearly "this is not Marian's screen". Good child-safety / dark-pattern hygiene.

---

## Findings

### P0 — Ship-blockers

The bar is "polished + responsive + immersive". Each P0 below breaks at least one of those substantively for Marian's first session.

- [ ] **(independent)** **All sound effects are silent in production.** `sfx-chime-soft.mp3`, `sfx-sparkle.mp3`, `sfx-poof.mp3`, `sfx-plink.mp3`, `sfx-cheer.mp3` are referenced by Greet / Math / WordSong / SessionEnd but none exist in `public/assets/`. The sfx helper degrades to silent no-op, so reward (correct chip), error (poof), and stardust-arrival (plink) reactions land **visually but not aurally**. Spec calls for chime + sparkle on every correct, poof on every wrong. Without these the screen feels half-rendered every interaction. — proposed fix: source the 5 SFX files per `assets-todo.md` recipe (freesound CC0, 400–600ms each, 96–128 kbps mono, -14 LUFS). Single asset-pass ticket; no design work needed beyond the existing spec.

- [ ] **(independent)** **All Hub welcome-back audio is silent in production.** `public/assets/audio/hub/` has only a README; `hubLines.ts` manifests 18 audio files, none on disk. The Hub plays via `playLineFn`'s default 165-wpm silent caption-walk. So Marian's first arrival at the home screen of the app is text-only-with-no-voice — Emma is visually present but verbally absent. Given Hub is THE place she'll arrive every session 2+ launch, this is the single most-load-bearing immersion gap. — proposed fix: render the 18 manifest lines via `scripts/render-greet-mp3s.mjs` (existing pipeline) using `en-US-EmmaMultilingualNeural` rate `-10%` to match Greet voice provenance. Same ticket structure as Greet's MP3 batch.

- [ ] **(independent)** **Hub does not consume real progress; promotion is invisible.** `App.tsx` renders `<Hub />` without a `progress` prop, so the path-strip is perpetually frozen at `numberGardenIndex: 0, wordSongIndex: 0`. M3 just shipped mastery promotion (skillLevels mutate, pendingPromotion writes), but Hub doesn't read either — Marian could complete add-to-10 perfectly across 3 days and the path-strip would not budge, no "leveled up" moment, no visual change at all. This breaks both "polished" (the recently-shipped feature has no UI surface) and "immersive" (no celebration of mastery). — proposed fix: (a) wire `progress` prop through App.tsx from `loadProgress()`, mapping skill levels onto the per-tree currentIndex; (b) author a one-screen promotion celebration moment — Emma's `cheering` pose + sparkle burst + new "you mastered N!" line — that fires on the first Hub mount after `pendingPromotion` flips. Two tickets: data-wiring (Devon) + design spec for promotion celebration (me).

- [ ] **(Phase-3b-dependent)** **Bunny artwork ships as 500×500 raster PNG wrapped in SVG, ~190 KB per pose × 8 poses.** Decoded the IHDR — every pose file is a base64-encoded 500×500 PNG inside a `<svg>` shell. Renders soft on a 12.9" iPad Pro (Emma at 60vh ≈ 1638px native, ~3.3× upscale = visible blur on retina). Bundle weight ~1.5 MB just for character art; iPad PWA cold install pays this every cache miss. The Phase 3b visual pivot will replace the artwork — at the same time, replace the **technique**: ship true vector geometry, or ship 2× and 3× WebP raster variants with a `<picture>` source set. — proposed fix: Phase 3b art-spec must require either (a) authored SVG paths, or (b) WebP @ 1024×1024 + 2048×2048 for retina iPad, with a sane fallback PNG. Either way: lose the base64-data-URI-inside-SVG pattern.

- [ ] **(independent)** **Word Song picture pictures are inline-SVG silhouette placeholders.** Per `wordPictures.tsx`: every CVC word — cat, hat, bus, fan, etc. — renders as a schematic Emma-palette silhouette inline-SVG, NOT a real illustration. Only `pic-dog.svg` is a real shipped picture. Marian is supposed to be **picture-anchored** (per CLAUDE.md: "every CVC word needs a picture + audio — vocabulary is the bottleneck"). Schematic silhouettes are not picture-anchoring. — proposed fix: source-decision is on Thomas (commission / curate / AI-gen — tracked as Open Q #1 in `design/word-song-picture-pack.md`). Promote that decision to ship-blocker; can't go to Marian without real pictures for the Word Song surface. Once decided, the asset-drop is one ticket per ~12-word pack.

### P1 — Significant polish gaps

- [ ] **(independent)** **Hub stage-icons are placeholder text glyphs.** `+`, `−`, `±`, `…`, `×`, `Aa`, `Ca`, `cat`, `sh`, `the`, `I` for the path-strip's signature glyphs. Thomas locked Q9=B (tree-themed art) in the Hub spec — that ticket (86c9j53yx) has not shipped. Today the strip reads like a typographic scratchpad. — proposed fix: ship the Q9=B SVG set per the existing spec — 17 stage signatures total (10 number-garden + 7 word-song). Each is a small flat glyph in Emma palette. ~1 day of icon work; no new design decisions needed.

- [ ] **(independent)** **No mastery-promotion celebration moment.** Even after the Hub progress wiring (P0 above) lands, the _moment_ of crossing into a new skill is silent: Hub mounts, the path-strip cell at the previous index has flipped from "current" to "mastered" (a check glyph), and the next cell is now "current". No Emma reaction, no copy ("You did it! Word Song unlocked tap-the-cap!"), no audio cue. For an 8yo, "the icons changed" is not a celebration — it's a UI diff. — proposed fix: dedicated promotion-screen design spec. Mounts as an overlay on top of Hub the first time after `pendingPromotion` flips. Emma in `cheering` pose, single line ("You mastered add to ten!"), sparkle burst from the now-mastered cell, single CTA ("Yay!") that dismisses to normal Hub. Specced + sized for 30s flow, not a multi-tap ceremony.

- [ ] **(Phase-3b-dependent)** **Greet wake state — the visible Emma + ready ring + finger-tap nudge are all `pointer-events: none`.** The actual tap target is a full-bleed transparent button beneath Emma. From a code-correctness standpoint this is a deliberate iPad-Safari-unlock fix (documented at length in the file header). From a polish lens: the affordance an 8yo would naturally try (tap the bunny) is silently passed-through; only "anywhere on the screen" works. Because Emma renders as raster art (P0 above), there's no easy way to make Emma herself the live target without re-introducing the iPad hit-testing race. — proposed fix: re-evaluate when Phase 3b lands. With true vector Emma we can keep the full-bleed transparent button AND additionally bind a stronger tap-affordance (subtle bounce on Emma every 4–6s after wake) so the bunny visibly invites contact even if the actual hit-target is wider.

- [ ] **(independent)** **Math / WordSong back-arrow is top-left.** 56×56pt visible glyph, top-left corner. That is a stretch for an 8yo holding the iPad two-handed. Per CLAUDE.md ("primary actions thumb-reachable"), this is borderline. Designed as an off-ramp not a primary action — but it's the ONLY mid-skill exit and the spec explicitly added it because Marian was getting trapped in sessions she wanted to leave. — proposed fix: keep the top-left position (matches iOS convention for back) but enlarge the touch zone to 72×72pt and add a 1px-stroke 36×36pt visible glyph rather than 28×28pt, so it reads as "press here to leave" without becoming visually heavy. OR move it to bottom-left near the chip strip — but that conflicts with chip thumb-reach; needs a Dave check before relocating.

- [ ] **(independent)** **No app-load skeleton; the splash is silent.** Splash auto-advances on a 1500–3000 ms timer with three pulsing dots. No first-paint protection: if the React bundle is slow, the user sees the SSR-shell title "Marian Tutor" then a flash to the splash. — proposed fix: add an inline `<style>` in `index.html` that paints the cream background + Emma logo at the SSR stage, so the first frame already matches the splash. Pure cosmetic, ~50 lines of inline CSS+SVG, zero JS.

- [ ] **(independent)** **No haptics anywhere.** iPad doesn't have the iPhone Taptic Engine, but iPad Pro 11/12.9 has subtle haptic playback via `navigator.vibrate` (limited Webkit support — but on supported builds it lands). Today: zero. For an 8yo, even a 10ms tick on chip-tap raises perceived responsiveness. — proposed fix: tiny haptics utility in `lib/sfx`; gate on `'vibrate' in navigator`; one tick on chip-tap (10ms), one slightly-longer pulse on celebration (40ms). Defensive degradation — silent on iPad models without the API.

- [ ] **(independent)** **SessionEnd's `phase === 'sleep-splash'` branch is dead in production.** App always wires `onAllDone`, which short-circuits past sleep-splash to Hub. SleepSplash.tsx and the SessionEnd phase branch are unreachable in shipping code. — proposed fix: gate it behind a debug flag (`?debug=sleep-splash`) so it's not removed (Thomas may want it back as a dark-launch fallback per the existing comment) but the dev tree is honest about its status. Add a one-line test: `expect(phase).not.toBe('sleep-splash')` when `onAllDone` is provided.

- [ ] **(independent)** **Splash logo currently `emma-logo.svg`** — that asset is 5 KB and is a real vector file. Emma's name + bunny visual are still the bunny silhouette. That's the documented Phase-3a/3b mismatch — fine as a known temporary state but flagging for the audit log because Marian will see this on EVERY launch. — proposed fix: covered by Phase 3b. Leaving here as a tracking item.

### P2 — Nice-to-haves

- [ ] **(independent)** **Hub's `NumberGardenSignature` and `WordSongSignature` (the big icons on each tree node) are placeholder inline SVGs** — three flowers and three music notes. These read fine but they're not delightful. — proposed fix: when Q9=B ships (the tree-themed stage icons), replace these too with same-style large signatures.

- [ ] **(independent)** **The cumulative-stardust counter and the streak-day counter both use the same SparkleGlyph.** They sit side-by-side in the recent-stats strip when both are active. Per the in-code comment ("text below disambiguates"), the disambiguation is supposed to come from the small label underneath. For a reading-emergent 8yo, two identical sparkles with tiny labels is muddy. — proposed fix: keep stardust as the sparkle, change the streak indicator to a small flame OR a stack of dots (representing days). Single Tailwind change once the icon picks.

- [ ] **(independent)** **Greet captions reveal at TTS word-tick rate, but the silent fallback walks at 165 wpm regardless of line content.** That's a reasonable default but feels slightly mechanical when comparing the 4 lines side-by-side ("Hi!" — 165 wpm of one word is ~360ms reveal — feels long for a single exclamation). — proposed fix: per-line override in `HUB_LINE_WORD_COUNTS` — single-word lines reveal in 200ms regardless of the wpm calc. Minor; only matters when audio fails.

- [ ] **(independent)** **No transition between Hub and Math/WordSong — both screens fade in independently via `<AnimatePresence mode="wait">`.** That's two opacity fades back-to-back (Hub fades out 250ms; the new screen fades in via its own transition). Functional but not "scene change" feeling. With `layoutId="emma"` already wired, Emma should crossfade her position from Hub's 22vh band into Math's upper-left perch. — proposed fix: confirm the `layoutId` shared-element transition actually fires across the AnimatePresence boundary (it should; framer-motion supports cross-tree shared layout). If not, lift the `<m.img>` into the App root and key it on route. No new asset; pure motion config.

- [ ] **(independent)** **No "first-ever launch" install moment specced anywhere in code.** PWA manifest is correct, splash images are wired in `index.html`, but there's no in-app moment that says "want to add me to your home screen?". For Marian's iPad, dad will install this once on her behalf — but documenting the install moment as a one-time card (parent-side) would still reduce friction. — proposed fix: defer to the orchestrator; flagging because the brief explicitly mentioned "design the install moment too" but it's not in the v1 product surface today.

- [ ] **(Phase-3b-dependent)** **Three-cloud background (`bg-clouds.svg`) drifts horizontally on a 20s loop on Greet only.** Hub has a flat radial-gradient backdrop. Math has a flat radial-gradient backdrop. SessionEnd has a flat radial-gradient backdrop. The "three backgrounds for emotional variety" goal in CLAUDE.md is not delivered — every non-Greet screen is a CSS gradient. Phase 3b is rebuilding character art; the same pass should land 3 background scenes (garden / song / twilight) authored in the new visual language. — proposed fix: add to Phase 3b art brief.

- [ ] **(independent)** **Parent-gate corner zone (96×96pt, top-right, 2-second long-press)** has no visible affordance and v1 callback is a no-op. Worth deciding whether to land a real parent-area target before next QA pass — otherwise it's a 96×96pt dead zone Marian could discover by accident. Not harmful (callback is `console.log` in v1) but it's a "what is this?" moment if she stumbles into it. — proposed fix: either remove the zone in v1, or wire it to ParentSettings the same way the character long-press does (then we have two redundant ways to reach the same screen — confusing — so prefer removing the corner zone and keeping only the character long-press).

---

## Suggested follow-up tickets

(One bullet = one ticket. Title + brief scope.)

- ticket: **Source 5 SFX MP3s (chime, sparkle, poof, plink, cheer)** — per `public/assets/assets-todo.md` recipe; freesound CC0; 400–600ms each; -14 LUFS normalized. Asset-pass only; no design work.
- ticket: **Render the 18 Hub welcome-back MP3s** — drive `scripts/render-greet-mp3s.mjs` against `hubLines.ts` manifest using the `en-US-EmmaMultilingualNeural` -10% rate. Land in `public/assets/audio/hub/`.
- ticket: **Wire Hub progress prop from Progress doc** — App.tsx reads `loadProgress()` and computes per-tree `currentIndex` from `skillLevels`; passes `progress={...}` to `<Hub />`. Devon ticket; data-only.
- ticket: **Promotion celebration moment design + impl** — design spec from me (one-screen overlay, Emma cheering pose, single CTA), then Devon impl. Triggers on Hub mount when `pendingPromotion` flipped since last visit.
- ticket: **Phase 3b art technique fix** — bake into Phase 3b art brief: ship vector or @2x WebP raster, NOT base64 PNG inside SVG.
- ticket: **Word Song picture pack source-decision** — escalate Open Q #1 in `word-song-picture-pack.md` to ship-blocker for Marian's first session. Thomas decides commission / curate / AI-gen.
- ticket: **Hub stage-icon set (Q9=B tree-themed)** — 17 SVG stage signatures (10 number-garden + 7 word-song). Existing spec; pure asset work.
- ticket: **iPad PWA SSR-shell skeleton** — inline `<style>` in `index.html` to paint cream + Emma logo on first frame.
- ticket: **Haptics on chip-tap and celebration** — small `lib/haptics` module; `navigator.vibrate(10)` on correct, `vibrate([20,20,20])` on celebration; defensive degradation for unsupported builds.
- ticket: **Mid-skill back-arrow polish** — enlarge touch zone to 72×72pt, glyph to 36×36pt; same top-left position. (May want Dave check before sizing.)
- ticket: **Streak indicator glyph differentiation** — replace SparkleGlyph in streak-day counter with a flame or dot-stack so it disambiguates from cumulative-stardust at a glance.
- ticket: **`layoutId="emma"` cross-route shared-element transition verification** — confirm Emma's position morphs from Hub band to Math perch on route change. Lift `<m.img>` to App root if cross-tree shared layout doesn't fire.
- ticket: **Sleep-splash debug-gating** — gate `phase === 'sleep-splash'` behind `?debug=sleep-splash` so dead branches are explicit; add regression test.
- ticket: **Parent-gate corner cleanup** — remove the 96×96pt top-right corner long-press; keep only the character long-press as the path to ParentSettings.

---

## What I deliberately did NOT cover

- **No live iPad device session.** All findings are grounded in code + asset state. Frame-level animation feel, real cold-PWA boot timings, exact judder on Hub→Math route change, and AudioContext-resume behaviour after lock-screen — Jessica's QA pass will catch anything I missed in the real-device pass.
- **No poor-WiFi simulation.** The Path A Claude session-start fetch can take seconds; behaviour under throttling is described in code (silent fallback walks captions; chips wait on `audioReady`) but I did not exercise the slow-network path.
- **No backgrounding / lock-screen mid-session test.** The audio-architecture doc and Howler `_autoSuspend` patches address this, but reality-checking under iOS Safari is Jessica's lane.
- **No accessibility audit beyond touch target + safe area.** VoiceOver, Switch Control, dynamic-type interactions all defer to a dedicated accessibility pass — flagged here as a future audit, not a P0 gap (Marian doesn't use assistive tech today).
- **No copy / vocabulary cap audit.** Dave covers developmental-psychology lens; he'll check that Hub's "Hi! Look who's here!" + Math's pre-canned chatter stay within the 200-word vocab budget.
- **No edge-case mistap / double-tap / swipe coverage.** That's Jessica's QA scope per the brief.
- **No Phase 3b visual pivot scope creep.** Findings tagged `(Phase-3b-dependent)` are surfaced for awareness only; the visual replacement is in flight separately.
