import { defineConfig } from 'tsup';

// Inject a real require() so bundled CJS packages (yaml, etc.) can call require('process')
const cjsPolyfill = 'import{createRequire as _cR}from"module";var require=_cR(import.meta.url);\n';

export default defineConfig([
  // CLI binary entry — bundles @learn-anything/core, keeps external deps
  {
    entry: {
      'cli/index': 'src/cli/index.ts',
    },
    format: ['esm'],
    target: 'node20',
    platform: 'node',
    outDir: 'dist',
    clean: true,
    splitting: false,
    sourcemap: true,
    dts: false,

    // Bundle core and its transitive deps into the output
    noExternal: [/@learn-anything/],

    // Keep runtime deps as real npm dependencies
    external: ['commander', 'chalk', '@inquirer/prompts'],

    banner: {
      js: '#!/usr/bin/env node\n' + cjsPolyfill,
    },
  },

  // Library barrel export — for programmatic use, generates .d.ts
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm'],
    target: 'node20',
    platform: 'node',
    outDir: 'dist',
    clean: false,
    splitting: false,
    sourcemap: true,
    dts: {
      compilerOptions: {
        composite: false,
      },
    },

    noExternal: [/@learn-anything/],
    external: ['commander', 'chalk', '@inquirer/prompts'],

    banner: {
      js: cjsPolyfill,
    },
  },

  // Standalone scripts — compiled individually, deployed to user projects at runtime
  {
    entry: [
      'src/scripts/utils.mts',
      'src/scripts/render.mts',
      'src/scripts/status.mts',
      'src/scripts/init-sessions.mts',
    ],
    format: ['esm'],
    target: 'node20',
    platform: 'node',
    outDir: 'dist/scripts',
    clean: false,
    splitting: false,
    sourcemap: true,
    dts: false,

    // Scripts are standalone — only use Node.js built-ins, bundle nothing
    noExternal: [],
    external: [],

    // Preserve .mjs extension since these scripts reference each other as .mjs
    outExtension: () => ({ js: '.mjs' }),
  },
]);
