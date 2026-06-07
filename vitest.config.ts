import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    globals: true,
    include: ['test/**/*.test.ts', 'test/**/*.spec.ts'],
  },
});
