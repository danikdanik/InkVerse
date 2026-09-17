import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// Web dev server proxies /api and /assets to the Node backend on :8787.
export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
      '@content': path.resolve(__dirname, '../content'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8788', changeOrigin: true },
      '/assets': { target: 'http://localhost:8788', changeOrigin: true },
    },
  },
  build: { outDir: path.resolve(__dirname, '../../dist/web'), emptyOutDir: true },
});
