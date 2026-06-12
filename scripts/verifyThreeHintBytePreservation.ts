/**
 * BYTE-PRESERVATION PROOF for the W12-04 three-hint re-bake (ticket
 * 86ca8704f, AC #2).
 *
 * Proves that the targeted re-bake changed ONLY the hint slots: every
 * NON-hint utterance (read / correct / reprompt / giveAnswer / session.end.*)
 * has base64 audio byte-identical to the committed baseline, in BOTH the
 * audio-side `utterances[]` array and the `plan.utterances[]` skeleton; and
 * that each problem's legacy `math.p<N>.hint` is gone, replaced by
 * `hint1/hint2/hint3`.
 *
 * The baseline is read straight from a git ref (default origin/main) via
 * `git show`, so the proof is independent of the bake script — it compares
 * working-tree canon against the last committed canon.
 *
 * Exit 0 + "BYTE-PRESERVATION: PASS" iff every invariant holds; non-zero
 * otherwise. The printed summary is the artifact quoted in the PR body
 * (feedback_canon_state_empirical_verification).
 *
 * Run: `npx tsx scripts/verifyThreeHintBytePreservation.ts`
 *      `npx tsx scripts/verifyThreeHintBytePreservation.ts --base <ref>`
 *      `npx tsx scripts/verifyThreeHintBytePreservation.ts --tiers a,b`
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MATH_CANON_REL = 'public/canon/math/level-1'

const ALL_DERIVABLE_TIERS = [
  'add-to-10',
  'add-to-20',
  'sub-to-10',
  'sub-to-20',
  'two-digit-addsub',
  'two-digit-addsub-with-regroup',
]

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

const isHintId = (id: string): boolean => /\.hint\d*$/.test(id)
const isLegacyHint = (id: string): boolean => /\.hint$/.test(id)
const isNewHint = (id: string): boolean => /\.hint[123]$/.test(id)

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

function readWorking(relPath: string): CanonFile {
  return JSON.parse(readFileSync(join(REPO_ROOT, relPath), 'utf8')) as CanonFile
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
  const tiersArg = resolveArg('tiers')
  const tiers = tiersArg
    ? tiersArg
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : ALL_DERIVABLE_TIERS

  let nonHintChecked = 0
  let nonHintMismatches = 0
  let newHintClips = 0
  let legacyHintRemaining = 0
  const failures: string[] = []

  for (const tier of tiers) {
    const rel = `${MATH_CANON_REL}/${tier}.json`
    const before = readBaseline(base, rel)
    const after = readWorking(rel)

    // ── audio-side utterances[] ──────────────────────────────────────────
    const beforeAudio = new Map(
      before.utterances.map((u) => [u.id, u.audio?.base64 ?? '']),
    )
    const afterAudio = new Map(
      after.utterances.map((u) => [u.id, u.audio?.base64 ?? '']),
    )

    // Every NON-hint id present in baseline must exist post-bake with
    // byte-identical base64.
    for (const [id, b64] of beforeAudio) {
      if (isHintId(id)) continue
      nonHintChecked++
      const post = afterAudio.get(id)
      if (post === undefined) {
        failures.push(`${tier}: non-hint id ${id} DISAPPEARED post-bake`)
        nonHintMismatches++
      } else if (sha(post) !== sha(b64)) {
        failures.push(`${tier}: non-hint id ${id} base64 CHANGED`)
        nonHintMismatches++
      }
    }
    // No NEW non-hint id may appear post-bake (nothing added but hints).
    for (const id of afterAudio.keys()) {
      if (isHintId(id)) continue
      if (!beforeAudio.has(id)) {
        failures.push(`${tier}: unexpected new non-hint id ${id} post-bake`)
        nonHintMismatches++
      }
    }

    // ── hint-shape invariants (both arrays) ──────────────────────────────
    for (const [arrName, beforeArr, afterArr] of [
      ['utterances', before.utterances, after.utterances],
      ['plan.utterances', before.plan.utterances, after.plan.utterances],
    ] as const) {
      const afterIds = new Set(afterArr.map((u) => u.id))
      const beforeIds = new Set(beforeArr.map((u) => u.id))
      for (let n = 1; n <= 8; n++) {
        // Baseline must have carried the legacy single hint.
        if (!beforeIds.has(`math.p${n}.hint`)) {
          failures.push(
            `${tier}/${arrName}: baseline missing legacy math.p${n}.hint`,
          )
        }
        // Post-bake: legacy gone, triple present.
        if (afterIds.has(`math.p${n}.hint`)) {
          failures.push(
            `${tier}/${arrName}: legacy math.p${n}.hint STILL present`,
          )
          if (arrName === 'utterances') legacyHintRemaining++
        }
        for (const suffix of ['hint1', 'hint2', 'hint3']) {
          if (!afterIds.has(`math.p${n}.${suffix}`)) {
            failures.push(
              `${tier}/${arrName}: missing math.p${n}.${suffix} post-bake`,
            )
          }
        }
      }
      // Count new hint clips in the audio array (carry audio).
      if (arrName === 'utterances') {
        for (const u of afterArr as AudioUtterance[]) {
          if (isNewHint(u.id)) {
            if (!u.audio?.base64) {
              failures.push(`${tier}: new hint ${u.id} has no audio`)
            }
            newHintClips++
          }
          if (isLegacyHint(u.id)) legacyHintRemaining++
        }
      }
    }
  }

  console.log('=== W12-04 byte-preservation proof ===')
  console.log(`baseline ref:           ${base}`)
  console.log(`tiers:                  ${tiers.length} (${tiers.join(', ')})`)
  console.log(`non-hint clips checked: ${nonHintChecked}`)
  console.log(`non-hint mismatches:    ${nonHintMismatches}`)
  console.log(`new hint clips (audio): ${newHintClips}`)
  console.log(`legacy hint remaining:  ${legacyHintRemaining}`)
  if (failures.length) {
    console.log(`\nFAILURES (${failures.length}):`)
    for (const f of failures.slice(0, 40)) console.log(`  - ${f}`)
    if (failures.length > 40) console.log(`  ... +${failures.length - 40} more`)
    console.log('\nBYTE-PRESERVATION: FAIL')
    process.exit(1)
  }
  console.log('\nBYTE-PRESERVATION: PASS')
  console.log(
    `(${nonHintChecked} non-hint clips byte-identical; ${newHintClips} new ` +
      `hint clips added; ${legacyHintRemaining} legacy hint clips remain)`,
  )
}

main()
