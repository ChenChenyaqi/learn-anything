import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      vue: fileURLToPath(new URL('./site/node_modules/vue', import.meta.url)),
    },
  },
  test: {
    pool: 'forks',
    globals: true,
    include: ['test/**/*.test.ts', 'test/**/*.spec.ts'],
  },
});
