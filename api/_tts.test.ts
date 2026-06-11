/**
 * @vitest-environment node
 *
 * Server-only module — runs in Node, never in jsdom.
 *
 * Covers the Azure Speech REST swap (ticket 86c9gvgjk). The prior WSS-
 * shaped tests (Sec-MS-GEC, binary-frame parsing, fake-WebSocket fan-out)
 * were retired with the transport layer; what remains is the testable
 * surface of the new pipeline:
 *   - SSML body construction (voice/lang/prosody/escape)
 *   - env-var validation (key + region must be set)
 *   - endpoint URL construction
 *   - fetch happy path (correct method, headers, body, status handling)
 *   - error mapping (401 / 429 / 5xx / generic non-2xx)
 *   - timeout path
 *   - base64 round-trip
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyPhonemeOverrides,
  buildAzureEndpoint,
  buildSsmlBody,
  computeBackoffDelayMs,
  describeAzureFailure,
  escapeSsml,
  fetchWithBackoff,
  parseRetryAfterMs,
  readAzureCredentials,
  renderFourSubjectHint,
  renderLetterNamesScratchyHint,
  renderSightWordsInnerText,
  renderLetterSoundsInnerText,
  renderSsmlInnerText,
  synthesizeUtterance,
  uint8ToBase64,
} from './_tts.js'

describe('escapeSsml', () => {
  it('escapes the five XML metacharacters', () => {
    expect(escapeSsml(`<a href="x">o'rly?</a> & more`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;o&apos;rly?&lt;/a&gt; &amp; more',
    )
  })

  it('passes through plain text untouched', () => {
    expect(escapeSsml('Hello Marian!')).toBe('Hello Marian!')
  })
})

describe('buildAzureEndpoint', () => {
  it('builds the per-region cognitiveservices/v1 URL', () => {
    expect(buildAzureEndpoint('westeurope')).toBe(
      'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1',
    )
    expect(buildAzureEndpoint('eastus')).toBe(
      'https://eastus.tts.speech.microsoft.com/cognitiveservices/v1',
    )
  })
})

describe('readAzureCredentials', () => {
  it('returns key + region when both are set', () => {
    const env = {
      AZURE_SPEECH_KEY: 'test-key',
      AZURE_SPEECH_REGION: 'westeurope',
    } as NodeJS.ProcessEnv
    expect(readAzureCredentials(env)).toEqual({
      key: 'test-key',
      region: 'westeurope',
    })
  })

  it('throws a clear error when AZURE_SPEECH_KEY is missing', () => {
    const env = {
      AZURE_SPEECH_REGION: 'westeurope',
    } as NodeJS.ProcessEnv
    expect(() => readAzureCredentials(env)).toThrow(/AZURE_SPEECH_KEY/)
  })

  it('throws a clear error when AZURE_SPEECH_REGION is missing', () => {
    const env = {
      AZURE_SPEECH_KEY: 'test-key',
    } as NodeJS.ProcessEnv
    expect(() => readAzureCredentials(env)).toThrow(/AZURE_SPEECH_REGION/)
  })

  it('throws when AZURE_SPEECH_KEY is the empty string (not just undefined)', () => {
    const env = {
      AZURE_SPEECH_KEY: '',
      AZURE_SPEECH_REGION: 'westeurope',
    } as NodeJS.ProcessEnv
    expect(() => readAzureCredentials(env)).toThrow(/AZURE_SPEECH_KEY/)
  })
})

describe('buildSsmlBody', () => {
  const baseReq = {
    text: 'Hello Marian!',
    voice: 'en-US-EmmaMultilingualNeural',
    rate: '-10%',
    pitch: '+0Hz',
    volume: '+0%',
  }

  it('wraps text in <speak><voice><prosody> with xml:lang="en-US"', () => {
    const body = buildSsmlBody(baseReq)
    expect(body).toContain('xml:lang="en-US"')
    expect(body).toContain(
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"',
    )
    expect(body).toContain('<voice name="en-US-EmmaMultilingualNeural">')
    expect(body).toContain('<prosody pitch="+0Hz" rate="-10%" volume="+0%">')
    expect(body).toContain('Hello Marian!')
    expect(body).toMatch(/<\/prosody><\/voice><\/speak>$/)
  })

  it('XML-escapes the text payload (defense against SSML injection)', () => {
    // Use a declarative payload so this test pins escape behavior
    // independently of the trailing-interrogative prosody wrap (covered
    // separately under renderSsmlInnerText / buildSsmlBody-prosody tests).
    const body = buildSsmlBody({
      ...baseReq,
      text: `What's <2+2>.`,
    })
    expect(body).toContain('What&apos;s &lt;2+2&gt;.')
    expect(body).not.toContain("What's <2+2>.")
  })

  it('XML-escapes voice/rate/pitch/volume attribute values (defense-in-depth)', () => {
    // Future caller might pass user-derived prosody values into a double-
    // quoted attribute slot; escapeSsml on those four fields blocks
    // attribute injection. None of the metacharacters reach the wire raw.
    const body = buildSsmlBody({
      text: 'x',
      voice: `evil" onerror="`,
      rate: `<rate>`,
      pitch: `&pitch;`,
      volume: `'vol'`,
    })
    expect(body).toContain('voice name="evil&quot; onerror=&quot;"')
    expect(body).toContain('rate="&lt;rate&gt;"')
    expect(body).toContain('pitch="&amp;pitch;"')
    expect(body).toContain(`volume="&apos;vol&apos;"`)
    // Raw double-quote inside the voice attribute would close it early —
    // verify it's gone after escaping.
    expect(body).not.toContain(`voice name="evil" onerror=""`)
  })
})

describe('renderSsmlInnerText (interrogative prosody hint, ticket 86c9gxup4)', () => {
  // Background: en-US-AnaNeural's prosody predictor sometimes fails to flip
  // into question intonation on short trailing interrogatives ("How many
  // now?" after a numeric clause). A <break>+<prosody> wrapper resets the
  // predictor and forces rising pitch on the trailing clause.

  it('passes declarative text through unchanged (no break/prosody wrap)', () => {
    expect(renderSsmlInnerText('Hello Marian!')).toBe('Hello Marian!')
    expect(renderSsmlInnerText('This one is five.')).toBe('This one is five.')
    expect(renderSsmlInnerText('Yes! Five!')).toBe('Yes! Five!')
  })

  it('still XML-escapes declarative text', () => {
    expect(renderSsmlInnerText(`A & B < C.`)).toBe('A &amp; B &lt; C.')
  })

  it('wraps the trailing clause of the Math hint in <break>+<prosody>', () => {
    // The exact utterance from sessionPlans.ts that the ticket targets.
    // "two" is NOT wrapped — Thomas's iPad listening pass on PR #115
    // showed the en-US-EmmaMultilingualNeural voice does not honour
    // /tuː/ for the cardinal "two" the same way it honours /fɔːr/ for
    // "four". The "two" override is parked for a follow-up ticket;
    // here "two" passes through plain. "How many now?" still gets the
    // trailing-clause prosody hint from 86c9gxup4.
    expect(
      renderSsmlInnerText('Look. Three. And two more. How many now?'),
    ).toBe(
      'Look. Three. And two more. <break time="250ms"/><prosody pitch="+8%" rate="-5%">How many now?</prosody>',
    )
  })

  it('wraps the whole text when it is one short interrogative with no internal boundary', () => {
    expect(renderSsmlInnerText('How many?')).toBe(
      '<break time="250ms"/><prosody pitch="+8%" rate="-5%">How many?</prosody>',
    )
  })

  it('XML-escapes both the leading portion and the wrapped clause', () => {
    expect(renderSsmlInnerText(`A & B. What's left?`)).toBe(
      `A &amp; B. <break time="250ms"/><prosody pitch="+8%" rate="-5%">What&apos;s left?</prosody>`,
    )
  })

  it('does not match a final-punctuation+whitespace inside the trailing clause itself', () => {
    // Defensive case: only one sentence boundary exists, and it sits
    // immediately before the trailing clause. No false-positive split.
    expect(renderSsmlInnerText('Ready. Go now?')).toBe(
      'Ready. <break time="250ms"/><prosody pitch="+8%" rate="-5%">Go now?</prosody>',
    )
  })

  it('treats `!` and `.` endings as declarative even after question-shaped phrasing', () => {
    expect(renderSsmlInnerText('How many now.')).toBe('How many now.')
    expect(renderSsmlInnerText('How many now!')).toBe('How many now!')
  })

  it('handles the read utterance ("X plus Y. How many?") correctly', () => {
    // "two" is currently NOT in the override table (parked for a
    // follow-up to 86c9kj2um; the voice didn't honour /tuː/ in
    // listening tests). "How many?" still picks up the question-
    // prosody hint.
    expect(renderSsmlInnerText('Three plus two. How many?')).toBe(
      'Three plus two. <break time="250ms"/><prosody pitch="+8%" rate="-5%">How many?</prosody>',
    )
  })

  it('wraps the read utterance with "four" in the trailing clause', () => {
    // Same shape as the "two" case above but with "four" — which IS
    // in the override table. Pin that the trailing-question prosody
    // wrap composes correctly with the phoneme injection.
    expect(renderSsmlInnerText('Three plus four. How many?')).toBe(
      'Three plus <phoneme alphabet="ipa" ph="fɔːr">four</phoneme>. <break time="250ms"/><prosody pitch="+8%" rate="-5%">How many?</prosody>',
    )
  })
})

describe('applyPhonemeOverrides (ticket 86c9kj2um)', () => {
  // Background: en-US-EmmaMultilingualNeural's neural prosody predictor
  // maps "four" to the unstressed homophone "for" /fɚ/ on iPad. PR #114
  // tried a carrier-prefix workaround (Option B) and it failed in
  // production listening — Thomas confirmed "four" still sounded wrong
  // AND the leading "Okay." was annoying. This is the pivot to an
  // explicit IPA `<phoneme>` override (Option C).

  it('passes plain text through unchanged when no override matches (with XML escape)', () => {
    expect(applyPhonemeOverrides('Hello Marian!')).toBe('Hello Marian!')
    expect(applyPhonemeOverrides('A & B < C.')).toBe('A &amp; B &lt; C.')
  })

  it('wraps "four" in <phoneme alphabet="ipa" ph="fɔːr">', () => {
    expect(applyPhonemeOverrides('I want four apples.')).toBe(
      'I want <phoneme alphabet="ipa" ph="fɔːr">four</phoneme> apples.',
    )
  })

  it('passes "two" through unchanged (override parked for follow-up; voice did not honour /tuː/)', () => {
    // Listening test on PR #115 showed Azure's
    // en-US-EmmaMultilingualNeural voice did NOT honour /tuː/ for
    // "two" the way it honoured /fɔːr/ for "four". "two" is therefore
    // not in PHONEME_OVERRIDES (yet) — it passes through plain and
    // the rest of the pipeline (XML-escape, prosody) handles it
    // unchanged. This test is the contract guard: do not re-add "two"
    // to the override map without first listening-confirming the IPA
    // moves the voice on a preview deploy.
    expect(applyPhonemeOverrides('Two plus two.')).toBe('Two plus two.')
    expect(applyPhonemeOverrides('Two plus two.')).not.toContain('<phoneme')
  })

  it('preserves original casing inside the tag (Four stays Four)', () => {
    expect(applyPhonemeOverrides('Four cats.')).toBe(
      '<phoneme alphabet="ipa" ph="fɔːr">Four</phoneme> cats.',
    )
    expect(applyPhonemeOverrides('FOUR cats.')).toBe(
      '<phoneme alphabet="ipa" ph="fɔːr">FOUR</phoneme> cats.',
    )
  })

  it('does NOT match "four" inside "fourteen" (right-edge boundary fails)', () => {
    expect(applyPhonemeOverrides('I want fourteen apples.')).toBe(
      'I want fourteen apples.',
    )
    expect(applyPhonemeOverrides('I want fourteen apples.')).not.toContain(
      '<phoneme',
    )
  })

  it('does NOT match "four" inside "fourth"', () => {
    expect(applyPhonemeOverrides('fourth grade')).toBe('fourth grade')
    expect(applyPhonemeOverrides('fourth grade')).not.toContain('<phoneme')
  })

  it('does NOT match a target word as a substring of larger words (twoscore / Bartholomew boundary guard)', () => {
    // "two" is not currently in PHONEME_OVERRIDES — both expressions
    // pass through trivially. The test is kept as a forward-compat
    // guard: if "two" is re-added in a follow-up, this test must
    // continue to pass (i.e. the regex still uses \b on both edges).
    expect(applyPhonemeOverrides('twoscore years')).toBe('twoscore years')
    expect(applyPhonemeOverrides('twoscore years')).not.toContain('<phoneme')
    // "Bartholomew" famously contains "two" as a substring on no
    // boundaries — the regex must not fire.
    expect(applyPhonemeOverrides('Bartholomew')).toBe('Bartholomew')
  })

  it('emits ZERO <phoneme> tags for "Two plus two. How many?" (override parked) and leaves the bare tokens intact', () => {
    const out = applyPhonemeOverrides('Two plus two. How many?')
    // Count-based assertion (per feedback_count_assertions_on_regression_tests):
    // zero phoneme wraps for "two" (parked), zero for "four" (not in
    // this string).
    const phonemeMatches = out.match(/<phoneme alphabet="ipa"/g) ?? []
    expect(phonemeMatches).toHaveLength(0)
    // The bare "two" tokens are preserved verbatim — Azure will voice
    // them via its default lexicon. (The voice currently picks the
    // short /tu/ realization on the leading instance, per Thomas's
    // listening test; that is the bug the follow-up ticket will
    // tackle. Until then the contract is "pass through unchanged".)
    expect(out).toBe('Two plus two. How many?')
  })

  it('emits exactly one <phoneme ph="fɔːr"> for a single "four" in a multi-word utterance', () => {
    const out = applyPhonemeOverrides('Two plus four. How many?')
    const fourMatches = out.match(/<phoneme alphabet="ipa" ph="fɔːr">/g) ?? []
    expect(fourMatches).toHaveLength(1)
    // "two" passes through plain; pin the full string for clarity.
    expect(out).toBe(
      'Two plus <phoneme alphabet="ipa" ph="fɔːr">four</phoneme>. How many?',
    )
  })

  it('emits exactly two <phoneme ph="fɔːr"> for "Four plus four"', () => {
    const out = applyPhonemeOverrides('Four plus four. How many?')
    const fourMatches = out.match(/<phoneme alphabet="ipa" ph="fɔːr">/g) ?? []
    expect(fourMatches).toHaveLength(2)
    // No bare "four" tokens outside the phoneme wrap. Strip the tags
    // and assert — the same shape the original count-based test used
    // for "two", retargeted to the still-active "four" override.
    const stripped = out.replace(/<phoneme[^>]*>[^<]*<\/phoneme>/g, '')
    expect(stripped).not.toMatch(/\bfour\b/i)
  })

  it('XML-escapes plain segments around the phoneme tag', () => {
    expect(applyPhonemeOverrides(`A & four B.`)).toBe(
      'A &amp; <phoneme alphabet="ipa" ph="fɔːr">four</phoneme> B.',
    )
  })
})

describe('applyPhonemeOverrides tier-filter (Wave 7 Track A7 — Amendment 1, ticket 86c9y49cd)', () => {
  // Background: PHONEME_OVERRIDES widened from Record<string, string> to
  // Record<string, { ipa: string; tiers?: readonly string[] }>. Entries
  // with `tiers` set are tier-scoped and only fire when the caller
  // passes a matching `tierFilter`. Global entries (no `tiers`) fire on
  // every call. This guards both the back-compat surface (existing
  // `four` consumers, no `tier`) and the new tier-scoped surface
  // (letter-sounds mnemonics like `mmm`, `buh`, `o`).

  it('global `four` override fires regardless of tierFilter (back-compat with pre-Amendment-1 callers)', () => {
    // Use a sentence WITHOUT any single-letter words like "I" / "a"
    // because the letter-sounds tier-scoped entries (`a`, `e`, `i`,
    // `o`, `u`) match single-letter tokens on `\b` boundaries —
    // a real letter-sounds tier session would never carry such
    // English prose, but the test must not conflate them.
    //
    // No tier passed — pre-Wave-7 shape. Global entries (no `tiers`
    // field on the entry) must fire; tier-scoped entries do not.
    expect(applyPhonemeOverrides('We have four cats.')).toBe(
      'We have <phoneme alphabet="ipa" ph="fɔːr">four</phoneme> cats.',
    )
    // letter-sounds tier — `four` is global, still fires.
    expect(applyPhonemeOverrides('We have four cats.', 'letter-sounds')).toBe(
      'We have <phoneme alphabet="ipa" ph="fɔːr">four</phoneme> cats.',
    )
    // cvc-words tier — `four` is global, still fires.
    expect(applyPhonemeOverrides('We have four cats.', 'cvc-words')).toBe(
      'We have <phoneme alphabet="ipa" ph="fɔːr">four</phoneme> cats.',
    )
  })

  it('letter-sounds tier-scoped `mmm` mnemonic fires ONLY when tierFilter === "letter-sounds"', () => {
    const text = 'Which letter says mmm?'
    // letter-sounds tier — fires.
    const out = applyPhonemeOverrides(text, 'letter-sounds')
    expect(out).toContain('<phoneme alphabet="ipa" ph="m">mmm</phoneme>')
    // No tier — does NOT fire (tier-scoped entries require matching
    // tier).
    expect(applyPhonemeOverrides(text)).not.toContain('<phoneme')
    expect(applyPhonemeOverrides(text)).toBe('Which letter says mmm?')
    // cvc-words tier — does NOT fire (tier-scope mismatch).
    expect(applyPhonemeOverrides(text, 'cvc-words')).not.toContain('<phoneme')
  })

  it('letter-sounds tier-scoped `buh` stop-consonant mnemonic fires ONLY in letter-sounds (voiced stop carries a schwa /bə/ for audible release)', () => {
    const text = 'Which letter says buh?'
    // VOICED stops (b/d/g) carry a schwa /ə/ in the IPA so Olivia
    // releases them audibly (a bare /b/ rendered near-silent — Thomas's
    // "B-silent" report). Voiceless stops (p/t/k) stay bare.
    expect(applyPhonemeOverrides(text, 'letter-sounds')).toContain(
      '<phoneme alphabet="ipa" ph="bə">buh</phoneme>',
    )
    expect(applyPhonemeOverrides(text, 'cvc-words')).not.toContain('<phoneme')
    expect(applyPhonemeOverrides(text)).not.toContain('<phoneme')
  })

  it('letter-sounds tier-scoped vowel mnemonics fire ONLY in letter-sounds (round-2 en-GB realisations for u/i/e)', () => {
    // Vowel mnemonics are TRIPLETS (aaa/ooo/uuu/iii/eee) — the vowel
    // double-wrap fix. A/O are FROZEN at æ/ɒ. Round-2 (Dave straggler
    // spec) re-points u/i/e to en-GB lexical-set realisations because
    // Olivia mis-realises the bare phonemic /ʌ/ /ɪ/ /ɛ/: u→ə, i→ɘ, e→e.
    const cases: ReadonlyArray<[string, string]> = [
      ['Which letter says aaa.', 'æ'], // FROZEN
      ['Which letter says ooo.', 'ɒ'], // FROZEN
      ['Which letter says uuu.', 'ə'], // round-2 (was ʌ)
      ['Which letter says iii.', 'ɘ'], // round-2 (was ɪ)
      ['Which letter says eee.', 'e'], // round-2 (was ɛ)
    ]
    for (const [text, ipa] of cases) {
      expect(applyPhonemeOverrides(text, 'letter-sounds')).toContain(
        `ph="${ipa}"`,
      )
      // Without the tier filter, no wrap. The bare triplet is preserved.
      expect(applyPhonemeOverrides(text)).not.toContain('<phoneme')
    }
  })

  it('does NOT wrap letter `m` inside the word "math" on a cvc-words tier render (the load-bearing pollution test)', () => {
    // This is the canonical regression scenario for Amendment 1: the
    // letter-sounds tier scopes the bare-letter mnemonics so they
    // never fire on CVC-tier utterances. "math" contains `m` as a
    // word substring (no \b on the right edge against `a`), so `\b`
    // already excludes the substring case — but the bare mnemonic
    // `m` is NOT in PHONEME_OVERRIDES (only `mmm` is, with
    // tiers=letter-sounds), and `mmm` doesn't appear inside "math".
    // Belt-and-braces: any tier-scoped entry only activates with the
    // matching tier filter. The CVC-tier render passes "math" through
    // plain.
    expect(applyPhonemeOverrides('Read the math.', 'cvc-words')).toBe(
      'Read the math.',
    )
    // letter-sounds tier on the same text: still passes through
    // because `m` is not a key (only `mmm` is). The crucial
    // assertion is "no spurious wrap" — letter-sounds tier seeing a
    // CVC-shaped string does not break it.
    expect(applyPhonemeOverrides('Read the math.', 'letter-sounds')).toBe(
      'Read the math.',
    )
  })

  it('cvc-words tier render of "Read the dog." passes through plain (bare letter `o` only fires when wrapped in a letter-sounds utterance)', () => {
    // The bare letter `o` IS a PHONEME_OVERRIDES key (tier-scoped to
    // letter-sounds). On cvc-words, the tier-filter rejects the entry
    // and "dog" is rendered as-is. The `\b` boundary would also
    // protect against substring match (the `o` in "dog" is not on a
    // word boundary), but tier-scoping is the primary guard.
    expect(applyPhonemeOverrides('Read the dog.', 'cvc-words')).toBe(
      'Read the dog.',
    )
    // letter-sounds + "Read the dog." would NOT typically appear (the
    // letter-sounds tier uses different read templates), but the bare
    // `o` inside "dog" is still substring-boundary-protected by `\b`.
    expect(applyPhonemeOverrides('Read the dog.', 'letter-sounds')).toBe(
      'Read the dog.',
    )
  })

  it('emits NO wrap on undefined tier for any tier-scoped entry (defense-in-depth — undefined != "letter-sounds")', () => {
    // Pre-Amendment-1 call shape: no tier passed. Every tier-scoped
    // entry MUST be filtered out at pattern-build time. This is the
    // contract that keeps existing /api/claude callers (no `tier`
    // field) safe under the new shape.
    const cases = [
      'Which letter says mmm?',
      'Which letter says buh?',
      'Which letter says aaa.',
      'Which letter says ooo.',
      'Which letter says iii.',
      'Which letter says eee.',
    ]
    for (const text of cases) {
      const out = applyPhonemeOverrides(text)
      expect(out).not.toContain('<phoneme')
    }
  })

  it('combines tier-scoped + global wraps in a single utterance (defense-in-depth — both can fire when both match)', () => {
    // Hypothetical letter-sounds utterance that mentions "four" plus
    // the mnemonic `mmm`. Both wraps must land. (Not a real
    // letter-sounds utterance shape; the test pins the composition
    // contract — global entries do not exclude tier-scoped ones, and
    // vice versa.)
    const out = applyPhonemeOverrides('Hear mmm before four.', 'letter-sounds')
    expect(out).toContain('<phoneme alphabet="ipa" ph="m">mmm</phoneme>')
    expect(out).toContain('<phoneme alphabet="ipa" ph="fɔːr">four</phoneme>')
  })

  it('buildSsmlBody passes TtsRequest.tier through to applyPhonemeOverrides (end-to-end Amendment-1 wiring)', () => {
    // End-to-end: TtsRequest.tier --> buildSsmlBody --> renderSsmlInnerText
    // --> applyPhonemeOverrides(text, tierFilter). The letter-sounds
    // mnemonic `mmm` must wrap when the request carries
    // tier: 'letter-sounds'.
    const letterSoundsBody = buildSsmlBody({
      text: 'Which letter says mmm?',
      voice: 'en-US-EmmaMultilingualNeural',
      rate: '-10%',
      pitch: '+0Hz',
      volume: '+0%',
      tier: 'letter-sounds',
    })
    expect(letterSoundsBody).toContain(
      '<phoneme alphabet="ipa" ph="m">mmm</phoneme>',
    )
    // Same SSML build without tier: the mnemonic stays bare prose
    // (the SSML is XML-escape-clean and Azure voices it via lexicon).
    const noTierBody = buildSsmlBody({
      text: 'Which letter says mmm?',
      voice: 'en-US-EmmaMultilingualNeural',
      rate: '-10%',
      pitch: '+0Hz',
      volume: '+0%',
    })
    expect(noTierBody).not.toContain('<phoneme')
    expect(noTierBody).toContain('mmm')
    // cvc-words tier: ALSO no wrap (tier-scope mismatch).
    const cvcBody = buildSsmlBody({
      text: 'Which letter says mmm?',
      voice: 'en-US-EmmaMultilingualNeural',
      rate: '-10%',
      pitch: '+0Hz',
      volume: '+0%',
      tier: 'cvc-words',
    })
    expect(cvcBody).not.toContain('<phoneme')
  })
})

describe('letter-sounds SSML treatment (British-voice rollout, 2026-06-06)', () => {
  it('injects a 300ms break before each phoneme when prependBreakMs is set', () => {
    const out = applyPhonemeOverrides(
      'Which letter says mmm.',
      'letter-sounds',
      300,
    )
    expect(out).toBe(
      'Which letter says <break time="300ms"/><phoneme alphabet="ipa" ph="m">mmm</phoneme>.',
    )
  })

  it('does NOT inject a break for non-letter-sounds callers (back-compat)', () => {
    // No prependBreakMs → no break, even when a global entry wraps.
    expect(applyPhonemeOverrides('Hear four.', 'cvc-words')).toBe(
      'Hear <phoneme alphabet="ipa" ph="fɔːr">four</phoneme>.',
    )
    expect(applyPhonemeOverrides('Hear four.')).toBe(
      'Hear <phoneme alphabet="ipa" ph="fɔːr">four</phoneme>.',
    )
  })

  it('does NOT apply the question-prosody wrapper to a VOICELESS letter-sounds read (ends with "?")', () => {
    // "Which letter says sss?" is a voiceless-sound read — it ends with
    // "?" but must NOT pick up the +8%/-5% question-prosody wrapper that
    // math "How many?" gets. The intonation cue is the punctuation + the
    // 300ms break only.
    const out = renderSsmlInnerText('Which letter says sss?', 'letter-sounds')
    expect(out).not.toContain('pitch="+8%"')
    expect(out).toBe(
      'Which letter says <break time="300ms"/><phoneme alphabet="ipa" ph="s">sss</phoneme>?',
    )
  })

  it('handles a VOICED (declarative) letter-sounds read with the break + phoneme', () => {
    // Vowel mnemonic is a TRIPLET (ooo), not the bare letter (o) — the
    // vowel double-wrap fix. Only the triplet is wrapped.
    const out = renderSsmlInnerText('Which letter says ooo.', 'letter-sounds')
    expect(out).toBe(
      'Which letter says <break time="300ms"/><phoneme alphabet="ipa" ph="ɒ">ooo</phoneme>.',
    )
  })

  it('does NOT double-wrap a vowel correct line — only the triplet mnemonic is wrapped, the letter-NAME stays bare (vowel double-wrap regression guard)', () => {
    // The bug: "Yes A says a." → both the letter-name "A" and the bare
    // mnemonic "a" matched the case-insensitive override → both rendered
    // /æ/ ("Yes ahh says ahh"). The NEW correct shape (Dave master spec)
    // is "Yes. A. aaa." — letter-name its own sentence, "says" dropped.
    // With the TRIPLET mnemonic the letter-name "A" is NOT a key, so it
    // stays bare prose (Azure speaks "ay") and only "aaa" is wrapped /æ/.
    const out = applyPhonemeOverrides('Yes. A. aaa.', 'letter-sounds')
    // Exactly ONE phoneme wrap, and it surrounds the triplet — NOT the
    // letter-name.
    expect(out).toBe('Yes. A. <phoneme alphabet="ipa" ph="æ">aaa</phoneme>.')
    // The standalone letter-name "A" is never wrapped.
    expect(out).not.toContain('>A</phoneme>')
    expect((out.match(/<phoneme/g) ?? []).length).toBe(1)
  })

  it('mirrors the consonant case — a consonant correct line wraps only the mnemonic, never the letter-name', () => {
    const out = applyPhonemeOverrides('Yes. M. mmm.', 'letter-sounds')
    expect(out).toBe('Yes. M. <phoneme alphabet="ipa" ph="m">mmm</phoneme>.')
    expect((out.match(/<phoneme/g) ?? []).length).toBe(1)
  })

  it('handles the fricative hint "It says hhh?" without question prosody', () => {
    const out = renderSsmlInnerText('It says hhh?', 'letter-sounds')
    expect(out).not.toContain('pitch="+8%"')
    expect(out).toBe(
      'It says <break time="300ms"/><phoneme alphabet="ipa" ph="h">hhh</phoneme>?',
    )
  })

  it('STILL applies question prosody to math reads (tierFilter undefined — unaffected by the letter-sounds scoping)', () => {
    const out = renderSsmlInnerText('Three plus two. How many?')
    expect(out).toBe(
      'Three plus two. <break time="250ms"/><prosody pitch="+8%" rate="-5%">How many?</prosody>',
    )
  })

  // ── Round-3: example-word anchoring (Dave round-3) ──────────────────
  it('anchored U Primary read: wraps ONLY the isolate lead "uh" (/ʌ/); the anchor word "cup" stays PLAIN TEXT', () => {
    const out = renderSsmlInnerText(
      'Which letter says uh, like in cup?',
      'letter-sounds',
    )
    // The isolate lead is the only wrap, with the 300ms break.
    expect(out).toBe(
      'Which letter says <break time="300ms"/><phoneme alphabet="ipa" ph="ʌ">uh</phoneme>, like in cup?',
    )
    // "cup" is NEVER phoneme-wrapped — its value is Olivia's native
    // lexicon. Exactly one phoneme tag total.
    expect(out).not.toContain('>cup<')
    expect((out.match(/<phoneme/g) ?? []).length).toBe(1)
  })

  it('anchored I Primary read: wraps ONLY "ih" (/ɪ/); "ink" stays plain text', () => {
    const out = renderSsmlInnerText(
      'Which letter says ih, like in ink?',
      'letter-sounds',
    )
    expect(out).toBe(
      'Which letter says <break time="300ms"/><phoneme alphabet="ipa" ph="ɪ">ih</phoneme>, like in ink?',
    )
    expect(out).not.toContain('>ink<')
    expect((out.match(/<phoneme/g) ?? []).length).toBe(1)
  })

  it('anchored U correct line: letter-name "U" un-wrapped, "Uh" isolate wrapped, "cup" plain', () => {
    const out = renderSsmlInnerText('Yes. U. Uh, like in cup.', 'letter-sounds')
    // "Uh" (capitalised, sentence-initial) is the only wrap; the case-
    // insensitive override matches it. The letter-name "U" and "cup"
    // stay bare prose.
    expect(out).toBe(
      'Yes. U. <break time="300ms"/><phoneme alphabet="ipa" ph="ʌ">Uh</phoneme>, like in cup.',
    )
    expect(out).not.toContain('>U</phoneme>')
    expect(out).not.toContain('>cup<')
    expect((out.match(/<phoneme/g) ?? []).length).toBe(1)
  })

  it('defensive: a bare single-letter "u"/"i" is NEVER phoneme-wrapped (double-wrap guard; the rejected Anchor-only form would have relied on this)', () => {
    // The bare "u"/"i" is NOT a PHONEME_OVERRIDES key (only the triplet
    // "uuu"/"iii" and the round-3 isolate leads "uh"/"ih" are). So a bare
    // single letter is never wrapped — this guards the double-wrap fix.
    // (The Anchor-only candidate that emitted bare-letter reads was
    // rejected and removed; this stays as a defensive guard.)
    expect(
      renderSsmlInnerText('Which letter says u, like in cup?', 'letter-sounds'),
    ).not.toContain('<phoneme')
    expect(
      renderSsmlInnerText('Which letter says i, like in ink?', 'letter-sounds'),
    ).not.toContain('<phoneme')
  })
})

describe('buildSsmlBody (phoneme override integration, ticket 86c9kj2um)', () => {
  const baseReq = {
    voice: 'en-US-EmmaMultilingualNeural',
    rate: '-10%',
    pitch: '+0Hz',
    volume: '+0%',
  }

  it('emits ZERO <phoneme> tags for "Two plus two. How many?" (override parked) but preserves the trailing-question prosody', () => {
    const body = buildSsmlBody({
      ...baseReq,
      text: 'Two plus two. How many?',
    })
    // No phoneme wraps — "two" is not currently in PHONEME_OVERRIDES.
    const phonemeMatches = body.match(/<phoneme alphabet="ipa"/g) ?? []
    expect(phonemeMatches).toHaveLength(0)
    // Plain "Two plus two" survives intact inside the outer prosody.
    expect(body).toContain(
      '<prosody pitch="+0Hz" rate="-10%" volume="+0%">Two plus two. ',
    )
    // Trailing question still gets the prosody hint (86c9gxup4).
    expect(body).toContain(
      '<break time="250ms"/><prosody pitch="+8%" rate="-5%">How many?</prosody>',
    )
  })

  it('emits exactly one <phoneme ph="fɔːr"> for "Two plus four. How many?" ("two" passes through plain)', () => {
    const body = buildSsmlBody({
      ...baseReq,
      text: 'Two plus four. How many?',
    })
    const fourMatches = body.match(/<phoneme alphabet="ipa" ph="fɔːr">/g) ?? []
    expect(fourMatches).toHaveLength(1)
    expect(body).toContain('<phoneme alphabet="ipa" ph="fɔːr">four</phoneme>')
    // "Two" is plain — no phoneme wrap on it.
    expect(body).not.toContain('<phoneme alphabet="ipa" ph="tuː">')
  })

  it('emits two <phoneme ph="fɔːr"> tags for "Four plus four. How many?"', () => {
    const body = buildSsmlBody({
      ...baseReq,
      text: 'Four plus four. How many?',
    })
    const fourMatches = body.match(/<phoneme alphabet="ipa" ph="fɔːr">/g) ?? []
    expect(fourMatches).toHaveLength(2)
    // No bare "four" tokens leak past the phoneme wrap.
    const stripped = body.replace(/<phoneme[^>]*>[^<]*<\/phoneme>/g, '')
    expect(stripped).not.toMatch(/\bfour\b/i)
  })

  it('does NOT emit <phoneme> tags for utterances that do not contain target words', () => {
    const body = buildSsmlBody({
      ...baseReq,
      text: 'Yes! Five!',
    })
    expect(body).not.toContain('<phoneme')
  })

  it('does NOT emit <phoneme> for "fourteen" / "fourth" (boundary regression guard)', () => {
    const body = buildSsmlBody({
      ...baseReq,
      text: 'I am fourteen years old. The fourth grade.',
    })
    expect(body).not.toContain('<phoneme')
  })

  it('envelope structure: <speak version=...> + voice + outer prosody for an utterance with phoneme injection', () => {
    const body = buildSsmlBody({
      ...baseReq,
      text: 'Four plus four. How many?',
    })
    // Pin the envelope shape independent of inner content. Use a
    // "four"-containing string so the envelope-with-injection
    // invariant is exercised (the brief calls out asserting "the body
    // starts with `<speak version=`").
    expect(body.startsWith('<speak version="1.0"')).toBe(true)
    expect(body).toContain('xml:lang="en-US"')
    expect(body).toContain('<voice name="en-US-EmmaMultilingualNeural">')
    expect(body).toContain('<prosody pitch="+0Hz" rate="-10%" volume="+0%">')
    expect(body).toContain('<phoneme alphabet="ipa" ph="fɔːr">')
    expect(body).toMatch(/<\/prosody><\/voice><\/speak>$/)
  })
})

describe('buildSsmlBody (prosody-hint integration)', () => {
  const baseReq = {
    voice: 'en-US-EmmaMultilingualNeural',
    rate: '-10%',
    pitch: '+0Hz',
    volume: '+0%',
  }

  it('emits the <break>+<prosody> hint inside outer <prosody> for the Math hint utterance', () => {
    const body = buildSsmlBody({
      ...baseReq,
      text: 'Look. Three. And two more. How many now?',
    })
    // "two" passes through plain — the override is parked
    // (86c9kj2um listening test on PR #115). The trailing
    // interrogative still gets the question-prosody wrap (86c9gxup4).
    expect(body).toContain(
      '<prosody pitch="+0Hz" rate="-10%" volume="+0%">' +
        'Look. Three. And two more. ' +
        '<break time="250ms"/><prosody pitch="+8%" rate="-5%">How many now?</prosody>' +
        '</prosody>',
    )
  })

  it('does NOT emit <break> for declarative utterances (regression guard for non-hint lines)', () => {
    const body = buildSsmlBody({
      ...baseReq,
      text: 'Yes! Five!',
    })
    expect(body).not.toContain('<break')
    expect(body).toContain(
      '<prosody pitch="+0Hz" rate="-10%" volume="+0%">Yes! Five!</prosody>',
    )
  })
})

describe('describeAzureFailure', () => {
  it('maps 401 to a key-hint auth-failed error', () => {
    expect(describeAzureFailure(401, 'Access denied').message).toMatch(
      /tts auth failed \(401\)/,
    )
  })

  it('maps 403 to the same auth-failed error class', () => {
    expect(describeAzureFailure(403, 'Forbidden').message).toMatch(
      /tts auth failed \(403\)/,
    )
  })

  it('maps 429 to a rate-limited error', () => {
    expect(describeAzureFailure(429, 'Too many').message).toMatch(
      /tts rate limited \(429\)/,
    )
  })

  it('maps 5xx to upstream-error and includes a body hint', () => {
    const err = describeAzureFailure(503, 'service unavailable')
    expect(err.message).toMatch(/tts upstream error \(503\)/)
    expect(err.message).toContain('service unavailable')
  })

  it('truncates oversize body hints to keep error messages bounded', () => {
    const longBody = 'X'.repeat(500)
    const err = describeAzureFailure(500, longBody)
    // 200-char cap inside describeAzureFailure.
    expect(err.message.length).toBeLessThan(longBody.length)
  })

  it('falls through to a generic http-error for unmapped status codes', () => {
    expect(describeAzureFailure(418, "I'm a teapot").message).toMatch(
      /tts http error \(418\)/,
    )
  })
})

// --- synthesizeUtterance: integration with a fake fetch ----------------

const HAPPY_REQ = {
  text: 'Hi!',
  voice: 'en-US-EmmaMultilingualNeural',
  rate: '-10%',
  pitch: '+0Hz',
  volume: '+0%',
}

function fakeOkResponse(bytes: Uint8Array): Response {
  // Construct a real Response to match the runtime contract — fetchFn
  // returns one of these and we await arrayBuffer() / text() on it.
  return new Response(bytes, {
    status: 200,
    headers: { 'Content-Type': 'audio/mpeg' },
  })
}

function fakeFailResponse(status: number, body = ''): Response {
  return new Response(body, { status })
}

const TEST_ENV: NodeJS.ProcessEnv = {
  AZURE_SPEECH_KEY: 'test-key-not-real',
  AZURE_SPEECH_REGION: 'westeurope',
}

describe('synthesizeUtterance', () => {
  beforeEach(() => {
    // Explicit env injection on every test — never read process.env in
    // synthesize tests so a stray AZURE_SPEECH_* in the dev shell can't
    // turn a unit test into an integration test.
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs the SSML body to the per-region endpoint with the correct headers', async () => {
    const audioBytes = new Uint8Array([0xff, 0xfb, 0x90, 0x44])
    const fetchFn =
      vi.fn<(input: string | URL, init?: RequestInit) => Promise<Response>>()
    fetchFn.mockImplementation(async () => fakeOkResponse(audioBytes))

    const result = await synthesizeUtterance(HAPPY_REQ, {
      fetchFn: fetchFn as unknown as typeof fetch,
      env: TEST_ENV,
    })

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url, init] = fetchFn.mock.calls[0]!
    expect(url).toBe(
      'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1',
    )
    expect(init).toBeDefined()
    expect(init!.method).toBe('POST')

    const headers = init!.headers as Record<string, string>
    expect(headers['Ocp-Apim-Subscription-Key']).toBe('test-key-not-real')
    // charset=utf-8 is mandatory — without it Azure may decode the body
    // as Windows-1252 and mojibake unicode punctuation (ticket 86c9qhr91).
    expect(headers['Content-Type']).toBe('application/ssml+xml; charset=utf-8')
    expect(headers['X-Microsoft-OutputFormat']).toBe(
      'audio-24khz-48kbitrate-mono-mp3',
    )
    expect(headers['User-Agent']).toBeTruthy()

    expect(typeof init!.body).toBe('string')
    expect(init!.body as string).toContain(
      '<voice name="en-US-EmmaMultilingualNeural">',
    )
    expect(init!.body as string).toContain('xml:lang="en-US"')
    expect(init!.body as string).toContain('Hi!')

    expect(Array.from(result.audio)).toEqual([0xff, 0xfb, 0x90, 0x44])
  })

  it('passes the response body through as a Uint8Array unchanged', async () => {
    const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0xff])
    const fetchFn = vi.fn(async () => fakeOkResponse(bytes))
    const result = await synthesizeUtterance(HAPPY_REQ, {
      fetchFn: fetchFn as unknown as typeof fetch,
      env: TEST_ENV,
    })
    expect(Array.from(result.audio)).toEqual([
      0x01, 0x02, 0x03, 0x04, 0x05, 0xff,
    ])
  })

  it('fails loud when AZURE_SPEECH_KEY is missing in the env', async () => {
    const fetchFn = vi.fn()
    await expect(
      synthesizeUtterance(HAPPY_REQ, {
        fetchFn: fetchFn as unknown as typeof fetch,
        env: { AZURE_SPEECH_REGION: 'westeurope' } as NodeJS.ProcessEnv,
      }),
    ).rejects.toThrow(/AZURE_SPEECH_KEY/)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('fails loud when AZURE_SPEECH_REGION is missing in the env', async () => {
    const fetchFn = vi.fn()
    await expect(
      synthesizeUtterance(HAPPY_REQ, {
        fetchFn: fetchFn as unknown as typeof fetch,
        env: { AZURE_SPEECH_KEY: 'k' } as NodeJS.ProcessEnv,
      }),
    ).rejects.toThrow(/AZURE_SPEECH_REGION/)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('rejects with the auth-failed message on 401', async () => {
    const fetchFn = vi.fn(async () => fakeFailResponse(401, 'Access denied'))
    await expect(
      synthesizeUtterance(HAPPY_REQ, {
        fetchFn: fetchFn as unknown as typeof fetch,
        env: TEST_ENV,
      }),
    ).rejects.toThrow(/tts auth failed \(401\)/)
  })

  it('rejects with the rate-limited message on 429 (retries disabled)', async () => {
    const fetchFn = vi.fn(async () => fakeFailResponse(429, 'Too many'))
    await expect(
      synthesizeUtterance(HAPPY_REQ, {
        fetchFn: fetchFn as unknown as typeof fetch,
        env: TEST_ENV,
        // Disable retries so this test pins the error-mapping semantics
        // independently of the retry policy. The retry behaviour is
        // covered by its own dedicated suite further down.
        backoff: { maxAttempts: 0 },
      }),
    ).rejects.toThrow(/tts rate limited \(429\)/)
  })

  it('rejects with the upstream-error message on 503 (retries disabled)', async () => {
    const fetchFn = vi.fn(async () =>
      fakeFailResponse(503, 'service unavailable'),
    )
    await expect(
      synthesizeUtterance(HAPPY_REQ, {
        fetchFn: fetchFn as unknown as typeof fetch,
        env: TEST_ENV,
        backoff: { maxAttempts: 0 },
      }),
    ).rejects.toThrow(/tts upstream error \(503\)/)
  })

  it('rejects on timeout — uses the injected scheduler so the test is synchronous', async () => {
    // The fetch never resolves; the timeout fires synchronously via the
    // injected setTimeoutFn. AbortController on the request signals the
    // fetch implementation, which here we simulate by rejecting with an
    // AbortError after the controller's signal aborts.
    let abortHandler: (() => void) | null = null
    const fetchFn = vi.fn((_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined
      return new Promise<Response>((_resolve, reject) => {
        if (signal) {
          abortHandler = () => {
            const err = new Error('aborted') as Error & { name: string }
            err.name = 'AbortError'
            reject(err)
          }
          signal.addEventListener('abort', abortHandler)
        }
      })
    })

    let scheduled: (() => void) | null = null
    const promise = synthesizeUtterance(HAPPY_REQ, {
      fetchFn: fetchFn as unknown as typeof fetch,
      env: TEST_ENV,
      timeoutMs: 100,
      setTimeoutFn: (cb) => {
        scheduled = cb
        return 1
      },
      clearTimeoutFn: () => {},
    })

    expect(scheduled).toBeTypeOf('function')
    // Fire the scheduled timeout — the AbortController inside synthesize
    // calls .abort(), the fake fetch's signal listener rejects, and
    // synthesize re-throws the timeout-shaped error.
    scheduled!()

    await expect(promise).rejects.toThrow(/timeout after 100ms/)
  })

  it('rejects with the underlying fetch error when fetch fails for a non-timeout reason', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('connection reset by peer')
    })
    await expect(
      synthesizeUtterance(HAPPY_REQ, {
        fetchFn: fetchFn as unknown as typeof fetch,
        env: TEST_ENV,
      }),
    ).rejects.toThrow(/connection reset by peer/)
  })
})

// --- Retry + backoff (ticket 86c9kjdh2) -------------------------------

describe('parseRetryAfterMs', () => {
  it('returns null for missing or empty headers', () => {
    expect(parseRetryAfterMs(null)).toBeNull()
    expect(parseRetryAfterMs('')).toBeNull()
    expect(parseRetryAfterMs('   ')).toBeNull()
  })

  it('parses integer-seconds form to ms', () => {
    expect(parseRetryAfterMs('1')).toBe(1000)
    expect(parseRetryAfterMs('5')).toBe(5000)
    expect(parseRetryAfterMs('0')).toBe(0)
  })

  it('rounds decimal seconds to nearest ms', () => {
    expect(parseRetryAfterMs('1.5')).toBe(1500)
    expect(parseRetryAfterMs('0.25')).toBe(250)
  })

  it('parses HTTP-date form against a fixed clock', () => {
    const now = Date.parse('2026-05-01T07:00:00.000Z')
    const target = 'Fri, 01 May 2026 07:00:03 GMT' // 3 seconds later
    const result = parseRetryAfterMs(target, now)
    // Allow ±1ms tolerance for date-parser variance, though both should be exact.
    expect(result).not.toBeNull()
    expect(Math.abs(result! - 3000)).toBeLessThan(2)
  })

  it('returns 0 for an HTTP-date already in the past', () => {
    const now = Date.parse('2026-05-01T07:00:00.000Z')
    const past = 'Thu, 30 Apr 2026 12:00:00 GMT'
    expect(parseRetryAfterMs(past, now)).toBe(0)
  })

  it('returns null for unparseable values', () => {
    expect(parseRetryAfterMs('not-a-thing')).toBeNull()
  })

  it('rejects negative integer-seconds (treats as unparseable)', () => {
    expect(parseRetryAfterMs('-1')).toBeNull()
  })
})

describe('computeBackoffDelayMs', () => {
  // Pin randomFn → 0.5 produces ZERO jitter in the (random*2 - 1) formula.
  // Pin randomFn → 0 produces -jitterMs jitter; randomFn → 1 produces +jitterMs.
  const noJitter = { randomFn: () => 0.5 }

  it('uses base delay on the first retry attempt', () => {
    expect(computeBackoffDelayMs(1, { baseDelayMs: 200, ...noJitter })).toBe(
      200,
    )
  })

  it('doubles per attempt up to the cap', () => {
    expect(computeBackoffDelayMs(2, { baseDelayMs: 200, ...noJitter })).toBe(
      400,
    )
    expect(computeBackoffDelayMs(3, { baseDelayMs: 200, ...noJitter })).toBe(
      800,
    )
    expect(computeBackoffDelayMs(4, { baseDelayMs: 200, ...noJitter })).toBe(
      1600,
    )
  })

  it('caps the delay at maxDelayMs (default 3000)', () => {
    expect(computeBackoffDelayMs(5, { baseDelayMs: 200, ...noJitter })).toBe(
      3000, // 200 × 2^4 = 3200, capped to 3000
    )
    expect(computeBackoffDelayMs(10, { baseDelayMs: 200, ...noJitter })).toBe(
      3000,
    )
  })

  it('applies positive jitter when randomFn returns 1', () => {
    // (1 × 2 - 1) × 50 = +50ms
    expect(
      computeBackoffDelayMs(1, {
        baseDelayMs: 200,
        jitterMs: 50,
        randomFn: () => 1,
      }),
    ).toBe(250)
  })

  it('applies negative jitter when randomFn returns 0', () => {
    // (0 × 2 - 1) × 50 = -50ms
    expect(
      computeBackoffDelayMs(1, {
        baseDelayMs: 200,
        jitterMs: 50,
        randomFn: () => 0,
      }),
    ).toBe(150)
  })

  it('clamps the final value to >= 0 (jitter cannot drive it negative)', () => {
    expect(
      computeBackoffDelayMs(1, {
        baseDelayMs: 10,
        jitterMs: 100,
        randomFn: () => 0,
      }),
    ).toBe(0) // 10 + (-100) = -90 → clamped to 0
  })
})

describe('fetchWithBackoff', () => {
  /** Build a fake fetchFn that returns the given sequence of Response
   *  factories. After the sequence is exhausted, a sentinel Error is
   *  thrown to make over-call regressions loud. */
  function sequencedFetch(responseFactories: Array<() => Response>): {
    fetchFn: ReturnType<typeof vi.fn>
    callCount: () => number
  } {
    let i = 0
    const fetchFn = vi.fn(async () => {
      if (i >= responseFactories.length) {
        throw new Error(
          `fetchFn called ${i + 1} times, only ${responseFactories.length} responses queued`,
        )
      }
      return responseFactories[i++]!()
    })
    return { fetchFn, callCount: () => i }
  }

  function recordingSleep(): {
    sleepFn: (ms: number) => Promise<void>
    delays: number[]
  } {
    const delays: number[] = []
    return {
      sleepFn: async (ms: number) => {
        delays.push(ms)
      },
      delays,
    }
  }

  it('returns a 2xx response on first try without retrying', async () => {
    const { fetchFn, callCount } = sequencedFetch([
      () => new Response('ok', { status: 200 }),
    ])
    const { sleepFn, delays } = recordingSleep()
    const res = await fetchWithBackoff(
      fetchFn as unknown as typeof fetch,
      'https://example.test',
      { method: 'POST' },
      { sleepFn, randomFn: () => 0.5 },
    )
    expect(res.status).toBe(200)
    expect(callCount()).toBe(1)
    expect(delays).toEqual([])
  })

  it('429 with Retry-After: 1 → sleeps 1000ms and retries; 200 returned', async () => {
    const { fetchFn, callCount } = sequencedFetch([
      () =>
        new Response('throttled', {
          status: 429,
          headers: { 'Retry-After': '1' },
        }),
      () => new Response('ok', { status: 200 }),
    ])
    const { sleepFn, delays } = recordingSleep()
    const res = await fetchWithBackoff(
      fetchFn as unknown as typeof fetch,
      'https://example.test',
      { method: 'POST' },
      { sleepFn, randomFn: () => 0.5 },
    )
    expect(res.status).toBe(200)
    expect(callCount()).toBe(2)
    expect(delays).toEqual([1000])
  })

  it('429 with no Retry-After → exponential backoff delays', async () => {
    const { fetchFn, callCount } = sequencedFetch([
      () => new Response('', { status: 429 }),
      () => new Response('', { status: 429 }),
      () => new Response('', { status: 429 }),
      () => new Response('ok', { status: 200 }),
    ])
    const { sleepFn, delays } = recordingSleep()
    const res = await fetchWithBackoff(
      fetchFn as unknown as typeof fetch,
      'https://example.test',
      { method: 'POST' },
      {
        sleepFn,
        // No-jitter randomFn so we can pin exact delays.
        randomFn: () => 0.5,
        baseDelayMs: 200,
      },
    )
    expect(res.status).toBe(200)
    expect(callCount()).toBe(4)
    // Three retries: 200, 400, 800.
    expect(delays).toEqual([200, 400, 800])
  })

  it('5 consecutive 429s → returns the final 429 unchanged (caller maps to hard error)', async () => {
    const { fetchFn, callCount } = sequencedFetch([
      () => new Response('', { status: 429 }),
      () => new Response('', { status: 429 }),
      () => new Response('', { status: 429 }),
      () => new Response('', { status: 429 }),
      () => new Response('', { status: 429 }),
      () => new Response('', { status: 429 }), // 6th = exhausted, returned to caller
    ])
    const { sleepFn, delays } = recordingSleep()
    const res = await fetchWithBackoff(
      fetchFn as unknown as typeof fetch,
      'https://example.test',
      { method: 'POST' },
      { sleepFn, randomFn: () => 0.5, baseDelayMs: 200, maxAttempts: 5 },
    )
    expect(res.status).toBe(429)
    expect(callCount()).toBe(6) // 1 initial + 5 retries
    // Five backoff sleeps (capped at 3000): 200, 400, 800, 1600, 3000.
    expect(delays).toEqual([200, 400, 800, 1600, 3000])
  })

  it('5xx single retry → recovers on the second call', async () => {
    const { fetchFn, callCount } = sequencedFetch([
      () => new Response('upstream blip', { status: 503 }),
      () => new Response('ok', { status: 200 }),
    ])
    const { sleepFn, delays } = recordingSleep()
    const res = await fetchWithBackoff(
      fetchFn as unknown as typeof fetch,
      'https://example.test',
      { method: 'POST' },
      { sleepFn, randomFn: () => 0.5, baseDelayMs: 200 },
    )
    expect(res.status).toBe(200)
    expect(callCount()).toBe(2)
    expect(delays).toEqual([200])
  })

  it('5xx twice → does NOT retry a second time (single retry budget for 5xx)', async () => {
    const { fetchFn, callCount } = sequencedFetch([
      () => new Response('', { status: 500 }),
      () => new Response('', { status: 500 }), // returned to caller
    ])
    const { sleepFn } = recordingSleep()
    const res = await fetchWithBackoff(
      fetchFn as unknown as typeof fetch,
      'https://example.test',
      { method: 'POST' },
      { sleepFn, randomFn: () => 0.5, baseDelayMs: 200 },
    )
    expect(res.status).toBe(500)
    expect(callCount()).toBe(2)
  })

  it('caps a huge Retry-After at maxDelayMs (defense against pathological values)', async () => {
    const { fetchFn } = sequencedFetch([
      () =>
        new Response('', {
          status: 429,
          headers: { 'Retry-After': '300' }, // 5 minutes
        }),
      () => new Response('ok', { status: 200 }),
    ])
    const { sleepFn, delays } = recordingSleep()
    await fetchWithBackoff(
      fetchFn as unknown as typeof fetch,
      'https://example.test',
      { method: 'POST' },
      { sleepFn, randomFn: () => 0.5, maxDelayMs: 3000 },
    )
    expect(delays).toEqual([3000])
  })

  it('terminal 4xx (e.g. 401) is NOT retried', async () => {
    const { fetchFn, callCount } = sequencedFetch([
      () => new Response('access denied', { status: 401 }),
    ])
    const { sleepFn, delays } = recordingSleep()
    const res = await fetchWithBackoff(
      fetchFn as unknown as typeof fetch,
      'https://example.test',
      { method: 'POST' },
      { sleepFn, randomFn: () => 0.5 },
    )
    expect(res.status).toBe(401)
    expect(callCount()).toBe(1)
    expect(delays).toEqual([])
  })
})

