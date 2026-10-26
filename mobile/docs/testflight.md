# First TestFlight build (iOS)

The steps to get **Emma's Path** (bundle ID `dk.sandvaer.emmaspath`, version `0.1.0`) from `main` onto Marian's iPad through TestFlight. Every Apple and Expo sign-in is yours; agents never run `eas build`, `eas submit` or `eas credentials`.

**How to run a `!` step:** type it in the Claude Code prompt with the leading `!`. It runs in the session's shell, so every command starts with `cd ~/DEV/MarianLearning/mobile` (EAS CLI must run from the app directory in a monorepo [1]). Steps marked **interactive** ask for your Apple ID, password, 2FA code or a yes/no. **Interactive steps do not work under `!`**: on 2026-10-13 `eas login` there failed with "Use eas login --device --non-interactive to log in without prompts". Run every step marked **Terminal** in a Terminal window, without the `!`.

**Never type the progress secret into a `!` command**, because it would land in the session transcript. Step 3 uses the expo.dev dashboard instead.

## Already done

- [x] Apple Developer Program membership is active (2026-10-13).
- [x] Expo login: `npx eas-cli whoami` printed `sandvaer` (2026-10-13).
- [x] First build and submit (2026-10-13/14): build 0.1.0 (2) (EAS build `fabba9f9`), credentials created by EAS, App Store Connect app `Emma's Path: Math & Reading` (Apple ID `6822444808`, set in `eas.json` by #563), an App Manager API key stored on EAS, internal group **Family** with automatic distribution. Installed on Thomas's iPad and iPhone; step 11's checks passed on the iPhone.
- [x] `eas init` (run 2026-10-13 with your approval) created the EAS project `@sandvaer/marian-tutor` (ID `3ed1920d-bab2-4fef-ab11-6413a74d5e62`). It wrote two fields into `mobile/app.json`: `"owner": "sandvaer"` and `"extra": { "eas": { "projectId": "3ed1920d-…" } }`. They are committed in the PR that added this file, not left in the main checkout. **Don't re-run it.** The slug `marian-tutor` and the project ID are how EAS finds the project. Users never see them, so they keep the old name. If `eas init` ever runs again, it rewrites those fields, and the change goes in through a PR.

## Steps

1. **Update the main checkout** (not interactive; you or the orchestrator), after the PR that added this file is merged:

   ```
   ! cd ~/DEV/MarianLearning && git status --short && git pull --ff-only && cd mobile && npm ci
   ```

   `git status --short` should print nothing. EAS CLI reads `mobile/app.json` and `mobile/eas.json` from here.

2. **App Store Connect agreements** (browser): sign in at `https://appstoreconnect.apple.com/`. If a banner asks you to review or accept an agreement, accept it before step 4.

3. **Set the progress secret once** (browser). Without it the store build runs with cloud sync off (`src/platform/buildEnv.ts`).
   1. Open `https://expo.dev/accounts/sandvaer/projects/marian-tutor/environment-variables` (Project settings > Environment variables) and click **Add Variables** [2].
   2. Name: `EXPO_PUBLIC_PROGRESS_API_SECRET`.
   3. Value: the value of `PROGRESS_API_SECRET` in Vercel (Production). The app must send the value the server checks; the web's `VITE_PROGRESS_API_SECRET` is the same value (`.env.example`).
   4. Environment: **production** only.
   5. Visibility: **Sensitive**. Not Secret: secret values "are not readable outside of the EAS servers" [3], and "Secrets do not provide any additional security for values that you end up embedding in your application itself" [3]. This value is embedded in the app, like the web's.
   6. Check that it is there. The value stays hidden unless you pass `--include-sensitive` [4], so don't pass it:

      ```
      ! cd ~/DEV/MarianLearning/mobile && npx eas-cli env:list --environment production
      ```

4. **First store build** (**Terminal**, interactive):

   ```
   cd ~/DEV/MarianLearning/mobile && npx eas-cli build --platform ios --profile production
   ```

   - Sign in with your Apple ID when asked and pick your team. For the distribution certificate and provisioning profile, let EAS create them: "use EAS CLI by signing in to your Apple Developer Program account and following the prompts" [5]. If it offers to register the bundle identifier `dk.sandvaer.emmaspath`, say yes.
   - **Build number:** EAS keeps it (`appVersionSource: "remote"`, `autoIncrement: true`), so builds never need an `app.json` commit [6]. `app.json` sets no `ios.buildNumber`, and "if you do not have build versions set in your app config, the remote version will initialize with `1` when the first build is created" [6]. So the first build should be **build 1** of version 0.1.0, and later builds count up from there.
   - **Free plan:** "Up to 15 Android and 15 iOS builds", "Low-priority queue", "45-minute build timeout" [7]. The quota is monthly: "new builds are unavailable until the quota resets on the first day of the next calendar month" [8]. Don't start builds you don't need.
   - The command waits for the build. You can press Ctrl-C and follow the build page link instead (also on `https://expo.dev/builds`) [5].

   - The yellow "Detected that your app uses Expo Go for development" warning is harmless: Expo Go is only the development client; the store build is standalone. `EAS_BUILD_NO_EXPO_GO_WARNING=true` silences it.
   - If it fails at once with "Failed to resolve plugin for module expo-dev-client", `mobile/node_modules` is missing: run step 1's `npm ci` (seen 2026-10-13).

5. **Read the build log** on the build's expo.dev page before submitting. Tell the orchestrator what you see for a and b:
   1. **Build image** ("Spin up build environment" section [9]): expected an Xcode 27.1 image: Expo's SDK 58 upgrade post says the `sdk-58` alias points to it (build 23 and earlier ran SDK 57 on `macos-tahoe-26.5-xcode-26.6`). The profile pins `"image": "sdk-58"`.
   2. **Which install ran** (the install-dependencies phase): `npm` in `mobile/`, or `yarn install` at the repo root. The repo root has a `yarn.lock` and a `packages/*` workspace, but `mobile/` is a standalone npm project. EAS's documented rule is "Run `npm install` in the project root (or `yarn install` if **yarn.lock** exists)" [10]. If the build fails here, stop and send the log link to the orchestrator; don't retry blindly (each run counts against the 15).
   3. The build page shows version `0.1.0`, build `1`, and the status Finished.

6. **Create the App Store Connect app record** (browser, once). Apps > **+** > **New App** [11]:
   - Platform: iOS.
   - Name: **Emma's Path: Math & Reading** (27 characters; Apple's limit is 30 [12]). This is the store listing name. The home-screen name stays "Emma's Path" (`app.json` `name`).
   - Primary language: English.
   - Bundle ID: `dk.sandvaer.emmaspath`. Expected in the list after step 4, not verified. If it isn't there, stop and tell the orchestrator.
   - SKU: any internal string of your choice, for example `emmas-path`.
   - User access: Full Access.

   Click **Create** and check for messages [11]. "You can use an app name for one app per localization" [11]. If it's taken, use the fallback **Emma's Path – Kids Learning** (27 characters). Apple: "The name must be at least two characters and no more than 30 characters" [12].

