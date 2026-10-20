import { FIRST_ROUTE } from '@marian/core/router/route'
import { ROUTE_EXITS, ROUTE_LABELS, ROUTES, nextRoute } from './routes'

describe('route shell', () => {
  it('starts on Splash, like the web', () => {
    expect(FIRST_ROUTE).toBe('splash')
  })

  it('has a label and an exit for every route', () => {
    expect(ROUTES).toHaveLength(13)
    for (const route of ROUTES) {
      expect(ROUTE_LABELS[route]).toBeTruthy()
      expect(ROUTE_EXITS[route].length).toBeGreaterThan(0)
    }
  })

  it('Splash only leads to the picker, Greet or Hub (nextAfterSplash)', () => {
    expect(ROUTE_EXITS.splash).toEqual(['picker', 'greet', 'hub'])
  })

  it('learner profiles: the picker leads to Greet or the Hub, and is reached from § 1.1’s routes', () => {
    expect(ROUTE_EXITS.picker).toEqual(['greet', 'hub'])
    for (const from of [
      'hub',
      'greet',
      'map',
      'session-end',
      'parent-settings',
    ] as const) {
      expect(ROUTE_EXITS[from]).toContain('picker')
    }
    for (const from of ['math', 'literacy', 'peek'] as const) {
      expect(ROUTE_EXITS[from]).not.toContain('picker')
    }
  })

  it('first launch is Splash → Greet → Math → Session End → Hub', () => {
    let route = nextRoute('splash', 'greet')
    route = nextRoute(route, 'math')
    route = nextRoute(route, 'session-end')
    route = nextRoute(route, 'hub')
    expect(route).toBe('hub')
  })

  it('every exit leads to a known route, and every route is reachable', () => {
    const reachable = new Set([FIRST_ROUTE])
    for (const route of ROUTES) {
      for (const to of ROUTE_EXITS[route]) {
        expect(ROUTES).toContain(to)
        reachable.add(to)
      }
    }
    // `reward` exists in core's Route type but nothing routes to it
    // (the web renders no screen for it).
    expect([...reachable].sort()).toEqual(
      ROUTES.filter((r) => r !== 'reward').sort(),
    )
  })

  it('Map tap-to-play: the map starts a session or a replay, and a Map start returns to it', () => {
    expect(ROUTE_EXITS.map).toEqual([
      'hub',
      'peek',
      'math',
      'literacy',
      'picker',
    ])
    expect(ROUTE_EXITS.math).toContain('map')
    expect(ROUTE_EXITS.literacy).toContain('map')
    expect(ROUTE_EXITS.peek).toEqual(['map'])
  })

  it('the Play place (play-place § 1.4, N3): only the Hub opens it, and a game only returns to it', () => {
    expect(ROUTE_EXITS.hub).toContain('play-place')
    expect(ROUTE_EXITS['play-place']).toEqual(['hub', 'play-game', 'picker'])
    expect(ROUTE_EXITS['play-game']).toEqual(['play-place'])
    expect(
      ROUTES.filter(
        (r) => r !== 'hub' && ROUTE_EXITS[r].includes('play-place'),
      ).filter((r) => r !== 'play-game'),
    ).toEqual([])
    expect(
      ROUTES.filter(
        (r) => r !== 'play-place' && ROUTE_EXITS[r].includes('play-game'),
      ),
    ).toEqual([])
    expect(ROUTE_LABELS['play-place']).toBe('Play place')
    expect(ROUTE_LABELS['play-game']).toBe('Play game')
  })

  it('ignores a jump that is not an exit', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(nextRoute('greet', 'hub')).toBe('greet')
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
