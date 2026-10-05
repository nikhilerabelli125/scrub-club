import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        // Big libraries get their own chunks so browsers keep them cached across
        // deploys that only change game code.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'rapier', test: /node_modules[\\/]@dimforge[\\/]/ },
            { name: 'tone', test: /node_modules[\\/]tone[\\/]/ },
          ],
        },
      },
    },
    // three.js alone is ~530 kB minified. With libraries split out, this limit still
    // flags game code that grows too large.
    chunkSizeWarningLimit: 600,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
