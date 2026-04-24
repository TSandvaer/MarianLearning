import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Hello from './Hello'

describe('Hello', () => {
  it('greets Marian', () => {
    render(<Hello />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /hello, marian/i,
    )
  })
})
