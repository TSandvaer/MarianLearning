# Maestro flows (native critical paths)

Phase 4 of `design/react-native-migration-plan.md`: the native app's critical paths as [Maestro](https://maestro.dev) flows, run on the **iOS Simulator with Expo Go**.

| Flow                                 | Path                                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `flows/01-first-launch.yaml`         | empty storage: Splash → Greet (heart tap) → Math → Session End "1 of 3" → Hub                                         |
| `flows/02-hub-math-session-end.yaml` | returning child: Splash → Hub → Number Garden → Math → Session End "1 of 3" → Hub                                     |
| `flows/03-word-song.yaml`            | returning child on CVC words: Hub → Word Song → Session End "1 of 3" → Hub                                            |
| `flows/04-mastery-promotion.yaml`    | `cvc-words-short-o` seed, three Word Song days ("1/2/3 of 3"), the third promotes: "All done" → map unlock beat → Hub |

`subflows/` holds the shared steps (open the app from Metro, tap and confirm, one Math or Word Song session).

## Run

Prerequisites (once):

- Xcode with an iOS simulator. Any iPad works; the flows were written on "iPad Pro 11-inch (M5)", iOS 27.
- Expo Go on that simulator: `cd mobile && npx expo start --go --ios` installs it.
- Java 17+: `brew install openjdk@17` (keg-only: it is not put on the PATH, so pass `JAVA_HOME` as below).
- The Maestro CLI in `~/.maestro/bin` (`curl -fsSL "https://get.maestro.mobile.dev" | bash`, or unzip the `maestro.zip` of a [CLI release](https://github.com/mobile-dev-inc/maestro/releases) there). Written against 2.11.0.

Then, from `mobile/`:

```bash
xcrun simctl list devices booted       # pick the simulator's UDID
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
MAESTRO_DEVICE=<UDID> \
maestro/run.sh                          # all four flows, in order
```

One flow: `maestro/run.sh maestro/flows/03-word-song.yaml`. With exactly one booted simulator, `MAESTRO_DEVICE` can be left out. `MAESTRO_METRO_PORT` (default 8399) and `MAESTRO_OUT` (Metro's log and Maestro's screenshots/logs per flow; default: a fresh temp dir) are optional.

**The runner empties the app's storage inside Expo Go on that simulator before every flow**, so each flow starts as a fresh install. Don't point it at a simulator whose progress you want to keep.

### What `run.sh` does

1. Starts one Metro (`npx expo start --go --offline --clear`) with the harness's bundle-time flags:

   | Flag                              | Value                | Why                                                                                 |
   | --------------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
   | `EXPO_PUBLIC_API_BASE`            | `http://127.0.0.1:9` | a closed local port: no paid call can happen (see below)                            |
   | `EXPO_PUBLIC_PROGRESS_API_SECRET` | unset                | cloud sync off: nothing is written to the production progress store                 |
   | `EXPO_NO_DOTENV`                  | `1`                  | a local `mobile/.env*` can't slip a secret or another API base into the bundle      |
   | `EXPO_PUBLIC_MUTE`                | `1`                  | silent runs                                                                         |
   | `EXPO_PUBLIC_DEBUG`               | `1`                  | enables the seed, day offset and autotap                                            |
   | `EXPO_PUBLIC_QA_AUTOTAP_MS`       | `2500`               | Greet's wake tap and every Math / Word Song answer (7 of 8 per session: a good day) |

   `--clear` matters: Metro caches inlined `EXPO_PUBLIC_*` values across restarts.

2. Builds the iOS bundle once, from the URL Metro's manifest gives Expo Go, so no flow pays the cold build inside its first wait (about 10 s on an M5 Mac, about 140 s on a CI runner).
3. Per flow: quits Expo Go, empties the app's key-value store (`ExponentExperienceData/*/marian-tutor*/SQLite/ExpoSQLiteStorage`), runs the flow. With `MAESTRO_FLOW_RETRIES=N` (default 0; CI sets 1), a failed flow runs again from empty storage, up to N more times, after a `MAESTRO-RETRY` line.
4. Prints a PASS / `PASS (retry)` / FAIL line per flow with its duration and its `MAESTRO-RETAP` count and elements, then the totals, stops Metro, and exits non-zero if any flow failed.

Per-flow state goes in as **iOS launch arguments** in the flow's `launchApp: arguments:` (`seed`, `dayOffset`; `src/platform/launchFlags.ts` reads them before the env flags). That is what lets one Metro serve all four flows, and lets flow 4 move the clock a day per relaunch.

### No paid calls

`/api/claude` (Haiku plus TTS) is never reached: the bundle's API base is a closed port on the Mac, so every session start fails at once with "Could not connect to the server" (visible in Metro's log), and Math and Word Song run core's static plans with silent captions, exactly as an offline iPad does. `run.sh` refuses to start if something listens on that port. A local stub of `/api/claude` was the alternative; it was not chosen because it would have to track the planner's response contract and audio, the static-plan path needs nothing, and the server-plan parsing is covered by core's unit tests and the web e2e suite.

## Every-step sweep (on demand)

`run.sh --sweep` checks that every step of both worlds plays, without playing through to it. It is not part of the per-PR flows; in CI it runs only by hand (see CI). Per step, `sweep/step.yaml` launches with `debug: 1` and `qaStep: <step>` (core `progressAtStep`: the earlier steps of the step's world mastered, the step at `intro`), taps the world's card on the Hub (through `subflows/tap-and-confirm.yaml`, like every tap in the flows), plays one session with the QA autotap to Session End and goes back to the Hub.

```bash
yarn install                             # at the repo root, once: the sweep runs the API handler
cd mobile
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
MAESTRO_DEVICE=<UDID> \
maestro/run.sh --sweep                   # all 24 steps, Number Garden then Word Song
maestro/run.sh --sweep mult-3-4          # one step (same env)
```

The step list is core's `QA_STEPS` (`packages/core/src/debug/stepProgress.ts`), so a new step is swept with no change here. `MAESTRO_SWEEP_API_PORT` (default 8398) is the sweep API's port. The storage warning above applies: every step starts from empty storage.

Each step gets one verdict:

| Verdict | Meaning                                                                                                  |
| ------- | -------------------------------------------------------------------------------------------------------- |
| `PASS`  | every check below holds                                                                                  |
| `XFAIL` | the step is on `sweep/expected-fail.txt`, the API served it, and its only problem is the silent fallback |
| `XPASS` | an expected-fail step passed: the sweep fails, so the list is updated in the PR that fixes the step      |
| `FAIL`  | anything else, including a listed step that fails in another way (a crash, the API not serving it)       |

The checks (`scripts/maestroSweepVerdict.ts`), on the step's part of Metro's log and of the sweep API's request log:

1. The Maestro flow passed. A crash, a red box over the screen or a screen that never comes fails it.
2. Metro's log has `[qaStep] jumped to "<step>"`: the launch flag applied.
3. **The session was for this step:** every session start of the step's world asked the API for this step (`progress.focusNode` in the request), and at least one did. This is read from the request the API received, because Metro's log does not show the focus node. Requests of the other world (the Hub prefetches the suggested world's session) are ignored.
4. No `ERROR` line in Metro's log (a `console.error`, which a red box also prints).
5. **No silent fallback:** the session played the server's plan, Metro's `[audio] math-session ready (<plan id>)` (`word-song-session` for Word Song), not `[audio] math-session unavailable, silent fallback: <why>`. The fallback is detected from that Metro line, in both worlds.

At the end it prints the table, the totals and the duration, and exits non-zero on any `FAIL` or `XPASS`. In the output directory, `sweep-results.tsv` has the full detail per step, and `sweep/<world>-<nn>-<step>/` the step's Maestro output, its part of Metro's log (`metro.log`) and its API requests (`api.jsonl`).

### The sweep's API

The closed port can't run this check: there every session start fails, so every step plays core's static fallback plan (sums to ten for most of Number Garden), and the fallback line can't tell a step that works from one that doesn't. The sweep's bundle points instead at a local server, `scripts/maestroSweepApi.ts` (started by `sweep/sweep.sh`): the production `/api/claude` handler over the session canon committed in `public/canon/`, so each step gets the response production gives it. Nothing paid and nothing outbound:

- it is started with `env -i` (`PATH` and `HOME` only), and refuses to start if any credential the API reads is set. `ANTHROPIC_API_KEY` is set to a placeholder only because the handler checks that the variable exists;
- its Anthropic client is a stub that throws: a canon miss answers 502 (and fails the step); Haiku is never called;
- `fetch` throws in that process, which is the TTS providers' only way out; an attempt is logged as `OUTBOUND BLOCKED` in `sweep-api.out`;
- it listens on 127.0.0.1 only.

The other guards are the per-PR ones: no progress secret, `EXPO_NO_DOTENV=1`, muted audio.

### Expected failures

`sweep/expected-fail.txt`, one step per line. Today it is empty: every step plays its server plan. Number Garden 1 and 8–11 (`number-recog`, `skip-counting`, `mult-2-5-10`, `mult-3-4`, `mult-6-9`) were on it until the native Math screen could read their read lines (`mathSessionPlanFromServer(plan, { extendedKinds: true })` in `packages/core/src/math/planFromServer.ts`). A step that starts to fail for a known reason goes on the list, and comes off it in the PR that fixes it. A name on the list that is not a step stops the sweep before it starts.

### Sweep timing

One full run on 2026-10-13 (a dedicated iPad Pro 11-inch (M5) simulator, iOS 27): 44 min 36 s for the 24 steps, 90–109 s per Number Garden step and 110–132 s per Word Song step.

### Writing the sweep flow

`sweep/step.yaml` does not use the shared `subflows/*-session.yaml`. Maestro 2.11.0 counts an `extendedWaitUntil` timeout from the last interaction (the card tap), not from the start of the wait, so their 60 s wait for "All done" is used up by the session. With the server plan's audio, Session End's lines are still playing when it shows (seen on `digraphs-sh`), so the sweep's waits add up the budgets of the waits before them.

## Timing

Three consecutive runs on 2026-10-13 (iPad Pro 11-inch (M5) simulator, iOS 27): first launch 117 / 109 / 97 s, Hub → Math 112 / 88 / 88 s, Word Song 100 / 99 / 99 s, mastery promotion 292 / 291 / 289 s (it plays three sessions). The whole suite takes about 10 minutes.

On the hosted `macos-26` runner (CI run 38396715552, 2026-10-13): 409 / 335 / 287 / 619 s for flows 1–4. The flows step took 30 minutes and the job 36, including about 5 minutes to boot the simulator and install Expo Go.

## CI

`.github/workflows/maestro.yml` runs `run.sh` (all four flows) on every pull request to `main` that touches `mobile/**`, `packages/core/**` or the workflow, on pushes to `main` under `mobile/**` or `packages/core/**`, and by hand (`workflow_dispatch`). It is not a required check.

- **Runner:** GitHub-hosted `macos-26` (arm64; free for this public repo). It creates and boots a fresh "iPad Pro 11-inch (M5)" on the image's iOS 26.5 runtime.
- **Pinned and checksum-verified:** Maestro 2.11.0 (`maestro.zip` from the `cli-2.11.0` release; the hash is the release's `checksums_sha256.txt`) and Expo Go 57.0.9 for the simulator (the `Expo-Go-57.0.9.tar.gz` from `expo/expo-go-releases`, the URL Expo's versions API gives for SDK 57). JDK 17 comes from `actions/setup-java` (Temurin).
- **No production calls, no secrets:** the same `run.sh` guards (closed-port API base, no progress secret, `EXPO_NO_DOTENV=1`); the workflow reads no repository secrets and has `contents: read` only.
- **Flake handling:** the hosted simulator sometimes drops a tap that Maestro reports as done. This was seen three times on 2026-10-13: once on a Hub card, and twice in a row on iOS's "Open in “Expo Go”?" dialog. Each tap is re-tapped once if its element is still up (`MAESTRO-RETAP`, see Writing a flow). A failed flow is also rerun once (`MAESTRO_FLOW_RETRIES=1`, workflow only) and shows as `PASS (retry)`. Every re-tap and rerun also becomes a "Maestro flake" warning on the run, so a pass that needed one is visible on the PR. If the same element keeps showing up, try it on a real iPad: a tap the app drops there would be an app bug.
- **Artifact:** on a failure, a re-tap or a rerun, the `maestro-output-<attempt>` artifact holds Metro's log, the console log and Maestro's per-flow debug output with screenshots (a rerun's is in `<flow>-attempt2/`). The job summary lists the result line per flow.
- **Bumping:** a new Expo SDK needs a matching Expo Go (`sdkVersions["<sdk>"].iosClientUrl` in `https://exp.host/--/api/v2/versions`); update `EXPO_GO_VERSION` and `EXPO_GO_SHA256` together, and `MAESTRO_VERSION` and `MAESTRO_SHA256` together. The pins are workflow-level `env`, shared by both jobs.
- **The step sweep, by hand only:** Actions → maestro → Run workflow, tick `sweep` (and optionally name one `step`). The `sweep` job then runs `run.sh --sweep` instead of the four flows; it never runs on a pull request or a push. It also does the root `yarn install` for the sweep API, writes the step table to the job summary, turns each `MAESTRO-RETAP` step into a warning, and always uploads `maestro-sweep-output-<attempt>`, which holds `sweep-results.tsv` and each step's Maestro output, Metro slice and API requests. It has no flow reruns, so a flaky step is rerun with `step`. A manual run is in its own concurrency group, so a push to `main` doesn't cancel it.

## Writing a flow

- `testID` is the element's `id` in Maestro (`resource-id` in `maestro hierarchy`). Run `maestro --device <UDID> hierarchy --compact` on a live screen to see what is exposed.
- A `Pressable` with an accessibility label is one accessibility element on iOS, so the ids **inside** it are not reliably visible (the Hub cards' current step, tray and map button). Assert on the card itself, or on what the next screen shows.
- iOS asks "Open in 'Expo Go'?" for an `exp://` link the first time; `subflows/open-app.yaml` taps "Open" when it shows.
- Don't tap Greet's wake target: the QA autotap fires it at 2.5 s and the two would race. The heart has no autotap; the flow taps it.
- Tap through `subflows/tap-and-confirm.yaml` (`TARGET`, the id to tap; `NEXT`, the id it opens), not a bare `tapOn`. It waits up to 15 s for `NEXT`, and if `TARGET` is still there it taps once more, labelled `MAESTRO-RETAP`. Without this, Maestro can't tell that a tap was lost, because an animated screen always looks "changed". A second tap is safe because every target ignores taps after the first. `subflows/open-app.yaml` does the same for the system dialog.
- Splash lasts 1.75 s; it is checked by where it routes (Greet or Hub), not asserted itself.
- An `extendedWaitUntil` timeout counts from the last interaction (launch, link, tap), not from the start of the wait (Maestro 2.11.0, `Orchestra.adjustedToLatestInteraction`). Back-to-back waits share one budget, so give the later wait the sum. Flow 1's heart wait is 180 s because the Greet wait before it can use most of its 120 s on a CI runner.

## Why Expo Go on the iOS Simulator

- **Development build:** `npx expo run:ios` builds, but iOS 27 simulators refuse to launch it (`UIScene life cycle is required`, see `mobile/README.md`).
- **Android emulator:** possible (the SDK and an API 37 AVD are on this Mac), but the target is the iPad.
- **Expo Go + Maestro:** this Mac's Xcode 27 has no Simulator.app and `simctl` can't tap, but Maestro's XCTest driver taps, reads the accessibility tree and launches with arguments on an iOS 27 simulator. The trade-off: Expo Go is not the shipped binary. Native-module or entitlement differences of a release build are Phase 5's TestFlight check.
