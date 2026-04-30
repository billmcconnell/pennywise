import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'packages/**/*.test.tsx'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['packages/**/src/**/*.ts'],
    },
  },
});
