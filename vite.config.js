import { defineConfig } from 'vite';
import { leaderboardPlugin } from './server/dev-api.js';

// Every deploy gets its own build id. The page carries it, and /version.json names the newest,
// so a phone still running an older copy can tell an update is out (app/ui/updates.js).
const BUILD = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 8) || Date.now().toString(36);

/** Writes /version.json next to the page on build. */
function versionFile() {
  return {
    name: 'kimbia-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) });
    },
  };
}

export default defineConfig({
  // PWA manifest, service worker, icons, and fonts live in static/.
  publicDir: 'static',
  plugins: [leaderboardPlugin(), versionFile()],
  define: { __BUILD__: JSON.stringify(BUILD) },
  // vitest covers tests/; the leaderboard server keeps its own node:test suite
  test: { include: ['tests/**/*.test.js'] },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: { manualChunks: { three: ['three'] } },
    },
  },
  server: { host: true },
});
