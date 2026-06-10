// Config
export { AI_TOOLS, LEARN_DIR } from './config.js';
export type { AIToolOption } from './config.js';

// Learn protocol
export {
  stateV1Schema,
  validateStateV1,
  generateSlug,
  parseKnowledgeMap,
  isV0State,
  migrateV0ToV1,
  migrateAll,
  render,
} from './learn-protocol/index.js';
export type {
  ConceptStatus,
  Concept,
  Domain,
  StateV1,
  Detail,
  V0Concept,
  V0State,
  ParsedConcept,
  ParsedDomain,
  ParsedKnowledgeMap,
  StateV1Schema,
  ValidationResult,
  MigrationResult,
  MigrationReport,
} from './learn-protocol/index.js';

// Templates
export {
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
} from './templates/skill-templates.js';
export type { SkillTemplate, CommandTemplate, CommandContent } from './templates/types.js';

// Shared (skill generation)
export {
  getSkillTemplates,
  getCommandTemplates,
  getCommandContents,
  generateSkillContent,
} from './shared/index.js';
export type { SkillTemplateEntry, CommandTemplateEntry } from './shared/index.js';

// i18n
export { getMessages, detectSystemLocale, resolveLocale } from './i18n/index.js';
export type { SupportedLocale, LocaleMessages, CLIMessages, InitMessages } from './i18n/types.js';

// Utils
export { FileSystemUtils } from './utils/file-system.js';
export { isInteractive } from './utils/interactive.js';

// Context7 guidance (used by skill generation)
export { CONTEXT7_GUIDANCE } from './templates/context7-guidance.js';
