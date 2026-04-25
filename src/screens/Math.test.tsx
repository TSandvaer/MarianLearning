import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import type { ReactNode } from 'react'
import Math from './Math'

/**
 * Math is a placeholder for the future Number Garden ticket. We assert only
 * the contract Greet relies on:
 *   1. The screen mounts cleanly under the same Motion providers App uses.
 *   2. It exposes Melody at layoutId="melody" so the shared-element
 *      transition from Greet → Math has a destination (spec line 795).
 */
function withMotion(node: ReactNode) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{node}</MotionConfig>
    </LazyMotion>
  )
}

describe('Math (stub)', () => {
  it('renders a Melody element so the shared-element layoutId can land here', () => {
    render(withMotion(<Math />))
    expect(screen.getByTestId('math-stub')).toBeInTheDocument()
    expect(screen.getByAltText('Melody')).toBeInTheDocument()
    expect(screen.getByText('Number Garden (TBD)')).toBeInTheDocument()
  })
})
