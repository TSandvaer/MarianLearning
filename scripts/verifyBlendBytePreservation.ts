/**
 * BYTE-PRESERVATION PROOF for the candidate-f blend re-bake.
 *
 * Proves the re-bake changed ONLY the `word.p<N>.blend` clips of the 5 CVC
 * tiers, leaving every OTHER utterance byte-for-byte identical to the committed
 * baseline:
 *   - every PRE-EXISTING NON-blend id (read/correct/reprompt/hint/giveAnswer +
 *     the shared session.end.* family) has base64 audio byte-identical to the
 *     baseline, in BOTH the audio-side `utterances[]` and the `plan.utterances[]`
 *     skeleton;
 *   - every `word.p<N>.blend` clip's base64 CHANGED (the re-bake's whole point);
 *   - no id was added or removed; no blend clip's TEXT changed.
 *
 * The baseline is read straight from a git ref (default origin/main) via
 * `git show`, so the proof is independent of the bake script.
 *
 * Exit 0 + "BYTE-PRESERVATION: PASS" iff every invariant holds; non-zero
 * otherwise. The printed summary is the artifact quoted in the PR body
 * (feedback_canon_state_empirical_verification).
 *
 * Run: `npx tsx scripts/verifyBlendBytePreservation.ts`
 *      `npx tsx scripts/verifyBlendBytePreservation.ts --base <ref>`
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const BLEND_TIERS: readonly string[] = [
  'cvc-words',
  'cvc-words-short-o',
  'cvc-words-short-u',
  'cvc-words-short-i',
  'cvc-words-short-e',
]
const BLEND_ID_RE = /^word\.p[1-8]\.blend$/

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

  let nonBlendChecked = 0
  let nonBlendMismatches = 0
  let blendChanged = 0
  let blendUnchanged = 0
  const failures: string[] = []

  for (const tier of BLEND_TIERS) {
    const rel = `public/canon/word-song/level-1/${tier}.json`
    const abs = join(REPO_ROOT, rel)
    const before = readBaseline(base, rel)
    const after = readWorking(abs)

    const beforeById = new Map(before.utterances.map((u) => [u.id, u]))
    const afterById = new Map(after.utterances.map((u) => [u.id, u]))

    // No id added or removed (audio-side).
    for (const id of beforeById.keys()) {
      if (!afterById.has(id)) failures.push(`${tier}: id ${id} DISAPPEARED`)
    }
    for (const id of afterById.keys()) {
      if (!beforeById.has(id)) failures.push(`${tier}: unexpected new id ${id}`)
    }

    for (const [id, beforeU] of beforeById) {
      const afterU = afterById.get(id)
      if (!afterU) continue // already flagged disappeared
      const b64Before = beforeU.audio?.base64 ?? ''
      const b64After = afterU.audio?.base64 ?? ''
      if (BLEND_ID_RE.test(id)) {
        // Blend TEXT must be unchanged; only the audio bytes move.
        if (beforeU.text !== afterU.text) {
          failures.push(
            `${tier}: blend ${id} TEXT changed (must stay the same)`,
          )
        }
        if (sha(b64Before) === sha(b64After)) {
          failures.push(
            `${tier}: blend ${id} bytes UNCHANGED (re-bake did not take)`,
          )
          blendUnchanged++
        } else {
          blendChanged++
        }
      } else {
        // Every non-blend clip MUST be byte-identical.
        nonBlendChecked++
        if (sha(b64Before) !== sha(b64After)) {
          failures.push(`${tier}: non-blend id ${id} base64 CHANGED`)
          nonBlendMismatches++
        }
      }
    }

    // Skeleton (plan.utterances) carries no blend slot — must be fully identical.
    const skelBefore = JSON.stringify(before.plan.utterances)
    const skelAfter = JSON.stringify(after.plan.utterances)
    if (sha(skelBefore) !== sha(skelAfter)) {
      failures.push(`${tier}: plan.utterances skeleton CHANGED`)
    }
  }

  console.log('=== candidate-f blend re-bake byte-preservation proof ===')
  console.log(`baseline ref:            ${base}`)
  console.log(`tiers:                   ${BLEND_TIERS.length}`)
  console.log(`non-blend clips checked: ${nonBlendChecked}`)
  console.log(`non-blend mismatches:    ${nonBlendMismatches}`)
  console.log(`blend clips re-rendered: ${blendChanged}`)
  console.log(`blend clips unchanged:   ${blendUnchanged}`)
  if (failures.length) {
    console.log(`\nFAILURES (${failures.length}):`)
    for (const f of failures.slice(0, 40)) console.log(`  - ${f}`)
    if (failures.length > 40) console.log(`  ... +${failures.length - 40} more`)
    console.log('\nBYTE-PRESERVATION: FAIL')
    process.exit(1)
  }
  console.log('\nBYTE-PRESERVATION: PASS')
  console.log(
    `(${nonBlendChecked} non-blend clips byte-identical; ` +
      `${blendChanged} blend clips re-rendered across ${BLEND_TIERS.length} tiers)`,
  )
}

main()
