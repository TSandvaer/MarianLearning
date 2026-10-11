import type { Route } from '@marian/core/router/route'
import { greetLayout } from './greetLayout'
import { hubLayout } from './hubLayout'
import { mathLayout, type ScreenLayout, type Viewport } from './layout'
import { sessionEndLayout } from './sessionEndLayout'

/**
 * Emma's frame and the content area for a route. Greet centres Emma,
 * the two play screens perch her upper-left, Session End has its own;
 * the Hub and every route not ported yet (map, parent settings) use the
 * Hub's frames, so Emma stays put when a placeholder opens from the Hub.
 */
export function layoutForRoute(route: Route, viewport: Viewport): ScreenLayout {
  switch (route) {
    case 'greet':
      return greetLayout(viewport)
    case 'math':
    case 'literacy':
      return mathLayout(viewport)
    case 'session-end':
      return sessionEndLayout(viewport)
    default:
      return hubLayout(viewport)
  }
}
