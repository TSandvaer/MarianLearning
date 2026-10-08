/**
 * Side-effect module: wires `@marian/core` to React Native.
 *
 * It must be `index.ts`'s FIRST import. Core reads storage synchronously
 * as soon as the first screen renders (`nextAfterSplash()`, and in later
 * phases `useState(loadProgress)`), and a debug seed must land before
 * that. Babel compiles imports to in-order requires, so first-import
 * placement installs the store before `App` and anything it imports is
 * evaluated. `index.test.ts` pins the order. Same pattern as the web's
 * `src/platform/boot.ts`.
 */
import { Storage } from 'expo-sqlite/kv-store'
import { Platform, Settings } from 'react-native'
import { readBuildEnv } from './buildEnv'
import {
  buildEnvSource,
  launchArgumentSource,
  resolveLaunchFlags,
} from './launchFlags'
import { bootNative } from './native'

const env = readBuildEnv()
const flags = resolveLaunchFlags(
  Platform.OS === 'ios'
    ? [launchArgumentSource(Settings), buildEnvSource(env)]
    : [buildEnvSource(env)],
)
bootNative({ backend: Storage, env, flags })
