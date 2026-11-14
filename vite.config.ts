import { defineConfig } from 'vitest/config';

// A relative base lets the same build work at any address, including
// the /<repository>/ sub-path that GitHub Pages serves from.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  test: { include: ['src/**/*.test.ts'] },
});