7. **Put the app's Apple ID into `eas.json`** (through a PR). In App Store Connect: your app > **App Store** tab > **General** > **App Information**. The number listed as **Apple ID** is the `ascAppId` [13]. It isn't secret: Apple uses it in the app's App Store URL [12]. Send it to the orchestrator. A one-line PR replaces `REPLACE_WITH_ASC_APP_ID__see_mobile_docs_testflight_md` in `mobile/eas.json` (`submit.production.ios.ascAppId`). Your Apple ID email stays out of the repo, which is public: EAS asks for it at submit time [13]. After that PR merges, run step 1 again.

8. **Submit to TestFlight** (**Terminal**, interactive: Apple ID on first run [13]):

   ```
   cd ~/DEV/MarianLearning/mobile && npx eas-cli submit --platform ios --latest
   ```

   `--latest` submits the newest iOS build [4]. The `production` submit profile is used by default [14]. Apple then processes the build ("usually 5 to 10 minutes, though there is no guaranteed time" [15]; the submit guide says 10-15 [13]) and emails you when it's done. `ios.config.usesNonExemptEncryption: false` answers the export-compliance question in advance, so the build should not stop on **Missing Compliance** [15]. If it does stop there, the answer is: no encryption beyond HTTPS provided by iOS.

9. **Add yourself as an internal tester** (browser) [15]. App Store Connect > your app > **TestFlight** > **+** next to **Internal Testing**. Name the group (for example "Family") > **Create** > **+** next to **Testers** > tick yourself > **Add**. Internal testing needs no Beta App Review and reaches testers "immediately after processing" [15].

