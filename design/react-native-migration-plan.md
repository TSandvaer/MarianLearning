# React Native (Expo) migration plan

**Status:** proposal only, nothing started. Written 2026-10-08.
**Audience decision (Thomas, 2026-10-08):** Marian first (her iPad + a phone), public store release later as a separate decision.

## Goal

A native iOS + Android app, on phone and tablet in portrait and landscape, at feature parity with today's PWA, installed on Marian's devices through TestFlight internal testing and Google Play internal testing (or a sideloaded APK).

**Not in this plan:** a public store listing, multi-child profiles, a per-user cost model, curriculum changes. These are Phase 6, which needs its own decision.

The PWA stays live on https://marian-learning.vercel.app until the native app reaches parity.

## What exists today (measured 2026-10-08)

| Layer                                | Size                                                                                                         | Fate in React Native                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Screen UI (`src/screens/**/*.tsx`)   | 15,082 lines                                                                                                 | Rewritten with native primitives                                                    |
| Screen logic (`src/screens/**/*.ts`) | 12,345 lines, 70 files with `src/lib/progress`; 28 touch a browser API                                       | Mostly reused, after extracting the DOM-free parts                                  |
| Progress (`src/lib/progress`)        | 6,089 lines                                                                                                  | Reused behind a storage adapter                                                     |
| Audio (`src/lib/audio`)              | 4,442 lines; Howler in 8 files; `howlerContext.ts` ~1,078 lines of iOS-WebKit workarounds                    | Rewritten on `expo-audio`. The WebKit workarounds are deleted, not ported           |
| Animation                            | `motion/react` in 17 files: 70× `AnimatePresence`, 49× `layout`, 15× `layoutId`, 7× `variants`, 3× `drag`    | Rewritten on Reanimated 4                                                           |
| Styling                              | Tailwind 3.4 `className` in 23 files                                                                         | Largely carried over through NativeWind (native is flexbox-only, no grid)           |
| Inline SVG                           | `<svg>` in 14 files                                                                                          | `react-native-svg`                                                                  |
| Emma art                             | PNG-in-SVG, ~0.4–0.9 MB each (`public/assets/emma-*.svg`)                                                    | Exported to PNG/WebP and rendered with `expo-image`                                 |
| Gestures                             | 22× `onPointerDown`, 13× `onTouch*`, 54× `onClick`                                                           | `Pressable` + `react-native-gesture-handler`                                        |
| Storage                              | `localStorage` in 28 files, read synchronously at boot (`useState(loadProgress)`)                            | Sync key-value store (see Stack)                                                    |
| Browser lifecycle                    | `visibilitychange` in 8 files                                                                                | `AppState`                                                                          |
| Debug seeds                          | `?debug=1&seed=` URL params (6 files)                                                                        | Dev menu or launch arguments                                                        |
| API calls                            | Relative `/api/claude` (`src/lib/claude/client.ts:28`), `/api/progress` (`src/lib/progress/cloudSync.ts:69`) | Absolute base URL from config                                                       |
| Backend `api/` + `scripts/`          | 10,617 + 13,611 lines                                                                                        | **Unchanged.** It stays on Vercel                                                   |
| Canon (`public/canon`, 39 MB)        | Read server-side (`api/_canon.ts:298`, `readFileSync`)                                                       | Not shipped in the app                                                              |
| Client assets (`public/assets`)      | 24 MB                                                                                                        | Bundled in the app binary                                                           |
| Unit tests                           | 50,734 lines                                                                                                 | Logic tests stay on Vitest; component tests move to `@testing-library/react-native` |
| E2E                                  | 71 Playwright specs, 36,929 lines                                                                            | **Do not carry over.** Critical paths are rewritten as Maestro flows                |

## Target stack (checked 2026-10-08)

