import { defineConfig } from 'vitest/config';

// Mirrors upstream design-md-generator-main/vitest.config.ts.
// Test files live next to the engine code at lib/engine/__tests__/, and
// also under eval/__tests__/ for the scoreboard scoring functions.
export default defineConfig({
  test: {
    include: [
      'lib/engine/__tests__/**/*.test.ts',
      'eval/__tests__/**/*.test.ts',
    ],
    globals: true,
  },
});
