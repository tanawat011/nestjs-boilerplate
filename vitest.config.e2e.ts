import { defineConfig } from 'vitest/config';

// End-to-end tests: the whole app against a real PostgreSQL.
// TEST_DATABASE_URL must point at a server where the user may CREATE DATABASE.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    setupFiles: ['reflect-metadata'],
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
