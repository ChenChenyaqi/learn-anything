/**
 * learn-skills — SKILL.md file generation + script setup for the pi agent.
 *
 * Instead of writing SKILL.md files to the user's `.pi/` directory (which
 * pollutes their project), we write them to the app's persistent data
 * directory and register the path via `resourceLoaderOptions.additionalSkillPaths`.
 *
 * The pi agent discovers the SKILL.md files at session startup, includes
 * their names + descriptions in the system prompt, and tells the agent to
 * use the read tool to load the full instructions when the user's request
 * matches a skill's description. This means the agent can proactively
 * invoke learn skills based on natural-language intent — users do NOT
 * need to type `/learn-*` slash commands.
 *
 * Standalone .mjs scripts are written to `<appDataDir>/scripts/` and
 * referenced via absolute paths in the SKILL.md instructions.
 */

import {
  readScript,
  ALL_SCRIPT_NAMES,
  readFindDocsSkill,
  resolveInstructions,
  absolutePathResolver,
  getSkillTemplateEntries,
  generateSkillContent,
  isDocVerificationWorkflow,
  injectContext7GuidanceForSkill,
} from '@learn-anything/shared';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/* ── script + skill setup ─────────────────────────────────────── */

/**
 * Write all compiled .mjs scripts to the app's persistent data directory
 * and return its absolute path. Called once at sidecar boot.
 *
 * Uses `appDataDir` (provided by the Tauri host via the boot frame) so
 * scripts survive across app restarts. Falls back to the OS temp dir
 * if `appDataDir` is empty (e.g. during integration tests).
 */
export function setupScriptsDir(appDataDir: string): string {
  const base = appDataDir || tmpdir();
  const dir = join(base, 'scripts');
  mkdirSync(dir, { recursive: true });
  for (const name of ALL_SCRIPT_NAMES) {
    writeFileSync(join(dir, `${name}.mjs`), readScript(name));
  }
  return dir;
}

/**
 * Write resolved SKILL.md files to `<appDataDir>/skills/<dirName>/SKILL.md`
 * and return the skills directory path.
 *
 * Each SKILL.md contains YAML frontmatter (name, description) + the full
 * workflow instructions with `{{LEARN_SCRIPT:...}}` placeholders resolved
 * to absolute paths pointing at `scriptsDir`.
 *
 * The pi agent scans this directory via `additionalSkillPaths` and
 * auto-discovers all skills at session startup.
 */
export function setupSkillFiles(appDataDir: string, scriptsDir: string): string {
  const base = appDataDir || tmpdir();
  const skillsDir = join(base, 'skills');

  for (const entry of getSkillTemplateEntries()) {
    const skillDir = join(skillsDir, entry.dirName);
    mkdirSync(skillDir, { recursive: true });
    const content = generateSkillContent(entry.template, 'gui-sidecar', (instr) => {
      const resolved = resolveInstructions(instr, absolutePathResolver(scriptsDir));
      return isDocVerificationWorkflow(entry.workflowId)
        ? injectContext7GuidanceForSkill(resolved)
        : resolved;
    });
    writeFileSync(join(skillDir, 'SKILL.md'), content);
  }

  // find-docs skill — Context7 documentation lookup via the ctx7 CLI.
  // No template; the SKILL.md content is read verbatim from the shared
  // package (copied at build time from src/skills/find-docs.md).
  const findDocsDir = join(skillsDir, 'find-docs');
  mkdirSync(findDocsDir, { recursive: true });
  writeFileSync(join(findDocsDir, 'SKILL.md'), readFindDocsSkill());

  return skillsDir;
}

/* ── slash-command helpers ────────────────────────────────────── */

const LEARN_COMMAND_PREFIX = 'learn-';
const LEARN_SKILL_PREFIX = 'learn-anything-';

/**
 * Quick check whether a parsed command name (without leading slash) is a
 * learn-* command, e.g. "learn-topic".
 */
export function isLearnCommand(commandName: string): boolean {
  return commandName.startsWith(LEARN_COMMAND_PREFIX);
}

/**
 * Convert a learn-* slash command name to the corresponding skill name.
 * e.g. "learn-topic" → "learn-anything-topic"
 */
export function commandToSkillName(commandName: string): string {
  return commandName.replace(LEARN_COMMAND_PREFIX, LEARN_SKILL_PREFIX);
}

/**
 * Build a natural-language instruction that tells the agent to invoke
 * a specific learn skill. The agent reads the SKILL.md file (whose path
 * is listed in the system prompt's `<available_skills>` block) and
 * follows the workflow instructions.
 */
export function buildLearnInstruction(commandName: string, args: string): string | null {
  if (!isLearnCommand(commandName)) return null;
  const skillName = commandToSkillName(commandName);
  const argPart = args ? ` for: ${args}` : '';
  return `Use the "${skillName}" skill${argPart}.`;
}
