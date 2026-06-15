/**
 * SESSION-END FOCUS-RECAP canon bake — M5, ticket 86c9kmwh0.
 *
 * Why this exists (vs. canon:regen / rebakeThreeHint.ts)
 * -----------------------------------------------------
 * M5 shipped the Session-End focus-recap beat ("You worked on <friendly-name>
 * today!") plus a Thomas-approved GRACEFUL SKIP: the beat self-suppresses
 * because the `session.end.recap.focus` utterance was never baked into the
 * committed canon. This script bakes that one missing utterance into EVERY
 * active canon file so the graceful-skip auto-engages the beat on a real
 * device — no further app-code change (per the M5 dispatch).
 *
 * Like `rebakeThreeHint.ts`, this is an ADDITIVE, byte-preserving splice — NOT
 * a full re-bake:
 *   - A full `canon:regen --force` re-renders all ~1,350 utterances. Azure TTS
 *     is not byte-deterministic across bake runs (see planner-and-canon.md
 *     "Azure TTS renders are NOT byte-deterministic"), so every clip's bytes
 *     would churn and the entire voice-QA baseline would flip to needs-retest.
 *   - This script renders ONLY the one new `session.end.recap.focus` clip per
 *     file and splices it in (right after `session.end.opener`, matching the
 *     planner directive's emission order). Every other utterance is left
 *     byte-for-byte untouched. `verifyRecapFocusBytePreservation.ts` proves it.
 *
 * Per-node vs assembled (architecture decision — see PR body)
 * ----------------------------------------------------------
 * PER-NODE: one clip per canon file, carrying that file's focus-node-specific
 * phrase. Chosen because canon is already keyed per (track, level, focusNode),
 * so each file owns exactly one focus node => exactly one recap clip. An
 * "assembled" approach (TTS-concatenating "You worked on" + node-name +
 * "today") has no runtime audio-stitching layer in this app (Howler plays
 * whole clips), would add gapless-join artifacts, and the friendly names are
 * not single tokens anyway ("taking away to ten", "counting in groups").
 *
 * Deterministic text (no re-planning — byte-preservation + billing)
 * ----------------------------------------------------------------
 * The recap TEXT is derived DETERMINISTICALLY from the session's focus node via
 * `recapFocusLine()` (`scripts/recapFocusCopy.ts`). We do NOT re-run the Haiku
 * planner (that regenerates every text and breaches byte preservation). That
 * copy module MIRRORS the client caption's single-source-of-truth
 * `FRIENDLY_NODE_NAMES` in `src/screens/SessionEnd/friendlyNodeName.ts`, which
 * is itself mirrored by the planner directive's per-node phrase table
 * (`api/_planner.ts` SYSTEM_PREAMBLE, `session.end.recap.focus` bullet). All
 * three MUST stay in sync; the drift-guard test
 * `src/screens/SessionEnd/recapFocusBakeMirror.test.ts` pins the bake-side map
 * === the client map at vitest time so an edit to one side fails CI until the
 * other follows.
 *
 * Why a SEPARATE zero-import copy module rather than importing the client map:
 * importing `friendlyNodeName.ts` drags the `src/lib/progress` barrel
 * (DOM/Vite-typed app code) into the scripts tsconfig (api project, no DOM lib)
 * and breaks `tsc -b`. `rebakeThreeHint.ts` set the precedent of keeping
 * cross-tsconfig constants script-local; `recapFocusCopy.ts` is import-free so
 * BOTH this script and the app-side drift-guard test can read it cleanly.
 *
 * tierFilter coherence with a future full re-bake
 * -----------------------------------------------
 * `generateSessionStartResponse` renders word-song with `tierFilter = the
 * focus node`, math with `tierFilter = undefined`. This script mirrors that so
 * a future `canon:regen --force` would render the recap clip byte-identically.
 * (The recap text triggers NO tier-keyed transform in `_tts.ts` — the global
 * `four`/`row` PHONEME_OVERRIDES don't match it, and the tier-scoped
 * letter-sounds mnemonics never appear in it — so tierFilter is coherence-only,
 * not behaviour-changing. Verified by the text content of the friendly-name
 * map.)
 *
 * Run: `npx tsx scripts/bakeRecapFocus.ts`         (renders + writes)
 *      `npx tsx scripts/bakeRecapFocus.ts --dry`   (prints derived text, NO
 *                                                    Azure calls)
 *      `npx tsx scripts/bakeRecapFocus.ts --only math/add-to-10,word-song/cvc-words`
 * Reads `.env.local` for AZURE_SPEECH_KEY / AZURE_SPEECH_REGION.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSessionAudio } from '../api/_session.js'
import { canonFilePath } from '../api/_canon.js'
import { activeCombos } from './generateSessionCanon.js'
import { recapFocusLine } from './recapFocusCopy.js'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CANON_ROOT = join(REPO_ROOT, 'public/canon')

const RECAP_FOCUS_ID = 'session.end.recap.focus'
const OPENER_ID = 'session.end.opener'

// ── .env.local loader (mirrors rebakeThreeHint.ts) ──────────────────────────
function loadEnvLocal(): void {
  const path = join(REPO_ROOT, '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

// ── canon file shapes (mirror rebakeThreeHint.ts) ───────────────────────────
interface SkeletonUtterance {
  id: string
  text: string
}
interface AudioUtterance {
  id: string
  text: string
  audio: { kind: string; base64: string; mime: string }
}
interface CanonFile {
  ok: boolean
  kind: string
  plan: { id: string; label: string; utterances: SkeletonUtterance[] }
  utterances: AudioUtterance[]
}

/**
 * Word-song renders under `tierFilter = effectiveFocusNode(focusNode)`; for the
 * 13 active word-song combos that is the focus node verbatim (all are in
 * `WORD_SONG_FIRST_CLASS_FOCUS_NODES`). Math renders under `tierFilter =
 * undefined`. Mirrors `generateSessionStartResponse` so the recap clip is
 * byte-coherent with a future full re-bake.
 */