describe('synthesizeUtterance retry integration', () => {
  it('429 with Retry-After then 200 → returns audio after one retry', async () => {
    const audioBytes = new Uint8Array([0xff, 0xfb, 0x90, 0x44])
    let call = 0
    const fetchFn = vi.fn(async () => {
      call += 1
      if (call === 1) {
        return new Response('', {
          status: 429,
          headers: { 'Retry-After': '0' },
        })
      }
      return fakeOkResponse(audioBytes)
    })
    const result = await synthesizeUtterance(HAPPY_REQ, {
      fetchFn: fetchFn as unknown as typeof fetch,
      env: TEST_ENV,
      backoff: {
        sleepFn: async () => {},
        randomFn: () => 0.5,
      },
    })
    expect(call).toBe(2)
    expect(Array.from(result.audio)).toEqual([0xff, 0xfb, 0x90, 0x44])
  })

  it('5 consecutive 429s exhausts retries and surfaces the rate-limited hard error', async () => {
    const fetchFn = vi.fn(async () => fakeFailResponse(429, 'still throttled'))
    await expect(
      synthesizeUtterance(HAPPY_REQ, {
        fetchFn: fetchFn as unknown as typeof fetch,
        env: TEST_ENV,
        backoff: {
          sleepFn: async () => {},
          randomFn: () => 0.5,
          maxAttempts: 5,
        },
      }),
    ).rejects.toThrow(/tts rate limited \(429\)/)
    // 1 initial + 5 retries = 6 fetch calls.
    expect(fetchFn).toHaveBeenCalledTimes(6)
  })
})

