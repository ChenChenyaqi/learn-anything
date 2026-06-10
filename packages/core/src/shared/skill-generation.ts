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
import type { CommandContent } from '../templates/types.js';

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
