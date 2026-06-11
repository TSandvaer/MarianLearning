/**
 * Component tests for the `<TenFrameCell />` ten-frame primitive (ticket
 * 86ca7kdw8). Spec: `design/math/subitising-scaffold-content.md` §13.2.2
 * (pip layout / position rules).
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TenFrameCell, type TenFramePipsCount } from './TenFrameCell'

describe('<TenFrameCell />', () => {
  it.each<[TenFramePipsCount]>([[6], [7], [8], [9], [10]])(
    'renders exactly %i filled pips',
    (pips) => {
      render(<TenFrameCell pips={pips} />)
      expect(screen.getAllByTestId('math-dot-card-pip')).toHaveLength(pips)
    },
  )

  it('fills the top row (all 5) before any bottom-row pip for 6', () => {
    render(<TenFrameCell pips={6} />)
    const pips = screen
      .getAllByTestId('math-dot-card-pip')
      .map((p) => [Number(p.getAttribute('cx')), Number(p.getAttribute('cy'))])
    // Top row y=18 should have all 5 columns; bottom row y=42 should have 1.
    const topRow = pips.filter(([, cy]) => cy === 18)
    const bottomRow = pips.filter(([, cy]) => cy === 42)
    expect(topRow).toHaveLength(5)
    expect(bottomRow).toHaveLength(1)
    // The single bottom pip fills the FIRST column (left→right fill order).
    expect(bottomRow[0]?.[0]).toBe(17)
  })

  it('fills both rows fully for 10 (two full fives)', () => {
    render(<TenFrameCell pips={10} />)
    const pips = screen
      .getAllByTestId('math-dot-card-pip')
      .map((p) => [Number(p.getAttribute('cx')), Number(p.getAttribute('cy'))])
    const topRow = pips.filter(([, cy]) => cy === 18)
    const bottomRow = pips.filter(([, cy]) => cy === 42)
    expect(topRow).toHaveLength(5)
    expect(bottomRow).toHaveLength(5)
  })

  it('fills the bottom row left→right (8 → 5 top + first 3 bottom columns)', () => {
    render(<TenFrameCell pips={8} />)
    const pips = screen
      .getAllByTestId('math-dot-card-pip')
      .map((p) => [Number(p.getAttribute('cx')), Number(p.getAttribute('cy'))])
    const bottomCols = pips
      .filter(([, cy]) => cy === 42)
      .map(([cx]) => cx)
      .sort((a, b) => a - b)
    // 8 = 5 top + 3 bottom → bottom columns are the first three (17,41,65).
    expect(bottomCols).toEqual([17, 41, 65])
  })

  it('exposes data-pips + the reused math-dot-card-cell testid', () => {
    render(<TenFrameCell pips={8} />)
    const cell = screen.getByTestId('math-dot-card-cell')
    expect(cell).toHaveAttribute('data-pips', '8')
    expect(cell).toHaveAttribute('data-cell-kind', 'ten-frame')
  })

  it('uses the spelled-word ARIA label by default', () => {
    render(<TenFrameCell pips={8} />)
    const svg = screen.getByTestId('math-dot-card-cell').querySelector('svg')!
    expect(svg).toHaveAttribute('aria-label', 'eight')
    expect(svg).toHaveAttribute('role', 'img')
  })

  it('honours an ariaLabel override', () => {
    render(<TenFrameCell pips={9} ariaLabel="nueve" />)
    const svg = screen.getByTestId('math-dot-card-cell').querySelector('svg')!
    expect(svg).toHaveAttribute('aria-label', 'nueve')
  })

  it('uses the wider 130×60 ten-frame viewBox (not the 80×80 die viewBox)', () => {
    render(<TenFrameCell pips={7} />)
    const svg = screen.getByTestId('math-dot-card-cell').querySelector('svg')!
    expect(svg).toHaveAttribute('viewBox', '0 0 130 60')
  })
})
