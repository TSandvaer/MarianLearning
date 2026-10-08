# React Native (Expo) Phase 0 spike

Throwaway go/no-go prototype for `design/react-native-migration-plan.md` § Phase 0. Branch `spike/rn-phase0`. **Nothing here has run on a device yet.** Device behaviour is your gate. Everything below marked _verified_ was checked on this Mac with no simulator.

What it does: Splash → Greet (4 MP3 lines with word-tick captions, heart) → one live Math problem → Hub stub. A second launch goes Splash → Hub stub. Emma is one App-level view that travels between screens (the `layoutId` attempt).

## How to run

Prerequisites:

- **An Expo account.** Expo Go on the iOS App Store now requires login. Since 2026-09-03 the CLI and the Expo Go app must be signed in to the **same** account (Expo changelog "Login now required for running projects in Expo Go").
- Expo Go from the App Store or Play Store. Per that same post, the App Store build supports SDK 57, which is what this app uses (`expo ~57.0.27`, RN 0.86.3, React 19.2.3).
- The phone/iPad and the Mac on the same Wi-Fi.
- iOS/iPadOS 16.4 or later. SDK 57's minimum, per the migration plan's "Target stack".

```bash
cd mobile
npm install
npx expo login          # once; same account as in Expo Go
npx expo start          # scan the QR: iOS Camera app / Android Expo Go
```

If the device can't reach the Mac (guest Wi-Fi, client isolation, VPN), use the tunnel instead:

```bash
npx expo start --tunnel
```

Not tried here. Likely: the first `--tunnel` run asks to install `@expo/ngrok`.

Optional env flags (prefix the start command):

| Flag                                 | Effect                                                       |
| ------------------------------------ | ------------------------------------------------------------ |
| `EXPO_PUBLIC_SESSION_SOURCE=fixture` | Math uses the bundled fixture, no network                    |
| `EXPO_PUBLIC_SPIKE_MUTE=1`           | every player muted (for any automated run)                   |
| `EXPO_PUBLIC_SPIKE_DEBUG=0`          | debug log starts collapsed (tap "dbg" bottom-left to toggle) |
| `EXPO_PUBLIC_API_BASE=https://…`     | another deployment instead of production                     |

Reset to first launch: **Hub stub → "Reset storage"**, then reload.

Expo Go caveat: in dev mode the JS and every asset (MP3s, Emma WebPs) are fetched from the Mac over the LAN. First-play latency in Expo Go is therefore **not** representative of a standalone build.

## Device checklist (Thomas) — against the Phase 0 exit criteria

Devices: iPad, an iPhone, an Android phone. Tick per device. The debug log (bottom-left, small) prints `onPlay +N ms` per line and the Math session source.

**EC1 — Audio plays on cold launch on both OSes, with no unlock tap**

- [ ] Kill the project in Expo Go, then reopen it. After the splash, "Hi!" plays about 1 s after Greet appears, with no touch.
- [ ] Same with the iPhone ring/silent switch on silent. The app sets `playsInSilentMode: true`, so Emma should still be audible.
- [ ] All 4 lines play in order with ~400 ms gaps. The heart appears after "It's so nice to meet you."

**EC2 — Caption timing matches the PWA**

- [ ] Side by side with the PWA Greet on the iPad (the PWA needs its wake tap), words appear in step with the voice. Check "I'm Emma." (2 words) and the two 6-word lines.
- [ ] Math read-aloud "One plus two. How many?" ticks word by word in step.

**EC3 — Animation feel (your eye is the gate)**

- [ ] Emma's slide-in (from lower-left, spring), breathing, "Hi!" tilt-and-swap to celebration.
- [ ] Ribbon pop-in, word fades, heart spring-in, bob, tap squish, Greet fade-out.
- [ ] **Shared transition:** on the heart tap, Emma (celebrating) springs from Greet's centre to Math's upper-left perch, then settles to idle. Compare with the PWA's Greet → Math.
- [ ] Wrong chip: chip shakes, Emma tilts puzzled, no red anywhere. Correct: celebration + "Yes! Three!".

**EC4 — Greet layout works on a phone in both orientations**

