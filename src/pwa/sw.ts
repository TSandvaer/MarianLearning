/// <reference lib="webworker" />
/**
 * Workbox-generated service worker (via vite-plugin-pwa injectManifest).
 *
 * Responsibilities in v1:
 *  - Precache the build output so the app opens offline from the home screen.
 *  - Serve /offline.html for navigation requests when the network is down.
 *
 * Keep this file small and boring. Custom caching strategies land in a
 * follow-up ticket once Claude API + TTS need real offline behavior.
 */
import { precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

// Injected by vite-plugin-pwa at build time.
precacheAndRoute(self.__WB_MANIFEST)

// Navigation fallback: serve offline.html when the network fails.
const navHandler = new NetworkFirst({
  cacheName: 'pages',
  networkTimeoutSeconds: 3,
})

registerRoute(
  new NavigationRoute(async (options) => {
    try {
      return await navHandler.handle(options)
    } catch {
      const cache = await caches.open('pages')
      const cached = await cache.match('/offline.html')
      return (
        cached ??
        new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        })
      )
    }
  }),
)

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})
