// Metro config for the native app.
//
// mobile/ is a standalone npm project (own package-lock.json), NOT a yarn
// workspace, so the web app's install, lockfile and React stay untouched.
// It consumes @marian/core through `"@marian/core": "file:../packages/core"`,
// which npm installs as a symlink to ../packages/core.
//
// The only addition to Expo's defaults: Metro only sees files under the
// project root and the watch folders, and the symlink resolves to
// packages/core, outside mobile/.
//
// Deliberately NOT watched: the repo root. Its node_modules (the web app's
// React 19.2.5, Babel runtime, Howler, ...) therefore doesn't exist for
// Metro. Bare imports from core's files, including the Babel helpers
// added to them, resolve from mobile/node_modules, and a web-only package
// imported from core fails the bundle ("Unable to resolve module howler")
// instead of slipping in. `npm run check:bundle` proves it on every run.
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, '..', 'packages', 'core'),
]

// disableTypeScriptGeneration: otherwise the plugin rewrites tsconfig.json
module.exports = withNativeWind(config, {
  input: './global.css',
  inlineRem: 16,
  disableTypeScriptGeneration: true,
})
