import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: __dirname,
  server: {
    port: 5173,
    host: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
  },
});