function tierFilterFor(track: string, focusNode: string): string | undefined {
  return track === 'word-song' ? focusNode : undefined
}

/** Insert `entry` immediately AFTER the `session.end.opener` element so the id
 *  order matches the planner directive (opener -> recap.focus -> recap.1...).
 *  Throws if the opener is absent or a recap.focus already exists. */
function spliceAfterOpener<T extends { id: string }>(arr: T[], entry: T): T[] {
  if (arr.some((u) => u.id === RECAP_FOCUS_ID)) {
    throw new Error(`${RECAP_FOCUS_ID} already present — already baked?`)
  }
  const openerIdx = arr.findIndex((u) => u.id === OPENER_ID)
  if (openerIdx < 0) {
    throw new Error(`${OPENER_ID} not found — cannot place ${RECAP_FOCUS_ID}`)
  }
  return [...arr.slice(0, openerIdx + 1), entry, ...arr.slice(openerIdx + 1)]
}

interface TargetFile {
  label: string // "math/add-to-10"
  track: string
  focusNode: string
  path: string
  recapText: string
}

function resolveTargets(argv: readonly string[]): TargetFile[] {
  const onlyEq = argv.find((a) => a.startsWith('--only='))
  let onlyRaw: string | undefined = onlyEq?.slice('--only='.length)
  if (onlyRaw === undefined) {
    const idx = argv.indexOf('--only')
    if (idx >= 0 && idx + 1 < argv.length) onlyRaw = argv[idx + 1]
  }
  const only =
    onlyRaw === undefined
      ? undefined
      : new Set(
          onlyRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        )

  const targets: TargetFile[] = []
  for (const combo of activeCombos()) {
    const label = `${combo.track}/${combo.focusNode}`
    if (only && !only.has(label)) continue
    targets.push({
      label,
      track: combo.track,
      focusNode: combo.focusNode,
      // canonFilePath maps `two-digit-addsub-no-regroup` -> legacy disk file
      // `two-digit-addsub.json` via canonFileTierFor; every other node is the
      // identity. Using it guarantees generator + reader can't disagree.
      path: canonFilePath(CANON_ROOT, {
        track: combo.track,
        level: combo.level,
        focusNode: combo.focusNode,
      }),
      // The recap text is the focus node's child-facing phrase; mirror of the
      // client caption copy (see recapFocusCopy.ts header).
      recapText: recapFocusLine(combo.focusNode),
    })
  }
  if (only) {
    const found = new Set(targets.map((t) => t.label))
    for (const want of only) {
      if (!found.has(want)) {
        throw new Error(
          `--only target "${want}" is not an active combo ` +
            `(expected "<track>/<focusNode>", e.g. "math/add-to-10")`,
        )
      }
    }
  }
  return targets
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry')
  const targets = resolveTargets(process.argv)
  loadEnvLocal()
  if (
    !dryRun &&
    (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION)
  ) {
    console.error(
      'ERROR: AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set (.env.local). ' +
        'Run with --dry to preview derivation without rendering.',
    )
    process.exit(1)
  }

  let baked = 0
  for (const target of targets) {
    if (!existsSync(target.path)) {
      throw new Error(`canon file missing: ${target.path} (${target.label})`)
    }
    const canon = JSON.parse(readFileSync(target.path, 'utf8')) as CanonFile

    console.log(`\n=== ${target.label} ===`)
    console.log(`  ${RECAP_FOCUS_ID}: ${target.recapText}`)

    if (dryRun) {
      // Still exercise the splice-position guards so --dry catches a
      // double-bake / missing-opener before any Azure spend.
      spliceAfterOpener(canon.utterances, {
        id: RECAP_FOCUS_ID,
        text: target.recapText,
        audio: { kind: 'inline', base64: '', mime: 'audio/mpeg' },
      })
      baked++
      continue
    }

    // Render the ONE recap clip through the SAME pipeline the handler uses,
    // with this combo's effective tierFilter (coherence with a full re-bake).
    process.stdout.write(`  rendering 1 recap clip ... `)
    const response = await renderSessionAudio(
      {
        id: canon.plan.id,
        label: canon.plan.label,
        utterances: [{ id: RECAP_FOCUS_ID, text: target.recapText }],
      },
      { tierFilter: tierFilterFor(target.track, target.focusNode) },
    )
    if (response.utterances.length !== 1) {
      throw new Error(
        `partial render: ${response.utterances.length}/1 for ${target.label} (NOT writing)`,
      )
    }
    const rendered = response.utterances[0]!
    if (rendered.id !== RECAP_FOCUS_ID || !rendered.audio) {
      throw new Error(`unexpected render result for ${target.label}`)
    }

    // Splice the same id into BOTH arrays (audio-side carries bytes; the
    // plan.utterances skeleton is text-only), each right after the opener.
    canon.utterances = spliceAfterOpener(canon.utterances, {
      id: RECAP_FOCUS_ID,
      text: rendered.text,
      audio: rendered.audio as AudioUtterance['audio'],
    })
    canon.plan.utterances = spliceAfterOpener(canon.plan.utterances, {
      id: RECAP_FOCUS_ID,
      text: rendered.text,
    })

    // Post-write structural sanity: exactly one recap.focus in each array,
    // placed directly after the opener.
    assertRecapShape(canon)

    writeFileSync(target.path, JSON.stringify(canon), 'utf8')
    baked++
    console.log(`ok`)
  }

  console.log(
    `\nDone. ${dryRun ? '[--dry] would bake' : 'baked'} ${RECAP_FOCUS_ID} ` +
      `into ${baked} canon file(s).`,
  )
}

/** Post-write assertion: each array carries exactly one `session.end.recap.focus`
 *  and it sits immediately after `session.end.opener`. */
function assertRecapShape(canon: CanonFile): void {
  for (const arrName of ['utterances', 'plan.utterances'] as const) {
    const arr =
      arrName === 'utterances' ? canon.utterances : canon.plan.utterances
    const recapIdxs = arr
      .map((u, i) => (u.id === RECAP_FOCUS_ID ? i : -1))
      .filter((i) => i >= 0)
    if (recapIdxs.length !== 1) {
      throw new Error(
        `${arrName}: expected exactly 1 ${RECAP_FOCUS_ID}, found ${recapIdxs.length}`,
      )
    }
    const openerIdx = arr.findIndex((u) => u.id === OPENER_ID)
    if (recapIdxs[0] !== openerIdx + 1) {
      throw new Error(
        `${arrName}: ${RECAP_FOCUS_ID} at index ${recapIdxs[0]} is not directly ` +
          `after ${OPENER_ID} at index ${openerIdx}`,
      )
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