- **Expo SDK 57**: the current stable release (React Native 0.86, React 19.2, released 2026-06-30). SDK 58 has been in beta since 2026-09-15. Start on 57 and upgrade once 58 is stable. **SDK 57 needs iOS 16.4+**, so Marian's iPad must be on iPadOS 16.4 or later.
- **Navigation:** keep the existing in-app route state machine (`src/router/route.ts`; no URLs by design) inside a single Expo Router screen. Deep links aren't needed for Marian.
- **Styling:** NativeWind. v4 targets Tailwind 3, which matches today's `tailwind.config.js`. v5 targets Tailwind 4, and I couldn't confirm it's stable. Pick v4 unless the spike finds a reason not to.
- **Animation:** `react-native-reanimated` 4, using entering/exiting layout animations and CSS-style transitions.
- **Audio:** `expo-audio`. Session MP3s arrive base64-encoded in the `/api/claude` JSON. Write them to the cache directory with `expo-file-system` and play the file URI. The playback contract (`playUtterance`, caption word-ticks) stays the same.
- **Storage:** `expo-sqlite`'s `localStorage` polyfill, which is synchronous and persists across restarts. That keeps the sync boot reads unchanged. Fallback: `react-native-mmkv`. I couldn't find the polyfill's official doc page, so confirm the entry point in the spike.
- **Fonts:** Fredoka via `expo-font`.
- **Build and ship:** EAS Build + EAS Submit, with EAS Update for JavaScript-only changes over the air. The free plan gives 15 iOS + 15 Android builds a month in a low-priority queue.
- **E2E:** Maestro. Expo's EAS Workflows Maestro job is **alpha**, so the flows may need to run in GitHub Actions instead.

## Repo shape

The web app stays at the repo root, so Vercel, CI and docs paths don't move. Two directories are added:

- `packages/core/`: DOM-free logic (progress, mastery, Leitner, content, distractors, plan adapters, `api/_types`). Both apps use it.
- `mobile/`: the Expo app.

## Phases

### Phase 0: Spike and go/no-go (decision gate)

Build a throwaway Expo app and run it on your iPad, an iPhone and an Android phone using a development build. It needs:

- Splash → Greet ported natively: Emma image, the 4 Greet MP3s with caption ticks, the heart tap, and one Reanimated enter/exit
- One Math problem from a live `/api/claude` session-start (base64 → file → `expo-audio`)
- A round-trip through the storage polyfill

**Exit criteria:**

- Audio plays on cold launch on both operating systems, with no unlock tap
- Caption timing matches the PWA
- You find the animation feel acceptable (your eye is the gate)
- The Greet layout works on a phone in both orientations
- Porting speed on Greet is measured, and the later phase estimates below are re-estimated from it

**Kill condition:** a blocker in audio, animation fidelity or porting speed. In that case fall back to Capacitor (wrap the current web app) or stop.

### Phase 1: Extract the shared core (the web app keeps shipping)

- Move the DOM-free logic into `packages/core`.
- Put a storage adapter interface in front of `localStorage`.
- Make the API base URL configurable.

There is no user-visible change. Vitest and the Playwright suite must stay green, and it ships to production as a normal refactor.

### Phase 2: Native shell and platform services

- The `expo-audio` engine behind the same `playUtterance` contract, plus SFX
- The session audio pipeline
- Storage adapter and cloud sync
- Fonts and the asset bundle (Emma PNG export, pictures, path art)
- `AppState` lifecycle
- Debug seeds through the dev menu

### Phase 3: Screens, in first-launch order

