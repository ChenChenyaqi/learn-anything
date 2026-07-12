/**
 * @learn-anything/shared — single source of truth for learn-anything
 * workflow templates and standalone scripts.
 *
 * Consumed by:
 * - packages/cli     — skill/command file generation, script copying
 * - packages/gui/sidecar — inline prompt construction, temp-dir script setup
 */

export * from './templates/index.js';
export { readScript, getScriptsDir, ALL_SCRIPT_NAMES, type ScriptName } from './script-access.js';

// Re-export functions from standalone scripts that are also used
// programmatically (not just executed via `node script.mjs`).
export { render } from './scripts/render.mjs';
