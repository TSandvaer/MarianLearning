/**
 * Side-effect module: wires `@marian/core` to the browser.
 *
 * It must be `App.tsx`'s FIRST import. App.tsx runs storage writes at
 * module load (`maybeApplyDebugSeed()`, `maybeApplyResetParam()`) and
 * every screen boots with sync reads (`useState(loadProgress)`), so the
 * store has to be installed before App's own module body runs. ES
 * modules evaluate imports in order, so first-import placement does it.
 *
 * Why App.tsx and not main.tsx: tests that `vi.resetModules()` and
 * re-import App get fresh core module instances; importing this from App
 * re-installs the store into them.
 */
import { installWebPlatform } from './web'

installWebPlatform()
