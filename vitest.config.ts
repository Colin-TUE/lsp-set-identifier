import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/data/sets.generated.ts', 'src/main.ts'],
      reporter: ['text', 'json-summary', 'json'],
      thresholds: { branches: 99, functions: 99, lines: 99, statements: 99 },
    },
  },
});
