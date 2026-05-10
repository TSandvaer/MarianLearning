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

  // ── Short-i opener IPA scaffolding (ticket 86c9qdp1q) ────────────
  // Pin the two content-scoped overrides: `ih → /ɪ/`, `ee → /iː/`.
  // The rationale is in `design/research/short-i-opener-phrasing.md` —
  // both tokens appear ONLY in the cvc-words-short-i opener line so
  // the overrides have zero false-fire surface in any other planner
  // output.
  //
  // PR #192 follow-up (2026-05-10): the originally-shipped `pig` →
  // /pɪɡ/ override was REMOVED after Thomas's iPad ear-test on the
  // PR #192 Vercel preview. The IPA wrap rendered fine on the slow
  // instructional read line ("Read the pig.") but caused robotic /
  // gibberish prosody on the faster cheerful per-correct celebration
  // utterances ("Yes! Pig.", "Let's look. Pig.", "This one is pig.").
  // Azure's default lexicon already pronounces "pig" correctly, so
  // the override was buying nothing on the read line and breaking
  // celebrations. The contract guard below pins that "pig" passes
  // through plain — do not re-add it without first listening-confirming
  // a per-utterance-id scoping that limits the wrap to read-shaped IDs.

  it('wraps "ih" (short-i opener token) in <phoneme alphabet="ipa" ph="ɪ">', () => {
    expect(applyPhonemeOverrides('says ih.')).toBe(
      'says <phoneme alphabet="ipa" ph="ɪ">ih</phoneme>.',
    )
  })

  it('wraps "ee" (contrast partner) in <phoneme alphabet="ipa" ph="iː">', () => {
    expect(applyPhonemeOverrides("not 'ee' —")).toBe(
      'not &apos;<phoneme alphabet="ipa" ph="iː">ee</phoneme>&apos; —',
    )
  })

  it('passes "pig" through unchanged (override removed; PR #192 ear-test feedback)', () => {
    // Contract guard against a regression that re-adds `pig` to
    // PHONEME_OVERRIDES at module scope. Per PR #192 follow-up
    // (2026-05-10) the global wrap caused robotic prosody on the
    // per-correct celebration utterances. If a future PR wants
    // anchor-word IPA back, scope it per-utterance-id (read-only),
    // do not put it in the module-level map.
    expect(applyPhonemeOverrides('Read the pig.')).toBe('Read the pig.')
    expect(applyPhonemeOverrides('Yes! Pig.')).toBe('Yes! Pig.')
    expect(applyPhonemeOverrides("Let's look. Pig.")).toBe(
      'Let&apos;s look. Pig.',
    )
    expect(applyPhonemeOverrides('This one is pig.')).toBe('This one is pig.')
    // Zero phoneme wraps total across the four pig-bearing utterances.
    const total = [
      'Read the pig.',
      'Yes! Pig.',
      "Let's look. Pig.",
      'This one is pig.',
    ]
      .map((s) => applyPhonemeOverrides(s).match(/<phoneme/g)?.length ?? 0)
      .reduce((a, b) => a + b, 0)
    expect(total).toBe(0)
  })

  it('emits exactly three overrides on the full short-i opener line (two ih + one ee; pig passes through plain)', () => {
    // The exact line the canon bakes. Pin all wraps in one pass.
    const out = applyPhonemeOverrides(
      "Listen — short i says ih. Not 'ee' — just ih. Like pig: /p/-/ɪ/-/g/.",
    )
    // Two `ih` wraps + one `ee` wrap + ZERO `pig` wraps = 3 phoneme tags.
    const phonemeCount = (out.match(/<phoneme alphabet="ipa"/g) ?? []).length
    expect(phonemeCount).toBe(3)
    const ihCount = (out.match(/<phoneme alphabet="ipa" ph="ɪ">/g) ?? []).length
    expect(ihCount).toBe(2)
    const eeCount = (out.match(/<phoneme alphabet="ipa" ph="iː">/g) ?? [])
      .length
    expect(eeCount).toBe(1)
    // `pig` MUST NOT be wrapped — see the contract guard above.
    expect(out).not.toContain('<phoneme alphabet="ipa" ph="pɪɡ">')
    // The bare token "pig" is preserved verbatim inside the opener
    // (Azure's default lexicon voices it correctly on the slow read
    // prosody used for the opener line).
    expect(out).toContain('Like pig:')
  })

  it('does NOT match "ih" or "ee" inside larger words (boundary guard)', () => {
    // "withholding", "shih-tzu", "feed", "speedy" all contain "ih"/"ee"
    // as a substring but never on word boundaries. The \b regex must
    // not fire.
    expect(applyPhonemeOverrides('withholding')).toBe('withholding')
    expect(applyPhonemeOverrides('feed the cat')).toBe('feed the cat')
    expect(applyPhonemeOverrides('speedy')).toBe('speedy')
    expect(applyPhonemeOverrides('withholding')).not.toContain('<phoneme')
    expect(applyPhonemeOverrides('feed the cat')).not.toContain('<phoneme')
    expect(applyPhonemeOverrides('speedy')).not.toContain('<phoneme')
  })

  it('does NOT match "pig" inside larger words (pigeon / pigsty boundary guard, kept as forward-compat)', () => {
    // Forward-compat guard: if a future PR re-introduces a `pig`
    // override (per-utterance-id scoped per the PR #192 follow-up
    // note), this test must continue to pass — the regex must still
    // use \b on both edges.
    expect(applyPhonemeOverrides('pigeon')).toBe('pigeon')
    expect(applyPhonemeOverrides('pigeon')).not.toContain('<phoneme')
    expect(applyPhonemeOverrides('pigsty')).toBe('pigsty')
    expect(applyPhonemeOverrides('pigsty')).not.toContain('<phoneme')
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
    expect(headers['Content-Type']).toBe('application/ssml+xml')
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
