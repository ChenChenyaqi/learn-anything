export type ConceptStatus = 'mastered' | 'in_progress' | 'needs_practice' | 'unexplored';

export interface Concept {
  name: string;
  slug: string;
  status: ConceptStatus;
  confidence: number;
  practice_count: number;
  explain_count: number;
  last_explained: string | null;
  last_practiced: string | null;
  details: string[];
}

export interface Domain {
  name: string;
  slug: string;
  concepts: Concept[];
}

export interface StateV1 {
  version: 1;
  topic: string;
  slug: string;
  created: string;
  domains: Domain[];
}

export interface TopicSummary {
  slug: string;
  name: string;
  domainCount: number;
  totalConcepts: number;
  masteredCount: number;
  percentage: number;
}

export interface SessionFile {
  filename: string;
  path: string;
}

export interface ExerciseFile {
  name: string;
  path: string;
}

export interface ExerciseGroup {
  conceptSlug: string;
  conceptName: string;
  files: ExerciseFile[];
}

export interface SelectedFilePayload {
  path: string;
  type: 'markdown' | 'code';
  sourceTab?: 'topics' | 'exercises' | 'quizzes';
  /**
   * Filled in asynchronously after the file content loads.
   * The selection itself (path/type) is available synchronously.
   */
  content?: string;
}

export type OmitQuizSourceType = 'topics' | 'exercises';
