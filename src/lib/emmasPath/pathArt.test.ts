import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { defaultProgress } from '../progress/defaults'
import { LANDS } from '../progress/lands'
import type { SkillNode } from '../progress/types'
import {
  PATH_ART,
  PATH_ART_DIR,
  PATH_ART_SIZES,
  landArtId,
  pathArtSrc,
  type PathArtId,
} from './pathArt'

const ALL_NODES = Object.keys(defaultProgress().skillLevels) as SkillNode[]
const PUBLIC = join(process.cwd(), 'public')
const fileFor = (id: PathArtId, size: number) =>
  join(PUBLIC, PATH_ART_DIR, `${id}-${size}.webp`)

const ids = Object.keys(PATH_ART) as PathArtId[]
const ready = ids.filter((id) => PATH_ART[id] === 'ready')

describe('PATH_ART manifest', () => {
  it('lists 24 stages + 9 lands + 8 UI pieces, one pending', () => {
    expect(ALL_NODES).toHaveLength(24)
    expect(ids).toHaveLength(24 + 9 + 8)
    expect(ids.filter((id) => PATH_ART[id] === 'pending')).toEqual([
      'ui-arch-closed',
    ])
  })

  it('has a ready file at every size for every SkillNode', () => {
    const found = ALL_NODES.flatMap((node) =>
      PATH_ART_SIZES.filter(
        (size) => PATH_ART[node] === 'ready' && existsSync(fileFor(node, size)),
      ),
    )
    expect(found).toHaveLength(ALL_NODES.length * PATH_ART_SIZES.length)
  })

  it('has a ready file at every size for every land', () => {
    const landIds = LANDS.map(landArtId)
    expect(new Set(landIds).size).toBe(9)
    const found = landIds.flatMap((id) =>
      PATH_ART_SIZES.filter(
        (size) => PATH_ART[id] === 'ready' && existsSync(fileFor(id, size)),
      ),
    )
    expect(found).toHaveLength(LANDS.length * PATH_ART_SIZES.length)
  })

  it('ships exactly the ready files, nothing else, in public/assets/path', () => {
    const expected = ready
      .flatMap((id) => PATH_ART_SIZES.map((size) => `${id}-${size}.webp`))
      .sort()
    expect(expected).toHaveLength(40 * PATH_ART_SIZES.length)
    expect(readdirSync(join(PUBLIC, PATH_ART_DIR)).sort()).toEqual(expected)
  })
})

describe('landArtId', () => {
  it('maps math to ng and word-song to ws', () => {
    expect(landArtId({ world: 'math', number: 4 })).toBe('land-ng-4')
    expect(landArtId({ world: 'word-song', number: 1 })).toBe('land-ws-1')
  })
})

describe('pathArtSrc', () => {
  it('returns the site-root URL of a ready piece', () => {
    expect(pathArtSrc('add-to-20', 512)).toBe('/assets/path/add-to-20-512.webp')
  })

  it('returns undefined for a pending piece', () => {
    expect(pathArtSrc('ui-arch-closed', 256)).toBeUndefined()
  })
})
