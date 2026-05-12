import { defineConfig } from 'vitest/config';

// Mirrors upstream design-md-generator-main/vitest.config.ts.
// Test files live next to the engine code at lib/engine/__tests__/.
export default defineConfig({
  test: {
    include: ['lib/engine/__tests__/**/*.test.ts'],
    globals: true,
  },
});
