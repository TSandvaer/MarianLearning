/**
 * The `EXPO_PUBLIC_*` build-time flags the app reads.
 *
 * Metro inlines `process.env.EXPO_PUBLIC_*` into the JS bundle when it
 * builds it, and only for a literal member access, so every read lives
 * here, spelled out. Set them in the shell (or `mobile/.env.local`)
 * before `npx expo start` / `npx expo run:ios`; Metro's cache may keep an
 * old value, so restart with `--clear` after changing one.
 *
 * | Flag                               | Effect                                        |
 * | ---------------------------------- | --------------------------------------------- |
 * | `EXPO_PUBLIC_API_BASE`             | origin of `/api/*` (default: production)      |
 * | `EXPO_PUBLIC_PROGRESS_API_SECRET`  | cloud-sync bearer secret (unset: sync off)    |
 * | `EXPO_PUBLIC_DEBUG=1`              | debug mode, gates the two flags below         |
 * | `EXPO_PUBLIC_SEED=<name>`          | debug seed, see `@marian/core/debug/seeds`    |
 * | `EXPO_PUBLIC_DAY_OFFSET=<n>`       | moves the progress clock n days (0..60)       |
 * | `EXPO_PUBLIC_MUTE=1`               | every audio player muted (automated runs)     |
 * | `EXPO_PUBLIC_AUDIO_CHECK=1`        | runs `src/audio/debug/audioCheck.ts` at boot  |
 * | `EXPO_PUBLIC_QA_AUTOTAP_MS=<n>`    | debug only: Greet's wake tap fires itself n ms |
 * |                                    | after Greet mounts, and Math answers n ms     |
 * |                                    | after each chip gate opens (simulators        |
 * |                                    | without a tap)                                |
 * | `EXPO_PUBLIC_QA_ROUTE=<route>`     | debug only: launch on this route (web         |
 * |                                    | `?route=`), e.g. `math`                       |
 *
 * The progress secret ships inside the bundle, exactly like the web's
 * `VITE_PROGRESS_API_SECRET` (cloud-sync threat model: casual-abuse
 * protection, not real auth). The Claude key never reaches the app: it
 * stays in the Vercel function behind `/api/claude`.
 */
export interface BuildEnv {
  apiBase: string | undefined
  progressApiSecret: string | undefined
  debug: string | undefined
  seed: string | undefined
  dayOffset: string | undefined
  mute: string | undefined
  audioCheck: string | undefined
  qaAutoTapMs: string | undefined
  qaRoute: string | undefined
}

export function readBuildEnv(): BuildEnv {
  return {
    apiBase: process.env.EXPO_PUBLIC_API_BASE,
    progressApiSecret: process.env.EXPO_PUBLIC_PROGRESS_API_SECRET,
    debug: process.env.EXPO_PUBLIC_DEBUG,
    seed: process.env.EXPO_PUBLIC_SEED,
    dayOffset: process.env.EXPO_PUBLIC_DAY_OFFSET,
    mute: process.env.EXPO_PUBLIC_MUTE,
    audioCheck: process.env.EXPO_PUBLIC_AUDIO_CHECK,
    qaAutoTapMs: process.env.EXPO_PUBLIC_QA_AUTOTAP_MS,
    qaRoute: process.env.EXPO_PUBLIC_QA_ROUTE,
  }
}
