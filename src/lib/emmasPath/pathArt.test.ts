import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { defaultProgress } from '../progress/defaults'
import { LANDS } from '../progress/lands'
import type { SkillNode } from '../progress/types'
import {
  PATH_ART_DIR,
  PATH_ART_IDS,
  PATH_ART_SIZES,
  landArtId,
  pathArtSrc,
  type PathArtId,
} from './pathArt'

const ALL_NODES = Object.keys(defaultProgress().skillLevels) as SkillNode[]
const PUBLIC = join(process.cwd(), 'public')
const fileFor = (id: PathArtId, size: number) =>
  join(PUBLIC, PATH_ART_DIR, `${id}-${size}.webp`)

const ids = new Set<PathArtId>(PATH_ART_IDS)

describe('PATH_ART manifest', () => {
  it('lists 24 stages + 9 lands + 8 UI pieces, no duplicates', () => {
    expect(ALL_NODES).toHaveLength(24)
    expect(PATH_ART_IDS).toHaveLength(24 + 9 + 8)
    expect(ids.size).toBe(PATH_ART_IDS.length)
  })

  it('has a file at every size for every SkillNode', () => {
    const found = ALL_NODES.flatMap((node) =>
      PATH_ART_SIZES.filter(
        (size) => ids.has(node) && existsSync(fileFor(node, size)),
      ),
    )
    expect(found).toHaveLength(ALL_NODES.length * PATH_ART_SIZES.length)
  })

  it('has a file at every size for every land', () => {
    const landIds = LANDS.map(landArtId)
    expect(new Set(landIds).size).toBe(9)
    const found = landIds.flatMap((id) =>
      PATH_ART_SIZES.filter(
        (size) => ids.has(id) && existsSync(fileFor(id, size)),
      ),
    )
    expect(found).toHaveLength(LANDS.length * PATH_ART_SIZES.length)
  })

  it('ships exactly the manifest files, nothing else, in public/assets/path', () => {
    const expected = PATH_ART_IDS.flatMap((id) =>
      PATH_ART_SIZES.map((size) => `${id}-${size}.webp`),
    ).sort()
    expect(expected).toHaveLength(41 * PATH_ART_SIZES.length)
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
  it('returns the site-root URL of a piece', () => {
    expect(pathArtSrc('add-to-20', 512)).toBe('/assets/path/add-to-20-512.webp')
    expect(pathArtSrc('ui-arch-closed', 256)).toBe(
      '/assets/path/ui-arch-closed-256.webp',
    )
  })
})
