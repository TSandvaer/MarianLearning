#!/usr/bin/env node
/**
 * Rewrite letter-sounds canon TEXT to the Lily wording (voice migration 3/6,
 * ClickUp 123jpnbc33g; ear-tested 2026-10-04, round 4: simplified won 15/15).
 *
 *   read        "Which letter says <m>?"
 *   hint        "It says <m>."            (O: "Hear this sound: ooo.")
 *   correct     "Yes. <L> says <m>."        (R: "Yes! R says <m>!")
 *   giveAnswer  "This one is <L>. <L> says <m>."
 *   U/I anchor  kept on correct + giveAnswer ("…, like in cup."), dropped on
 *               read + hint (read plain won; hint inferred, not ear-tested).
 *
 * Deterministic: derives <L> from the giveAnswer line and <m> from the read
 * line of each problem, rewrites both `plan.utterances` and `utterances`,
 * and touches nothing else. AUDIO IS NOT RE-RENDERED HERE — the changed
 * lines must be re-voiced (4/6) before any release, or captions and audio
 * disagree. Prints every change; `--check` exits 1 if anything would change.
 *
 * Usage: node scripts/rewriteLetterSoundsWording.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const FILES = ['letter-sounds.json', 'letter-sounds-audit.json'].map((f) =>
  join('public/canon/word-song/level-1', f),
)
const READ = /^Which letter says ([a-z]+)(?:, like in ([a-z]+))?[.?]$/i
const GIVE = /^This one is ([A-Z])\./

export function lilyWording(letter, mnem, anchor) {
  const tail = anchor ? `${mnem}, like in ${anchor}` : mnem
  return {
    read: `Which letter says ${mnem}?`,
    // O only: "It says ooo." rendered as /a/ in three voice-QA attempts;
    // "Hear this sound: ooo." won the round-6 ear-test (2026-10-04).
    hint: mnem === 'ooo' ? `Hear this sound: ${mnem}.` : `It says ${mnem}.`,
    correct:
      letter === 'R' ? `Yes! R says ${tail}!` : `Yes. ${letter} says ${tail}.`,
    giveAnswer: `This one is ${letter}. ${letter} says ${tail}.`,
  }
}

function rewrite(doc) {
  const changes = []
  const lists = [doc.utterances, doc.plan?.utterances].filter(Array.isArray)
  const byId = new Map(doc.utterances.map((u) => [u.id, u.text]))
  const problems = new Set(
    doc.utterances
      .map((u) => u.id.match(/^word\.(p\d+)\./)?.[1])
      .filter(Boolean),
  )
  for (const p of problems) {
    const read = byId.get(`word.${p}.read`)?.match(READ)
    const give = byId.get(`word.${p}.giveAnswer`)?.match(GIVE)
    if (!read || !give)
      throw new Error(`${p}: unrecognised read/giveAnswer shape`)
    // The anchor lives on the read line in the old wording and only on
    // correct/giveAnswer in the new one — read both so a re-run is a no-op.
    const anchor =
      read[2] ??
      byId.get(`word.${p}.giveAnswer`)?.match(/, like in ([a-z]+)\.$/i)?.[1]
    const next = lilyWording(give[1], read[1].toLowerCase(), anchor)
    for (const list of lists) {
      for (const u of list) {
        const slot = u.id.match(
          new RegExp(`^word\\.${p}\\.(read|hint|correct|giveAnswer)$`),
        )?.[1]
        if (slot && u.text !== next[slot]) {
          if (list === doc.utterances)
            changes.push(`${u.id}: "${u.text}" -> "${next[slot]}"`)
          u.text = next[slot]
        }
      }
    }
  }
  return changes
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check')
  let total = 0
  for (const f of FILES) {
    const doc = JSON.parse(readFileSync(f, 'utf8'))
    const changes = rewrite(doc)
    total += changes.length
    console.log(`${f}: ${changes.length} line(s)`)
    for (const c of changes) console.log(`  ${c}`)
    if (!check && changes.length) writeFileSync(f, JSON.stringify(doc))
  }
  if (check && total) process.exit(1)
}