describe('uint8ToBase64', () => {
  it('round-trips through Buffer.from(b64, "base64")', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff])
    const b64 = uint8ToBase64(bytes)
    const decoded = Buffer.from(b64, 'base64')
    expect(Array.from(decoded)).toEqual([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff])
  })

  it('returns the empty string for an empty Uint8Array', () => {
    expect(uint8ToBase64(new Uint8Array(0))).toBe('')
  })
})

// --- Voice-QA baseline fixes (ticket 86ca7u3gr, GitHub issue #372) ------
//
// 5 SSML fix clusters from Thomas's voice-QA baseline. Each block proves
// (a) the flagged shape gets its fix AND (b) the passing-baseline
// siblings stay byte-identical — that asymmetry IS the targeted-only
// invariant the ticket requires.

describe('cluster 1 — "row" homophone (rəʊ not raʊ)', () => {
  it('wraps "row" in <phoneme ph="rəʊ"> in the streak praise line', () => {
    expect(applyPhonemeOverrides('Three in a row! Wow!')).toBe(
      'Three in a <phoneme alphabet="ipa" ph="rəʊ">row</phoneme>! Wow!',
    )
  })

  it('fires on every streak count 3–8 (global override, both tracks)', () => {
    for (const n of ['Three', 'Four', 'Five', 'Six', 'Seven', 'Eight']) {
      const out = applyPhonemeOverrides(`${n} in a row! Wow!`)
      expect(out).toContain('<phoneme alphabet="ipa" ph="rəʊ">row</phoneme>')
    }
  })

  it('does NOT match "row" inside "grow" / "brown" / "arrow" (boundary guard)', () => {
    expect(applyPhonemeOverrides('They grow.')).toBe('They grow.')
    expect(applyPhonemeOverrides('A brown arrow.')).toBe('A brown arrow.')
    expect(applyPhonemeOverrides('They grow.')).not.toContain('<phoneme')
  })

  it('co-fires with "four" on "Four in a row! Wow!" — both wrapped, no break (math tier)', () => {
    expect(renderSsmlInnerText('Four in a row! Wow!')).toBe(
      '<phoneme alphabet="ipa" ph="fɔːr">Four</phoneme> in a ' +
        '<phoneme alphabet="ipa" ph="rəʊ">row</phoneme>! Wow!',
    )
  })
})

