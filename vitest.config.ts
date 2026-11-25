import { defineConfig } from 'vitest/config';

// Unit tests: no database, no network.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    setupFiles: ['reflect-metadata'],
    include: ['src/**/*.spec.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/database/migrations/**', '**/*.spec.ts'],
    },
  },
});
