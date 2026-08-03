import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      injectRegister: 'auto',

      includeAssets: [
        'favicon.svg',
        'apple-touch-icon-v2.png',
      ],

      manifest: {
        id: '/',
        name: 'GeoFogo Ceará',
        short_name: 'GeoFogo',
        description:
          'Monitoramento de incêndios florestais no Estado do Ceará',

        lang: 'pt-BR',

        start_url: '/',
        scope: '/',
        display: 'standalone',

        orientation: 'portrait-primary',

        background_color: '#0f172a',
        theme_color: '#f97316',

        categories: [
          'utilities',
          'navigation',
          'productivity',
        ],

        icons: [
          {
            src:
              '/icon-192-v2.png',

            sizes:
              '192x192',

            type:
              'image/png',

            purpose:
              'any',
          },
          {
            src:
              '/icon-512-v2.png',

            sizes:
              '512x512',

            type:
              'image/png',

            purpose:
              'any',
          },
          {
            src:
              '/icon-512-maskable-v2.png',

            sizes:
              '512x512',

            type:
              'image/png',

            purpose:
              'maskable',
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,

        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,json,woff,woff2}',
        ],

        navigateFallback: '/index.html',

        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin ===
              'https://tile.openstreetmap.org',

            handler: 'CacheFirst',

            options: {
              cacheName: 'geofogo-osm-tiles',

              expiration: {
                maxEntries: 300,
                maxAgeSeconds:
                  60 * 60 * 24 * 7,
              },

              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },

          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith(
                'basemaps.cartocdn.com',
              ),

            handler: 'CacheFirst',

            options: {
              cacheName: 'geofogo-carto-tiles',

              expiration: {
                maxEntries: 300,
                maxAgeSeconds:
                  60 * 60 * 24 * 7,
              },

              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },

          {
            urlPattern: ({ request }) =>
              request.destination ===
              'document',

            handler: 'NetworkFirst',

            options: {
              cacheName:
                'geofogo-navigation',

              networkTimeoutSeconds: 5,

              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },

        devOptions: {
        enabled: false,
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(
        process.cwd(),
        'src',
      ),
    },
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
  },

  preview: {
    host: '0.0.0.0',
    port: 4173,
  },

  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 900,

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            !id.includes('node_modules')
          ) {
            return undefined;
          }

          if (
            id.includes(
              '/node_modules/maplibre-gl/',
            )
          ) {
            return 'maplibre';
          }

          if (
            id.includes(
              '/node_modules/@turf/',
            ) ||
            id.includes(
              '/node_modules/turf/',
            )
          ) {
            return 'turf';
          }

          if (
            id.includes(
              '/node_modules/lucide-react/',
            )
          ) {
            return 'icons';
          }

          if (
            id.includes(
              '/node_modules/@tanstack/',
            )
          ) {
            return 'tanstack';
          }

          return undefined;
        },
      },
    },
  },
});