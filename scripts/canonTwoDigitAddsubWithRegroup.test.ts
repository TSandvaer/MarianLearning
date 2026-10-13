/**
 * @vitest-environment node
 *
 * Canon checks ported from `e2e/two-digit-addsub-with-regroup-progression.spec.ts`, test 1 (canon file existence) (React
 * Native Phase 4, `design/native/playwright-spec-sort.md`). They read the
 * committed canon from disk and never needed a browser, so they run here
 * and survive the web front end. The code below is copied from the spec
 * as it was; the comments still describe their Playwright origin.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// ── Canon-file path (the load-bearing failing-first surface) ───────────
//
// Per `api/_canon.ts:148` `canonFileTierFor`:
//   - `'two-digit-addsub-no-regroup'`  → disk `'two-digit-addsub'`
//   - `'two-digit-addsub-with-regroup'` → disk `'two-digit-addsub-with-regroup'`
//     (pass-through; no rebind)
//
// So the expected disk file for the new tier is exactly:
//   public/canon/math/level-1/two-digit-addsub-with-regroup.json
//
// Resolved from `process.cwd()` (Playwright runs from the worktree
// root) per `testing-and-ci.md §4.1.3` rule.
const TWO_DIGIT_ADDSUB_WITH_REGROUP_CANON_PATH = resolve(
  process.cwd(),
  'public/canon/math/level-1/two-digit-addsub-with-regroup.json',
)

describe('two-digit-addsub-with-regroup — Wave 6 progression (failing-first paired with Wave 6C canon-bake) — canon checks', () => {
  // ── Test 1 — RED-on-base canon-existence lever ─────────────────────
  //
  // The load-bearing failing-first assertion. Asserts the
  // `two-digit-addsub-with-regroup.json` canon file exists on disk.
  // Today on `main` (HEAD `b4ebfa7`), this file is absent — only
  // `two-digit-addsub.json` (the `-no-regroup` canon, baked by PR
  // #309) sits in `public/canon/math/level-1/`.
  //
  // Per Kyle's spec §5 (`design/math/two-digit-addsub-with-regroup-
  // content.md` line 516): "No `two-digit-addsub-with-regroup` canon
  // currently exists." This is the empirically-verified state being
  // locked.
  //
  // Failure mode on base is a concrete one-line assertion error:
  //
  //   Error: expect(received).toBe(true)
  //     received: false
  //     Expected the with-regroup canon to exist at
  //     <abs-path>/public/canon/math/level-1/two-digit-addsub-with-
  //     regroup.json. Wave 6C bake has not landed yet.
  //
  // NOT a flake; NOT a timeout. Wave 6C's bake materialises the file
  // and the assertion turns green.
  //
  // Engine-agnostic (no browser interaction); runs on both chromium
  // and webkit projects.
  it('canon file existence — public/canon/math/level-1/two-digit-addsub-with-regroup.json must exist on disk', async () => {
    const exists = existsSync(TWO_DIGIT_ADDSUB_WITH_REGROUP_CANON_PATH)
    expect(
      exists,
      `Expected the with-regroup canon to exist at ` +
        `${TWO_DIGIT_ADDSUB_WITH_REGROUP_CANON_PATH}. Wave 6C bake has ` +
        `not landed yet. Per canonFileTierFor (api/_canon.ts:148), the ` +
        `wire literal 'two-digit-addsub-with-regroup' passes through ` +
        `unchanged to the disk filename. Until this file ships, a runtime ` +
        `request for focusNode=two-digit-addsub-with-regroup hits canon ` +
        `miss → falls through to Haiku (which has no -with-regroup ` +
        `directive on base) OR fails. Wave 6C is the canon-bake PR ` +
        `that creates this file.`,
    ).toBe(true)
  })
})
