/**
 * @vitest-environment node
 *
 * Unit tests for the server-side first-encounter gate (ticket
 * 86c9q9ben — AC9f, AC9h; updated ticket 86c9qkf3v 2026-05-11).
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
 *   6. The gate covers cvc-words-short-o (infrastructure-ready).
 *      cvc-words-short-u was previously gated but has been REMOVED
 *      (ticket 86c9qkf3v, 2026-05-11) — the scaffolding opener
 *      produced Azure gibberish across three fix iterations. The node
 *      is now treated as non-gated; cvc-words-short-u passes through
 *      to vanilla "You did it!" directly from the re-baked canon.
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
  it('includes cvc-words-short-o (infrastructure-ready)', () => {
    const gated = getFirstEncounterGatedNodes()
    expect(gated).toContain('cvc-words-short-o')
  })

  it('does NOT include cvc-words-short-u (stripped ticket 86c9qkf3v — scaffolding pattern dead)', () => {
    // cvc-words-short-u was removed from the gated set in ticket
    // 86c9qkf3v (2026-05-11). The canon is now re-baked to carry the
    // plain "You did it!" opener, same as every other tier. No gate
    // needed — the canon itself is vanilla.
    const gated = getFirstEncounterGatedNodes()
    expect(gated).not.toContain('cvc-words-short-u')
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
  it('non-gated focus node (cvc-words) → input returned verbatim (same reference)', () => {
    const response = buildResponse({ openerText: 'You did it!' })
    const out = applyFirstEncounterGate(response, {
      focusNode: 'cvc-words',
      lifetimeFirstEncounters: ['cvc-words'],
    })
    expect(out).toBe(response)
  })

  it('cvc-words-short-u is now non-gated → input returned verbatim regardless of lifetimeFirstEncounters', () => {
    // After ticket 86c9qkf3v: short-u no longer has a scaffolding
    // opener in the gate or the planner. The canon carries vanilla
    // "You did it!" directly. The gate is a no-op for this node.
    const response = buildResponse({ openerText: 'You did it!' })
    const out = applyFirstEncounterGate(response, {
      focusNode: 'cvc-words-short-u',
      lifetimeFirstEncounters: ['cvc-words-short-u'],
    })
    // Non-gated → same reference.
    expect(out).toBe(response)
  })

  it('gated focus (cvc-words-short-o) + node NOT in lifetimeFirstEncounters → first encounter, pass through', () => {
    const response = buildResponse({ openerText: 'You did it!' })
    const out = applyFirstEncounterGate(response, {
      focusNode: 'cvc-words-short-o',
      lifetimeFirstEncounters: ['cvc-words'],
    })
    // First encounter: the canon's variant is delivered as-is.
    expect(out).toBe(response)
  })

  it('gated focus (cvc-words-short-o) + empty lifetimeFirstEncounters → first encounter, pass through', () => {
    const response = buildResponse({ openerText: 'You did it!' })
    const out = applyFirstEncounterGate(response, {
      focusNode: 'cvc-words-short-o',
      lifetimeFirstEncounters: [],
    })
    expect(out).toBe(response)
  })

  it('gated focus (cvc-words-short-o) + undefined lifetimeFirstEncounters → first-encounter posture (defensive)', () => {
    // Legacy clients that don't ship the field get the canon variant
    // (first-encounter posture) — safest interpretation per the
    // type doc-comment.
    const response = buildResponse({ openerText: 'You did it!' })
    const out = applyFirstEncounterGate(response, {
      focusNode: 'cvc-words-short-o',
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
      focusNode: 'cvc-words-short-o',
      lifetimeFirstEncounters: ['cvc-words-short-o'],
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
        focusNode: 'cvc-words-short-o',
        lifetimeFirstEncounters: ['cvc-words-short-o'],
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

  it('short-o tier — gate is wired, already-encountered → rewrites opener to vanilla', () => {
    // cvc-words-short-o is in the gated set as infrastructure-ready;
    // its canon today carries the vanilla "You did it!" opener.
    // When already-encountered, the gate fires the rewrite — result
    // is "You did it!" replaced with the cvc-words.json vanilla
    // "You did it!" (same text, possibly slightly different audio
    // bytes). The point is the mechanism fires and does not crash.
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

  it('short-o rewrite preserves other utterances unchanged', () => {
    const response = buildResponse({
      openerText: 'You did it!',
      openerAudioBase64: 'BASE64_SHORT_O_VANILLA_OPENER',
    })
    const out = applyFirstEncounterGate(response, {
      focusNode: 'cvc-words-short-o',
      lifetimeFirstEncounters: ['cvc-words-short-o'],
    })

    const problemRead = out.utterances.find((u) => u.id === 'word.p1.read')!
    const originalProblemRead = response.utterances.find(
      (u) => u.id === 'word.p1.read',
    )!
    // Same content (text + audio) — only the opener was rewritten.
    expect(problemRead).toEqual(originalProblemRead)
  })

  it('short-o rewrite is non-mutating — input response is unchanged', () => {
    const response = buildResponse({
      openerText: 'You did it!',
      openerAudioBase64: 'BASE64_SHORT_O_VANILLA_OPENER',
    })
    const beforeOpener = response.utterances[0]
    applyFirstEncounterGate(response, {
      focusNode: 'cvc-words-short-o',
      lifetimeFirstEncounters: ['cvc-words-short-o'],
    })
    // Input opener unchanged (same reference).
    expect(response.utterances[0]).toBe(beforeOpener)
    expect(response.utterances[0]!.text).toBe('You did it!')
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
