import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GUIDANCE_LINES,
  GUIDANCE_LINES_AWAITING_RENDER,
  guidanceLine,
} from './guidanceLines'
import { PATH_LINES } from './pathLines'

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const norm = (s: string) => s.replace(/’/g, "'")

describe('GUIDANCE_LINES (Guidance G3)', () => {
  it('has exactly the expected line count per kind', () => {
    const counts: Record<string, number> = {}
    for (const l of GUIDANCE_LINES) counts[l.kind] = (counts[l.kind] ?? 0) + 1
    expect(counts).toEqual({
      'hub-suggest': 2,
      'hub-sleeping': 2,
      'hub-both-sleeping': 1,
      'hub-woke': 1,
      'hub-woke-one': 1,
      'hub-one-more': 1,
      'end-right': 2,
      'end-flower': 1,
      'end-count': 3,
      'end-sleeps': 1,
      'end-path-opens': 1,
      'end-not-yet-praise': 1,
      'end-not-yet-again': 1,
      'end-world-done': 1,
      'end-fast-track': 1,
      'session-review': 1,
      'session-warmup': 1,
      'session-knew': 1,
      'session-peek-open': 1,
      'session-peek-close': 1,
    })
    expect(GUIDANCE_LINES).toHaveLength(25)
    expect(new Set(GUIDANCE_LINES.map((l) => l.id)).size).toBe(25)
    expect(new Set(GUIDANCE_LINES.map((l) => l.text)).size).toBe(25)
    expect(new Set(GUIDANCE_LINES.map((l) => l.src)).size).toBe(25)
  })

  it('bakes each world and count variant', () => {
    expect(guidanceLine('guide.hub.suggest.math')?.text).toBe(
      "Let's grow a flower in Number Garden! Or pick Word Song.",
    )
    expect(guidanceLine('guide.hub.suggest.word-song')?.text).toBe(
      "Let's grow a flower in Word Song! Or pick Number Garden.",
    )
    expect(guidanceLine('guide.hub.sleeping.math')?.text).toBe(
      "Your flower is sleeping. Let's play Number Garden!",
    )
    expect(guidanceLine('guide.hub.sleeping.word-song')?.text).toBe(
      "Your flower is sleeping. Let's play Word Song!",
    )
    expect(
      ['1', '2', '3'].map((n) => guidanceLine(`guide.end.count.${n}`)?.text),
    ).toEqual(['One of three!', 'Two of three!', 'Three of three!'])
    expect(guidanceLine('guide.end.right.7')?.text).toBe(
      'Seven right! You worked hard!',
    )
    expect(guidanceLine('guide.end.right.8')?.text).toBe(
      'Eight right! You worked hard!',
    )
    expect(guidanceLine('guide.hub.woke.one')?.text).toBe(
      'Your flower woke up!',
    )
    expect(guidanceLine('guide.end.world-done')?.src).toBe(
      '/assets/audio/path/guide-end-world-done.mp3',
    )
    expect(guidanceLine('guide.end.right.7')?.src).toBe(
      '/assets/audio/path/guide-end-right-7.mp3',
    )
    // The review opener and the warm-up line (native review / warm-up
    // spec § 4, approved as written by Thomas 2026-10-14).
    expect(guidanceLine('guide.session.review')?.text).toBe(
      "Your flower is sleeping. Let's play the ones you know!",
    )
    expect(guidanceLine('guide.session.review')?.src).toBe(
      '/assets/audio/path/guide-session-review.mp3',
    )
    expect(guidanceLine('guide.session.warmup')?.text).toBe(
      'Remember this one?',
    )
    expect(guidanceLine('guide.session.warmup')?.src).toBe(
      '/assets/audio/path/guide-session-warmup.mp3',
    )
  })

  it('bakes the fast-track spec § 8 lines with their exact approved texts (AC 11)', () => {
    expect(guidanceLine('guide.end.fast-track')?.text).toBe(
      'You know this! All your flowers grew!',
    )
    expect(guidanceLine('guide.session.knew')?.text).toBe(
      'You just knew that one!',
    )
    expect(guidanceLine('guide.session.peek-open')?.text).toBe(
      "Let's look at this one!",
    )
    expect(guidanceLine('guide.session.peek-close')?.text).toBe(
      'This one is for later. You will learn it!',
    )
    expect(guidanceLine('guide.session.peek-close')?.src).toBe(
      '/assets/audio/path/guide-session-peek-close.mp3',
    )
  })

  it('has a bundled MP3 for every line but the ones awaiting their render', () => {
    const missing = GUIDANCE_LINES.filter(
      (l) => !existsSync(join(process.cwd(), 'public', l.src)),
    ).map((l) => l.id)
    // Exactly the awaiting list: the render commit adds the clips AND
    // empties `GUIDANCE_LINES_AWAITING_RENDER`.
    expect(missing).toEqual([...GUIDANCE_LINES_AWAITING_RENDER])
    expect(
      GUIDANCE_LINES.filter((l) =>
        l.src.startsWith('/assets/audio/path/guide-'),
      ),
    ).toHaveLength(25)
  })

  it('repeats no Emma’s Path line', () => {
    const pathTexts = new Set(PATH_LINES.map((l) => l.text))
    const pathSrcs = new Set(PATH_LINES.map((l) => l.src))
    expect(GUIDANCE_LINES.filter((l) => pathTexts.has(l.text))).toEqual([])
    expect(GUIDANCE_LINES.filter((l) => pathSrcs.has(l.src))).toEqual([])
  })

  it('covers every Emma caption in the approved guidance mockup', () => {
    const html = read('design/emmas-path/redesign/guidance-mockup.html')
    const states = html.slice(
      html.indexOf('const STATES'),
      html.indexOf('const ORDER'),
    )
    const captions = [...states.matchAll(/lines:\s*\[([\s\S]*?)\],\s*look:/g)]
      .flatMap((m) => [...m[1].matchAll(/(['"])((?:(?!\1).)+)\1/g)])
      .map((m) => norm(m[2]))
    expect(captions.length).toBeGreaterThanOrEqual(15)
    const known = new Set([
      ...GUIDANCE_LINES.map((l) => l.text),
      ...PATH_LINES.filter((l) => l.src !== null).map((l) => l.text),
    ])
    expect(captions.filter((c) => !known.has(c))).toEqual([])
  })

  it('lists every clip, with its text, as the voice-QA Guidance group', () => {
    const html = read('public/voice-qa.html')
    const block = html.slice(
      html.indexOf('const GUIDANCE_FILES'),
      html.indexOf('// ── State'),
    )
    const listed = [
      ...block.matchAll(
        /\[\s*(['"])([^'"]+\.mp3)\1,\s*(['"])(.*?)\3\s*,?\s*\]/g,
      ),
    ].map((m) => `${m[2]}|${m[4]}`)
    const expected = GUIDANCE_LINES.map(
      (l) => `${l.src.split('/').pop()}|${l.text}`,
    )
    expect(listed.sort()).toEqual(expected.sort())
    expect(html).toContain("appendGroup('Guidance'")
  })
})
