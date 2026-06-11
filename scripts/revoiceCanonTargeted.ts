/**
 * TARGETED canon re-render — voice-QA baseline fixes (ticket 86ca7u3gr,
 * GitHub issue #372).
 *
 * Why this exists (vs. revoiceCanon.ts)
 * -------------------------------------
 * `revoiceCanon.ts` re-renders EVERY utterance of EVERY (non-letter-sounds)
 * canon file — the right tool for a whole-voice swap. The voice-QA baseline
 * fix is the opposite: a handful of SSML adjustments that must change ONLY
 * the affected utterances and leave every other byte identical, so Thomas's
 * pass verdicts stay valid and the voice-QA page flags exactly the
 * re-rendered cells as `needs-retest`.
 *
 * What it does
 * ------------
 *   1. Builds the dedup groups across ALL canon files, keyed by
 *      sha256(audio.base64) — the SAME dedup the voice-QA page computes.
 *   2. Expands each fail itemId (FAIL_ITEM_IDS) to its FULL dedup-group
 *      membership: every (file, utteranceId) whose audio hash matches, so a
 *      single flagged streak line re-renders across all 22-ish tier files.
 *   3. Re-renders each member with the PRODUCTION SSML — the same
 *      `renderSessionAudio` the handler uses — with the production
 *      `tierFilter` for the owning file (math → undefined; word-song → file
 *      stem; letter-sounds AND letter-sounds-audit → 'letter-sounds', per
 *      bakeLetterSoundsPinned.ts). All cluster fixes live in api/_tts.ts, so
 *      no per-utterance SSML override is needed here — the script is pure
 *      mechanics.
 *   4. Writes the new audio.base64 back into ONLY the targeted utterances;
 *      every other field (text, structure, untouched utterances' audio) is
 *      preserved byte-for-byte.
 *
 * The TEXT is never touched — this is a voice/SSML re-render, not a re-bake.
 *
 * Run: `npx tsx scripts/revoiceCanonTargeted.ts`
 * Reads `.env.local` for AZURE_SPEECH_KEY / AZURE_SPEECH_REGION.
 *
 * `--dry` prints the expansion plan (dedup members per fail id + the total
 * changed-entry count) WITHOUT calling Azure — used to assemble the PR
 * body's hash-diff inventory before spending render budget.
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSessionAudio } from '../api/_session.js'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CANON_ROOT = join(REPO_ROOT, 'public/canon')

// ── .env.local loader (mirrors revoiceCanon.ts) ─────────────────────────
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

/**
 * The 23 in-scope canon fail itemIds from
 * `design/voice-qa/fails-2026-06-11.json` (greet/hub are VQA-FIX.2, out
 * of scope). Each is a dedup-group CANONICAL id (alphabetically-first
 * member); the script expands every one to its full membership so all
 * tier siblings re-render to the fixed audio.
 */
const FAIL_ITEM_IDS: readonly string[] = [
  // Cluster 1 — "row" homophone (streak lines).
  'add-to-10#session.end.streak.3',
  'add-to-10#session.end.streak.4',
  'add-to-10#session.end.streak.5',
  'add-to-10#session.end.streak.6',
  'add-to-10#session.end.streak.7',
  'add-to-10#session.end.streak.8',
  'letter-sounds#session.end.streak.4', // separate dedup group (had break-before-four)
  // Cluster 3 — "twenty-four" gap.
  'mult-6-9#math.p7.correct',
  'mult-6-9#math.p7.giveAnswer',
  // Cluster 4b — "Four comes after three." emphasis.
  'number-recog#math.p6.hint',
  // Cluster 4a — break-before-four removed on letter-sounds path.
  'letter-sounds#session.end.recap.4',
  // Cluster 2 — break after "This one is X." (fricative + A giveAnswers).
  'letter-sounds#word.p2.giveAnswer', // S
  'letter-sounds#word.p4.giveAnswer', // A (also cluster 5)
  'letter-sounds-audit#word.p1.giveAnswer', // F
  'letter-sounds-audit#word.p2.giveAnswer', // V (also cluster 5)
  'letter-sounds-audit#word.p3.giveAnswer', // H
  // Cluster 5 — scratchy isolated sounds.
  'letter-sounds#word.p4.correct', // A
  'letter-sounds#word.p6.correct', // O (dedup partner p8.correct)
  'letter-sounds-audit#word.p2.read', // V
  'letter-sounds-audit#word.p2.correct', // V
  'letter-sounds-audit#word.p2.hint', // V
  'letter-names#word.p2.hint', // e (letter-names tier)
  'letter-names#word.p5.hint', // O (letter-names tier)
]

interface CanonUtterance {
  id: string
  text: string
  audio: { kind: string; base64: string; mime: string }
}
interface CanonFile {
  ok: boolean
  kind: string
  plan: {
    id: string
    label: string
    utterances: Array<{ id: string; text: string }>
  }
  utterances: CanonUtterance[]
}

/** Recursively list every canon JSON file under public/canon. */
function listCanonFiles(): string[] {
  const out: string[] = []
  function walk(dir: string): void {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.json')) out.push(p)
    }
  }
  walk(CANON_ROOT)
  return out.sort()
}

/** File stem (basename without .json) — the voice-QA itemId discriminant. */
function stemOf(absPath: string): string {
  return absPath
    .split(/[\\/]/)
    .pop()!
    .replace(/\.json$/, '')
}

/**
 * Production tierFilter for a canon file, mirroring the bake scripts:
 *   - math → undefined
 *   - letter-sounds + letter-sounds-audit → 'letter-sounds'
 *     (bakeLetterSoundsPinned.ts renders BOTH with tierFilter:'letter-sounds')
 *   - every other word-song file → the file stem (focus node)
 */
