/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest gives us full control of the SW file; the precache
      // manifest is injected into src/pwa/sw.ts at build time. See AC.
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'sw.ts',
      injectRegister: false, // we register manually in src/pwa/registerServiceWorker.ts
      registerType: 'autoUpdate',
      includeAssets: [
        'offline.html',
        'icons/apple-touch-icon-180x180.png',
        'icons/apple-touch-icon-167x167.png',
        'icons/apple-touch-icon-152x152.png',
        'icons/apple-touch-icon-120x120.png',
      ],
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        name: 'Marian Tutor',
        short_name: 'Marian',
        description: 'A personal learning companion for Marian.',
        lang: 'en',
        // Melody pink — placeholder, Kyle owns the final value (86c9gkm42)
        theme_color: '#f85a93',
        background_color: '#fff5f8',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        // Precache HTML, JS, CSS, PNG, SVG, webmanifest — not much else in v1
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,woff,woff2,ico}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
