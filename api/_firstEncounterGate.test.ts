/**
 * @vitest-environment node
 *
 * Unit tests for the server-side first-encounter gate (ticket
 * 86c9q9ben — AC9f, AC9h).
 *
 * Pin the contract:
 *   1. Non-gated focus nodes pass through unchanged.
 *   2. Gated focus + first encounter (focus NOT in
 *      lifetimeFirstEncounters) → pass through unchanged so the
 *      canon's tier-specific opener variant is delivered.
 *   3. Gated focus + already-encountered (focus IN
 *      lifetimeFirstEncounters) → rewrite session.end.opener to the
 *      vanilla source.
 *   4. Defensive: missing vanilla source → pass through.
 *   5. Defensive: response without session.end.opener → pass through.
 *   6. The gate covers BOTH cvc-words-short-u (real) AND
 *      cvc-words-short-o (infrastructure-ready) — pinned via
 *      `getFirstEncounterGatedNodes`.
 */
import { describe, expect, it, beforeEach } from 'vitest'

import {
  applyFirstEncounterGate,
  getFirstEncounterGatedNodes,
  readVanillaOpener,
  _resetVanillaOpenerCacheForTests,
} from './_firstEncounterGate.js'
import type { SessionStartResponse, Utterance } from './_types.js'

beforeEach(() => {
  _resetVanillaOpenerCacheForTests()
})

/**
 * Build a SessionStartResponse with the specified opener text +
 * audio. Other utterances are minimal — just a single problem so
 * the response shape is valid.
 */
function buildResponse(opts: {
  openerText: string
  openerAudioBase64?: string
}): SessionStartResponse {
  const opener: Utterance = {
    id: 'session.end.opener',
    text: opts.openerText,
    audio: {
      kind: 'inline',
      base64: opts.openerAudioBase64 ?? 'BASE64_TIER_OPENER',
      mime: 'audio/mpeg',
    },
  }
  return {
    ok: true,
    kind: 'session-start',
    plan: { id: 'test-plan', label: 'test', utterances: [{ id: opener.id }] },
    utterances: [
      opener,
      {
        id: 'word.p1.read',
        text: 'Read the cat.',
        audio: {
          kind: 'inline',
          base64: 'BASE64_PROBLEM_AUDIO',
          mime: 'audio/mpeg',
        },
      },
    ],
  }
}

describe('getFirstEncounterGatedNodes', () => {
  it('includes cvc-words-short-u (active), cvc-words-short-i (active, ticket 86c9qdp1q), and cvc-words-short-o (infra-ready)', () => {
    const gated = getFirstEncounterGatedNodes()
    expect(gated).toContain('cvc-words-short-u')
    expect(gated).toContain('cvc-words-short-i')
    expect(gated).toContain('cvc-words-short-o')
  })

  it('does NOT include cvc-words (short-a — vanilla forever, no scaffolding)', () => {
    const gated = getFirstEncounterGatedNodes()
    expect(gated).not.toContain('cvc-words')
  })

  it('does NOT include blending-cv (no first-encounter scaffolding)', () => {
    expect(getFirstEncounterGatedNodes()).not.toContain('blending-cv')
  })

  it('does NOT include any math focus nodes', () => {
    const gated = getFirstEncounterGatedNodes()
    for (const mathNode of [
      'add-to-10',
      'add-to-20',
      'sub-to-10',
      'sub-to-20',
      'two-digit-addsub',
    ]) {
      expect(gated).not.toContain(mathNode)
    }
  })
})