describe('cluster 3 — "twenty-four" spoken as a unit (hyphen boundary)', () => {
  it('does NOT split "four" out of "twenty-four" (no phoneme wrap across the hyphen)', () => {
    expect(applyPhonemeOverrides('Yes! Twenty-four!')).toBe('Yes! Twenty-four!')
    expect(applyPhonemeOverrides('This one is twenty-four.')).toBe(
      'This one is twenty-four.',
    )
  })

  it('still wraps a STANDALONE "four" (hyphen guard does not break the base case)', () => {
    expect(applyPhonemeOverrides('I want four.')).toBe(
      'I want <phoneme alphabet="ipa" ph="fɔːr">four</phoneme>.',
    )
  })

  it('preserves the fourteen / fourth substring guards under the hyphen-aware boundary', () => {
    expect(applyPhonemeOverrides('I want fourteen apples.')).toBe(
      'I want fourteen apples.',
    )
    expect(applyPhonemeOverrides('fourth grade')).toBe('fourth grade')
  })

  it('does not split a hyphenated tier-scoped mnemonic either (forward guard)', () => {
    // No letter-sounds mnemonic is hyphen-adjacent today, but the
    // boundary must hold for them too if a future canon introduced one.
    expect(applyPhonemeOverrides('says mmm-ish', 'letter-sounds')).toBe(
      'says mmm-ish',
    )
  })
})

