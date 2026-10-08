#!/usr/bin/env node
/**
 * Trim a captured `/api/claude` session-start response down to a small
 * iteration fixture: the FULL plan (text only — `mathSessionPlanFromServer`
 * needs all 8 problems) plus the inline MP3s for problem 1 only.
 *
 * Usage: node mobile/scripts/trim-fixture.mjs <captured.json> <out.json>
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [input, output] = process.argv.slice(2)
if (!input || !output) {
  console.error('usage: trim-fixture.mjs <captured.json> <out.json>')
  process.exit(1)
}
const res = JSON.parse(readFileSync(input, 'utf8'))
const kept = res.utterances.filter((u) => u.id.startsWith('math.p1.'))
const trimmed = { ...res, utterances: kept }
writeFileSync(output, JSON.stringify(trimmed))
console.log(
  `kept ${kept.length}/${res.utterances.length} utterances: ${kept.map((u) => u.id).join(', ')}`,
)
