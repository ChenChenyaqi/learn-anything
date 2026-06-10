import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Root-level tests (existing tests that haven't been moved to packages yet)
  {
    test: {
      name: 'root',
      pool: 'forks',
      globals: true,
      include: ['test/**/*.test.ts', 'test/**/*.spec.ts'],
    },
  },
  // Package-level tests — each package with a vitest config is auto-discovered
  'packages/*',
]);