Order: Splash → Greet → Math → SessionEnd → Hub → Map (Emma's Path) → WordSong → ParentSettings.

Each screen is ported together with its **phone portrait, phone landscape and tablet layouts**. The first five give Marian a usable vertical slice early.

The biggest pieces are Math (4,562 `.tsx` lines) and WordSong (3,350).

### Phase 4: Test harness

- Maestro flows for the critical paths: first launch, Hub → Math → SessionEnd, Word Song, and mastery promotion via a debug seed.
- Sort the 71 Playwright specs into product invariants, which are re-expressed as Maestro or core unit tests, and web-only mechanics, which are dropped (for example the WebAudio and backgrounding specs).

### Phase 5: Parity and rollout to Marian

- TestFlight internal testing on her iPad and phone. Internal testers don't go through App Review.
- Android through Play internal testing or an APK.
- The native app gets a new `deviceId`, which means fresh progress. That's acceptable while Marian isn't using the app yet.
- Then decide: retire the PWA, or keep the web build.

### Phase 6 (later, separate decision): Public store release

- Apple Kids Category and Google Designed for Families compliance: privacy policy, parental gate, data disclosure (cloud sync, Claude, ElevenLabs)
- Multi-child profiles. `childName: 'Marian'` is hardcoded at `src/App.tsx:1311` and `:1852`
- A per-user cost model for Claude and TTS
- Store listing assets
- Accounts: Apple Developer ($99/yr) and Google Play ($25 once). These are also needed for TestFlight and Play internal testing in Phase 5.

## Effort

These are my estimates, not measurements. Phase 0 exists to replace them with measured porting speed.

| Phase                     | Focused dev-days |
| ------------------------- | ---------------- |
| 0 Spike                   | 3–5              |
| 1 Core extraction         | 4–7              |
| 2 Platform layer          | 7–12             |
| 3 Screens + phone layouts | 20–35            |
| 4 Test harness            | 8–15             |
| 5 Parity + rollout        | 4–8              |
| **Total**                 | **~46–82**       |

Agents can write the code in parallel. Your eye and ear gates can't be parallelised: animation feel, audio timing, and every screen on three form factors. Those gates will set the pace.

## Risks

1. **Motion fidelity.** Reanimated covers enter/exit, but the 15 `layoutId` shared-layout animations (including Emma's Hub idle ↔ celebration) have no proven 1:1 equivalent. Test one in Phase 0.
2. **Double maintenance.** Every web UI change during the migration has to be done twice. Proposal: freeze web UI features from Phase 2. Content, canon and server work continues, since it's shared.
3. **The kill switch.** CLAUDE.md retires the standing team after any week with zero `feat` merges. Phases 1 and 4 are refactor/test work. Decide up front whether `feat(mobile):` screen ports count, or suspend the rule for the migration.
4. **Docs and agent definitions go stale.** These become partly wrong: `audio-system.md`, `emma-character-and-animation.md`, `testing-and-ci.md`, the Devon and Kevin personas ("Web Speech API, PWA plumbing"), and Jessica's Playwright-first QA.
5. **Tooling maturity.** The EAS Maestro job is alpha, and free-tier builds wait in a low-priority queue.
6. **Caption sync.** Word ticks are driven from audio duration. Check that `expo-audio` status events are precise enough.

## Open questions for you

- Freeze web UI features during the migration? (Recommended)
- Which phone(s) are the targets (iPhone, which Android model), and which iPadOS version is Marian's iPad on?
- Are the Apple Developer and Google Play accounts set up?
- Long term: keep a web build (through `react-native-web`) or retire the PWA?

## Sources

- Expo changelog, SDK 57 / 58 beta: https://expo.dev/changelog, https://expo.dev/changelog/sdk-57
- Expo SDK 57 reference (platform requirements): https://docs.expo.dev/versions/v57.0.0
- expo-audio: https://docs.expo.dev/versions/v57.0.0/sdk/audio
- expo-sqlite README (localStorage polyfill source): https://cdn.jsdelivr.net/npm/expo-sqlite@57.0.3/README.md
- NativeWind v5 (Tailwind 4): https://www.nativewind.dev/v5/core-concepts/tailwindcss
- Expo DOM components: https://docs.expo.dev/guides/dom-components/
- EAS pricing: https://expo.dev/pricing
- Maestro on EAS Workflows: https://docs.expo.dev/eas/workflows/examples/e2e-tests/
