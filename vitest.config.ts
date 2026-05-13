import { defineConfig } from 'vitest/config';

// Mirrors upstream design-md-generator-main/vitest.config.ts, extended for
// our additional surfaces.
// - lib/engine/__tests__/   — engine (inherited from upstream)
// - eval/__tests__/         — scoreboard scoring functions
// - lib/__tests__/          — our top-level platform code (rate-limit, ...)
export default defineConfig({
  test: {
    include: [
      'lib/engine/__tests__/**/*.test.ts',
      'lib/__tests__/**/*.test.ts',
      'eval/__tests__/**/*.test.ts',
    ],
    globals: true,
  },
});
