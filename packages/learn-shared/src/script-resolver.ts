/**
 * script-resolver — resolve LEARN_SCRIPT placeholders in skill
 * instructions to platform-specific bash invocations.
 *
 * The workflow templates use a single placeholder format so that
 * different consumers (CLI, sidecar) can inject their own script
 * invocation strategy without fragile regex on the final text.
 *
 * Placeholder syntax (single line):
 *   LEARN_SCRIPT colon scriptName space args, wrapped in double braces
 *
 * CLI resolves to a two-line find-and-run pattern using the find
 * command to locate the script inside the skill directory.
 *
 * Sidecar resolves to a one-liner with an absolute app-data-dir path.
 */

import { join } from 'node:path';

export interface ScriptInvocation {
  /** script name without extension, e.g. "render", "validate-quiz" */
  scriptName: string;
  /** arguments after the script name, e.g. "./.learn/topics/javascript" */
  args: string;
}

/** Transforms a script invocation into a bash code snippet. */
export type ScriptPathResolver = (invocation: ScriptInvocation) => string;

/**
 * CLI resolver — generates a two-line find-and-run pattern.
 *
 * The AI uses `find` to locate the script inside the skill's `scripts/`
 * directory (written there by `learn-anything init`).
 *
 * @param skillDir - e.g. "learn-anything-topic"
 */
export function findPatternResolver(skillDir: string): ScriptPathResolver {
  return ({ scriptName, args }) => {
    const varName = 'SCRIPT';
    const findPath = `*/${skillDir}/scripts/${scriptName}.mjs`;
    return `SCRIPT=$(find . -path '${findPath}' -print -quit 2>/dev/null)\nnode "$${varName}"${args ? ' ' + args : ''}`;
  };
}

/**
 * Sidecar resolver — generates a one-liner with an absolute path.
 *
 * Scripts are written to an app-data directory at boot, so the AI can
 * invoke them directly without `find`.
 *
 * @param scriptsDir - absolute path to the app-data scripts directory
 */
export function absolutePathResolver(scriptsDir: string): ScriptPathResolver {
  return ({ scriptName, args }) => {
    const absPath = join(scriptsDir, `${scriptName}.mjs`);
    return `node "${absPath}"${args ? ' ' + args : ''}`;
  };
}

const PLACEHOLDER_RE = /\{\{LEARN_SCRIPT:([\w-]+)(?:[ \t]+([^\n]*?))?\}\}/g;

/**
 * Replace all {{LEARN_SCRIPT:...}} placeholders in instruction text
 * using the provided resolver.
 */
export function resolveInstructions(instructions: string, resolver: ScriptPathResolver): string {
  return instructions.replace(PLACEHOLDER_RE, (_match, scriptName: string, args?: string) => {
    return resolver({ scriptName, args: (args ?? '').trim() });
  });
}