describe('cluster 4a — no break before "four" on the letter-sounds path', () => {
  it('letter-sounds recap.4 wraps "four" WITHOUT a leading break (global word, not a mnemonic)', () => {
    expect(renderSsmlInnerText('You earned four stars!', 'letter-sounds')).toBe(
      'You earned <phoneme alphabet="ipa" ph="fɔːr">four</phoneme> stars!',
    )
  })

  it('letter-sounds streak.4 matches the math-tier render (collapses the dedup split)', () => {
    const math = renderSsmlInnerText('Four in a row! Wow!')
    const letterSounds = renderSsmlInnerText(
      'Four in a row! Wow!',
      'letter-sounds',
    )
    expect(letterSounds).toBe(math)
  })

  it('STILL injects the 300ms break before a genuine tier-scoped mnemonic', () => {
    expect(renderSsmlInnerText('Which letter says mmm.', 'letter-sounds')).toBe(
      'Which letter says <break time="300ms"/><phoneme alphabet="ipa" ph="m">mmm</phoneme>.',
    )
  })
})

describe('cluster 2 — break after "This one is X." in the fricative giveAnswer', () => {
  it('injects a 350ms break after the letter sentence for S/F/H fricative giveAnswers', () => {
    expect(
      renderSsmlInnerText('This one is S. S says it. sss?', 'letter-sounds'),
    ).toBe(
      'This one is S.<break time="350ms"/>S says it. ' +
        '<break time="300ms"/><phoneme alphabet="ipa" ph="s">sss</phoneme>?',
    )
    expect(
      renderSsmlInnerText('This one is F. F says it. fff?', 'letter-sounds'),
    ).toContain('This one is F.<break time="350ms"/>')
    expect(
      renderSsmlInnerText('This one is H. H says it. hhh?', 'letter-sounds'),
    ).toContain('This one is H.<break time="350ms"/>')
  })

  it('does NOT add the break to a PASSING plain giveAnswer (M/L/B/O/N)', () => {
    // These were clean on the baseline — must stay byte-identical.
    for (const [text, ipa, mnem] of [
      ['This one is M. mmm.', 'm', 'mmm'],
      ['This one is O. ooo.', 'ɒ', 'ooo'],
      ['This one is B. buh.', 'bə', 'buh'],
    ] as const) {
      expect(renderSsmlInnerText(text, 'letter-sounds')).toBe(
        text.replace(
          new RegExp(`\\b${mnem}\\b`),
          `<break time="300ms"/><phoneme alphabet="ipa" ph="${ipa}">${mnem}</phoneme>`,
        ),
      )
      expect(renderSsmlInnerText(text, 'letter-sounds')).not.toContain('350ms')
    }
  })

  it('adds the break to the flagged "This one is A. aaa." giveAnswer but NOT the passing O giveAnswer', () => {
    expect(
      renderSsmlInnerText('This one is A. aaa.', 'letter-sounds'),
    ).toContain('This one is A.<break time="350ms"/>')
    expect(
      renderSsmlInnerText('This one is O. ooo.', 'letter-sounds'),
    ).not.toContain('350ms')
  })
})

