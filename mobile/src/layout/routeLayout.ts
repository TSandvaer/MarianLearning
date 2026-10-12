import type { Route } from '@marian/core/router/route'
import { greetLayout } from './greetLayout'
import { hubLayout } from './hubLayout'
import { mathLayout, type ScreenLayout, type Viewport } from './layout'
import { sessionEndLayout } from './sessionEndLayout'
import { wordSongLayout } from './wordSongLayout'

/**
 * Emma's frame and the content area for a route. Greet centres Emma,
 * the two play screens perch her upper-left, Session End has its own;
 * the Hub and every other route use the Hub's frames (the map and Parent
 * Settings don't show this Emma; the `reward` placeholder keeps her put).
 */
export function layoutForRoute(route: Route, viewport: Viewport): ScreenLayout {
  switch (route) {
    case 'greet':
      return greetLayout(viewport)
    case 'math':
      return mathLayout(viewport)
    case 'literacy':
      return wordSongLayout(viewport)
    case 'session-end':
      return sessionEndLayout(viewport)
    default:
      return hubLayout(viewport)
  }
}