describe('applyFirstEncounterGate — pass-through cases', () => {
  it('non-gated focus node → input returned verbatim (same reference)', () => {
    const response = buildResponse({ openerText: 'You did it!' })
    const out = applyFirstEncounterGate(response, {
      focusNode: 'cvc-words',
      lifetimeFirstEncounters: ['cvc-words'],
    })
    expect(out).toBe(response)
  })

  it('gated focus + node NOT in lifetimeFirstEncounters → first encounter, pass through', () => {
    const response = buildResponse({
      openerText: "You did it! Listen carefully: 'sun' — not 'soon.'",
    })
    const out = applyFirstEncounterGate(response, {
      focusNode: 'cvc-words-short-u',
      lifetimeFirstEncounters: ['cvc-words'],
    })
    // First encounter: the canon's contrast variant is delivered as-is.
    expect(out).toBe(response)
  })

  it('gated focus + empty lifetimeFirstEncounters → first encounter, pass through', () => {
    const response = buildResponse({
      openerText: "You did it! Listen carefully: 'sun' — not 'soon.'",
    })
    const out = applyFirstEncounterGate(response, {
      focusNode: 'cvc-words-short-u',
      lifetimeFirstEncounters: [],
    })
    expect(out).toBe(response)
  })

  it('gated focus + undefined lifetimeFirstEncounters → first-encounter posture (defensive)', () => {
    // Legacy clients that don't ship the field get the contrast
    // line — safest interpretation per the type doc-comment.
    const response = buildResponse({
      openerText: "You did it! Listen carefully: 'sun' — not 'soon.'",
    })
    const out = applyFirstEncounterGate(response, {
      focusNode: 'cvc-words-short-u',
    })
    expect(out).toBe(response)
  })

  it('response without session.end.opener → pass through (defensive)', () => {
    const response: SessionStartResponse = {
      ok: true,
      kind: 'session-start',
      plan: {},
      utterances: [
        {
          id: 'word.p1.read',
          text: 'Read the cat.',
          audio: {
            kind: 'inline',
            base64: 'BASE64_PROBLEM_AUDIO',
            mime: 'audio/mpeg',
          },
        },
      ],
    }
    const out = applyFirstEncounterGate(response, {
      focusNode: 'cvc-words-short-u',
      lifetimeFirstEncounters: ['cvc-words-short-u'],
    })
    expect(out).toBe(response)
  })

  it('vanilla source canon missing → pass through (defensive)', () => {
    // Override canon root to a non-existent path. The gate should
    // notice the missing source and pass through rather than
    // crashing.
    const response = buildResponse({ openerText: 'tier-specific opener' })
    const out = applyFirstEncounterGate(
      response,
      {
        focusNode: 'cvc-words-short-u',
        lifetimeFirstEncounters: ['cvc-words-short-u'],
      },
      '/nonexistent/canon/root',
    )
    expect(out).toBe(response)
  })
})

