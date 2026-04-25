/**
 * Build-time integrity guard for the 4 pre-recorded Greet MP3s.
 *
 * Why this lives in tests/qa/ and not in src/lib/audio/__tests__/
 * --------------------------------------------------------------
 * This test exercises shipped assets, not module code. It's a build-time
 * guarantee: if any of the 4 Greet MP3s is missing, sub-1KB, or not a valid
 * MP3 header, the test suite fails — which means CI fails, which means the
 * PR can't merge. The asset path is the production path; we deliberately
 * read the same files Vite/Workbox will precache.
 *
 * Provenance
 * ----------
 * Bundled with ticket 86c9gr43t (GBUG-7). Jessica's QA report on PR #26
 * flagged this as automation candidate #1: a corrupt or missing MP3 used to
 * silently halt the Greet sequence (heart never appeared, Marian stuck). The
 * runtime resilience fix in greetSequence + Greet.tsx handles the
 * recover-and-retry side; this test makes sure shipped MP3s are valid in the
 * first place so the runtime path is the rare exception, not the rule.
 *
 * What we check
 * -------------
 *  1. Each of the 4 expected files exists at public/assets/audio/greet/.
 *  2. Each file is at least 1 KB (sanity check: a "successful" git LFS
 *     pointer or an empty placeholder commit is well under that).
 *  3. Each file is at most 30 KB (current largest is ~18 KB; a runaway
 *     re-encode would surface here before it bloats the precache).
 *  4. The first two bytes form a valid MPEG audio frame sync: 0xFF
 *     followed by one of 0xFB / 0xFA / 0xF3 / 0xF2 (the four Layer III
 *     frame headers we accept — covers MPEG-1 and MPEG-2 Layer III at the
 *     bitrates edge-tts emits).
 *
 * What we deliberately don't check
 * --------------------------------
 * Voice content / duration / sample-rate. Those are out of scope for an
 * integrity guard — Jessica's manual QA covers tone, and the runtime word-
 * tick code reads `howl.duration()` so a wildly off duration would surface
 * as caption drift, not as a silent halt.
 */

import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GREET_LINE_SOURCES } from '../../src/lib/audio/preRecorded'

// Repo root resolved via this test file's own location — survives any
// future test-runner cwd quirk and stays correct on Windows / POSIX.
const __filename = fileURLToPath(import.meta.url)
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..')

const MIN_BYTES = 1024 // 1 KB — sub-this is almost certainly an error/placeholder
const MAX_BYTES = 30 * 1024 // 30 KB — current largest greet MP3 is ~18 KB

/**
 * Resolve a public-relative source URL (the form the browser fetches) to
 * an absolute filesystem path under public/.
 *
 * Greet sources look like '/assets/audio/greet/greet-01-hi.mp3'. We strip
 * the leading slash and join under public/, mirroring how Vite serves them.
 */
function resolvePublicAsset(publicUrl: string): string {
  // Trim the leading '/' so path.join doesn't reset to filesystem root on POSIX.
  const relative = publicUrl.replace(/^\/+/, '')
  return path.join(REPO_ROOT, 'public', relative)
}

/**
 * Parse a buffer's first two bytes against the MPEG audio frame-sync
 * prefix. We accept 0xFF followed by 0xFB / 0xFA / 0xF3 / 0xF2 — the four
 * Layer III variants edge-tts emits at the bitrates we use. We do NOT
 * accept ID3-tagged files (which begin "ID3"); none of our edge-tts output
 * carries an ID3 tag, so the presence of one would mean someone re-encoded
 * the asset through a different pipeline and we want to know.
 */
function isValidMpegLayer3Header(buf: Buffer): boolean {
  if (buf.length < 2) return false
  if (buf[0] !== 0xff) return false
  const second = buf[1]
  return (
    second === 0xfb || second === 0xfa || second === 0xf3 || second === 0xf2
  )
}

describe('Greet MP3 asset integrity (build-time guard)', () => {
  // Source-of-truth iteration: drive the test from preRecorded.ts's
  // exported map so a future line addition / rename automatically extends
  // coverage without anyone remembering to update this test.
  const entries = Object.entries(GREET_LINE_SOURCES) as Array<[string, string]>

  it('covers exactly the 4 pre-recorded Greet lines', () => {
    expect(entries).toHaveLength(4)
  })

  for (const [key, publicUrl] of entries) {
    describe(`${key} (${publicUrl})`, () => {
      const filePath = resolvePublicAsset(publicUrl)

      it('exists on disk under public/', () => {
        expect(() => statSync(filePath)).not.toThrow()
      })

      it(`is between ${MIN_BYTES} and ${MAX_BYTES} bytes`, () => {
        const stats = statSync(filePath)
        expect(stats.size).toBeGreaterThanOrEqual(MIN_BYTES)
        expect(stats.size).toBeLessThanOrEqual(MAX_BYTES)
      })

      it('starts with a valid MPEG Layer III frame-sync header (0xFF 0xFB|FA|F3|F2)', () => {
        const buf = readFileSync(filePath)
        expect(isValidMpegLayer3Header(buf)).toBe(true)
      })
    })
  }
})