10. **Install on the iPad.** Install the TestFlight app from the App Store [15]. On the iPad, tap the link in the invitation email; the app appears in TestFlight, and you install it from there [15].
    - **Marian's own iPad can't use TestFlight:** her child account is under 13, and the [TestFlight terms](https://www.apple.com/legal/internet-services/itunes/testflight/us/terms.html) do not permit under-13 users. She plays on Thomas's iPad (decided 2026-10-13). If her own iPad is needed later, the route is an EAS internal (ad hoc) build for a registered device.
    - **A second device with the same Apple ID** (Thomas's iPhone): open the TestFlight app directly. The email link says "Unable to accept invite" once the invite is used, which is expected.
    - **Builds expire 90 days after upload** [15]. TestFlight shows the date. A new build is needed before then.

11. **Device checks** on the installed build. Report each one to the orchestrator:
    1. The home-screen name reads **Emma's Path**, apostrophe included.
    2. The app opens straight into Emma's splash. No Expo dev launcher screen.
    3. **No dev menu:** shaking the iPad or a three-finger long-press does nothing.
    4. No "find devices on your local network" prompt. The dev-launcher plugin still writes `NSLocalNetworkUsageDescription` into Info.plist, but the launcher does not run in a Release build. Expected: no prompt (not verified).
    5. Parent Settings has no "QA: jump to a step" row (debug-only).
    6. Parent Settings > Push now updates "Last synced". That proves the secret from step 3 is in the build.

## Later builds

- One step builds and submits [13]:

  ```
  ! cd ~/DEV/MarianLearning/mobile && npx eas-cli build --platform ios --profile production --auto-submit
  ```

- The build number counts up on EAS; there is nothing to commit.
- The user-facing version (`0.1.0`) changes only through a PR that edits `app.json` `version`. "When you are doing a production release, the user-facing version should be explicitly set and updated by you" [6].

## If something goes wrong

- **The build fails:** send the build page link to the orchestrator.
- **Apple emails about missing "required reason" APIs (privacy manifest):** forward it. The fix goes into `ios.privacyManifests` in `app.json` [16].
- **Out of builds for the month:** wait for the 1st, take the Starter plan, or build locally [8].

## Sources (fetched 2026-10-13)

1. https://docs.expo.dev/build-reference/build-with-monorepos/
2. https://docs.expo.dev/eas/environment-variables/manage/
3. https://docs.expo.dev/eas/environment-variables/
4. https://docs.expo.dev/eas/cli/ (`eas env:list`, `eas submit`)
5. https://docs.expo.dev/deploy/build-project/
6. https://docs.expo.dev/build-reference/app-versions/
7. https://expo.dev/pricing
8. https://docs.expo.dev/billing/faq/ ("What happens when I use up the Free plan's monthly quota?")
9. https://docs.expo.dev/build-reference/infrastructure/
10. https://docs.expo.dev/build-reference/ios-builds/
11. https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app
12. https://developer.apple.com/help/app-store-connect/reference/app-information/app-information
13. https://docs.expo.dev/submit/ios/
14. https://docs.expo.dev/submit/eas-json/
15. https://docs.expo.dev/submit/testflight/
16. https://docs.expo.dev/guides/apple-privacy/
