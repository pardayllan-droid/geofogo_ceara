import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
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
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('/node_modules/maplibre-gl/')) {
            return 'maplibre';
          }

          if (
            id.includes('/node_modules/@turf/') ||
            id.includes('/node_modules/turf/')
          ) {
            return 'turf';
          }

          if (id.includes('/node_modules/lucide-react/')) {
            return 'icons';
          }

          if (id.includes('/node_modules/@tanstack/')) {
            return 'tanstack';
          }

          return undefined;
        },
      },
    },
  },
});