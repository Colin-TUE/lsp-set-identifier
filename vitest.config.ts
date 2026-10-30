import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'scripts/**/*.ts'],
      // main.ts is covered by the e2e tests; scrape-bricklink.ts is only the real file/network wiring for scrape-lib.ts.
      exclude: ['src/data/sets.generated.ts', 'src/main.ts', 'scripts/scrape-bricklink.ts'],
      reporter: ['text', 'json-summary', 'json'],
      thresholds: { branches: 99, functions: 99, lines: 99, statements: 99 },
    },
  },
});