function tierFilterFor(absPath: string): string | undefined {
  if (absPath.includes('/math/') || absPath.includes('\\math\\'))
    return undefined
  const stem = stemOf(absPath)
  if (stem === 'letter-sounds-audit') return 'letter-sounds'
  return stem
}

interface Member {
  absPath: string
  stem: string
  id: string
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry')
  loadEnvLocal()
  if (
    !dryRun &&
    (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION)
  ) {
    console.error(
      'ERROR: AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set (add to .env.local). ' +
        'Run with --dry to preview the plan without rendering.',
    )
    process.exit(1)
  }

  // 1. Load all canon files + build dedup groups keyed by sha256(base64).
  const files = listCanonFiles()
  const fileCache = new Map<string, CanonFile>()
  // canonicalItemId -> Member[] (the dedup group)
  const byHash = new Map<
    string,
    { canonicalItemId: string; members: Member[] }
  >()
  // (stem#id) -> hash, so we can find a fail id's group.
  const hashByItemId = new Map<string, string>()

  for (const absPath of files) {
    const canon = JSON.parse(readFileSync(absPath, 'utf8')) as CanonFile
    fileCache.set(absPath, canon)
    const stem = stemOf(absPath)
    for (const u of canon.utterances ?? []) {
      if (!u.audio?.base64) continue
      const hash = createHash('sha256').update(u.audio.base64).digest('hex')
      const member: Member = { absPath, stem, id: u.id }
      let g = byHash.get(hash)
      if (!g) {
        g = { canonicalItemId: '', members: [] }
        byHash.set(hash, g)
      }
      g.members.push(member)
      hashByItemId.set(`${stem}#${u.id}`, hash)
    }
  }
  // Canonical id = alphabetically-first (stem, id) — matches voice-qa.html.
  for (const g of byHash.values()) {
    g.members.sort((a, b) =>
      a.stem === b.stem
        ? a.id < b.id
          ? -1
          : a.id > b.id
            ? 1
            : 0
        : a.stem < b.stem
          ? -1
          : 1,
    )
    g.canonicalItemId = `${g.members[0]!.stem}#${g.members[0]!.id}`
  }

  // 2. Expand each fail id to its dedup-group members. Dedup the union
  // (a member could appear under two fail ids if their groups overlap —
  // they don't today, but be safe).
  const targets = new Map<string, Member>() // key: stem#id
  const expansionReport: Array<{ failId: string; members: string[] }> = []
  for (const failId of FAIL_ITEM_IDS) {
    const hash = hashByItemId.get(failId)
    if (!hash) {
      console.error(`ERROR: fail id not found in canon: ${failId}`)
      process.exit(1)
    }
    const g = byHash.get(hash)!
    expansionReport.push({
      failId,
      members: g.members.map((m) => `${m.stem}#${m.id}`),
    })
    for (const m of g.members) targets.set(`${m.stem}#${m.id}`, m)
  }

  // Report the expansion plan (always — it IS the hash-diff inventory).
  console.log('=== Targeted re-render plan (dedup expansion) ===')
  for (const { failId, members } of expansionReport) {
    console.log(`\n${failId}  (${members.length} dedup member(s)):`)
    for (const m of members) console.log(`    ${m}`)
  }
  console.log(`\nTOTAL unique changed entries: ${targets.size}`)

  if (dryRun) {
    console.log('\n[--dry] No Azure calls made; no files written.')
    return
  }

  // 3+4. Group targets by file, re-render each target utterance through the
  // production pipeline, write back ONLY those utterances' audio.base64.
  const targetsByFile = new Map<string, Member[]>()
  for (const m of targets.values()) {
    const arr = targetsByFile.get(m.absPath) ?? []
    arr.push(m)
    targetsByFile.set(m.absPath, arr)
  }

  let changed = 0
  for (const [absPath, members] of targetsByFile) {
    const canon = fileCache.get(absPath)!
    const tierFilter = tierFilterFor(absPath)
    const byId = new Map(canon.utterances.map((u) => [u.id, u]))
    // Render each target utterance with its ORIGINAL text + production tier.
    const renderPlan = {
      id: canon.plan.id,
      label: canon.plan.label,
      utterances: members.map((m) => {
        const u = byId.get(m.id)
        if (!u) throw new Error(`utterance missing: ${m.stem}#${m.id}`)
        return { id: u.id, text: u.text }
      }),
    }
    process.stdout.write(
      `revoice ${stemOf(absPath)} (${members.length} utt, tier=${tierFilter ?? 'none'}) ... `,
    )
    const response = await renderSessionAudio(renderPlan, { tierFilter })
    if (response.utterances.length !== renderPlan.utterances.length) {
      throw new Error(
        `partial render: ${response.utterances.length}/${renderPlan.utterances.length} (NOT writing ${stemOf(absPath)})`,
      )
    }
    // Splice the new audio back into the EXACT utterance objects; nothing
    // else in the file is touched.
    for (const rendered of response.utterances) {
      const dest = byId.get(rendered.id)!
      dest.audio = rendered.audio as CanonUtterance['audio']
      changed += 1
    }
    writeFileSync(absPath, JSON.stringify(canon), 'utf8')
    console.log(`ok (${members.length} utt rewritten)`)
  }

  console.log(
    `\nDone. ${changed} utterance(s) re-rendered across ${targetsByFile.size} file(s).`,
  )
  if (changed !== targets.size) {
    console.error(
      `WARNING: changed (${changed}) != planned (${targets.size}) — investigate before commit.`,
    )
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
