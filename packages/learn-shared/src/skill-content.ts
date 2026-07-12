/**
 * Skill content generation — shared between CLI (writes SKILL.md to .pi/)
 * and sidecar (writes SKILL.md to app-data-dir for pi agent auto-discovery).
 */

import type { SkillTemplate } from './templates/types.js';
import {
  getLearnTopicSkillTemplate,
  getLearnExplainSkillTemplate,
  getLearnPracticeSkillTemplate,
  getLearnReviewSkillTemplate,
  getLearnStatusSkillTemplate,
  getLearnQuizSkillTemplate,
} from './templates/index.js';

export interface SkillTemplateEntry {
  template: SkillTemplate;
  /** Directory name for the skill, e.g. "learn-anything-topic". */
  dirName: string;
  /** Workflow identifier, e.g. "topic". */
  workflowId: string;
}

/**
 * All six learn-anything skill templates with their directory names.
 * Single source of truth — used by both CLI and sidecar.
 */
export function getSkillTemplateEntries(): SkillTemplateEntry[] {
  return [
    {
      template: getLearnTopicSkillTemplate(),
      dirName: 'learn-anything-topic',
      workflowId: 'topic',
    },
    {
      template: getLearnExplainSkillTemplate(),
      dirName: 'learn-anything-explain',
      workflowId: 'explain',
    },
    {
      template: getLearnPracticeSkillTemplate(),
      dirName: 'learn-anything-practice',
      workflowId: 'practice',
    },
    {
      template: getLearnReviewSkillTemplate(),
      dirName: 'learn-anything-review',
      workflowId: 'review',
    },
    {
      template: getLearnStatusSkillTemplate(),
      dirName: 'learn-anything-status',
      workflowId: 'status',
    },
    { template: getLearnQuizSkillTemplate(), dirName: 'learn-anything-quiz', workflowId: 'quiz' },
  ];
}

/**
 * Generate SKILL.md file content with YAML frontmatter.
 *
 * @param template   Skill template (name, description, instructions, ...)
 * @param generatedBy Version string identifying who generated the file
 * @param transformInstructions Optional transform applied to instructions
 *   (e.g. to resolve `{{LEARN_SCRIPT:...}}` placeholders).
 */
export function generateSkillContent(
  template: SkillTemplate,
  generatedBy: string,
  transformInstructions?: (instructions: string) => string,
): string {
  const instructions = transformInstructions
    ? transformInstructions(template.instructions)
    : template.instructions;

  return `---
name: ${template.name}
description: ${template.description}
license: ${template.license || 'MIT'}
compatibility: ${template.compatibility || 'Requires learn-anything CLI.'}
metadata:
  author: ${template.metadata?.author || 'learn-anything'}
  version: "${template.metadata?.version || '1.0'}"
  generatedBy: "${generatedBy}"
---

${instructions}
`;
}