describe('cluster 5 — scratchy isolated sounds softened (slot × class gated)', () => {
  it('softens vvv in EVERY /v/ slot with the STRONGER round-2 prosody + length-marked IPA (86ca7y0hj)', () => {
    // Round-2 (86ca7y0hj): the round-1 `və` + rate-only `-12%` was not
    // enough — Thomas re-tested the shipped bytes and still heard "very
    // scratchy" ×4. Stronger treatment: length-marked `vːə` (sustained
    // fricative, not a clipped burst) + a vvv-specific prosody (deeper rate
    // `-20%` + volume cut `-12%` to tame the loud onset).
    for (const text of [
      'Which letter says vvv?',
      'Yes. V says it. vvv?',
      'It says vvv?',
    ]) {
      expect(renderSsmlInnerText(text, 'letter-sounds')).toContain(
        '<prosody rate="-20%" volume="-12%"><phoneme alphabet="ipa" ph="vːə">vvv</phoneme></prosody>',
      )
    }
  })

  it('softens aaa/ooo in the CORRECT slot only (read/hint stay byte-identical)', () => {
    expect(renderSsmlInnerText('Yes. A. aaa.', 'letter-sounds')).toContain(
      '<prosody rate="-12%"><phoneme alphabet="ipa" ph="æ">aaa</phoneme></prosody>',
    )
    expect(renderSsmlInnerText('Yes. O. ooo.', 'letter-sounds')).toContain(
      '<prosody rate="-12%"><phoneme alphabet="ipa" ph="ɒ">ooo</phoneme></prosody>',
    )
    // read + hint were clean on the baseline → NO prosody wrap.
    expect(
      renderSsmlInnerText('Which letter says aaa.', 'letter-sounds'),
    ).not.toContain('<prosody')
    expect(renderSsmlInnerText('Listen. ooo.', 'letter-sounds')).not.toContain(
      '<prosody',
    )
  })

  it('softens aaa in the giveAnswer slot (flagged) but NOT ooo (O giveAnswer passed)', () => {
    expect(
      renderSsmlInnerText('This one is A. aaa.', 'letter-sounds'),
    ).toContain(
      '<prosody rate="-12%"><phoneme alphabet="ipa" ph="æ">aaa</phoneme></prosody>',
    )
    expect(
      renderSsmlInnerText('This one is O. ooo.', 'letter-sounds'),
    ).not.toContain('<prosody')
  })

  it('does NOT soften a non-scratchy mnemonic even in the correct slot', () => {
    expect(renderSsmlInnerText('Yes. M. mmm.', 'letter-sounds')).not.toContain(
      '<prosody',
    )
  })

  it('softenScratchy is opt-in on applyPhonemeOverrides (default off)', () => {
    expect(applyPhonemeOverrides('says vvv', 'letter-sounds')).not.toContain(
      '<prosody',
    )
    // vvv carries the round-2 stronger per-mnemonic prosody (86ca7y0hj):
    // deeper rate + a volume cut, distinct from the shared `-12%` vowels.
    expect(
      applyPhonemeOverrides('says vvv', 'letter-sounds', 300, true),
    ).toContain('<prosody rate="-20%" volume="-12%">')
  })
})

