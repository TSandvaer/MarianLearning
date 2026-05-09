/**
 * Component tests for the `<DotCardCell />` dice-pip primitive (ticket
 * 86c9q5j9a). Spec: `design/screen-math-subitising-prompt.md` § "Pip
 * layout".
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DotCardCell } from './DotCardCell'
import { isValidPips, pipsFromProblem } from './dotCard'
import type { MathProblem } from './sessionPlans'

function problem(addendA: number, addendB: number): MathProblem {
  return {
    index: 1,
    addendA,
    addendB,
    correct: addendA + addendB,
    utterances: {
      read: 'placeholder',
      correct: 'placeholder',
      reprompt: 'placeholder',
      hint: 'placeholder',
      giveAnswer: 'placeholder',
    },
  }
}

describe('<DotCardCell />', () => {
  it('renders 1 pip for the "1" face (centre cell)', () => {
    render(<DotCardCell pips={1} />)
    const pips = screen.getAllByTestId('math-dot-card-pip')
    expect(pips).toHaveLength(1)
  })

  it('renders 2 pips for the "2" face (diagonal)', () => {
    render(<DotCardCell pips={2} />)
    const pips = screen.getAllByTestId('math-dot-card-pip')
    expect(pips).toHaveLength(2)
  })

  it('renders 3 pips for the "3" face (diagonal + centre)', () => {
    render(<DotCardCell pips={3} />)
    const pips = screen.getAllByTestId('math-dot-card-pip')
    expect(pips).toHaveLength(3)
  })

  it('renders 4 pips for the "4" face (four corners)', () => {
    render(<DotCardCell pips={4} />)
    const pips = screen.getAllByTestId('math-dot-card-pip')
    expect(pips).toHaveLength(4)
  })

  it('renders 5 pips for the "5" face (four corners + centre)', () => {
    render(<DotCardCell pips={5} />)
    const pips = screen.getAllByTestId('math-dot-card-pip')
    expect(pips).toHaveLength(5)
  })

  it('exposes the data-pips attribute on the cell wrapper', () => {
    render(<DotCardCell pips={3} />)
    const cell = screen.getByTestId('math-dot-card-cell')
    expect(cell).toHaveAttribute('data-pips', '3')
  })

  it('uses the spelled-word ARIA label by default', () => {
    render(<DotCardCell pips={3} />)
    const svg = screen.getByTestId('math-dot-card-cell').querySelector('svg')!
    expect(svg).toHaveAttribute('aria-label', 'three')
    expect(svg).toHaveAttribute('role', 'img')
  })

  it('honours an ariaLabel override', () => {
    render(<DotCardCell pips={4} ariaLabel="quattro" />)
    const svg = screen.getByTestId('math-dot-card-cell').querySelector('svg')!
    expect(svg).toHaveAttribute('aria-label', 'quattro')
  })

  it('places the centre pip at viewBox (40, 40) for the "1" face', () => {
    render(<DotCardCell pips={1} />)
    const pip = screen.getByTestId('math-dot-card-pip')
    expect(pip).toHaveAttribute('cx', '40')
    expect(pip).toHaveAttribute('cy', '40')
  })

  it('places "2" pips on the top-left → bottom-right diagonal', () => {
    render(<DotCardCell pips={2} />)
    const pips = screen.getAllByTestId('math-dot-card-pip')
    // Spec: 2 → top-left + bottom-right.
    // viewBox 80x80; 25%/75% of cell = 20 / 60.
    const points = pips.map((p) => [
      Number(p.getAttribute('cx')),
      Number(p.getAttribute('cy')),
    ])
    expect(points).toEqual([
      [20, 20], // top-left
      [60, 60], // bottom-right
    ])
  })

  it('places "3" pips on the diagonal with a centre dot', () => {
    render(<DotCardCell pips={3} />)
    const pips = screen.getAllByTestId('math-dot-card-pip')
    const points = pips.map((p) => [
      Number(p.getAttribute('cx')),
      Number(p.getAttribute('cy')),
    ])
    // Spec: 3 → top-left + centre + bottom-right.
    expect(points).toEqual([
      [20, 20],
      [40, 40],
      [60, 60],
    ])
  })

  it('places "4" pips at the four corners', () => {
    render(<DotCardCell pips={4} />)
    const pips = screen.getAllByTestId('math-dot-card-pip')
    const points = new Set(
      pips.map((p) => `${p.getAttribute('cx')},${p.getAttribute('cy')}`),
    )
    expect(points).toEqual(new Set(['20,20', '60,20', '20,60', '60,60']))
  })

  it('places "5" pips at the four corners + centre', () => {
    render(<DotCardCell pips={5} />)
    const pips = screen.getAllByTestId('math-dot-card-pip')
    const points = new Set(
      pips.map((p) => `${p.getAttribute('cx')},${p.getAttribute('cy')}`),
    )
    expect(points).toEqual(
      new Set(['20,20', '60,20', '40,40', '20,60', '60,60']),
    )
  })
})

describe('isValidPips', () => {
  it('accepts integers 1..5', () => {
    expect(isValidPips(1)).toBe(true)
    expect(isValidPips(2)).toBe(true)
    expect(isValidPips(3)).toBe(true)
    expect(isValidPips(4)).toBe(true)
    expect(isValidPips(5)).toBe(true)
  })

  it('rejects 0, 6, and beyond', () => {
    expect(isValidPips(0)).toBe(false)
    expect(isValidPips(6)).toBe(false)
    expect(isValidPips(10)).toBe(false)
  })

  it('rejects non-integers', () => {
    expect(isValidPips(2.5)).toBe(false)
  })
})

describe('pipsFromProblem', () => {
  it('returns the addend pair for an in-scope problem', () => {
    expect(pipsFromProblem(problem(3, 2))).toEqual([3, 2])
  })

  it('returns null when an addend is out of range', () => {
    expect(pipsFromProblem(problem(6, 3))).toBeNull()
    expect(pipsFromProblem(problem(3, 6))).toBeNull()
    expect(pipsFromProblem(problem(0, 3))).toBeNull()
  })
})
