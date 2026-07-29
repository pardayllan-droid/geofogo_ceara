/**
 * Configuração do Vite para o GeoFogo Ceará.
 *
 * Projeto independente, sem SDKs, plugins
 * ou serviços externos.
 */

import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
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
    host: true,
  },

  preview: {
    host: true,
  },

  build: {
    sourcemap: false,

    /**
     * O MapLibre isoladamente possui mais de 500 kB.
     * Esse tamanho é esperado para a biblioteca completa.
     */
    chunkSizeWarningLimit: 900,

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
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