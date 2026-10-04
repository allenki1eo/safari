import { defineConfig } from 'vite';
import { leaderboardPlugin } from './server/dev-api.js';

export default defineConfig({
  // PWA manifest, service worker, icons, and fonts live in static/.
  publicDir: 'static',
  plugins: [leaderboardPlugin()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: { manualChunks: { three: ['three'] } },
    },
  },
  server: { host: true },
});
