/**
 * Drift-guard for the M5 focus-recap bake copy (ticket 86c9kmwh0).
 *
 * The bake script's copy lives in `scripts/recapFocusCopy.ts` as a zero-import
 * MIRROR of this directory's `FRIENDLY_NODE_NAMES` (client caption copy) —
 * mirrored rather than imported because importing app code into the scripts
 * tsconfig breaks `tsc -b` (see `recapFocusCopy.ts` header). This test is the
 * tripwire that keeps the two in lockstep: it lives under the APP tsconfig
 * (DOM-typed, can import the client map) and reads the script's zero-import
 * copy module, so any edit to one side that isn't mirrored fails here.
 *
 * It lives next to `friendlyNodeName.ts` (the source of truth) so a future
 * edit to the client map sees this guard in the same directory.
 */
import { describe, expect, it } from 'vitest'

import {
  FRIENDLY_NODE_NAMES as CLIENT_MAP,
  focusRecapLine as clientRecapLine,
  FRIENDLY_NODE_NAME_FALLBACK as CLIENT_FALLBACK,
} from './friendlyNodeName'
import {
  RECAP_FRIENDLY_NODE_NAMES as BAKE_MAP,
  recapFocusLine as bakeRecapLine,
  RECAP_FRIENDLY_NODE_NAME_FALLBACK as BAKE_FALLBACK,
} from '../../../scripts/recapFocusCopy'

describe('recap-focus bake-copy mirror', () => {
  it('the two maps are key-for-key, value-for-value identical', () => {
    // Sorted-key deep-equality in BOTH directions — catches a missing key, an
    // extra key, or a diverged phrase on either side.
    expect(BAKE_MAP).toEqual(CLIENT_MAP)
  })

  it('the fallback phrase matches the client fallback', () => {
    expect(BAKE_FALLBACK).toBe(CLIENT_FALLBACK)
  })

  it('the composed recap line is identical across bake and client', () => {
    for (const node of Object.keys(CLIENT_MAP)) {
      expect(bakeRecapLine(node)).toBe(clientRecapLine(node))
    }
  })

  it('every recap line is ASCII-7, digit-free, exactly one "!" (planner-coherent)', () => {
    // Canon-lint rejects non-ASCII; the planner directive constrains the spoken
    // recap to "never use digits; one exclamation mark". Pin both here so a
    // future phrase edit can't ship a digit or extra "!" past the bake.
    for (const node of Object.keys(BAKE_MAP)) {
      const line = bakeRecapLine(node)
      // eslint-disable-next-line no-control-regex
      expect(line, `non-ASCII in "${line}"`).toMatch(/^[\x00-\x7F]*$/)
      expect(line, `digit in "${line}"`).not.toMatch(/[0-9]/)
      expect(
        (line.match(/!/g) ?? []).length,
        `exclamation count in "${line}"`,
      ).toBe(1)
    }
  })
})
