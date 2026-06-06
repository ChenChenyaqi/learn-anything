import {
  getLearnTopicSkillTemplate,
  getLearnExplainSkillTemplate,
  getLearnPracticeSkillTemplate,
  getLearnReviewSkillTemplate,
  getLearnStatusSkillTemplate,
  getLearnTopicCommandTemplate,
  getLearnExplainCommandTemplate,
  getLearnPracticeCommandTemplate,
  getLearnReviewCommandTemplate,
  getLearnStatusCommandTemplate,
  type SkillTemplate,
} from '../templates/skill-templates.js';
import type { CommandContent } from '../command-generation/index.js';
import type { DocUrlEntry } from '../config.js';

export interface SkillTemplateEntry {
  template: SkillTemplate;
  dirName: string;
  workflowId: string;
}

export interface CommandTemplateEntry {
  template: ReturnType<typeof getLearnTopicCommandTemplate>;
  id: string;
}

export function getSkillTemplates(): SkillTemplateEntry[] {
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
  ];
}

export function getCommandTemplates(): CommandTemplateEntry[] {
  return [
    { template: getLearnTopicCommandTemplate(), id: 'topic' },
    { template: getLearnExplainCommandTemplate(), id: 'explain' },
    { template: getLearnPracticeCommandTemplate(), id: 'practice' },
    { template: getLearnReviewCommandTemplate(), id: 'review' },
    { template: getLearnStatusCommandTemplate(), id: 'status' },
  ];
}

export function getCommandContents(): CommandContent[] {
  const commandTemplates = getCommandTemplates();
  return commandTemplates.map(({ template, id }) => ({
    id,
    name: template.name,
    description: template.description,
    category: template.category,
    tags: template.tags,
    body: template.content,
  }));
}

/**
 * Formats selected DocUrlEntries into a mandatory reference documentation section.
 * Used to replace the {{DOC_URLS}} placeholder in templates.
 */
export function buildDocUrlsSection(urls: Record<string, DocUrlEntry>): string {
  const entries = Object.entries(urls);
  if (entries.length === 0) {
    return '_(No mandatory documentation configured.)_';
  }
  return entries.map(([, entry]) => `- **${entry.name}**: ${entry.toc}`).join('\n');
}

/**
 * Returns the storage path string for replacing the {{DOCS_PATH}} placeholder.
 */
export function buildDocsPathSection(storagePath: string): string {
  return storagePath;
}

export function generateSkillContent(
  template: SkillTemplate,
  generatedByVersion: string,
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
  generatedBy: "${generatedByVersion}"
---

${instructions}
`;
}
