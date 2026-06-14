import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Vector-re-trace contract gate for the Emma pose SVGs (ticket 86ca8kq42, spec
 * `design/emma-vector-retrace-spec.md`). The pilot re-traces `emma-idle` from a
 * PNG-in-SVG (base64 raster embed) to TRUE vector geometry; the all-7 PR applies
 * the same `tools/emma-vectorize` recipe to the remaining poses. This file is
 * the assertable half of AC6.2 — it must catch a recipe regression (raster
 * sneaking back in, or the load-bearing envelope getting dropped on minify).
 *
 * IMPORTANT — these assertions match the DATA-URI form of a raster embed
 * (`data:image/...;base64,` / `<image ...>`), NOT the bare word "base64". The
 * committed SVG's provenance comment legitimately says "Supersedes the
 * PNG-in-SVG (base64 raster embed) technique." — a `/base64/` regex snags that
 * prose and fails on a genuinely-vector asset (the v1 test bug, PR #435 review).
 * Match the real embed marker so the gate tracks the product, not the comment.
 */
describe('emma-idle vector re-trace contract (86ca8kq42 / AC6.2)', () => {
  const repoRoot = resolve(__dirname, '..', '..', '..')
  const svg = readFileSync(
    resolve(repoRoot, 'public/assets/emma-idle.svg'),
    'utf8',
  )

  it('contains no base64-embedded raster (true vector, not PNG-in-SVG)', () => {
    // The real embed marker is the data-URI, e.g. `xlink:href="data:image/png;base64,..."`.
    // Matching the bare word "base64" would wrongly snag the provenance comment.
    expect(svg).not.toMatch(/data:image\/[a-z+]+;base64/i)
  })

  it('contains no <image> element (no raster layer)', () => {
    // Mirror the data-URI discipline: match the real <image> tag form, which
    // excludes the word "image" appearing in comment prose.
    expect(svg).not.toMatch(/<image[\s/>]/)
  })

  it('is built from <path> vector geometry', () => {
    expect(svg).toMatch(/<path[\s]/)
  })

  it('keeps the load-bearing viewBox on the root <svg> (AC7)', () => {
    // viewBox must survive minify — EmmaCharacter's feet-pivot tilt/breathing
    // animations are authored against the 2000x2000 coordinate system.
    const rootTag = svg.match(/<svg\b[^>]*>/)?.[0] ?? ''
    expect(rootTag).toMatch(/\bviewBox="0 0 2000 2000"/)
  })

  it('keeps preserveAspectRatio="xMidYMid meet" on the root <svg> (AC7 / AC6.2)', () => {
    // SVGO drops this on minify because "xMidYMid meet" is the SVG default
    // (render-identical), but spec AC7 + AC6.2 name it a REQUIRED, assertable
    // part of the contract. vectorize-pose.mjs re-adds it post-minify; this
    // assertion is the gate that catches it for the all-7 PR too. Must be on the
    // root tag itself, NOT merely present somewhere in the comment prose.
    const rootTag = svg.match(/<svg\b[^>]*>/)?.[0] ?? ''
    expect(rootTag).toMatch(/\bpreserveAspectRatio="xMidYMid meet"/)
  })

  it('carries no transform attribute (scale baked into coords, AC7)', () => {
    // A baked rotation/scale transform would collide with EmmaCharacter's
    // runtime rotateZ/breathing transforms on the wrapping element.
    expect(svg).not.toMatch(/<(?:svg|g|path)\b[^>]*\btransform=/)
  })

  it('stays under the 150 KB AC4 size target', () => {
    const bytes = Buffer.byteLength(svg, 'utf8')
    expect(bytes).toBeLessThanOrEqual(150 * 1024)
  })
})
