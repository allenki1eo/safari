import { defineConfig } from 'vite';

export default defineConfig({
  // `static/` holds the PWA files; the legacy `public/` folder is intentionally not shipped.
  publicDir: 'static',
  // inline config stops Vite from loading the legacy tailwind postcss.config.js
  css: { postcss: {} },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: { manualChunks: { three: ['three'] } },
    },
  },
  server: { host: true },
});
