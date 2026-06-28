import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    pool: 'forks',
    globals: true,
    include: ['test/**/*.test.ts', 'test/**/*.spec.ts'],
  },
});
