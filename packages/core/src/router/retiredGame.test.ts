/**
 * The flower bed moved into adding to ten (`design/native/flower-bed-into-add-to-10.md`
 * § 6, C4): the side-game route, its core and its clay piece are gone.
 * Games wrote nothing, so nothing migrates.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PATH_ART_IDS, type PathArtId } from '../emmasPath/pathArt'
import type { Route } from './route'

describe('the retired game (C4)', () => {
  it('Route has no game', () => {
    // @ts-expect-error -- 'game' is no longer a Route.
    const retired: Route = 'game'
    expect(retired).toBe('game')
  })

  it('pathArt has no ui-flower-bed', () => {
    expect(PATH_ART_IDS).not.toContain('ui-flower-bed' as PathArtId)
  })

  it('packages/core/src/games/ does not exist', () => {
    expect(
      existsSync(join(process.cwd(), 'packages', 'core', 'src', 'games')),
    ).toBe(false)
  })
})