- [ ] Phone portrait: Emma top, ribbon below, heart at the bottom. Nothing clipped.
- [ ] Phone landscape: Emma in the left half, ribbon and heart in the right half.
- [ ] iPad portrait and landscape.
- [ ] Rotate mid-greeting: Emma springs to her new frame and the audio keeps playing.
- [ ] Same three form factors on the Math problem (Emma perch, caption, equation + dots, 3 chips).

**Storage round-trip**

- [ ] First launch → Greet. Reach Math, kill the app, relaunch → Splash → **Hub stub, "Sessions started: 1"**.

**Live Math call**

- [ ] The debug log says `session: live`. `fixture (…)` means the call failed, and the reason is in the brackets.

### Predictions (written before any device run, so they can be graded)

1. iPad + iPhone: "Hi!" is audible with no tap on every cold launch. The debug log shows `onPlay +<300 ms` for line 1 once the assets are cached, but the very first launch in Expo Go can be slower (LAN asset fetch).
2. Caption ticks match the PWA within ~50 ms per word, because the formula is identical and the ticks are read from the player clock. Nobody should be able to see the difference.
3. Android: same as iOS, except the first-line `onPlay` latency is higher (ExoPlayer prepare). Still no tap needed.
4. The Emma Greet → Math move reads as one Emma travelling. It lacks Framer's crossfade-while-moving between two different elements. Rotation reflows read as a smooth spring, not a jump.

**Not tested at all** (bounded claim): any runtime behaviour, audio, timing, layout or animation on any device or simulator. Only static checks were run (below).

## What was verified on this Mac

| Check                                | Result                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `npx expo-doctor`                    | `21/21 checks passed. No issues detected!` (after adding the `expo-asset` peer dep it flagged)   |
| `npx tsc --noEmit`                   | exit 0. It also type-checks the 8 reused web files                                               |
| `npx expo export --platform ios`     | `iOS Bundled … index.ts (1189 modules)`, 3.1 MB `.hbc`                                           |
| `npx expo export --platform android` | `Android Bundled … index.ts (1187 modules)`, 3.1 MB `.hbc`                                       |
| Worklets compiled                    | the plain-JS iOS export contains `__workletHash` (126×) and the `EmmaStageTsx1` entering worklet |

## Porting speed (measured from the commit timestamps)

- Branch created **15:19:22**. Scaffold commit `3143b6e` **15:27:18**. Feature commit `145decf` **15:40:59**, all on 2026-10-08. Research to working bundle: **21 min 37 s** wall-clock, of which **13 min 41 s** went on writing code (agent time, not a human developer).
- **Greet path.** Web: `Greet.tsx` 1,639 + `Splash.tsx` 131 + `preRecorded.ts` 552 = **2,322 lines**. Native: 1,230 lines (Greet 256, Splash 159, greetAudio 98, captionPlayer 183, CaptionRibbon 130, HeartButton 160, Clouds 79, EmmaStage 165). About 1,000 of the web lines are iOS-WebKit unlock and Howler instrumentation that is **deleted, not ported**.
- **Whole spike.** 2,604 native lines written. Reused **unchanged**: 2,822 web lines (`greetSequence`, `splashTiming`, `planFromServer`, `sessionPlans`, `distractors`, `api/_types`, `emmaPose`, `gameplayConstants`) via Metro `watchFolders`.
- **What it means for the estimates.** Writing the code is not the bottleneck. These ~14 minutes are code that compiles and bundles, not code proven on a device. The real cost per screen is the device-gate loop: your eye and ear on 3 form factors × fix rounds. That loop has not started. Estimate (not measured): Phase 3's 20–35 dev-days is dominated by gate rounds. With ~2 rounds per screen × 8 screens × 3 form factors, plan for ~45–50 device check sessions rather than for coding days. Re-base the table after this spike's first device round, using its round count.

## `layoutId` verdict (honest, and unverified on device)

