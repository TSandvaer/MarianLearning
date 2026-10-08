import { FIRST_ROUTE } from '@marian/core/router/route'
import { ROUTE_EXITS, ROUTE_LABELS, ROUTES, nextRoute } from './routes'

describe('route shell', () => {
  it('starts on Splash, like the web', () => {
    expect(FIRST_ROUTE).toBe('splash')
  })

  it('has a label and an exit for every route', () => {
    expect(ROUTES).toHaveLength(9)
    for (const route of ROUTES) {
      expect(ROUTE_LABELS[route]).toBeTruthy()
      expect(ROUTE_EXITS[route].length).toBeGreaterThan(0)
    }
  })

  it('Splash only leads to Greet or Hub (nextAfterSplash)', () => {
    expect(ROUTE_EXITS.splash).toEqual(['greet', 'hub'])
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

  it('ignores a jump that is not an exit', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(nextRoute('greet', 'hub')).toBe('greet')
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
