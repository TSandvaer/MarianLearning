import { afterEach, describe, expect, it } from 'vitest'
import { apiUrl, setApiBase } from './apiUrl'

afterEach(() => {
  setApiBase('')
})

describe('apiUrl', () => {
  it('stays relative with no base (the web default)', () => {
    expect(apiUrl('/api/claude')).toBe('/api/claude')
    expect(apiUrl('/api/progress')).toBe('/api/progress')
  })

  it('prefixes the configured base (a native host)', () => {
    setApiBase('https://marian-learning.vercel.app')
    expect(apiUrl('/api/claude')).toBe(
      'https://marian-learning.vercel.app/api/claude',
    )
  })

  it('never doubles or drops the joining slash', () => {
    setApiBase('https://example.test///')
    expect(apiUrl('/api/progress')).toBe('https://example.test/api/progress')
    expect(apiUrl('api/progress')).toBe('https://example.test/api/progress')
  })

  it('setApiBase("") restores relative URLs', () => {
    setApiBase('https://example.test')
    setApiBase('')
    expect(apiUrl('/api/claude')).toBe('/api/claude')
  })
})
