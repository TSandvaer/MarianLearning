import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Ensure every test teardown unmounts React trees.
afterEach(() => {
  cleanup()
})
