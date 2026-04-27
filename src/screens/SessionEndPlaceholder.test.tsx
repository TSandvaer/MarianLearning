import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'
import SessionEndPlaceholder, {
  type SessionEndPayload,
} from './SessionEndPlaceholder'

function withMotion(node: ReactNode) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{node}</MotionConfig>
    </LazyMotion>
  )
}

describe('SessionEndPlaceholder', () => {
  it('renders the Word Song handoff payload (surface, earned, totals)', () => {
    const payload: SessionEndPayload = {
      totalCorrect: 8,
      totalStardust: 23,
      finalStreak: 8,
      earnedThisSession: 11,
      surface: 'word-song',
    }
    render(withMotion(<SessionEndPlaceholder payload={payload} />))

    const root = screen.getByTestId('session-end')
    expect(root).toHaveAttribute('data-surface', 'word-song')
    expect(root).toHaveAttribute('data-earned', '11')
    expect(root).toHaveAttribute('data-total-stardust', '23')
    expect(root).toHaveAttribute('data-total-correct', '8')

    expect(screen.getByTestId('session-end-headline')).toHaveTextContent(
      'Great job!',
    )
    expect(screen.getByTestId('session-end-stardust')).toHaveTextContent(
      'You earned 11 stardust!',
    )
  })

  it('renders the Math handoff payload (surface=math)', () => {
    const payload: SessionEndPayload = {
      totalCorrect: 7,
      totalStardust: 9,
      finalStreak: 5,
      earnedThisSession: 9,
      surface: 'math',
    }
    render(withMotion(<SessionEndPlaceholder payload={payload} />))

    expect(screen.getByTestId('session-end')).toHaveAttribute(
      'data-surface',
      'math',
    )
    expect(screen.getByTestId('session-end-stardust')).toHaveTextContent(
      'You earned 9 stardust!',
    )
  })

  it('renders zero defaults when reached without a payload (cold launch)', () => {
    render(withMotion(<SessionEndPlaceholder payload={null} />))

    const root = screen.getByTestId('session-end')
    expect(root).toHaveAttribute('data-earned', '0')
    expect(root).toHaveAttribute('data-total-stardust', '0')
    expect(root).toHaveAttribute('data-total-correct', '0')
    // Default surface is 'math' per the spec's backwards-compat shim.
    expect(root).toHaveAttribute('data-surface', 'math')
  })

  it('does not display any "X" or shame copy (anti-dark-pattern)', () => {
    const payload: SessionEndPayload = {
      totalCorrect: 4,
      totalStardust: 4,
      finalStreak: 0,
      earnedThisSession: 4,
      surface: 'math',
    }
    render(withMotion(<SessionEndPlaceholder payload={payload} />))

    const text = (
      screen.getByTestId('session-end').textContent ?? ''
    ).toLowerCase()
    expect(text).not.toContain('wrong')
    expect(text).not.toContain('failed')
    expect(text).not.toContain('try again')
    expect(text).not.toContain('only')
  })
})
