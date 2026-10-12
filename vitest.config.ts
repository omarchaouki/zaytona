import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    // PGlite boots a WASM Postgres per test file.
    hookTimeout: 60_000,
    env: {
      APP_SECRET: 'test-secret-that-is-long-enough-for-validation',
      DATABASE_URL: 'postgres://unused:unused@localhost:1/unused',
    },
  },
})
