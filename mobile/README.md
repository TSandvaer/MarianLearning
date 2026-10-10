# Marian Tutor: native app (Expo)

The React Native app from `design/react-native-migration-plan.md`. Phase 2a: the shell. Phase 2b: the audio engine (`src/audio/`, see [Audio](#audio)). Phase 3 ports the screens in first-launch order: Splash, Greet and Math are real (`src/screens/Splash.tsx`, `src/screens/greet/`, `src/screens/math/`, UX calls in `design/native/greet-math-native.md`); every other route is still a placeholder.

## Shape

- **Standalone npm project**, with its own `package-lock.json`. It is _not_ a yarn workspace, so the web app's `yarn install`, `yarn.lock`, React 19.2.5, CI and Vercel never see it. This app runs React 19.2.3 / React Native 0.86.3 (Expo SDK 57).
- **Shared logic** comes from `@marian/core` (`../packages/core`), installed as `"file:../packages/core"` (an npm symlink) and served by Metro through one watch folder (`metro.config.js`). Metro does not watch the repo root, so nothing resolves from the web app's `node_modules`. `npm run check:bundle` proves it.
- **Native projects are generated** (`ios/`, `android/` are gitignored). `app.json` is the source of truth; `npx expo run:ios` / `npx expo prebuild` regenerate them.

## Run it

Prerequisites: Node 20.19+ (22 or 24 recommended), Xcode with an iOS simulator, CocoaPods (`brew install cocoapods`). Install from this directory:

```bash
cd mobile
npm ci
```

**Development build on the iOS simulator** (`expo-dev-client`):

```bash
npx expo run:ios                      # builds, installs, starts Metro
npx expo run:ios --device "iPad (A16)"
```

Known blocker (2026-10-08): with Xcode 27 the build succeeds, but an **iOS 27** simulator refuses to launch it: `Application failed to launch: UIScene life cycle is required for apps built with this SDK.` Expo SDK 57's prebuild template (up to `expo-template-bare-minimum@57.0.29`) has no scene delegate; the SDK 58 template (`58.0.15`, beta) adds one. Until that is resolved, use Expo Go.

**Expo Go** (no build). The shell uses only modules that ship in Expo Go SDK 57:

```bash
npx expo start --go          # scan the QR code with the store Expo Go app
npx expo start --go --ios    # installs Expo Go on the booted simulator
```

On a physical iPhone / iPad, Expo Go needs `npx expo login` and the same Expo account signed in inside the app (Expo changelog, 2026-09-03). Simulators and development builds don't.

**Physical iPhone / iPad without the paid Apple Developer account**: see the PR for the free "Personal Team" status. The app declares no capabilities (its entitlements file is empty), which is what a free team can provision.

## Styling

`StyleSheet` plus pure layout maths (`src/layout/`), not NativeWind. The colour tokens are in `src/theme.ts`, and each web class a value comes from is named next to it. The measurements behind the choice are in the Phase 3 Greet PR; the probe that produced them is on the never-merge branch `devon/rn-greet-nativewind-probe`. Inline SVG (the web's `bg-clouds`, `heart-button`, `icon-finger-tap`) renders through `react-native-svg` from copies in `src/assets/vectors.ts`; `vectors.test.ts` fails when a web file drifts.

## Debug flags

Same names as the web's query parameters. `seed` and `dayOffset` only apply with `debug=1`.

| Web               | iOS launch argument | Env flag (bundle time)       |
| ----------------- | ------------------- | ---------------------------- |
| `?debug=1`        | `-debug 1`          | `EXPO_PUBLIC_DEBUG=1`        |
| `?seed=cvc-words` | `-seed cvc-words`   | `EXPO_PUBLIC_SEED=cvc-words` |
| `?dayOffset=2`    | `-dayOffset 2`      | `EXPO_PUBLIC_DAY_OFFSET=2`   |

Seeds are `@marian/core/debug/seeds` (the same table the web uses). Launch arguments win over env flags.

```bash
# launch arguments, on an installed dev build
xcrun simctl launch booted com.marianlearning.tutor -debug 1 -seed cvc-words

# env flags (restart Metro with --clear after changing one)
EXPO_PUBLIC_DEBUG=1 EXPO_PUBLIC_SEED=cvc-words npx expo start --clear
```

`EXPO_PUBLIC_QA_AUTOTAP_MS=<n>` (with debug on) makes Greet's wake tap fire itself n ms after Greet mounts, and makes Math answer n ms after each chip gate opens (problem 1: three wrong answers, so the re-prompt, the hint and the guided answer all show; problem 2: one wrong; then right). `EXPO_PUBLIC_QA_ROUTE=<route>` (with debug on, the web's `?route=`) launches straight on a route, e.g. `math`. Both exist because this Mac's Xcode 27 has no Simulator.app and `simctl` cannot tap: launch Expo Go with `xcrun simctl launch <udid> host.exp.Exponent --initialUrl exp://127.0.0.1:<port>` (no "Open in Expo Go?" prompt, unlike `openurl`), and on a fresh simulator first skip Expo Go's onboarding with `xcrun simctl spawn <udid> defaults write host.exp.Exponent EXDevMenuIsOnboardingFinished -bool YES` (and the same for `ExpoGoOnboardingFinished`). On Android, `adb shell input tap` taps for real.

Other env flags: `EXPO_PUBLIC_API_BASE` (default `https://marian-learning.vercel.app`; an unreachable origin such as `http://127.0.0.1:9` exercises Math's offline fallback without spending an `/api/claude` call), `EXPO_PUBLIC_PROGRESS_API_SECRET` (unset: cloud sync is skipped). See `src/platform/buildEnv.ts`.

```bash
# Math on a simulator, offline fallback, answering itself every 2.5 s
EXPO_PUBLIC_MUTE=1 EXPO_PUBLIC_DEBUG=1 EXPO_PUBLIC_QA_ROUTE=math \
EXPO_PUBLIC_QA_AUTOTAP_MS=2500 EXPO_PUBLIC_API_BASE=http://127.0.0.1:9 \
npx expo start --go --port 8297 --clear
```

## Math

`src/screens/math/` is the web's `src/screens/Math/` (8 problems, read-aloud, chip tap-gate, right / wrong reactions, hint ladder, dot card / minuend scaffolds, streak and stardust), with Kyle's phone layouts (`src/layout/mathLayout.ts`). The logic is core's; the two pure helpers the web keeps private (`buildChipOrder`, `startSessionWithFallback`) are verbatim copies whose tests fail when the web copy changes. App owns the session start (`src/session/mathSession.ts`, the web's Path A): kicked on Greet, 5 s visible-wait fallback to a hint-free request, torn down on back-to-Hub and when leaving Session End. Without a server plan Math runs core's static plan with silent captions (165 wpm). The result goes to Session End as the web's `SessionEndPayload` (`src/session/sessionEndPayload.ts`).

Reset to a first launch: delete the app from the simulator/device (storage lives in the app's SQLite database).

## Audio

`src/audio/` is the native counterpart of the web's Howler stack, on expo-audio. Screens import from `src/audio/index.ts` only; its header maps each web module to its native function. Highlights:

- **One Emma line at a time** across Greet, Hub/guidance/path lines and session lines (a new line cancels the one in flight). SFX play over her.
- **Captions** use the web's formula (word i at `i × duration / wordCount`, 165 wpm fallback), read from the player clock at a 50 ms status interval. expo-audio's default is 500 ms, which is too coarse for the captions.
- **Audio session:** plays in silent mode, `doNotMix`, never in the background. On iOS every player keeps the session active between lines (`keepAudioSessionActive`), so other audio stays paused while Emma's screens are up; it is released when the app goes to the background. Android has no equivalent in expo-audio 57.0.5: it abandons audio focus at the end of every line (see the Greet PR).
- **Lifecycle:** going to the background parks the line and freezes its caption; the foreground resumes it where it stopped. A line requested while hidden waits for the foreground (most recent wins). After a call or Siri, the OS resumes the line, or else the next `inactive → active` edge does.
- **Session audio:** `startSession()` posts to `/api/claude` through core's `apiUrl()` and writes one MP3 per distinct text to `<cache>/session-audio/<sessionId>/` in the background. `unload()` deletes the files, and a boot sweep removes the files a killed app left. `sessionPrefetcher` is the Hub prefetch Phase 3 calls.
- **Players:** created lazily, with at most 4 live voice players (LRU). On Android every live player holds an MP3 decoder.

| Env flag (bundle time)      | Effect                                                                   |
| --------------------------- | ------------------------------------------------------------------------ |
| `EXPO_PUBLIC_MUTE=1`        | every player muted. Use it for any automated or simulator run.           |
| `EXPO_PUBLIC_AUDIO_CHECK=1` | runs `src/audio/debug/audioCheck.ts` 2 s after launch and logs to Metro. |

The audio check plays a Greet line, a live session line and two SFX, and logs onPlay latencies (`[audio] onPlay +N ms`), session fetch and write timings, a raw player-status probe and a decoder-limit probe. Simulator: `xcrun simctl openurl booted exp://127.0.0.1:<port>`. With `--ios` the simulator lands on Safari's dev-build/Expo Go chooser, because this project ships `expo-dev-client`. Android: `adb reverse tcp:<port> tcp:<port>`, then open the same URL in Expo Go.

```bash
EXPO_PUBLIC_AUDIO_CHECK=1 EXPO_PUBLIC_MUTE=1 EXPO_PUBLIC_DEBUG=1 npx expo start --go --port 8297 --clear
```

**Bundled clips** (Greet, Hub, Emma's Path and guidance lines, SFX) are byte-for-byte copies of the web MP3s: run `npm run export-audio` after a web re-render. `src/audio/audioRegistry.test.ts` fails when a copy drifts or a manifest line has no copy.

## Checks

```bash
npm run typecheck      # app (no DOM, no Node types) + tests
npm test               # jest-expo
npm run check:bundle   # iOS export; fails if anything comes from outside mobile/ except @marian/core
npx expo-doctor
```

The repo root's `yarn lint` lints `mobile/**/*.ts{,x}` with the web's ESLint + Prettier rules; the root Vitest run excludes `mobile/`.

## Assets

`npm run export-assets` (after the root `yarn install`; it borrows the web's `sharp` and `prettier`) re-exports the web images: Emma poses, pictures and scenes from PNG-in-SVG to WebP, the Emma's Path WebPs as-is, the app icon and the splash logo. It regenerates `src/assets/registry.ts`, keyed by the web URL path, so `pathArtSrc()` / `sceneSrc()` from core look up native images directly. `src/assets/assets.test.ts` fails when a pose, picture, scene or path-art piece has no native export.