- **What does not work.** Reanimated's real shared-element API (`sharedTransitionTag`) is gated by the static flag `ENABLE_SHARED_ELEMENT_TRANSITIONS`, which is `false` in `react-native-reanimated@4.5.1/src/featureFlags/staticFlags.json`. Static flags need a native rebuild, so it is **impossible in Expo Go**. It also only animates between react-navigation native-stack screens, which this app doesn't use.
- **What was built.** Emma is hoisted to one App-level view (`src/components/EmmaStage.tsx`). Each screen exposes Emma's frame through pure layout functions (`src/layout.ts`). A `LinearTransition.springify()` layout animation springs her between frames on route change or rotation. Pose swaps use expo-image's native cross-dissolve plus the per-pose spring tilt from the reused `emmaPose.ts`.
- **How close (predicted).** It is close for the Greet → Math move and for the in-place idle ↔ celebration swap (Hub ↔ PromotionCelebration is the same case). It is not 1:1: Framer morphs between **two different elements** across unmount and mount, while this moves **one element**. So every `layoutId` use (15 in the web app) becomes "hoist the element and give it an explicit frame per screen". That is an architectural change to how screens own Emma, not a drop-in. Your eye decides whether the motion is acceptable.

## Blockers and risks found

1. **Expo Go distribution is fragile.** In May 2026 the App Store Expo Go was still on SDK 54. SDK 55 was awaiting Apple approval, and 55 and 56 were offered only through `eas go`, which needs a paid Apple Developer membership (Expo, "Expo Go and the App Store in May 2026"). The App Store build supported SDK 57 by 2026-09-03, and SDK 58 has been in beta since 2026-09-15. When the store Expo Go moves to 58, this SDK 57 spike may stop opening in it. The fallback is a development build through EAS, which needs the Apple Developer Program ($99/yr). Phase 5 needs that account anyway; consider getting it now.
2. **iOS Expo Go needs an Expo login** on both the CLI and the app (since 2026-09-03).
3. **`layoutId` has no drop-in equivalent** (see above). Plan Phase 3 time for re-architecting the 15 uses around hoisted elements.
4. **expo-audio status updates default to 500 ms** (`AudioPlayerOptions.updateInterval`). That is too coarse for caption ticks; the spike uses 50 ms. Any port that forgets this gets late captions.
5. **The Wake state is removed** (native needs no unlock tap). That is a UX change to Greet; Kyle should sign it off. Line 1 auto-starts 1 s after Greet mounts (my choice, to sit after Emma's slide-in).
6. **Caption font.** The web Greet caption uses `ui-rounded` (SF Pro Rounded on iPad), not Fredoka. The spike uses Fredoka on both OSes, because Android has no SF Rounded. It will look slightly different on the iPad. That's Kyle's call.
7. **RN 0.86 removed `StyleSheet.absoluteFillObject`** (tsc error). Small, but it shows that up-to-date RN breaks older snippets and codemods.
8. **Reuse through `watchFolders` works.** 2,822 web lines bundle unchanged, so Phase 1 can start this way. Caveat: if a reused file grows a third-party import, Metro resolves it from the web's root `node_modules`. A real `packages/core` with its own `package.json` fixes that.
9. **Session payload size.** The live response is 1,713,343 bytes with 76 inline MP3s. The spike writes only problem 1's 7 files. Phase 2 must decide whether to write all 76 up front (the base64 decode happens natively in `File.write`, off the JS heap) or lazily.
10. **Not evaluated:** NativeWind (the spike uses `StyleSheet`), SFX, `AppState` backgrounding, and audio interruption (phone call or Siri mid-line).

## Live API usage

One live call so far, made with `curl` on 2026-10-08 to cache the fixture: `HTTP 200 size 1713343 time 1.339476`. The app calls production on every Math mount. Payload `{ track: 'math', level: 1, childName: 'Marian' }` with no progress block. Reading `api/claude.ts` (the "canon-first" branch runs before the rate limiter and before any Anthropic call), this should be served from the pre-baked canon. _Hypothesis, not confirmed from server logs:_ device testing costs no Anthropic credits.

## Files

- `App.tsx`: route state machine (`splash | greet | math | hub`), fonts, the Emma stage and the debug log
- `src/reuse.ts`: the only import surface from the web tree
- `src/audio/captionPlayer.ts`: expo-audio plus the word-tick contract. `greetAudio.ts` and `sessionAudio.ts` sit on top of it
- `src/api/sessionStart.ts`: the live session-start, with fixture fallback
- `src/layout.ts`: pure frame maths for phone portrait, phone landscape and tablet
- `scripts/extract-emma.mjs`: PNG-in-SVG → WebP (idle 838 KB SVG → 57 KB WebP)
- `scripts/trim-fixture.mjs`, `fixtures/session-start-math.json`: the full plan text plus problem 1's MP3s
