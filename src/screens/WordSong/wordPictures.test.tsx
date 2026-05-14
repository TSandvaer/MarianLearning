import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WordPicture } from './wordPictures'
import { ALL_WORDS } from './wordPack'

describe('WordPicture', () => {
  it('renders an SVG with role=img and the picture key as data-attr', () => {
    render(<WordPicture pictureKey="cat" />)
    const svg = screen.getByTestId('word-picture')
    expect(svg.tagName.toLowerCase()).toBe('svg')
    expect(svg).toHaveAttribute('role', 'img')
    expect(svg).toHaveAttribute('data-picture-key', 'cat')
  })

  it('uses the picture key as default aria-label', () => {
    render(<WordPicture pictureKey="cat" />)
    const svg = screen.getByTestId('word-picture')
    expect(svg).toHaveAttribute('aria-label', 'cat')
  })

  it('honours an explicit aria-label override', () => {
    render(<WordPicture pictureKey="cat" ariaLabel="A cat" />)
    expect(screen.getByTestId('word-picture')).toHaveAttribute(
      'aria-label',
      'A cat',
    )
  })

  it('marks data-large=true when the large prop is set', () => {
    render(<WordPicture pictureKey="cat" large />)
    expect(screen.getByTestId('word-picture')).toHaveAttribute(
      'data-large',
      'true',
    )
  })

  // Picture keys whose picture body has NOT yet shipped — they
  // legitimately render the unknown-key silhouette fallback (graceful,
  // not crashing) until their picture-pack ticket lands. The digraphs-sh
  // tier's 7 sh-target pictures + 2 s-contrast distractor pictures
  // (`sell`, `sop`) are authored in a SEPARATE picture-pack ticket per
  // `design/word-song/digraphs-sh-word-list.md` §3 + §10 finding #13 —
  // the wordPack-side ticket (this one) ships the WordEntry rows so the
  // planner + distractor matrix can resolve them; the chips fall back to
  // the silhouette until `digraphs-sh-picture-pack-prompts.md` ships.
  // Same posture as the short-o-extension / short-i pre-embed windows.
  // REMOVE entries from this set as each picture body lands.
  const PENDING_PICTURE_PACK = new Set<string>([
    'ship',
    'shell',
    'shoe',
    'sheep',
    'shark',
    'shed',
    'shop',
    'sell',
    'sop',
  ])

  it('renders a non-empty body for every picture in the curated pack', () => {
    // Smoke test: every entry in ALL_WORDS (target + distractor) must
    // render at least one inner SVG primitive — no key falls through to
    // the unknown-picture text fallback. EXCEPT keys in
    // PENDING_PICTURE_PACK, whose picture body ships in a separate ticket.
    for (const entry of ALL_WORDS) {
      if (PENDING_PICTURE_PACK.has(entry.pictureKey)) continue
      const { container, unmount } = render(
        <WordPicture pictureKey={entry.pictureKey} />,
      )
      const svg = container.querySelector('svg[data-testid="word-picture"]')
      expect(svg, `key=${entry.pictureKey}`).toBeTruthy()
      // The fallback renders a single <text> child; real pictures render
      // <g> with multiple primitives. Assert we got the latter.
      const fallbackText = svg!.querySelector('text')
      expect(
        fallbackText,
        `picture key "${entry.pictureKey}" rendered the unknown-picture fallback — add a renderPictureBody case`,
      ).toBeNull()
      unmount()
    }
  })

  it('digraphs-sh tier keys render the silhouette fallback until the picture-pack ticket lands', () => {
    // Positive assertion of the PENDING_PICTURE_PACK posture: each
    // not-yet-pictured digraphs-sh key renders the graceful silhouette
    // fallback (a <text> child with the key) — NOT a crash, NOT a blank
    // SVG. When the picture-pack ticket adds a renderPictureBody case for
    // a key, remove it from PENDING_PICTURE_PACK and this loop shrinks.
    let fallbackCount = 0
    for (const key of PENDING_PICTURE_PACK) {
      const { container, unmount } = render(<WordPicture pictureKey={key} />)
      const svg = container.querySelector('svg[data-testid="word-picture"]')
      expect(svg, `key=${key}`).toBeTruthy()
      const text = svg!.querySelector('text')
      expect(text?.textContent, `key=${key} fallback text`).toBe(key)
      fallbackCount += 1
      unmount()
    }
    expect(fallbackCount).toBe(9)
  })

  it('falls back to the unknown-picture text shape for an unknown key', () => {
    const { container } = render(<WordPicture pictureKey="not-a-real-key" />)
    const svg = container.querySelector('svg[data-testid="word-picture"]')
    expect(svg).toBeTruthy()
    // The unknown fallback renders the key as text inside the SVG.
    const text = svg!.querySelector('text')
    expect(text?.textContent).toBe('not-a-real-key')
  })
})
