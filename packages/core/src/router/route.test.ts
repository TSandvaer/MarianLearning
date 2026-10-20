/**
 * The Play place's routes (play-place spec § 1.4, AC C9): `'play-place'`
 * and `'play-game'`, never `'play'` (that names the Map's current-stop
 * start, K5). A type-level check: tsc fails this file if they drift.
 */
import { describe, expect, it } from 'vitest'
import type { Route } from './route'

type Has<T, U> = [U] extends [T] ? true : false

describe('Route (C9)', () => {
  it("has 'play-place' and 'play-game', and not 'play'", () => {
    const hasPlace: Has<Route, 'play-place'> = true
    const hasGame: Has<Route, 'play-game'> = true
    const hasPlay: Has<Route, 'play'> = false
    expect([hasPlace, hasGame, hasPlay]).toEqual([true, true, false])
  })
})