describe('cluster 4b — stress de-stressed "Four comes after three."', () => {
  it('stresses the subject "Four" with a pitch lift + deeper rate + lead break (round-2 stronger, 86ca7y0hj)', () => {
    // <prosody> (not <emphasis> — Olivia ignores emphasis on this voice).
    // Round-2: pitch `+12%` is the dominant stress cue that separates the
    // stressed "four" from the reduced "for" Thomas still heard at the
    // round-1 rate-only `-18%`; rate deepened to `-25%`, break to 250ms.
    expect(renderSsmlInnerText('Look. Four comes after three.')).toBe(
      'Look. <break time="250ms"/><prosody pitch="+12%" rate="-25%">' +
        '<phoneme alphabet="ipa" ph="fɔːr">Four</phoneme>' +
        '</prosody> comes after three.',
    )
  })

  it('is text-shape gated — other "four" math utterances stay on the plain override', () => {
    // Sentence-final fours (baseline-passing) keep the un-emphasised wrap.
    expect(renderSsmlInnerText('You earned four stars!')).toBe(
      'You earned <phoneme alphabet="ipa" ph="fɔːr">four</phoneme> stars!',
    )
    expect(
      renderFourSubjectHint('You earned four stars!', undefined),
    ).toBeNull()
  })

  it('does not fire on a word-song tier (tierFilter set → null)', () => {
    expect(
      renderFourSubjectHint('Look. Four comes after three.', 'cvc-words'),
    ).toBeNull()
  })
})

