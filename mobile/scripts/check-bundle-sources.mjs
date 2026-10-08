#!/usr/bin/env node
/**
 * Proof that the native bundle takes nothing from the web app's
 * dependency tree.
 *
 *   npm run check:bundle            (from mobile/; add `-- --clear` to
 *                                    bypass Metro's cache)
 *
 * Exports the iOS bundle with a source map, then classifies every module
 * in it. Source-map paths are relative to mobile/, so a module that Metro
 * resolved from the repo root's node_modules (the web app's React,
 * Babel runtime, ...) shows up as `/../node_modules/...`.
 *
 * Fails when:
 *   - any module comes from outside mobile/ other than @marian/core's
 *     sources (`/../packages/core/src/...`);
 *   - more than one copy of `react` is bundled;
 *   - no @marian/core module is bundled (the wiring broke).
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'marian-bundle-check-'))

const args = [
  'expo',
  'export',
  '--platform',
  'ios',
  '--output-dir',
  outDir,
  '--no-bytecode',
  '--source-maps',
  ...(process.argv.includes('--clear') ? ['--clear'] : []),
]
const run = spawnSync('npx', args, { cwd: mobileRoot, encoding: 'utf8' })
if (run.status !== 0) {
  console.error(run.stdout, run.stderr)
  console.error(`expo export failed (exit ${run.status})`)
  process.exit(1)
}

const jsDir = join(outDir, '_expo', 'static', 'js', 'ios')
const mapFile = readdirSync(jsDir).find((f) => f.endsWith('.js.map'))
if (!mapFile) {
  console.error(`no source map in ${jsDir}`)
  process.exit(1)
}
const { sources } = JSON.parse(readFileSync(join(jsDir, mapFile), 'utf8'))
rmSync(outDir, { recursive: true, force: true })

const isFile = (p) => p.startsWith('/')
const fromCore = sources.filter((p) => p.startsWith('/../packages/core/src/'))
const foreign = sources.filter(
  (p) => p.startsWith('/../') && !p.startsWith('/../packages/core/src/'),
)
const ownNodeModules = sources.filter((p) => p.startsWith('/node_modules/'))
const app = sources.filter(
  (p) => isFile(p) && !p.startsWith('/../') && !p.startsWith('/node_modules/'),
)
const reactCopies = [
  ...new Set(
    sources
      .map((p) => p.match(/^(.*\/node_modules\/react)\/(?:index|cjs\/)/)?.[1])
      .filter(Boolean),
  ),
]

console.log(`bundle modules:              ${sources.length}`)
console.log(`  mobile/node_modules:       ${ownNodeModules.length}`)
console.log(`  mobile app + assets:       ${app.length}`)
console.log(`  @marian/core sources:      ${fromCore.length}`)
console.log(`  anything else outside:     ${foreign.length}`)
console.log(`react copies:                ${reactCopies.join(', ') || 'none'}`)

const failures = []
if (foreign.length > 0) {
  failures.push(
    `modules resolved from outside mobile/:\n  ${foreign.join('\n  ')}`,
  )
}
if (reactCopies.length !== 1) {
  failures.push(`expected exactly one react, found ${reactCopies.length}`)
}
if (fromCore.length === 0) failures.push('no @marian/core module bundled')

if (failures.length > 0) {
  console.error(`\nFAIL\n${failures.join('\n')}`)
  process.exit(1)
}
console.log('\nOK: nothing bundled from the web app’s dependency tree')
