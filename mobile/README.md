# Marian Tutor: native app (Expo)

The React Native app from `design/react-native-migration-plan.md`. Phase 2a: the shell. Every route renders a placeholder until Phase 3 ports the real screens; there is no audio yet (Phase 2b).

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

**Expo Go** (no build; scan the QR code with the store Expo Go app, SDK 57). The shell uses only modules that ship in Expo Go:

```bash
npx expo start --go
```

**Physical iPhone / iPad without the paid Apple Developer account**: see the PR for the free "Personal Team" status. `npx expo run:ios --device` signs with whatever team Xcode has, and the app declares no capabilities (its entitlements file is empty), which is what a free team can provision.

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

Other env flags: `EXPO_PUBLIC_API_BASE` (default `https://marian-learning.vercel.app`), `EXPO_PUBLIC_PROGRESS_API_SECRET` (unset: cloud sync is skipped). See `src/platform/buildEnv.ts`.

Reset to a first launch: delete the app from the simulator/device (storage lives in the app's SQLite database).

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
