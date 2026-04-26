import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { installStorageShim } from './storageShim'

// Per-file `@vitest-environment node` skips the jsdom setup entirely, so
// `window` will be undefined for those tests. Guard the storage shim and
// the React unmount hook so node-environment specs (api/_tts.test.ts and
// friends) don't blow up at setup-time.
if (typeof window !== 'undefined') {
  // Node 25 (verified on 25.6.1, 2026-04) ships an experimental built-in
  // `localStorage`/`sessionStorage` that pre-empts jsdom's Storage in
  // vitest's worker, leaving an empty null-prototype object missing every
  // method. The shim feature-checks before installing, so it's a no-op
  // once the toolchain advances. See `src/test/storageShim.ts` and
  // ClickUp 86c9gn9th for removal criteria.
  installStorageShim(window)

  // Ensure every test teardown unmounts React trees.
  afterEach(() => {
    cleanup()
  })
}
