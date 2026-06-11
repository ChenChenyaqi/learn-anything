import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Each package with a vitest config is auto-discovered
  'packages/*',
]);
