import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const siteDistPath = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
  '..',
  'site-dist',
);
