import type { Route } from '@marian/core/router/route'
import {
  greetLayout,
  hubLayout,
  mathLayout,
  type ScreenLayout,
  type Viewport,
} from './layout'

/**
 * Emma's frame and the content area for a route. Greet centres Emma,
 * the two play screens perch her upper-left, everything else uses the
 * Hub's top band until its real screen (Phase 3) brings its own layout.
 */
export function layoutForRoute(route: Route, viewport: Viewport): ScreenLayout {
  switch (route) {
    case 'greet':
      return greetLayout(viewport)
    case 'math':
    case 'literacy':
      return mathLayout(viewport)
    default:
      return hubLayout(viewport)
  }
}
