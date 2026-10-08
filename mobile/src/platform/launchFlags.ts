/**
 * Debug launch flags: the native counterpart of the web's
 * `?debug=1&seed=<name>&dayOffset=<n>` query parameters.
 *
 * Two sources, same names as the web parameters:
 *
 *   1. iOS launch arguments, `-debug 1 -seed cvc-words -dayOffset 2`.
 *      iOS puts `-key value` launch arguments into NSUserDefaults (the
 *      argument domain), which React Native's `Settings` module exposes.
 *      Pass them with `xcrun simctl launch <device> <bundle id> -debug 1
 *      -seed cvc-words`, from an Xcode scheme, or from a Maestro
 *      `launchApp: arguments:` block.
 *   2. Build-time env flags, `EXPO_PUBLIC_DEBUG=1 EXPO_PUBLIC_SEED=...`
 *      (see `./buildEnv.ts`).
 *
 * Per flag, the first source with a non-empty value wins (launch
 * arguments first). Exactly like the web, `seed` and `dayOffset` are
 * ignored unless `debug` is `1`: Marian's normal launch never sets it.
 */
import type { BuildEnv } from './buildEnv'

export type LaunchFlagName = 'debug' | 'seed' | 'dayOffset'

/** One place a flag can come from. Returns `undefined` when unset. */
export type LaunchFlagSource = (name: LaunchFlagName) => string | undefined

export interface LaunchFlags {
  /** `debug` is `1`. */
  readonly debug: boolean
  /** The seed name, only when `debug`. */
  readonly seed: string | null
  /** The raw day offset (core validates it), only when `debug`. */
  readonly dayOffset: string | null
}

export const NO_LAUNCH_FLAGS: LaunchFlags = {
  debug: false,
  seed: null,
  dayOffset: null,
}

/** The subset of React Native's `Settings` (iOS NSUserDefaults) we read. */
export interface UserDefaultsReader {
  get(key: string): unknown
}

/** iOS launch arguments, read through React Native's `Settings`. */
export function launchArgumentSource(
  defaults: UserDefaultsReader,
): LaunchFlagSource {
  return (name) => {
    let value: unknown
    try {
      value = defaults.get(name)
    } catch {
      return undefined
    }
    if (typeof value === 'string') return value
    if (typeof value === 'number') return String(value)
    return undefined
  }
}

/** The `EXPO_PUBLIC_*` build-time flags. */
export function buildEnvSource(env: BuildEnv): LaunchFlagSource {
  return (name) => {
    if (name === 'debug') return env.debug
    if (name === 'seed') return env.seed
    return env.dayOffset
  }
}

function firstValue(
  sources: readonly LaunchFlagSource[],
  name: LaunchFlagName,
): string | null {
  for (const source of sources) {
    const value = source(name)?.trim()
    if (value) return value
  }
  return null
}

export function resolveLaunchFlags(
  sources: readonly LaunchFlagSource[],
): LaunchFlags {
  const debug = firstValue(sources, 'debug') === '1'
  if (!debug) return NO_LAUNCH_FLAGS
  return {
    debug,
    seed: firstValue(sources, 'seed'),
    dayOffset: firstValue(sources, 'dayOffset'),
  }
}

let current: LaunchFlags = NO_LAUNCH_FLAGS

/** Record this launch's flags (`bootNative()`, once). */
export function setLaunchFlags(flags: LaunchFlags): void {
  current = flags
}

/** The flags this launch resolved at boot. */
export function getLaunchFlags(): LaunchFlags {
  return current
}
