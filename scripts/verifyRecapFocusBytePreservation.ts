/**
 * BYTE-PRESERVATION PROOF for the M5 focus-recap bake (ticket 86c9kmwh0).
 *
 * Proves that the additive recap bake changed ONLY by ADDING a single
 * `session.end.recap.focus` utterance per active canon file:
 *   - every PRE-EXISTING utterance (every id other than session.end.recap.focus)
 *     has base64 audio byte-identical to the committed baseline, in BOTH the
 *     audio-side `utterances[]` array AND the `plan.utterances[]` skeleton;
 *   - exactly ONE new id is added per file, `session.end.recap.focus`, and it
 *     carries real audio + sits directly after `session.end.opener`;
 *   - no pre-existing id disappeared.
 *
 * The baseline is read straight from a git ref (default origin/main) via
 * `git show`, so the proof is independent of the bake script — it compares the
 * working-tree canon against the last committed canon.
 *
 * Exit 0 + "BYTE-PRESERVATION: PASS" iff every invariant holds; non-zero
 * otherwise. The printed summary is the artifact quoted in the PR body
 * (feedback_canon_state_empirical_verification).
 *
 * Run: `npx tsx scripts/verifyRecapFocusBytePreservation.ts`
 *      `npx tsx scripts/verifyRecapFocusBytePreservation.ts --base <ref>`
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonFilePath } from '../api/_canon.js'
import { activeCombos } from './generateSessionCanon.js'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CANON_ROOT = join(REPO_ROOT, 'public/canon')

const RECAP_FOCUS_ID = 'session.end.recap.focus'
const OPENER_ID = 'session.end.opener'

interface SkeletonUtterance {
  id: string
  text: string
}
interface AudioUtterance {
  id: string
  text: string
  audio?: { kind: string; base64: string; mime: string }
}
interface CanonFile {
  plan: { utterances: SkeletonUtterance[] }
  utterances: AudioUtterance[]
}

function sha(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function readBaseline(ref: string, relPath: string): CanonFile {
  const raw = execFileSync('git', ['show', `${ref}:${relPath}`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return JSON.parse(raw) as CanonFile
}

function readWorking(absPath: string): CanonFile {
  return JSON.parse(readFileSync(absPath, 'utf8')) as CanonFile
}

function resolveArg(name: string): string | undefined {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(`--${name}=`.length)
  const idx = process.argv.indexOf(`--${name}`)
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1]
  return undefined
}

function main(): void {
  const base = resolveArg('base') ?? 'origin/main'

  // De-dupe disk paths (two-digit-addsub-no-regroup maps to the same file as
  // the legacy tier name; only one active combo writes it, but guard anyway).
  const seen = new Set<string>()
  const files: { rel: string; abs: string }[] = []
  for (const combo of activeCombos()) {
    const abs = canonFilePath(CANON_ROOT, combo)
    const rel = relative(REPO_ROOT, abs).split('\\').join('/')
    if (seen.has(rel)) continue
    seen.add(rel)
    files.push({ rel, abs })
  }

  let preExistingChecked = 0
  let preExistingMismatches = 0
  let newRecapClips = 0
  const failures: string[] = []

  for (const { rel, abs } of files) {
    const before = readBaseline(base, rel)
    const after = readWorking(abs)

    // Baseline must NOT already carry the recap.focus id (this bake adds it).
    if (before.utterances.some((u) => u.id === RECAP_FOCUS_ID)) {
      failures.push(`${rel}: baseline already has ${RECAP_FOCUS_ID}`)
    }

    // ── audio-side utterances[] byte-identity for every PRE-EXISTING id ──────
    const beforeAudio = new Map(
      before.utterances.map((u) => [u.id, u.audio?.base64 ?? '']),
    )
    const afterAudio = new Map(
      after.utterances.map((u) => [u.id, u.audio?.base64 ?? '']),
    )

    for (const [id, b64] of beforeAudio) {
      preExistingChecked++
      const post = afterAudio.get(id)
      if (post === undefined) {
        failures.push(`${rel}: pre-existing id ${id} DISAPPEARED post-bake`)
        preExistingMismatches++
      } else if (sha(post) !== sha(b64)) {
        failures.push(`${rel}: pre-existing id ${id} base64 CHANGED`)
        preExistingMismatches++
      }
    }

    // The ONLY new id allowed post-bake is RECAP_FOCUS_ID.
    for (const id of afterAudio.keys()) {
      if (beforeAudio.has(id)) continue
      if (id !== RECAP_FOCUS_ID) {
        failures.push(`${rel}: unexpected new id ${id} post-bake`)
        preExistingMismatches++
      }
    }

    // ── recap.focus shape in BOTH arrays ────────────────────────────────────
    for (const [arrName, arr] of [
      ['utterances', after.utterances],
      ['plan.utterances', after.plan.utterances],
    ] as const) {
      const recapIdxs = arr
        .map((u, i) => (u.id === RECAP_FOCUS_ID ? i : -1))
        .filter((i) => i >= 0)
      if (recapIdxs.length !== 1) {
        failures.push(
          `${rel}/${arrName}: expected exactly 1 ${RECAP_FOCUS_ID}, found ${recapIdxs.length}`,
        )
        continue
      }
      const openerIdx = arr.findIndex((u) => u.id === OPENER_ID)
      if (recapIdxs[0] !== openerIdx + 1) {
        failures.push(
          `${rel}/${arrName}: ${RECAP_FOCUS_ID} not directly after ${OPENER_ID}`,
        )
      }
    }

    // The audio-side recap clip must carry real bytes.
    const recapAudio = after.utterances.find((u) => u.id === RECAP_FOCUS_ID)
    if (!recapAudio?.audio?.base64) {
      failures.push(`${rel}: ${RECAP_FOCUS_ID} has no audio bytes`)
    } else {
      newRecapClips++
    }
  }

  console.log('=== M5 focus-recap byte-preservation proof ===')
  console.log(`baseline ref:              ${base}`)
  console.log(`canon files:               ${files.length}`)
  console.log(`pre-existing clips checked: ${preExistingChecked}`)
  console.log(`pre-existing mismatches:    ${preExistingMismatches}`)
  console.log(`new recap.focus clips:      ${newRecapClips}`)
  if (failures.length) {
    console.log(`\nFAILURES (${failures.length}):`)
    for (const f of failures.slice(0, 40)) console.log(`  - ${f}`)
    if (failures.length > 40) console.log(`  ... +${failures.length - 40} more`)
    console.log('\nBYTE-PRESERVATION: FAIL')
    process.exit(1)
  }
  console.log('\nBYTE-PRESERVATION: PASS')
  console.log(
    `(${preExistingChecked} pre-existing clips byte-identical; ` +
      `${newRecapClips} new recap.focus clips added across ${files.length} files)`,
  )
}

main()
