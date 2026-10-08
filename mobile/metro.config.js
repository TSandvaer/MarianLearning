// Metro config for the Phase 0 spike.
//
// The spike imports the web app's DOM-free modules UNCHANGED (greet line
// orchestrator, plan parser, distractors, wire types, Emma pose table) from
// the repo's `src/` and `api/` trees instead of copying them. This is the
// Phase 1 `packages/core` idea, done with two watch folders.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const repoRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.join(repoRoot, 'src'),
  path.join(repoRoot, 'api'),
]

// Caveat: the reused files have NO third-party imports today. If one grows
// one, Metro's hierarchical lookup would resolve it from the WEB app's root
// node_modules, not mobile/node_modules. Phase 1 (packages/core with its own
// package.json) removes that ambiguity; the spike just relies on the files
// staying dependency-free.

module.exports = config
