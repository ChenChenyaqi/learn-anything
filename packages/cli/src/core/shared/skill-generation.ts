import {
  getLearnTopicCommandTemplate,
  getLearnExplainCommandTemplate,
  getLearnPracticeCommandTemplate,
  getLearnReviewCommandTemplate,
  getLearnStatusCommandTemplate,
  getLearnQuizCommandTemplate,
  getSkillTemplateEntries,
  generateSkillContent,
} from '@learn-anything/shared';
import type { CommandContent } from '../command-generation/index.js';

// Re-export from shared package for backwards compatibility with CLI callers.
export { getSkillTemplateEntries as getSkillTemplates, generateSkillContent };
export type { SkillTemplateEntry } from '@learn-anything/shared';

export interface CommandTemplateEntry {
  template: ReturnType<typeof getLearnTopicCommandTemplate>;
  id: string;
}

export function getCommandTemplates(): CommandTemplateEntry[] {
  return [
    { template: getLearnTopicCommandTemplate(), id: 'topic' },
    { template: getLearnExplainCommandTemplate(), id: 'explain' },
    { template: getLearnPracticeCommandTemplate(), id: 'practice' },
    { template: getLearnReviewCommandTemplate(), id: 'review' },
    { template: getLearnStatusCommandTemplate(), id: 'status' },
    { template: getLearnQuizCommandTemplate(), id: 'quiz' },
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
