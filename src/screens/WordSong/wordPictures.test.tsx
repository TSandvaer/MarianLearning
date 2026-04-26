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

  it('renders a non-empty body for every picture in the curated pack', () => {
    // Smoke test: every entry in ALL_WORDS (target + distractor) must
    // render at least one inner SVG primitive — no key falls through to
    // the unknown-picture text fallback.
    for (const entry of ALL_WORDS) {
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

  it('falls back to the unknown-picture text shape for an unknown key', () => {
    const { container } = render(<WordPicture pictureKey="not-a-real-key" />)
    const svg = container.querySelector('svg[data-testid="word-picture"]')
    expect(svg).toBeTruthy()
    // The unknown fallback renders the key as text inside the SVG.
    const text = svg!.querySelector('text')
    expect(text?.textContent).toBe('not-a-real-key')
  })
})
