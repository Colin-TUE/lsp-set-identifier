import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/data/sets.generated.ts', 'src/main.ts'],
      reporter: ['text', 'json-summary', 'json'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
});
