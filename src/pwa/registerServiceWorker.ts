/**
 * Registers the Workbox-generated service worker that vite-plugin-pwa emits.
 *
 * We prefer manual registration (see vite.config.ts `registerType: 'prompt'`
 * when we wire an update UI later). For the scaffold this is a bare register.
 *
 * In dev, the SW is not emitted unless `devOptions.enabled` is true — so we
 * only register in production builds.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err: unknown) => {
        console.warn('[pwa] service worker registration failed', err)
      })
  })
}
