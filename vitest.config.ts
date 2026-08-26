import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/**/*.test.ts',
      'apps/web/src/**/*.test.ts',
      'apps/worker/test/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['packages/calculation-core/src/**/*.ts'],
      thresholds: { lines: 95, functions: 95, statements: 95, branches: 90 },
    },
  },
});
