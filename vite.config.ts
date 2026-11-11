import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/v6-engine-sim/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          vendor: ['valtio', 'chart.js', 'dat.gui']
        }
      }
    }
  },
  worker: { format: 'es', plugins: [] },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-*.png'],
      manifest: {
        name: 'V6 Engine Simulator',
        short_name: 'V6Sim',
        description: 'Interactive V6 engine thermodynamic simulator with turbo modeling',
        theme_color: '#0d1b2a',
        background_color: '#0d1b2a',
        display: 'standalone',
        orientation: 'landscape-primary',
        scope: '/v6-engine-sim/',
        start_url: '/v6-engine-sim/',
        icons: [
          { src: 'icons/icon-72.png', sizes: '72x72', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-96.png', sizes: '96x96', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-152.png', sizes: '152x152', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ],
        categories: ['education', 'simulation', 'engineering'],
        screenshots: [],
        shortcuts: [
          { name: 'Dyno', url: '/v6-engine-sim/?panel=dyno', description: 'Open dyno panel' },
          { name: 'Turbo', url: '/v6-engine-sim/?panel=turbo', description: 'Open turbo panel' }
        ]
      },
      workbox: {
        navigateFallback: '/v6-engine-sim/index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'gstatic-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          }
        ]
      }
    })
  ],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true }
});