describe('applyFirstEncounterGate — rewrite cases', () => {
  // These tests use the REAL canon root (the worktree's
  // public/canon/) since cvc-words.json is a committed artifact.
  // The vanilla opener carries text "You did it!" with the audio
  // baked at canon-bake time.

  it('gated focus + node IN lifetimeFirstEncounters → rewrites opener to vanilla', () => {
    const response = buildResponse({
      openerText: "You did it! Listen carefully: 'sun' — not 'soon.'",
      openerAudioBase64: 'BASE64_CONTRAST_LINE_AUDIO',
    })
    const out = applyFirstEncounterGate(response, {
      focusNode: 'cvc-words-short-u',
      lifetimeFirstEncounters: ['cvc-words-short-u'],
    })

    expect(out).not.toBe(response)
    const opener = out.utterances.find((u) => u.id === 'session.end.opener')!
    // Vanilla text from the cvc-words.json source canon.
    expect(opener.text).toBe('You did it!')
    // Audio swapped — base64 is no longer the contrast-line bytes.
    // (We don't assert the exact base64 because the cvc-words.json
    // canon's opener bytes are environment-dependent; we just
    // verify the rewrite happened by confirming the text changed.)
    expect(opener.audio.base64).not.toBe('BASE64_CONTRAST_LINE_AUDIO')
  })

  it('rewrite preserves other utterances unchanged', () => {
    const response = buildResponse({
      openerText: "You did it! Listen carefully: 'sun' — not 'soon.'",
    })
    const out = applyFirstEncounterGate(response, {
      focusNode: 'cvc-words-short-u',
      lifetimeFirstEncounters: ['cvc-words-short-u'],
    })

    const problemRead = out.utterances.find((u) => u.id === 'word.p1.read')!
    const originalProblemRead = response.utterances.find(
      (u) => u.id === 'word.p1.read',
    )!
    // Same content (text + audio) — only the opener was rewritten.
    expect(problemRead).toEqual(originalProblemRead)
  })

  it('rewrite is non-mutating — input response is unchanged', () => {
    const response = buildResponse({
      openerText: "You did it! Listen carefully: 'sun' — not 'soon.'",
      openerAudioBase64: 'BASE64_CONTRAST_LINE_AUDIO',
    })
    const beforeOpener = response.utterances[0]
    applyFirstEncounterGate(response, {
      focusNode: 'cvc-words-short-u',
      lifetimeFirstEncounters: ['cvc-words-short-u'],
    })
    // Input opener unchanged.
    expect(response.utterances[0]).toBe(beforeOpener)
    expect(response.utterances[0]!.text).toBe(
      "You did it! Listen carefully: 'sun' — not 'soon.'",
    )
  })

  it('short-i tier (ticket 86c9qdp1q) — gated focus + already-encountered → rewrites contrast opener to vanilla', () => {
    // Mirror of the short-u rewrite test above. Greenfield ships the
    // contrast line; once `cvc-words-short-i` is in
    // lifetimeFirstEncounters, the gate substitutes the vanilla
    // "You did it!" opener.
    const response = buildResponse({
      openerText: 'Listen. Short i says ih, not ee. Like pig. Listen: pig.',
      openerAudioBase64: 'BASE64_SHORT_I_CONTRAST_LINE_AUDIO',
    })
    const out = applyFirstEncounterGate(response, {
      focusNode: 'cvc-words-short-i',
      lifetimeFirstEncounters: ['cvc-words-short-i'],
    })

    expect(out).not.toBe(response)
    const opener = out.utterances.find((u) => u.id === 'session.end.opener')!
    expect(opener.text).toBe('You did it!')
    expect(opener.audio.base64).not.toBe('BASE64_SHORT_I_CONTRAST_LINE_AUDIO')
  })

  it('short-i tier (ticket 86c9qdp1q) — first encounter (focus NOT in list) → contrast opener delivered as canon ships it', () => {
    // Pin the greenfield path: an empty list (or any list lacking
    // short-i) leaves the canon's contrast variant intact.
    const response = buildResponse({
      openerText: 'Listen. Short i says ih, not ee. Like pig. Listen: pig.',
    })
    const out = applyFirstEncounterGate(response, {
      focusNode: 'cvc-words-short-i',
      lifetimeFirstEncounters: ['cvc-words', 'cvc-words-short-o'],
    })
    // First encounter for short-i: the canon's contrast variant is
    // delivered as-is (same reference).
    expect(out).toBe(response)
  })

  it('short-o tier — gate is wired, but with vanilla canon today the rewrite is functionally a no-op (canon is already vanilla)', () => {
    // cvc-words-short-o is in the gated set as infrastructure-ready;
    // its canon today carries the vanilla "You did it!" opener.
    // When already-encountered, the gate fires the rewrite, but the
    // result is "You did it!" replaced with "You did it!" — same
    // text, possibly slightly different audio bytes (different
    // Azure render). The point is the mechanism fires; the
    // content delta is zero today.
    const response = buildResponse({
      openerText: 'You did it!',
      openerAudioBase64: 'BASE64_SHORT_O_VANILLA_OPENER',
    })
    const out = applyFirstEncounterGate(response, {
      focusNode: 'cvc-words-short-o',
      lifetimeFirstEncounters: ['cvc-words-short-o'],
    })
    // Rewrite fires (response is not the same reference) — proves
    // the gate is wired for short-o.
    expect(out).not.toBe(response)
    const opener = out.utterances.find((u) => u.id === 'session.end.opener')!
    expect(opener.text).toBe('You did it!')
  })
})

describe('readVanillaOpener — direct cache + read', () => {
  it('returns null when the source canon is missing', () => {
    const result = readVanillaOpener('/nonexistent/canon/root')
    expect(result).toBeNull()
  })

  it('reads the vanilla opener from the real cvc-words.json canon', () => {
    const result = readVanillaOpener()
    expect(result).not.toBeNull()
    expect(result!.id).toBe('session.end.opener')
    expect(result!.text).toBe('You did it!')
    expect(result!.audio.kind).toBe('inline')
    expect(typeof result!.audio.base64).toBe('string')
    expect(result!.audio.base64.length).toBeGreaterThan(100)
  })

  it('cache hit: a second read returns the same object without re-parsing', () => {
    const a = readVanillaOpener()
    const b = readVanillaOpener()
    expect(a).toBe(b) // identity match — cache hit
  })

  it('cache invalidates when the canon root changes', () => {
    const real = readVanillaOpener()
    expect(real).not.toBeNull()
    const fake = readVanillaOpener('/nonexistent/canon/root')
    expect(fake).toBeNull()
    // Re-read the real one — cache should rebuild.
    const reReal = readVanillaOpener()
    expect(reReal).not.toBeNull()
    expect(reReal!.text).toBe('You did it!')
  })
})
