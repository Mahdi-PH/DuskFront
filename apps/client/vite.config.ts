import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: __dirname,
  // Overridable for hosting under a sub-path (e.g. a GitHub Pages project
  // site at /<repo>/) without affecting the default root-relative build.
  base: process.env.VITE_BASE_PATH || '/',
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
