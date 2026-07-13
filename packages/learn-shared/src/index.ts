/**
 * @learn-anything/shared — single source of truth for learn-anything
 * workflow templates and standalone scripts.
 *
 * Consumed by:
 * - packages/cli     — skill/command file generation, script copying
 * - packages/gui/sidecar — inline prompt construction, app-data-dir script setup
 */

export * from './templates/index.js';
export {
  readScript,
  getScriptsDir,
  ALL_SCRIPT_NAMES,
  readFindDocsSkill,
  type ScriptName,
} from './script-access.js';
export {
  resolveInstructions,
  findPatternResolver,
  absolutePathResolver,
  type ScriptPathResolver,
  type ScriptInvocation,
} from './script-resolver.js';

// Re-export functions from standalone scripts that are also used
// programmatically (not just executed via `node script.mjs`).
export { render } from './scripts/render.mjs';

export {
  getSkillTemplateEntries,
  generateSkillContent,
  type SkillTemplateEntry,
} from './skill-content.js';

export {
  CONTEXT7_GUIDANCE,
  CONTEXT7_GUIDANCE_SKILL,
  isDocVerificationWorkflow,
  injectContext7Guidance,
  injectContext7GuidanceForSkill,
} from './context7-guidance.js';
