import { defineConfig } from 'vite';

export default defineConfig({
  // PWA manifest, service worker, icons, and fonts live in static/.
  publicDir: 'static',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: { manualChunks: { three: ['three'] } },
    },
  },
  server: { host: true },
});