describe('cluster 5 — letter-NAMES scratchy hint (e drum-beat, O scratchy)', () => {
  it('keeps "e" on the round-1 -12% shape but gives "O" the STRONGER round-2 prosody (86ca7y0hj)', () => {
    // "e" GREENED at round-1 → byte-identical -12% rate-only.
    expect(
      renderLetterNamesScratchyHint("Let's look. e.", 'letter-names'),
    ).toBe(
      'Let&apos;s look.<break time="250ms"/><prosody rate="-12%">e.</prosody>',
    )
    // "O" was "still slightly scratchy" → deeper rate -18% + volume -8% to
    // take the edge off the harder "oh" onset (only the O letter changes).
    expect(
      renderLetterNamesScratchyHint("Let's look. O.", 'letter-names'),
    ).toBe(
      'Let&apos;s look.<break time="250ms"/><prosody rate="-18%" volume="-8%">O.</prosody>',
    )
  })

  it('returns null (falls through, byte-identical) for the PASSING letter-names hints', () => {
    for (const text of [
      "Let's look. C.",
      "Let's look. G.",
      "Let's look. J.",
      "Let's look. b.",
      "Let's look. W.",
      "Let's look. d.",
    ]) {
      expect(renderLetterNamesScratchyHint(text, 'letter-names')).toBeNull()
      // …and the full render path leaves them unchanged.
      expect(renderSsmlInnerText(text, 'letter-names')).toBe(
        text.replace(/'/g, '&apos;'),
      )
    }
  })

  it('does not fire off the letter-names tier (wrong tier → null)', () => {
    expect(
      renderLetterNamesScratchyHint("Let's look. e.", 'letter-sounds'),
    ).toBeNull()
    expect(
      renderLetterNamesScratchyHint("Let's look. e.", undefined),
    ).toBeNull()
  })
})

describe('renderSightWordsInnerText — weak-word stress (Wave 11, 86ca7xmr8)', () => {
  // Dave's W11-01 ruling implemented via <prosody> (Olivia IGNORES
  // <emphasis>; pitch is the stress lever per PR #384). Only the five
  // phonologically-weak target tokens {the, a, of, in, to} get stressed,
  // and ONLY the TARGET token — the carrier "the" in "Find the word:"
  // stays bare.
  const STRESS_OPEN = '<prosody pitch="+10%" rate="-10%">'
  const STRESS_CLOSE = '</prosody>'

  it('stresses ONLY the weak target token in a read line (carrier "the" stays bare)', () => {
    expect(
      renderSightWordsInnerText('Find the word: the.', 'sight-words'),
    ).toBe(`Find the word: ${STRESS_OPEN}the${STRESS_CLOSE}.`)
  })

  it('stresses the weak target token in a hint line', () => {
    expect(renderSightWordsInnerText('Look. The.', 'sight-words')).toBe(
      `Look. ${STRESS_OPEN}The${STRESS_CLOSE}.`,
    )
  })

  it('stresses the weak target token in a correct line', () => {
    expect(renderSightWordsInnerText('Yes! A.', 'sight-words')).toBe(
      `Yes! ${STRESS_OPEN}A${STRESS_CLOSE}.`,
    )
  })

  it('covers all five weak tokens {the, a, of, in, to}', () => {
    for (const w of ['the', 'a', 'of', 'in', 'to']) {
      const cap = w[0]!.toUpperCase() + w.slice(1)
      expect(
        renderSightWordsInnerText(`Find the word: ${w}.`, 'sight-words'),
      ).toBe(`Find the word: ${STRESS_OPEN}${w}${STRESS_CLOSE}.`)
      // Case-insensitive token match, case-preserved in output.
      expect(renderSightWordsInnerText(`Look. ${cap}.`, 'sight-words')).toBe(
        `Look. ${STRESS_OPEN}${cap}${STRESS_CLOSE}.`,
      )
    }
  })

  it('returns null for STRONG sight-word targets (was/said/go/...) — they fall through unchanged', () => {
    // Strong monosyllables don't de-stress to schwa; no stress fix needed,
    // so they take the default plain-text path (byte-stable).
    expect(
      renderSightWordsInnerText('Find the word: was.', 'sight-words'),
    ).toBeNull()
    expect(renderSightWordsInnerText('Yes! Said.', 'sight-words')).toBeNull()
    expect(renderSightWordsInnerText('Look. Go.', 'sight-words')).toBeNull()
  })

  it('returns null off the sight-words tier (wrong tier → no stress fix)', () => {
    expect(
      renderSightWordsInnerText('Find the word: the.', 'cvc-words'),
    ).toBeNull()
    expect(
      renderSightWordsInnerText('Find the word: the.', undefined),
    ).toBeNull()
  })

  it('does not match a non-sight-word utterance shape', () => {
    expect(renderSightWordsInnerText('Read the cat.', 'sight-words')).toBeNull()
    expect(
      renderSightWordsInnerText('Hmm... try again?', 'sight-words'),
    ).toBeNull()
  })

  it('flows through the full renderSsmlInnerText dispatch on the sight-words tier', () => {
    // Integration: the dispatch branch in renderSsmlInnerText fires the
    // weak-word stress on the sight-words tier, and leaves strong targets
    // on the plain path.
    expect(renderSsmlInnerText('Find the word: the.', 'sight-words')).toBe(
      `Find the word: ${STRESS_OPEN}the${STRESS_CLOSE}.`,
    )
    expect(renderSsmlInnerText('Find the word: was.', 'sight-words')).toBe(
      'Find the word: was.',
    )
  })
})

describe('renderLetterSoundsInnerText — passing-baseline byte-identity guard', () => {
  // The whole point of the slot×class gating: a re-render must touch ONLY
  // the flagged utterances. These passed on Thomas's baseline and MUST
  // render exactly as the pre-fix pipeline did (no break, no prosody).
  const PASSING: Array<[string, string]> = [
    [
      'Which letter says mmm.',
      '<break time="300ms"/><phoneme alphabet="ipa" ph="m">mmm</phoneme>',
    ],
    [
      'Listen. aaa.',
      '<break time="300ms"/><phoneme alphabet="ipa" ph="æ">aaa</phoneme>',
    ],
    [
      'Listen. ooo.',
      '<break time="300ms"/><phoneme alphabet="ipa" ph="ɒ">ooo</phoneme>',
    ],
    [
      'Which letter says ooo.',
      '<break time="300ms"/><phoneme alphabet="ipa" ph="ɒ">ooo</phoneme>',
    ],
    [
      'This one is M. mmm.',
      'This one is M. <break time="300ms"/><phoneme alphabet="ipa" ph="m">mmm</phoneme>.',
    ],
    [
      'This one is O. ooo.',
      'This one is O. <break time="300ms"/><phoneme alphabet="ipa" ph="ɒ">ooo</phoneme>.',
    ],
  ]

  it('renders every passing slot with no 350ms break and no softening prosody', () => {
    for (const [text] of PASSING) {
      const out = renderLetterSoundsInnerText(text, 'letter-sounds')
      expect(out).not.toContain('350ms')
      expect(out).not.toContain('<prosody')
    }
  })

  it('matches the exact expected SSML for the give-answer passing siblings', () => {
    expect(
      renderLetterSoundsInnerText('This one is M. mmm.', 'letter-sounds'),
    ).toBe(
      'This one is M. <break time="300ms"/><phoneme alphabet="ipa" ph="m">mmm</phoneme>.',
    )
  })
})

// --- Unicode-punctuation round-trip (ticket 86c9qhr91) ------------------
//
// The bug: PR #192 baked an em-dash (U+2014, UTF-8 bytes `E2 80 94`) in a
// canon utterance. When the resulting SSML hit Azure's synthesizer it came
// back as the mojibake byte sequence `c3 a2 e2 82 ac e2 80 9d` — the
// classic UTF-8 → Windows-1252 → UTF-8 double-encoding signature. Azure
// then dutifully vocalized the mojibake characters as letters, producing
// "asesinati"-shaped gibberish in place of the em-dash pause.
//
// The root cause: Azure's SSML endpoint, given a body without an explicit
// charset on the Content-Type header, can fall back to a non-UTF-8 default
// (Windows-1252 in the observed case). Adding `; charset=utf-8` pins the
// decode and eliminates the mojibake path.
//
// These tests pin the contract:
//   1. The Content-Type header carries `; charset=utf-8`.
//   2. The SSML body is sent as a JS string (which fetch encodes as UTF-8
//      by default per the WHATWG Fetch spec) and contains the unicode
//      codepoints unchanged.
//   3. Re-encoding the body as UTF-8 bytes produces the original
//      codepoint byte sequences, NOT the mojibake double-encoding.
describe('synthesizeUtterance unicode-punctuation round-trip (86c9qhr91)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // The four unicode-punctuation codepoints most likely to appear in
  // human-authored canon prose: em-dash, en-dash, curly opening quote,
  // curly closing quote, plus the horizontal ellipsis. Each is paired
  // with its UTF-8 byte sequence so the test asserts on actual wire
  // bytes, not just string-equality.
  const UNICODE_CASES: Array<{
    name: string
    char: string
    utf8Bytes: number[]
  }> = [
    { name: 'em-dash (U+2014)', char: '—', utf8Bytes: [0xe2, 0x80, 0x94] },
    { name: 'en-dash (U+2013)', char: '–', utf8Bytes: [0xe2, 0x80, 0x93] },
    {
      name: 'curly open quote (U+201C)',
      char: '“',
      utf8Bytes: [0xe2, 0x80, 0x9c],
    },
    {
      name: 'curly close quote (U+201D)',
      char: '”',
      utf8Bytes: [0xe2, 0x80, 0x9d],
    },
    {
      name: 'horizontal ellipsis (U+2026)',
      char: '…',
      utf8Bytes: [0xe2, 0x80, 0xa6],
    },
  ]

  // Typed fetch-mock factory — explicit signature so `mock.calls[0][1]`
  // narrows to RequestInit instead of `never`. The synthesizeUtterance
  // suite above uses the same shape inline; this is its hoisted form.
  function makeFetchMock() {
    const fn =
      vi.fn<(input: string | URL, init?: RequestInit) => Promise<Response>>()
    fn.mockImplementation(async () =>
      fakeOkResponse(new Uint8Array([0xff, 0xfb])),
    )
    return fn
  }

  it('Content-Type header includes charset=utf-8', async () => {
    const fetchFn = makeFetchMock()
    await synthesizeUtterance(HAPPY_REQ, {
      fetchFn: fetchFn as unknown as typeof fetch,
      env: TEST_ENV,
    })
    const headers = fetchFn.mock.calls[0]![1]!.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/ssml+xml; charset=utf-8')
  })

  for (const { name, char, utf8Bytes } of UNICODE_CASES) {
    it(`preserves ${name} in the SSML body and as UTF-8 wire bytes`, async () => {
      const fetchFn = makeFetchMock()
      await synthesizeUtterance(
        { ...HAPPY_REQ, text: `before${char}after` },
        {
          fetchFn: fetchFn as unknown as typeof fetch,
          env: TEST_ENV,
        },
      )
      const body = fetchFn.mock.calls[0]![1]!.body as string
      // The raw codepoint round-trips through buildSsmlBody intact —
      // escapeSsml only touches the five XML metacharacters (& < > " '),
      // so unicode punctuation flows through untouched.
      expect(body).toContain(`before${char}after`)
      // Re-encode the body the way fetch will when it sends — UTF-8.
      // The unicode codepoint must appear as its canonical UTF-8 byte
      // sequence on the wire, NOT as the CP1252 mojibake double-
      // encoding.
      const wireBytes = new TextEncoder().encode(body)
      const needle = new Uint8Array(utf8Bytes)
      expect(indexOfBytes(wireBytes, needle)).toBeGreaterThanOrEqual(0)
      // Canary: the mojibake double-encoding signature for em-dash
      // starts with `c3 a2` (the UTF-8 of `Â`, which is what `E2` becomes
      // when re-encoded after a CP1252 decode). It must NOT appear in
      // the wire bytes for any of these inputs.
      const mojibakeCanary = new Uint8Array([0xc3, 0xa2])
      expect(indexOfBytes(wireBytes, mojibakeCanary)).toBe(-1)
    })
  }

  it('em-dash specifically: the exact PR #192 corruption signature does NOT appear', async () => {
    // The observed corruption from PR #192's bake of "..." → em-dash:
    // canon JSON contained `c3 a2 e2 82 ac e2 80 9d` instead of the
    // original `e2 80 94`. Pin that the corruption signature is absent
    // from the body we send to Azure.
    const fetchFn = makeFetchMock()
    await synthesizeUtterance(
      { ...HAPPY_REQ, text: 'wait—listen' },
      {
        fetchFn: fetchFn as unknown as typeof fetch,
        env: TEST_ENV,
      },
    )
    const body = fetchFn.mock.calls[0]![1]!.body as string
    const wireBytes = new TextEncoder().encode(body)
    // Original em-dash bytes present.
    expect(
      indexOfBytes(wireBytes, new Uint8Array([0xe2, 0x80, 0x94])),
    ).toBeGreaterThanOrEqual(0)
    // Corruption signature absent.
    const corruption = new Uint8Array([
      0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xe2, 0x80, 0x9d,
    ])
    expect(indexOfBytes(wireBytes, corruption)).toBe(-1)
  })

  it('combined unicode payload: em-dash + curly quotes + ellipsis all survive', async () => {
    const fetchFn = makeFetchMock()
    const text = '“wait—listen…”'
    await synthesizeUtterance(
      { ...HAPPY_REQ, text },
      {
        fetchFn: fetchFn as unknown as typeof fetch,
        env: TEST_ENV,
      },
    )
    const body = fetchFn.mock.calls[0]![1]!.body as string
    expect(body).toContain(text)
    const wireBytes = new TextEncoder().encode(body)
    // Each of the four codepoints present as canonical UTF-8.
    const expected: Array<[string, number[]]> = [
      ['curly open quote', [0xe2, 0x80, 0x9c]],
      ['em-dash', [0xe2, 0x80, 0x94]],
      ['ellipsis', [0xe2, 0x80, 0xa6]],
      ['curly close quote', [0xe2, 0x80, 0x9d]],
    ]
    for (const [label, bytes] of expected) {
      expect(
        indexOfBytes(wireBytes, new Uint8Array(bytes)),
        `${label} bytes missing from wire payload`,
      ).toBeGreaterThanOrEqual(0)
    }
    // No CP1252-shaped mojibake on the wire.
    expect(indexOfBytes(wireBytes, new Uint8Array([0xc3, 0xa2]))).toBe(-1)
  })
})

/** Find the first index of `needle` in `haystack`. Returns -1 if not
 * found. Naive O(n*m) scan — fine for the small fixtures these tests
 * use (a few hundred bytes of SSML, 2-8 byte needles). */
function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  if (needle.length === 0) return 0
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}
